import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { orderEmails, orderItems, orders, payments } from "./db/schema";
import { withOrderTransaction } from "./db/transaction";
import { cardThreeDsMode, getCheckoutConfig, orderPageUrl, paymentNotificationUrl, siteUrl } from "./checkout-config";
import { readMercadoPagoTestMode } from "./checkout-env";
import { providerStatus } from "./order-state";
import { transitionOrder } from "./order-service";
import { commerce } from "./commerce";
import { CardPaymentError, cardIdempotencyKey, excludedCardTypes, cardStatusMessage, isCardChoice, maxInstallmentsFor, MercadoPagoApiError, parseCardSubmission, splitPayerName, type CardOutcome } from "./mercadopago-card";

export { CardPaymentError, MercadoPagoApiError } from "./mercadopago-card";

type ProviderPayment = { id: number; external_reference: string; transaction_amount: number; currency_id: string;
  status: string; status_detail?: string; payment_type_id?: string; date_last_updated: string;
  transaction_details?: { external_resource_url?: string };
  three_ds_info?: { external_resource_url?: string; creq?: string } };
/** Un intento fallido (rechazado o cancelado) no cierra el pedido: el comprador puede reintentar. */
export const isFailedAttempt = (status: string | null | undefined) => status === "rejected" || status === "cancelled";
type ProviderMerchantOrder = { id: number; external_reference: string; preference_id: string;
  payments?: { id: number; status: string }[] };
type PaymentChannel = "card" | "checkout_pro";

function accessTokenFor(channel: PaymentChannel) {
  // En Production ambos medios usan la aplicación del propietario aunque se haya copiado
  // por error una variable adicional desde Preview.
  return (channel === "checkout_pro" && process.env.VERCEL_ENV !== "production" ? process.env.MP_CHECKOUT_PRO_ACCESS_TOKEN : undefined)?.trim()
    || process.env.MP_ACCESS_TOKEN?.trim();
}

