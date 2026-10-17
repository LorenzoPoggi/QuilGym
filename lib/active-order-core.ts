/** Texto del aviso flotante de pedido en curso. Puro: lo usan el endpoint y los tests. */
import type { DeliveryMethod, OrderStatus, PaymentMethod } from "./checkout-types";
import { formatEtaWindow, trackingSteps } from "./tracking-core";

/** Datos mínimos que viajan al navegador: nada de dirección, email ni montos. */
export type ActiveOrder = { id: string; code: string; status: string; title: string; detail: string; href: string };

const titles: Record<string, string> = {
  pending: "está en preparación", preparing: "está en preparación", ready_for_pickup: "está listo para retirar",
  shipped: "fue despachado", out_for_delivery: "está en camino",
};

export const ACTIVE_ORDER_WINDOW_MS = 30 * 24 * 60 * 60_000;

/**
 * «Tu pedido QG-XXXX está en camino» + la ventana de llegada si existe («llega hoy entre…»); si no, la descripción
 * del paso en curso de la línea de pasos de `/pedido`.
 */
export function activeOrderMessage(input: {
  id: string; delivery: DeliveryMethod; orderStatus: OrderStatus; paymentMethod: PaymentMethod; shipmentStatus: string;
  etaFrom: Date | null; etaTo: Date | null; token: string | null; now?: Date;
}): ActiveOrder {
  const code = `QG-${input.id.slice(0, 8).toUpperCase()}`;
  const window = input.shipmentStatus !== "ready_for_pickup" ? formatEtaWindow(input.etaFrom, input.etaTo, input.now) : null;
  const current = trackingSteps({ delivery: input.delivery, orderStatus: input.orderStatus, paymentMethod: input.paymentMethod, shipmentStatus: input.shipmentStatus })
    ?.find((step) => step.state === "current");
  const detail = window ? `${window.charAt(0).toLowerCase()}${window.slice(1)}` : current?.copy ?? "Te avisamos por email cada novedad.";
  return {
    id: input.id, code, status: input.shipmentStatus,
    title: `Tu pedido ${code} ${titles[input.shipmentStatus] ?? "está en curso"}`,
    detail,
    href: `/pedido/${input.id}${input.token ? `?t=${encodeURIComponent(input.token)}` : ""}`,
  };
}
