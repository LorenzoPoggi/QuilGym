/** `local` = entrega propia de QuilGym dentro del radio del local (migración 0010), costo a convenir. */
export type DeliveryMethod = "pickup" | "shipping" | "local";
export type PaymentMethod = "mercadopago" | "transfer" | "cash";
export type PaymentChoice = "mercadopago" | "mercado_credito" | "debit_card" | "credit_card" | "cash";
export type OrderStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded";
export type CheckoutInput = {
  checkoutKey: string;
  quoteToken: string;
  name: string;
  email: string;
  phone: string;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  paymentChoice: PaymentChoice;
  street: string;
  streetNumber: string;
  apartment: string;
  postalCode: string;
  city: string;
  province: string;
  notes: string;
  accepted: boolean;
  /** DNI/CUIT para la factura: solo cuando el total supera el umbral configurado (o si el comprador lo informa). */
  taxId?: { type: "DNI" | "CUIT"; number: string } | null;
};
export type ShippingRate = { id: string; label: string; postalCodes: string[]; priceArs: number; estimate: string };
export type CheckoutConfig = {
  demo: boolean;
  pickup: { address: string; hours: string } | null;
  shippingRates: ShippingRate[];
  payments: { mercadopago: boolean; transfer: boolean; cash: boolean };
  /**
   * Entrega propia ≤ `radiusKm` del local. null/ausente = apagada. `cash` permite efectivo al entregar
   * (LOCAL_DELIVERY_CASH). La cotización además exige la migración 0010: el servidor decide si se ofrece.
   */
  localDelivery?: { radiusKm: number; cash: boolean } | null;
  /** Coordenadas del local (STORE_LAT/STORE_LNG), con default en `lib/store-location.ts`. */
  store?: { lat: number; lng: number };
  /** Transportista con API configurado (sin secretos). null = tarifa fija de SHIPPING_RATES_JSON. */
  carrier?: { code: "correo_argentino" | "mock"; label: string } | null;
  /** Desde este total se pide DNI/CUIT para facturar (INVOICE_ID_THRESHOLD_ARS). null/ausente = no se pide. */
  taxIdThresholdArs?: number | null;
};
export type CheckoutQuote = {
  token: string; shippingArs: number; totalArs: number; label: string; estimate: string;
  /** Opción cotizada: `local`, `rate:<id>` (tarifa fija), `carrier:<servicio>` o `pickup`. */
  optionId?: string;
  delivery?: DeliveryMethod;
  /** Solo la entrega propia: distancia aproximada al local y aviso del costo a convenir. */
  distanceMeters?: number;
  note?: string;
};
/** Pedido de cotización: retiro, o dirección completa (la ubicación del navegador es solo una pista). */
export type CheckoutQuoteRequest =
  | { delivery: "pickup" }
  | { delivery: "address"; address: { street: string; streetNumber: string; postalCode: string; city: string; province: string }; hint?: { lat: number; lng: number } | null };
export type CheckoutQuoteResponse =
  | { ok: true; quote: CheckoutQuote; options: CheckoutQuote[]; notice?: string }
  | { ok: false; error: string; notice?: string };
export type CheckoutResult = { ok: true; orderId: string; redirectUrl?: string } | { ok: false; error: string; fields?: Record<string, string> };
export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pendiente de pago", approved: "Pago aprobado", rejected: "Pago rechazado",
  cancelled: "Pedido cancelado", refunded: "Pago reembolsado",
};