async function request<T>(path: string, body?: object, key?: string, channel: PaymentChannel = "card", quietAuthMiss = false): Promise<T> {
  let response: Response;
  const accessToken = accessTokenFor(channel);
  if (!accessToken) throw new MercadoPagoApiError(401);
  try {
    response = await fetch(`https://api.mercadopago.com${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(key ? { "X-Idempotency-Key": key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error("[Mercado Pago] No se pudo conectar con la API", { method: body ? "POST" : "GET", path, name });
    throw new MercadoPagoApiError(0);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const causes = Array.isArray(payload.cause)
      ? payload.cause.slice(0, 3).map((cause) => {
        const item = cause && typeof cause === "object" ? cause as Record<string, unknown> : {};
        return { code: item.code };
      })
      : undefined;
    const message = typeof payload.message === "string" ? payload.message.slice(0, 160) : undefined;
    if (!quietAuthMiss || ![401, 403, 404].includes(response.status)) {
      console.error("[Mercado Pago] La API rechazó la solicitud", {
        method: body ? "POST" : "GET", path, status: response.status,
        error: payload.error, message, causes,
      });
    }
    throw new MercadoPagoApiError(response.status, (causes ?? []).map((cause) => cause.code as string | number).filter((code) => code !== undefined), message);
  }
  return response.json() as Promise<T>;
}

/** Los pedidos anteriores pueden pertenecer al otro juego de credenciales de prueba. */
async function requestWithFallback<T>(path: string, preferred: PaymentChannel) {
  const other: PaymentChannel = preferred === "card" ? "checkout_pro" : "card";
  if (accessTokenFor(preferred) === accessTokenFor(other)) return request<T>(path, undefined, undefined, preferred);
  try {
    return await request<T>(path, undefined, undefined, preferred, true);
  } catch (error) {
    if (!(error instanceof MercadoPagoApiError) || ![401, 403, 404].includes(error.status)) throw error;
    return request<T>(path, undefined, undefined, other);
  }
}

/** El vendedor de prueba de Checkout Pro usa init_point; TEST- mantiene el sandbox solo para compatibilidad. */
export function checkoutUrl(preference: { init_point: string; sandbox_init_point?: string }, accessToken = process.env.MP_ACCESS_TOKEN) {
  return accessToken?.trim().startsWith("TEST-") && preference.sandbox_init_point ? preference.sandbox_init_point : preference.init_point;
}

export function safePaymentUrl(raw: string | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const allowed = ["mercadopago.com", "mercadopago.com.ar", "mercadolibre.com", "mercadolibre.com.ar"];
    return url.protocol === "https:" && allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch { return null; }
}

export async function paymentSetup(order: typeof orders.$inferSelect) {
  let stage = "eligibility";
  try {
    if (order.isDemo || order.paymentMethod !== "mercadopago" || isCardChoice(order.paymentChoice) || order.status !== "pending" || !getCheckoutConfig().payments.mercadopago) throw new Error("Pago no disponible.");
    // Las credenciales TEST- de Card Brick identifican a la cuenta real como vendedora.
    // El Checkout Pro de prueba necesita la credencial de su vendedor de prueba.
    if (accessTokenFor("card")?.startsWith("TEST-") && !process.env.MP_CHECKOUT_PRO_ACCESS_TOKEN?.trim()) {
      throw new Error("Falta MP_CHECKOUT_PRO_ACCESS_TOKEN para probar Checkout Pro con tarjetas TEST-.");
    }
    if (accessTokenFor("card")?.startsWith("TEST-") && accessTokenFor("checkout_pro")?.startsWith("TEST-")) {
      throw new Error("Checkout Pro necesita la credencial del vendedor de prueba, no la TEST- de tarjetas.");
    }
    const testingCheckoutPro = accessTokenFor("card")?.startsWith("TEST-") === true;
    if (testingCheckoutPro) {
      const expectedSellerId = process.env.MP_CHECKOUT_PRO_TEST_SELLER_ID?.trim();
      if (!expectedSellerId || !/^\d{1,30}$/.test(expectedSellerId)) {
        throw new Error("Falta el ID del vendedor de prueba de Checkout Pro.");
      }
      const seller = await request<{ id: number }>("/users/me", undefined, undefined, "checkout_pro");
      if (String(seller.id) !== expectedSellerId) {
        throw new Error("La credencial de Checkout Pro no pertenece al vendedor de prueba configurado.");
      }
      const cardCredentialOwner = await request<{ id: number }>("/users/me", undefined, undefined, "card");
      if (seller.id === cardCredentialOwner.id) {
        throw new Error("Checkout Pro no puede usar la misma cuenta vendedora real que las tarjetas de prueba.");
      }
    }
    const notificationUrl = paymentNotificationUrl();
    if (!notificationUrl) throw new Error("El webhook de Mercado Pago no está disponible en este entorno.");
    stage = "payment_record";
    return await withOrderTransaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id)).for("update");
      // Con un pago en curso o aprobado no se ofrece pagar de nuevo; tras un rechazo sí.
      if (!payment || (payment.providerId && !isFailedAttempt(payment.status))) throw new Error("Pago no disponible.");
      let preferenceId = payment.preferenceId;
      let initPoint: string | undefined;
      if (!preferenceId) {
        stage = "preference_create";
        // Incluye el link firmado: la vuelta desde la app de Mercado Pago puede abrir otro navegador sin la cookie.
        const returnUrl = orderPageUrl(order.id) ?? `${siteUrl()}/checkout/confirmacion/${order.id}`;
        const preference = await request<{ id: string; init_point: string; sandbox_init_point?: string }>("/checkout/preferences", {
          items: [{ id: order.id, title: "Pedido QuilGym", quantity: 1, unit_price: order.totalArs, currency_id: "ARS" }],
          // En la prueba el comprador inicia sesión con su cuenta de prueba de MP,
          // que puede ser distinta del email de su pedido en QuilGym.
          ...(testingCheckoutPro ? {} : { payer: { email: order.email } }), external_reference: order.id,
          ...(order.paymentChoice === "mercado_credito" ? { purpose: "onboarding_credits" } : {}),
          ...(order.paymentChoice === "mercadopago" ? { payment_methods: { excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "prepaid_card" }, { id: "ticket" }] } } : {}),
          notification_url: notificationUrl,
          back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
          auto_return: "approved",
        }, payment.id, "checkout_pro");
        preferenceId = preference.id;
        initPoint = checkoutUrl(preference, accessTokenFor("checkout_pro"));
        stage = "preference_save";
        await tx.update(payments).set({ preferenceId }).where(eq(payments.id, payment.id));
      } else {
        stage = "preference_load";
        const preference = await request<{ init_point: string; sandbox_init_point?: string }>(`/checkout/preferences/${encodeURIComponent(preferenceId)}`, undefined, undefined, "checkout_pro");
        initPoint = checkoutUrl(preference, accessTokenFor("checkout_pro"));
      }
      stage = "payment_url";
      const safeInitPoint = safePaymentUrl(initPoint);
      if (!safeInitPoint) throw new Error("Mercado Pago no devolvió un enlace de pago seguro.");
      return { publicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!, preferenceId, initPoint: safeInitPoint, amount: order.totalArs, email: order.email };
    });
  } catch (error) {
    const value = error && typeof error === "object" ? error as { name?: unknown; code?: unknown; status?: unknown } : {};
    const knownReason = error instanceof Error && ["Pago no disponible.", "Mercado Pago no devolvió un enlace de pago seguro.", "El webhook de Mercado Pago no está disponible en este entorno.",
      "Falta MP_CHECKOUT_PRO_ACCESS_TOKEN para probar Checkout Pro con tarjetas TEST-.",
      "Checkout Pro necesita la credencial del vendedor de prueba, no la TEST- de tarjetas.",
      "Falta el ID del vendedor de prueba de Checkout Pro.",
      "La credencial de Checkout Pro no pertenece al vendedor de prueba configurado.",
      "Checkout Pro no puede usar la misma cuenta vendedora real que las tarjetas de prueba."].includes(error.message)
      ? error.message : undefined;
    console.error("[Mercado Pago] No se pudo configurar la preferencia", {
      stage,
      reason: knownReason,
      name: typeof value.name === "string" ? value.name : "UnknownError",
      code: typeof value.code === "string" || typeof value.code === "number" ? value.code : undefined,
      status: typeof value.status === "number" ? value.status : undefined,
    });
    throw error;
  }
}

/** Datos públicos para montar el Card Payment Brick. El monto lo fija el servidor y se vuelve a fijar al cobrar. */
export async function cardPaymentSetup(order: typeof orders.$inferSelect) {
  if (order.isDemo || order.paymentMethod !== "mercadopago" || !isCardChoice(order.paymentChoice) || order.status !== "pending" || !getCheckoutConfig().payments.mercadopago) throw new Error("Pago no disponible.");
  const [payment] = await db.select().from(payments).where(eq(payments.orderId, order.id)).limit(1);
  if (!payment || (payment.providerId && !isFailedAttempt(payment.status))) throw new Error("Pago no disponible.");
  const testMode = readMercadoPagoTestMode(process.env);
  return { publicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!, amount: order.totalArs, email: order.email, testMode,
    paymentType: order.paymentChoice, excludedTypes: excludedCardTypes(order.paymentChoice), maxInstallments: maxInstallmentsFor(order.paymentChoice, commerce.maxCardInstallments) };
}

export type CardPaymentResult = { outcome: CardOutcome; message: string; paymentId: string;
  challenge: { externalResourceUrl: string; creq: string } | null };

/**
 * Cobra con el token del Card Payment Brick. Lista permitida: descarta cualquier monto, referencia o dato crudo
 * enviado por el navegador. Un rechazo deja el pedido pendiente para reintentar con otra tarjeta; un pago en
 * proceso o aprobado bloquea nuevos intentos. La conciliación vuelve a consultar el pago y valida ID/importe.
 */
export async function submitProviderPayment(order: typeof orders.$inferSelect, rawFormData: unknown, rawAdditional?: unknown): Promise<CardPaymentResult> {
  if (order.isDemo || order.paymentMethod !== "mercadopago" || !isCardChoice(order.paymentChoice) || order.status !== "pending" || !getCheckoutConfig().payments.mercadopago) throw new CardPaymentError("Este pedido ya no admite pagos con tarjeta.");
  const notificationUrl = paymentNotificationUrl();
  if (!notificationUrl) throw new CardPaymentError("El pago con tarjeta no está disponible en este entorno.");
  const parsed = parseCardSubmission(rawFormData, rawAdditional, order.paymentChoice, commerce.maxCardInstallments);
  if (!parsed.ok) throw new CardPaymentError(parsed.error);
  const [payment] = await db.select().from(payments).where(eq(payments.orderId, order.id));
  if (!payment) throw new CardPaymentError("Pedido no disponible.");
  if (payment.providerId && !isFailedAttempt(payment.status)) {
    // Ya hay un pago en proceso o aprobado: no se cobra otra vez; se informa el estado real.
    await reconcileProviderPayment(payment.providerId, "card");
    const [current] = await db.select().from(payments).where(eq(payments.orderId, order.id));
    return { ...cardStatusMessage(current?.status === "approved" ? "approved" : "in_process", null), paymentId: payment.providerId, challenge: null };
  }
  const card = parsed.value;
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id));
  const payer = splitPayerName(order.name);
  const threeDs = cardThreeDsMode();
  const result = await request<ProviderPayment>("/v1/payments", {
    transaction_amount: order.totalArs, description: `Pedido QuilGym QG-${order.id.slice(0, 8).toUpperCase()}`, external_reference: order.id,
    notification_url: notificationUrl,
    payment_method_id: card.paymentMethodId, token: card.token, installments: card.installments,
    ...(card.issuerId ? { issuer_id: card.issuerId } : {}),
    payer: { email: order.email, ...payer, ...(card.identification ? { identification: card.identification } : {}) },
    // Información que Mercado Pago recomienda para su análisis de riesgo. No incluye datos de tarjeta.
    additional_info: {
      items: lines.slice(0, 50).map((line) => ({ id: line.sku, title: line.name.slice(0, 120), quantity: line.quantity, unit_price: line.unitPriceArs })),
      payer: { ...payer, phone: { number: order.phone.replace(/\D/g, "").slice(-12) } },
    },
    ...(threeDs ? { three_d_secure_mode: threeDs } : {}),
  }, cardIdempotencyKey(payment.id, card.token));
  if (!result || !/^\d{1,30}$/.test(String(result.id))) throw new Error("Respuesta de pago inválida.");
  // La conciliación bloquea la orden y verifica ID/importe antes de guardar el vínculo.
  await reconcileProviderPayment(String(result.id), "card");
  const info = result.three_ds_info;
  const challenge = result.status_detail === "pending_challenge" && info?.creq && info.external_resource_url && /^https:\/\//.test(info.external_resource_url)
    ? { externalResourceUrl: info.external_resource_url, creq: info.creq } : null;
  return { ...cardStatusMessage(result.status, result.status_detail), paymentId: String(result.id), challenge };
}

export async function reconcileProviderPayment(id: string, channel?: PaymentChannel) {
  if (!/^\d{1,30}$/.test(id) || !process.env.MP_ACCESS_TOKEN) throw new Error("Pago inválido.");
  // Los webhooks solo incluyen el ID: un pago ya conocido conserva el canal del pedido.
  // Para uno nuevo se prueba primero Checkout Pro y luego tarjetas si la API no reconoce ese ID.
  const [known] = channel ? [] : await db.select({ paymentChoice: orders.paymentChoice }).from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId)).where(eq(payments.providerId, id)).limit(1);
  const preferred = channel ?? (known && isCardChoice(known.paymentChoice) ? "card" : "checkout_pro");
  const payment = preferred === "card"
    ? await request<ProviderPayment>(`/v1/payments/${id}`)
    : await requestWithFallback<ProviderPayment>(`/v1/payments/${id}`, "checkout_pro");
  const updated = new Date(payment.date_last_updated);
  if (String(payment.id) !== id || !Number.isFinite(updated.getTime())) throw new Error("Respuesta de pago inválida.");
  return withOrderTransaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.external_reference)).for("update");
    if (!order) return null;
    if (order.isDemo || order.paymentMethod !== "mercadopago" || payment.currency_id !== "ARS" || payment.transaction_amount !== order.totalArs) throw new Error("El pago no coincide con el pedido.");
    const [stored] = await tx.select().from(payments).where(eq(payments.orderId, order.id)).for("update");
    const status = providerStatus(payment.status);
    const failed = isFailedAttempt(status);
    if (stored.providerId && stored.providerId !== id) {
      // Se puede reintentar con otro pago (Checkout Pro o tarjeta): un intento fallido se reemplaza por el nuevo;
      // un fallido tardío no pisa un pago en curso o aprobado; entre dos fallidos queda el más reciente.
      if (failed && (!isFailedAttempt(stored.status) || (stored.providerUpdatedAt && stored.providerUpdatedAt >= updated))) return order.id;
      if (stored.status === "approved" || stored.status === "refunded") {
        console.error("[Mercado Pago] Segundo pago sobre un pedido ya cobrado", { order: order.id.slice(0, 8), payment: id, stored: stored.providerId });
        throw new Error("El pedido ya tiene otro pago asociado.");
      }
    } else if (stored.providerUpdatedAt && stored.providerUpdatedAt >= updated) return order.id;
    const record = { providerId: id, providerUpdatedAt: updated, ticketUrl: safePaymentUrl(payment.transaction_details?.external_resource_url), status };
    if (failed && order.status === "pending") {
      // Rechazo o cancelación de un intento: el pedido sigue pendiente y reservado hasta vencer (PENDING_ORDER_TTL_HOURS),
      // así el comprador puede reintentar con otra tarjeta o medio. Se avisa por email una sola vez por pedido.
      await tx.update(payments).set(record).where(eq(payments.id, stored.id));
      if (!order.isDemo) await tx.insert(orderEmails).values({ orderId: order.id, event: "payment_rejected" }).onConflictDoNothing();
      return order.id;
    }
    if (await transitionOrder(tx, order, status)) await tx.update(payments).set(record).where(eq(payments.id, stored.id));
    else {
      // El pedido ya cerró (p. ej., cancelado por vencimiento): se registra el estado real del proveedor para que el
      // panel muestre «Pago aprobado sobre pedido cancelado» en vez de perder el cobro.
      await tx.update(payments).set({ ...record, status }).where(eq(payments.id, stored.id));
      if (status === "approved") console.error("[Mercado Pago] Pago aprobado sobre un pedido cerrado", { order: order.id.slice(0, 8), status: order.status, payment: id });
    }
    return order.id;
  });
}

/** IPN no trae firma verificable: solo se usa su ID para consultar la API autenticada. */
export async function reconcileProviderMerchantOrder(id: string) {
  if (!/^\d{1,30}$/.test(id) || !process.env.MP_ACCESS_TOKEN) throw new Error("Orden comercial inválida.");
  const merchantOrder = await requestWithFallback<ProviderMerchantOrder>(`/merchant_orders/${id}`, "checkout_pro");
  if (String(merchantOrder.id) !== id || !merchantOrder.external_reference || !merchantOrder.preference_id) throw new Error("Respuesta de orden comercial inválida.");
  const [order] = await db.select().from(orders).where(eq(orders.id, merchantOrder.external_reference));
  if (!order || order.isDemo || order.paymentMethod !== "mercadopago") return null;
  const [stored] = await db.select().from(payments).where(eq(payments.orderId, order.id));
  if (!stored || !stored.preferenceId || stored.preferenceId !== merchantOrder.preference_id) throw new Error("La orden comercial no coincide con la preferencia.");
  const candidates = Array.isArray(merchantOrder.payments) ? merchantOrder.payments : [];
  if (candidates.length > 20) throw new Error("Orden comercial con demasiados pagos.");
  // Un intento aprobado prevalece sobre los rechazados anteriores. El detalle
  // final siempre se vuelve a consultar en /v1/payments y se valida allí.
  const selected = candidates.find((item) => item.status === "approved")
    ?? candidates.find((item) => String(item.id) === stored.providerId)
    ?? candidates.at(-1);
  if (!selected || !/^\d{1,30}$/.test(String(selected.id))) return null;
  return reconcileProviderPayment(String(selected.id), "checkout_pro");
}
