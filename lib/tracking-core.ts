/**
 * Reglas puras del seguimiento de pedidos: pasos visibles, línea de tiempo, ventana de llegada y frescura de la
 * posición del repartidor. Sin `server-only` ni base: la usan la página `/pedido/[id]`, el panel y los tests.
 */
import type { DeliveryMethod, OrderStatus, PaymentMethod } from "./checkout-types";

export const TRACKING_TIME_ZONE = "America/Argentina/Buenos_Aires";
/** Cada cuánto se vuelve a consultar al transportista al abrir la página. */
export const TRACKING_SYNC_INTERVAL_MS = 30 * 60_000;
/** La posición del repartidor se descarta (y se purga) pasadas 4 horas sin actualizar. */
export const COURIER_POSITION_TTL_MS = 4 * 60 * 60_000;
/** Polling del mapa del cliente y mínimo entre envíos del repartidor. */
export const COURIER_POLL_MS = 15_000;
export const COURIER_REPORT_MIN_INTERVAL_MS = 10_000;

export type TimelineEvent = { occurredAt: Date; status: string; description: string; location: string | null; source: string };
export type TrackingStep = { key: string; title: string; copy: string; state: "done" | "current" | "todo" };

/** Más reciente primero, sin duplicados (mismo instante y descripción) y con un tope razonable. */
export function buildTimeline(events: TimelineEvent[], limit = 30): TimelineEvent[] {
  const seen = new Set<string>();
  return [...events]
    .filter((event) => event.occurredAt instanceof Date && !Number.isNaN(event.occurredAt.getTime()) && event.description.trim())
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .filter((event) => {
      const key = `${event.occurredAt.getTime()}|${event.description.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

type StepInput = { delivery: DeliveryMethod; orderStatus: OrderStatus; paymentMethod: PaymentMethod; shipmentStatus: string };

/**
 * Pasos del pedido según la entrega. El efectivo se paga al retirar o al recibir: su paso de pago va al final y el
 * pedido avanza aunque siga pendiente. Pedidos cancelados, rechazados o reembolsados no muestran pasos.
 */
export function trackingSteps({ delivery, orderStatus, paymentMethod, shipmentStatus }: StepInput): TrackingStep[] | null {
  if (orderStatus !== "pending" && orderStatus !== "approved") return null;
  const cash = paymentMethod === "cash";
  const paid = orderStatus === "approved";
  const flow: Record<DeliveryMethod, { key: string; title: string; copy: string }[]> = {
    pickup: [
      { key: "preparing", title: "Preparación", copy: "Armamos y controlamos tu pedido." },
      { key: "ready_for_pickup", title: "Listo para retirar", copy: "Te avisamos cuando puedas pasar por el local." },
      { key: "delivered", title: "Retirado", copy: "Te llevaste tu pedido." },
    ],
    shipping: [
      { key: "preparing", title: "Preparación", copy: "Armamos y controlamos tu pedido." },
      { key: "shipped", title: "Despachado", copy: "Lo entregamos al transportista." },
      { key: "out_for_delivery", title: "En distribución", copy: "El transportista lo está llevando a tu domicilio." },
      { key: "delivered", title: "Entregado", copy: "Recibiste tu pedido." },
    ],
    local: [
      { key: "preparing", title: "Preparación", copy: "Armamos y controlamos tu pedido." },
      { key: "out_for_delivery", title: "En camino", copy: "Salimos a llevarte el pedido." },
      { key: "delivered", title: "Entregado", copy: "Recibiste tu pedido." },
    ],
  };
  const order = ["pending", ...flow[delivery].map((step) => step.key)];
  // «Enviado» de un envío propio no existe; un estado desconocido cuenta como recién recibido.
  const reached = Math.max(0, order.indexOf(shipmentStatus));
  const received: TrackingStep = { key: "received", title: "Pedido recibido", copy: "Guardamos tu pedido.", state: "done" };
  const payment: TrackingStep = cash
    ? { key: "payment", title: delivery === "pickup" ? "Pago al retirar" : "Pago al recibir", copy: "Lo pagás en efectivo.", state: paid ? "done" : "todo" }
    : { key: "payment", title: paid ? "Pago aprobado" : "Pago", copy: paid ? "Acreditamos el pago." : "Completá el pago para que preparemos tu pedido.", state: paid ? "done" : "current" };
  const blocked = !paid && !cash;
  const shipping = flow[delivery].map((step, index): TrackingStep => {
    const position = index + 1;
    const state = blocked ? "todo" : position < reached || (position === reached && step.key === "delivered") ? "done" : position === reached ? "current" : position === reached + 1 && reached === 0 ? "current" : "todo";
    return { ...step, state };
  });
  const steps = cash ? [received, ...shipping, payment] : [received, payment, ...shipping];
  // Con efectivo, al entregarse se considera cobrado recién cuando el negocio lo confirma (orderStatus approved).
  return steps;
}

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TRACKING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const time = (date: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: TRACKING_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
const shortDay = (date: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: TRACKING_TIME_ZONE, weekday: "long", day: "numeric", month: "numeric" }).format(date);

function dayLabel(date: Date, now: Date) {
  const key = dayKey(date);
  if (key === dayKey(now)) return "hoy";
  if (key === dayKey(new Date(now.getTime() + 24 * 60 * 60_000))) return "mañana";
  return `el ${shortDay(date)}`;
}

/** «Llega hoy entre 14:00 y 18:00», «llega mañana…» o, si cruza días, «entre el … 22:00 y el … 10:00». */
export function formatEtaWindow(from: Date | null, to: Date | null, now = new Date()) {
  if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;
  if (dayKey(from) === dayKey(to)) return `Llega ${dayLabel(from, now)} entre las ${time(from)} y las ${time(to)}`;
  return `Llega entre ${dayLabel(from, now)} a las ${time(from)} y ${dayLabel(to, now)} a las ${time(to)}`;
}

export type EtaChoice = { kind: "5h" | "12h" | "24h" } | { kind: "custom"; from: string; to: string };

/**
 * Ventana de llegada que elige el dueño al salir a entregar. Las personalizadas no pueden empezar más de una hora
 * en el pasado, deben terminar después de empezar y como máximo a 7 días.
 */
export function etaWindowFromChoice(choice: unknown, now = new Date()): { from: Date; to: Date } | null {
  const input = choice && typeof choice === "object" ? choice as Record<string, unknown> : {};
  const hours = { "5h": 5, "12h": 12, "24h": 24 }[String(input.kind)];
  if (hours) return { from: now, to: new Date(now.getTime() + hours * 60 * 60_000) };
  if (input.kind !== "custom" || typeof input.from !== "string" || typeof input.to !== "string") return null;
  const from = new Date(input.from); const to = new Date(input.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  if (from.getTime() < now.getTime() - 60 * 60_000 || to <= from || to.getTime() > now.getTime() + 7 * 24 * 60 * 60_000) return null;
  return { from, to };
}

export const needsTrackingSync = (checkedAt: Date | null | undefined, now = Date.now()) => !checkedAt || now - checkedAt.getTime() >= TRACKING_SYNC_INTERVAL_MS;
export const isCourierPositionFresh = (updatedAt: Date | null | undefined, now = Date.now()) => !!updatedAt && now - updatedAt.getTime() <= COURIER_POSITION_TTL_MS;

/** Página pública de seguimiento del transportista. TODO(correo): confirmar si acepta el número por URL. */
export function carrierTrackingPage(carrier: string | null | undefined, trackingUrl?: string | null) {
  if (trackingUrl?.startsWith("https://")) return trackingUrl;
  if (carrier === "correo_argentino") return "https://www.correoargentino.com.ar/formularios/e-commerce";
  return null;
}

/** Descripciones de los eventos que registra el panel. */
export const adminEventDescriptions: Record<string, string> = {
  pending: "Pedido sin preparar", preparing: "Estamos preparando tu pedido", ready_for_pickup: "Tu pedido está listo para retirar",
  shipped: "Despachamos tu pedido", out_for_delivery: "Salimos a entregar tu pedido", delivered: "Pedido entregado",
};
