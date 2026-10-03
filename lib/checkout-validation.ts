import type { CheckoutInput, CheckoutConfig, DeliveryMethod } from "./checkout-types";

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
  const delivery = input.delivery === "pickup" ? "pickup" : "shipping";
  if (!["shipping", "pickup"].includes(String(input.delivery))) fields.delivery = "Elegí una forma de entrega.";
  const payment = input.payment === "cash" ? "cash" : input.payment === "transfer" ? "transfer" : "mercadopago";
  if (!["cash", "transfer", "mercadopago"].includes(String(input.payment))) fields.payment = "Elegí un medio de pago.";
  if (payment === "cash" && delivery !== "pickup") fields.payment = "El efectivo está disponible solo con retiro.";
  const street = text("street", delivery === "shipping" ? 2 : 0, 160);
  const streetNumber = text("streetNumber", delivery === "shipping" ? 1 : 0, 12);
  const apartment = text("apartment", 0, 60);
  const postalCode = normalizePostalCode(text("postalCode", delivery === "shipping" ? 4 : 0, 8));
  if (delivery === "shipping" && !/^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(postalCode)) fields.postalCode = "Ingresá un código postal argentino válido.";
  const city = text("city", delivery === "shipping" ? 2 : 0, 100);
  const province = text("province", delivery === "shipping" ? 2 : 0, 100);
  const notes = text("notes", 0, 400);
  const checkoutKey = text("checkoutKey", 36, 36);
  if (!UUID_PATTERN.test(checkoutKey)) fields.checkoutKey = "Recargá el checkout para continuar.";
  const quoteToken = text("quoteToken", 1, 4096);
  if (input.accepted !== true) fields.accepted = "Confirmá los datos de tu pedido para continuar.";
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { name, email, phone, delivery, payment, street, streetNumber, apartment, postalCode, city, province, notes, checkoutKey, quoteToken, accepted: true } };
}

/** Tarifas configuradas por el negocio. Nunca supone envío gratis. */
export function quoteDelivery(config: CheckoutConfig, delivery: DeliveryMethod, postalCode: string) {
  if (delivery === "pickup") {
    if (!config.pickup) throw new Error("El retiro todavía no está disponible.");
    return { shippingArs: 0, label: "Retiro en Quilmes", estimate: config.pickup.hours };
  }
  const code = normalizePostalCode(postalCode);
  if (!/^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(code)) throw new Error("Ingresá un código postal válido.");
  const short = code.match(/\d{4}/)?.[0];
  const rate = config.shippingRates.find((item) => item.postalCodes.includes(code) || (short && item.postalCodes.includes(short)))
    ?? config.shippingRates.find((item) => item.postalCodes.includes("*"));
  if (!rate) throw new Error("Todavía no tenemos una tarifa de envío para ese código postal.");
  return { shippingArs: rate.priceArs, label: rate.label, estimate: rate.estimate };
}
