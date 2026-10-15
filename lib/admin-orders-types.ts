import type { DeliveryMethod, OrderStatus, PaymentMethod } from "./checkout-types";

export const ORDER_STATUSES: OrderStatus[] = ["pending", "approved", "rejected", "cancelled", "refunded"];
export const adminOrderStatusLabels: Record<OrderStatus, string> = {
  pending: "Pendiente", approved: "Pagado", rejected: "Rechazado", cancelled: "Cancelado", refunded: "Reembolsado",
};
export const paymentChoiceLabels: Record<string, string> = {
  mercadopago: "Mercado Pago", mercado_credito: "Mercado Crédito", debit_card: "Tarjeta de débito", credit_card: "Tarjeta de crédito", cash: "Efectivo", transfer: "Transferencia",
};
export const paymentMethodLabels: Record<PaymentMethod, string> = { mercadopago: "Mercado Pago", transfer: "Transferencia", cash: "Efectivo" };

/** `shipments.status` es texto libre en la base: estos son los únicos valores que escribe el panel. */
export const SHIPMENT_STATUSES = ["pending", "preparing", "ready_for_pickup", "shipped", "delivered"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];
export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  pending: "Sin preparar", preparing: "En preparación", ready_for_pickup: "Listo para retirar", shipped: "Enviado", delivered: "Entregado",
};
export const isShipmentStatus = (value: unknown): value is ShipmentStatus => typeof value === "string" && (SHIPMENT_STATUSES as readonly string[]).includes(value);
export const shipmentLabel = (value: string) => isShipmentStatus(value) ? shipmentStatusLabels[value] : value;

/** Estados de envío válidos según la entrega y el pago. El efectivo se cobra al retirar: se puede preparar estando pendiente. */
export function allowedShipmentStatuses(order: { status: OrderStatus; delivery: DeliveryMethod; paymentMethod: PaymentMethod }): ShipmentStatus[] {
  const byDelivery: ShipmentStatus[] = order.delivery === "pickup" ? ["pending", "preparing", "ready_for_pickup", "delivered"] : ["pending", "preparing", "shipped", "delivered"];
  if (order.status === "approved") return byDelivery;
  if (order.status === "pending" && order.paymentMethod === "cash") return ["pending", "preparing", "ready_for_pickup"];
  return [];
}

export const TRACKING_PATTERN = /^[\p{L}\p{N} ._/#-]{0,80}$/u;
export const ADMIN_ORDERS_PAGE_SIZE = 25;
export const orderCode = (id: string) => `QG-${id.slice(0, 8).toUpperCase()}`;

/** Pago del proveedor que quedó aprobado sobre un pedido que ya no está vigente (§8.4). */
export const isPaidOnClosedOrder = (orderStatus: OrderStatus, paymentStatus: OrderStatus | null | undefined) =>
  paymentStatus === "approved" && (orderStatus === "cancelled" || orderStatus === "rejected");

export type AdminOrderFilters = { q: string; status: OrderStatus | "all"; choice: string; kind: "all" | "real" | "demo"; from: string; to: string; alerts: boolean; page: number };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseAdminOrderFilters(raw: Record<string, string | string[] | undefined>): AdminOrderFilters {
  const status = one(raw.estado);
  const choice = one(raw.medio);
  const kind = one(raw.tipo);
  const validDate = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00-03:00`)) ? value : "";
  const page = Number.parseInt(one(raw.pagina), 10);
  return {
    q: one(raw.q).trim().slice(0, 120),
    status: (ORDER_STATUSES as string[]).includes(status) ? status as OrderStatus : "all",
    choice: choice in paymentChoiceLabels ? choice : "all",
    kind: kind === "real" || kind === "demo" ? kind : "all",
    from: validDate(one(raw.desde)), to: validDate(one(raw.hasta)),
    alerts: one(raw.alertas) === "1",
    page: Number.isSafeInteger(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

export function adminOrdersHref(filters: Partial<AdminOrderFilters>) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("estado", filters.status);
  if (filters.choice && filters.choice !== "all") params.set("medio", filters.choice);
  if (filters.kind && filters.kind !== "all") params.set("tipo", filters.kind);
  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);
  if (filters.alerts) params.set("alertas", "1");
  if (filters.page && filters.page > 1) params.set("pagina", String(filters.page));
  const query = params.toString();
  return `/admin/pedidos${query ? `?${query}` : ""}`;
}
export const paymentLabel = (order: { paymentMethod: PaymentMethod; paymentChoice: string }) =>
  order.paymentMethod === "mercadopago" ? paymentChoiceLabels[order.paymentChoice] ?? "Mercado Pago" : paymentMethodLabels[order.paymentMethod];
