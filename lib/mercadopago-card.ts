/**
 * Reglas puras del pago con tarjeta (Card Payment Brick → POST /v1/payments). Sin `server-only`
 * para poder probarlas sin red ni base. El servidor nunca toma del navegador el monto, la referencia,
 * el email ni datos crudos de la tarjeta: solo el token de un solo uso y lo que el Brick eligió.
 */
import { createHash } from "node:crypto";

/** Error de la API de Mercado Pago con el status HTTP (0 = sin conexión). El mensaje nunca incluye datos del pago. */
export class MercadoPagoApiError extends Error {
  constructor(public readonly status: number) { super("No pudimos comunicarnos con Mercado Pago. Reintentá con el mismo pedido."); this.name = "MercadoPagoApiError"; }
}
/** Error con mensaje apto para mostrar al comprador (validación previa al cobro: no se llamó a Mercado Pago). */
export class CardPaymentError extends Error { name = "CardPaymentError"; }

export type CardChoice = "debit_card" | "credit_card";
export const CARD_CHOICES: readonly CardChoice[] = ["debit_card", "credit_card"];
export const isCardChoice = (value: unknown): value is CardChoice => value === "debit_card" || value === "credit_card";

/** Tope técnico de Mercado Pago; el negocio puede bajarlo con `commerce.maxCardInstallments`. */
export const MAX_PROVIDER_INSTALLMENTS = 48;
/** Tipos de documento del Brick para Argentina (MLA). */
const IDENTIFICATION_TYPES = new Set(["DNI", "CI", "LC", "LE", "Otro", "CUIT", "CUIL"]);

