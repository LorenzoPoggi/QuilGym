import type { Cart } from "./cart-types";
import type { CheckoutConfig, DeliveryMethod, PaymentMethod } from "./checkout-types";
import { formatArs } from "./commerce";

const paymentOrder: PaymentMethod[] = ["mercadopago", "transfer", "cash"];

/** Formas de entrega configuradas, en el orden en que se ofrecen. */
export function availableDeliveries(config: CheckoutConfig): DeliveryMethod[] {
  return [config.pickup ? "pickup" as const : null, config.shippingRates.length ? "shipping" as const : null].filter((value) => value !== null);
}

/** Medios de pago que se pueden usar con la entrega elegida (efectivo solo con retiro). */
export function usablePayments(config: CheckoutConfig, delivery: DeliveryMethod): PaymentMethod[] {
  return paymentOrder.filter((method) => config.payments[method] && (method !== "cash" || delivery === "pickup"));
}

/** true si existe al menos una combinación de entrega y pago para comprar online. */
export function isOnlineCheckoutAvailable(config: CheckoutConfig) {
  return availableDeliveries(config).some((delivery) => usablePayments(config, delivery).some((method) => method !== "transfer"));
}

/** Entrega y pago iniciales del formulario: nunca una opción deshabilitada si hay alguna habilitada. */
export function initialCheckoutChoice(config: CheckoutConfig): { delivery: DeliveryMethod; payment: PaymentMethod } {
  const deliveries = availableDeliveries(config);
  const delivery = deliveries.find((value) => usablePayments(config, value).length > 0) ?? deliveries[0] ?? "shipping";
  return { delivery, payment: usablePayments(config, delivery)[0] ?? "mercadopago" };
}

type WhatsAppCheckoutDetails = {
  name: string; email: string; phone: string; delivery: DeliveryMethod; payment: PaymentMethod;
  paymentLabel?: string;
  street: string; streetNumber: string; apartment: string; postalCode: string; city: string; province: string;
  notes: string; shippingLabel?: string; shippingArs?: number;
};

/** Pedido listo para WhatsApp. Los datos del checkout solo se incluyen en el mensaje que el usuario revisa y envía. */
export function whatsappOrderMessage(cart: Cart, details?: WhatsAppCheckoutDetails) {
  const items = cart.lines.filter((line) => line.available);
  const missing = cart.lines.filter((line) => !line.available);
  const label = (line: Cart["lines"][number]) => `${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ""}`;
  const paymentLabels: Record<PaymentMethod, string> = { mercadopago: "Mercado Pago", transfer: "Transferencia bancaria", cash: "Efectivo" };
  return [
    "¡Hola! Quiero hacer este pedido desde la web:",
    "",
    ...items.map((line) => `• ${line.quantity} × ${label(line)}: ${formatArs(line.lineTotalArs)}`),
    "",
    ...(cart.coupon ? [`Subtotal: ${formatArs(cart.subtotalArs)}`, `Cupón ${cart.coupon.code}: − ${formatArs(cart.discountArs)}`] : []),
    `Total sin envío: ${formatArs(cart.totalArs)}`,
    ...(details ? [
      "",
      `Nombre: ${details.name}`,
      `Email: ${details.email}`,
      `Teléfono: ${details.phone}`,
      `Entrega: ${details.delivery === "pickup" ? "Retiro en Quilmes" : "Envío a domicilio"}`,
      ...(details.delivery === "shipping" ? [`Dirección: ${details.street} ${details.streetNumber}${details.apartment ? `, ${details.apartment}` : ""}, ${details.city}, ${details.province}, CP ${details.postalCode}`] : []),
      ...(details.delivery === "shipping" && details.shippingLabel ? [`Envío: ${details.shippingLabel}${details.shippingArs !== undefined ? ` · ${formatArs(details.shippingArs)}` : ""}`, ...(details.shippingArs !== undefined ? [`Total estimado con envío: ${formatArs(cart.totalArs + details.shippingArs)}`] : [])] : []),
      `Preferencia de pago: ${details.paymentLabel || paymentLabels[details.payment]}`,
      ...(details.notes ? [`Indicaciones: ${details.notes}`] : []),
    ] : []),
    ...(missing.length ? ["", `Sin stock en la web: ${missing.map(label).join(", ")}.`] : []),
    "",
    details ? "Revisé estos datos y quiero coordinar disponibilidad, entrega y pago." : "¿Me confirman disponibilidad, forma de pago y entrega?",
  ].join("\n");
}
