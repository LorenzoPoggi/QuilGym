import type { CheckoutInput, CheckoutConfig, DeliveryMethod } from "./checkout-types";
import { parseTaxId } from "./invoicing-config";
import { LOCAL_DELIVERY_ESTIMATE, LOCAL_DELIVERY_LABEL } from "./delivery-labels";

export const POSTAL_CODE_PATTERN = /^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizePostalCode(value: string) {
  return value.trim().toUpperCase().replace(/\s/g, "");
}

/** Mismo contrato para cliente y servidor; nunca acepta precios ni IDs de otro carrito. */
export function validateCheckout(raw: unknown): { ok: true; value: CheckoutInput } | { ok: false; fields: Record<string, string> } {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const fields: Record<string, string> = {};
  const text = (key: string, min: number, max: number) => {
    const value = typeof input[key] === "string" ? input[key].trim() : "";
    if (value.length < min || value.length > max || /[\u0000-\u001f]/.test(value)) fields[key] = `Completá este campo (${min}–${max} caracteres).`;
    return value;
  };
  const name = text("name", 2, 120);
  const email = text("email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Ingresá un email válido.";
  const phone = text("phone", 8, 30);
  if (!/^\+?[\d\s()-]{8,30}$/.test(phone)) fields.phone = "Ingresá un teléfono válido.";
  const delivery: DeliveryMethod = input.delivery === "pickup" ? "pickup" : input.delivery === "local" ? "local" : "shipping";
  if (!["shipping", "pickup", "local"].includes(String(input.delivery))) fields.delivery = "Elegí una forma de entrega.";
  // Con envío o entrega propia hace falta la dirección completa.
  const toAddress = delivery !== "pickup";
  const payment = input.payment === "cash" ? "cash" : input.payment === "transfer" ? "transfer" : "mercadopago";
  if (!["cash", "transfer", "mercadopago"].includes(String(input.payment))) fields.payment = "Elegí un medio de pago.";
  const paymentChoice = ["mercadopago", "mercado_credito", "debit_card", "credit_card", "cash"].includes(String(input.paymentChoice)) ? input.paymentChoice as CheckoutInput["paymentChoice"] : null;
  if (!paymentChoice || (payment === "cash") !== (paymentChoice === "cash")) fields.paymentChoice = "Elegí un medio de pago válido.";
  // La entrega propia admite efectivo solo si el negocio lo habilitó (LOCAL_DELIVERY_CASH): lo verifica createOrder.
  if (payment === "cash" && delivery === "shipping") fields.payment = "El efectivo está disponible solo con retiro.";
  const street = text("street", toAddress ? 2 : 0, 160);
  const streetNumber = text("streetNumber", toAddress ? 1 : 0, 12);
  const apartment = text("apartment", 0, 60);
  const postalCode = normalizePostalCode(text("postalCode", toAddress ? 4 : 0, 8));
  if (toAddress && !POSTAL_CODE_PATTERN.test(postalCode)) fields.postalCode = "Ingresá un código postal argentino válido.";
  const city = text("city", toAddress ? 2 : 0, 100);
  const province = text("province", toAddress ? 2 : 0, 100);
  const notes = text("notes", 0, 400);
  const checkoutKey = text("checkoutKey", 36, 36);
  if (!UUID_PATTERN.test(checkoutKey)) fields.checkoutKey = "Recargá el checkout para continuar.";
  const quoteToken = text("quoteToken", 1, 4096);
  if (input.accepted !== true) fields.accepted = "Confirmá los datos de tu pedido para continuar.";
  // DNI/CUIT es opcional acá: `createOrder` lo exige solo si el total supera el umbral de facturación.
  // Acepta los campos del formulario (taxIdType/taxIdNumber) o el objeto ya validado que reenvía el cliente.
  const taxIdObject = input.taxId && typeof input.taxId === "object" ? input.taxId as Record<string, unknown> : {};
  const rawTaxIdNumber = typeof input.taxIdNumber === "string" ? input.taxIdNumber : taxIdObject.number;
  const rawTaxId = typeof rawTaxIdNumber === "string" ? rawTaxIdNumber.trim() : "";
  let taxId: CheckoutInput["taxId"] = null;
  if (rawTaxId) {
    const parsedTaxId = parseTaxId(input.taxIdType ?? taxIdObject.type, rawTaxId);
    if (parsedTaxId.ok) taxId = parsedTaxId.value; else fields.taxIdNumber = parsedTaxId.error;
  }
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { name, email, phone, delivery, payment, paymentChoice: paymentChoice!, street, streetNumber, apartment, postalCode, city, province, notes, checkoutKey, quoteToken, accepted: true, taxId } };
}

/**
 * Tarifa fija configurada por el negocio (`SHIPPING_RATES_JSON`), retiro o entrega propia. Nunca supone envío
 * gratis. La elegibilidad de la entrega propia (distancia) se decide aparte, con la dirección geocodificada.
 */
export function quoteDelivery(config: CheckoutConfig, delivery: DeliveryMethod, postalCode: string): { shippingArs: number; label: string; estimate: string; rateId?: string } {
  if (delivery === "pickup") {
    if (!config.pickup) throw new Error("El retiro todavía no está disponible.");
    return { shippingArs: 0, label: "Retiro en Quilmes", estimate: config.pickup.hours };
  }
  if (delivery === "local") {
    if (!config.localDelivery) throw new Error("La entrega en Quilmes todavía no está disponible.");
    return { shippingArs: 0, label: LOCAL_DELIVERY_LABEL, estimate: LOCAL_DELIVERY_ESTIMATE };
  }
  const code = normalizePostalCode(postalCode);
  if (!POSTAL_CODE_PATTERN.test(code)) throw new Error("Ingresá un código postal válido.");
  const short = code.match(/\d{4}/)?.[0];
  const rate = config.shippingRates.find((item) => item.postalCodes.includes(code) || (short && item.postalCodes.includes(short)))
    ?? config.shippingRates.find((item) => item.postalCodes.includes("*"));
  if (!rate) throw new Error("Todavía no tenemos una tarifa de envío para ese código postal.");
  return { shippingArs: rate.priceArs, label: rate.label, estimate: rate.estimate, rateId: rate.id };
}