export type CardSubmission = {
  token: string;
  paymentMethodId: string;
  installments: number;
  issuerId?: string;
  identification?: { type: string; number: string };
};
export type CardParseResult = { ok: true; value: CardSubmission } | { ok: false; error: string };

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Número entero positivo que puede llegar como número o como texto numérico desde el Brick. */
function positiveInteger(value: unknown) {
  const number = typeof value === "string" && /^\d{1,3}$/.test(value) ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Tipos que el Card Payment Brick NO debe ofrecer. La documentación del Brick configura los tipos por exclusión
 * (`customization.paymentMethods.types.excluded`: credit_card, debit_card, prepaid_card). Las prepagas
 * (Ualá, Mercado Pago, etc.) se cobran en un pago, como el débito: se aceptan en «Tarjeta de débito».
 */
export function excludedCardTypes(choice: CardChoice): string[] {
  return choice === "debit_card" ? ["credit_card"] : ["debit_card", "prepaid_card"];
}
/** Tipo informado por el Brick (según el BIN) compatible con la opción elegida en el checkout. */
export const cardTypeMatches = (choice: CardChoice, paymentType: string) => paymentType === choice || (choice === "debit_card" && paymentType === "prepaid_card");

export function maxInstallmentsFor(choice: CardChoice, configured: number | null) {
  if (choice === "debit_card") return 1;
  return configured && Number.isInteger(configured) && configured >= 1 ? Math.min(configured, MAX_PROVIDER_INSTALLMENTS) : MAX_PROVIDER_INSTALLMENTS;
}

/**
 * Lista permitida de lo que envía el Brick (`formData`) y su `additionalData`. Rechaza en lugar de corregir:
 * si el comprador eligió 6 cuotas y el servidor cobrara 1, el importe de cada cuota cambiaría sin que lo vea.
 */
export function parseCardSubmission(rawFormData: unknown, rawAdditional: unknown, choice: CardChoice, configuredMax: number | null): CardParseResult {
  const value = record(rawFormData);
  const additional = record(rawAdditional);
  const token = typeof value.token === "string" && /^[A-Za-z0-9_-]{8,256}$/.test(value.token) ? value.token : null;
  if (!token) return { ok: false, error: "La tarjeta debe ser validada por Mercado Pago. Volvé a ingresar los datos." };
  const paymentMethodId = typeof value.payment_method_id === "string" && /^[a-z0-9_-]{2,40}$/i.test(value.payment_method_id) ? value.payment_method_id : null;
  if (!paymentMethodId) return { ok: false, error: "No reconocimos el medio de pago. Volvé a ingresar la tarjeta." };
  // El Brick informa el tipo real de la tarjeta según su BIN. Si no coincide con lo elegido, se avisa antes de cobrar.
  const paymentType = typeof additional.paymentTypeId === "string" ? additional.paymentTypeId : typeof value.payment_type_id === "string" ? value.payment_type_id : null;
  if (paymentType && !cardTypeMatches(choice, paymentType)) {
    return { ok: false, error: choice === "debit_card" ? "Esa tarjeta no es de débito. Para este pedido usá una tarjeta de débito." : "Esa tarjeta no es de crédito. Para este pedido usá una tarjeta de crédito." };
  }
  const installments = value.installments === undefined || value.installments === null ? 1 : positiveInteger(value.installments);
  const max = maxInstallmentsFor(choice, configuredMax);
  if (!installments || installments > max) return { ok: false, error: choice === "debit_card" ? "La tarjeta de débito se paga en una sola cuota." : `Elegí entre 1 y ${max} cuotas.` };
  const issuer = typeof value.issuer_id === "number" && Number.isInteger(value.issuer_id) ? String(value.issuer_id) : value.issuer_id;
  const issuerId = typeof issuer === "string" && /^\d{1,20}$/.test(issuer) ? issuer : undefined;
  const id = record(record(value.payer).identification);
  const idNumber = typeof id.number === "number" ? String(id.number) : id.number;
  const identification = typeof id.type === "string" && IDENTIFICATION_TYPES.has(id.type) && typeof idNumber === "string" && /^[A-Za-z0-9.-]{3,20}$/.test(idNumber)
    ? { type: id.type, number: idNumber.replace(/[.-]/g, "") } : undefined;
  return { ok: true, value: { token, paymentMethodId, installments, issuerId, identification } };
}

/**
 * Clave de idempotencia por intento: el mismo token (reintento de red o doble click) devuelve el mismo pago;
 * un token nuevo (otra tarjeta después de un rechazo) crea un intento nuevo. Una clave fija por pedido haría
 * que Mercado Pago devolviera el rechazo anterior para siempre.
 */
export function cardIdempotencyKey(paymentRowId: string, token: string) {
  return `card-${paymentRowId}-${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
}

/** Nombre y apellido para `payer`; Mercado Pago los usa en su análisis de riesgo. */
export function splitPayerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { first_name: (parts[0] ?? "").slice(0, 60), last_name: (parts.slice(1).join(" ") || parts[0] || "").slice(0, 60) };
}

export type CardOutcome = "approved" | "pending" | "rejected";

/** Mensajes para el comprador según `status_detail` (documentación de Mercado Pago, Checkout API). */
const rejectionMessages: Record<string, string> = {
  cc_rejected_3ds_challenge: "Tu banco no pudo validar la compra. Reintentá completando la verificación o probá con otra tarjeta.",
  cc_rejected_3ds_mandatory: "Tu banco exige una verificación adicional que no se pudo completar. Probá con otra tarjeta.",
  cc_rejected_bad_filled_card_number: "Revisá el número de la tarjeta.",
  cc_rejected_bad_filled_date: "Revisá la fecha de vencimiento.",
  cc_rejected_bad_filled_other: "Revisá los datos de la tarjeta.",
  cc_rejected_bad_filled_security_code: "Revisá el código de seguridad.",
  cc_rejected_blacklist: "No pudimos procesar el pago con esta tarjeta. Probá con otro medio.",
  cc_rejected_call_for_authorize: "Tu banco necesita que autorices el pago. Llamá al número que figura en tu tarjeta y volvé a intentarlo.",
  cc_rejected_card_disabled: "La tarjeta está inactiva. Llamá a tu banco para activarla o usá otra tarjeta.",
  cc_rejected_card_error: "No pudimos procesar el pago con esta tarjeta. Probá con otra.",
  cc_rejected_duplicated_payment: "Ya hiciste un pago por este importe. Si necesitás volver a pagar, usá otra tarjeta u otro medio.",
  cc_rejected_high_risk: "El pago fue rechazado por seguridad. Probá con otra tarjeta u otro medio de pago.",
  cc_rejected_insufficient_amount: "La tarjeta no tiene saldo o límite suficiente. Probá con otra.",
  cc_rejected_invalid_installments: "La tarjeta no acepta esa cantidad de cuotas. Elegí otra opción.",
  cc_rejected_max_attempts: "Llegaste al límite de intentos con esta tarjeta. Probá con otra.",
  cc_rejected_card_type_not_allowed: "Ese tipo de tarjeta no está habilitado para este pago. Probá con otra.",
  cc_rejected_other_reason: "Tu banco rechazó el pago. Probá con otra tarjeta u otro medio.",
  cc_amount_rate_limit_exceeded: "La tarjeta superó su límite. Probá con otra.",
  rejected_high_risk: "El pago fue rechazado por seguridad. Probá con otra tarjeta u otro medio de pago.",
  rejected_by_issuer: "Tu banco rechazó el pago. Probá con otra tarjeta.",
};

export function cardStatusMessage(status: string, detail: string | null | undefined): { outcome: CardOutcome; message: string } {
  if (status === "approved") return { outcome: "approved", message: "¡Listo! Tu pago fue aprobado." };
  if (status === "in_process" || status === "pending" || status === "authorized") {
    if (detail === "pending_challenge") return { outcome: "pending", message: "Tu banco necesita verificar el pago. Completá la verificación para terminar." };
    if (detail === "pending_review_manual") return { outcome: "pending", message: "Estamos revisando tu pago. Te avisamos por email en menos de 2 días hábiles si se aprobó o si necesitamos que pagues de otra forma. No vuelvas a pagar este pedido." };
    return { outcome: "pending", message: "Tu pago está en proceso. Te avisamos por email cuando se acredite. No vuelvas a pagar este pedido." };
  }
  const reason = (detail && rejectionMessages[detail]) || "Tu pago fue rechazado. Probá con otra tarjeta u otro medio de pago.";
  return { outcome: "rejected", message: `${reason} El pedido sigue reservado: podés reintentar acá mismo.` };
}
