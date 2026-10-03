export type DeliveryMethod = "pickup" | "shipping";
export type PaymentMethod = "mercadopago" | "transfer" | "cash";
export type OrderStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";
export type CheckoutInput = {
  checkoutKey: string;
  quoteToken: string;
  name: string;
  email: string;
  phone: string;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  street: string;
  streetNumber: string;
  apartment: string;
  postalCode: string;
  city: string;
  province: string;
  notes: string;
  accepted: boolean;
};
export type ShippingRate = { id: string; label: string; postalCodes: string[]; priceArs: number; estimate: string };
export type CheckoutConfig = {
  demo: boolean;
  pickup: { address: string; hours: string } | null;
  shippingRates: ShippingRate[];
  payments: { mercadopago: boolean; transfer: boolean; cash: boolean };
};
export type CheckoutQuote = { token: string; shippingArs: number; totalArs: number; label: string; estimate: string };
export type CheckoutResult = { ok: true; orderId: string } | { ok: false; error: string; fields?: Record<string, string> };
export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pendiente de pago", approved: "Pago aprobado", rejected: "Pago rechazado",
  cancelled: "Pedido cancelado", refunded: "Pago reembolsado",
};
