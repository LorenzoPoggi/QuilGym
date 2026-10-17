import "server-only";
import { and, desc, eq, inArray, isNotNull, lt, ne, or, isNull } from "drizzle-orm";
import { db } from "./db";
import { courierPositions, orderDelivery, orders, shipmentEvents, shipments, shipmentTracking } from "./db/schema";
import { tableExists } from "./db/table-exists";
import type { OrderTransaction } from "./db/transaction";
import { getCarrier } from "./carriers";
import { distanceMeters, geocodeAddress, isValidCoordinates } from "./geo";
import { readStoreCoordinates } from "./checkout-env";
import { buildTimeline, COURIER_POSITION_TTL_MS, isCourierPositionFresh, needsTrackingSync, TRACKING_SYNC_INTERVAL_MS, type TimelineEvent } from "./tracking-core";

type Executor = Parameters<typeof tableExists>[0];
type Order = typeof orders.$inferSelect;
type Shipment = typeof shipments.$inferSelect;
type Tracking = typeof shipmentTracking.$inferSelect;

/** Las tablas de seguimiento son de la migración 0010: sin ella todo esto se apaga y la página muestra lo básico. */
export async function trackingTablesReady(executor: Executor = db) {
  const [events, tracking, positions] = await Promise.all(["shipment_events", "shipment_tracking", "courier_positions"].map((name) => tableExists(executor, name)));
  return events && tracking && positions;
}

/** Evento de la línea de tiempo registrado desde el panel (dentro de la transacción del cambio de estado). */
export async function recordShipmentEvent(tx: OrderTransaction, shipmentId: string, status: string, description: string, occurredAt = new Date()) {
  if (!await tableExists(tx, "shipment_events")) return;
  await tx.insert(shipmentEvents).values({ shipmentId, occurredAt, status, description, source: "admin" }).onConflictDoNothing();
}

/** Corta una promesa lenta sin cancelarla: la página no espera al transportista más de `ms`. */
async function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
  try { return await Promise.race([promise.catch(() => fallback), timeout]); } finally { clearTimeout(timer); }
}

/**
 * Trae los eventos del transportista y guarda los nuevos (el índice único descarta repetidos). Marca la consulta
 * aunque falle, para no reintentar en cada visita: el próximo intento es a los 30 minutos o en el cron diario.
 * No cambia el estado del envío a partir de lo que informe el transportista (eso lo decide el negocio).
 */
export async function syncCarrierTracking(tracking: Pick<Tracking, "shipmentId" | "carrier" | "carrierShipmentId" | "trackingCheckedAt">, now = new Date()) {
  if (tracking.carrier === "own" || !tracking.carrierShipmentId || !needsTrackingSync(tracking.trackingCheckedAt, now.getTime())) return 0;
  const carrier = getCarrier();
  if (!carrier || carrier.code !== tracking.carrier) return 0;
  await db.update(shipmentTracking).set({ trackingCheckedAt: now }).where(eq(shipmentTracking.shipmentId, tracking.shipmentId));
  try {
    const events = await carrier.tracking(tracking.carrierShipmentId);
    const rows = events.slice(0, 100).map((event) => ({ shipmentId: tracking.shipmentId, occurredAt: event.occurredAt, status: event.status.slice(0, 60),
      description: event.description.slice(0, 200), location: event.location?.slice(0, 120) ?? null, source: "carrier" as const }));
    if (!rows.length) return 0;
    const inserted = await db.insert(shipmentEvents).values(rows).onConflictDoNothing().returning({ id: shipmentEvents.id });
    return inserted.length;
  } catch (error) {
    console.warn("[Seguimiento] No se pudo consultar al transportista", { shipment: tracking.shipmentId.slice(0, 8), carrier: tracking.carrier, reason: error instanceof Error ? error.name : "error" });
    return 0;
  }
}

/** Cron diario: sincroniza los envíos abiertos con transportista (en Vercel Hobby los crons corren una vez por día). */
export async function syncOpenShipments(limit = 25, now = new Date()) {
  if (!await trackingTablesReady()) return { synced: 0, events: 0 };
  const rows = await db.select({ tracking: shipmentTracking }).from(shipmentTracking).innerJoin(shipments, eq(shipments.id, shipmentTracking.shipmentId))
    .where(and(ne(shipmentTracking.carrier, "own"), isNotNull(shipmentTracking.carrierShipmentId), inArray(shipments.status, ["shipped", "out_for_delivery"]),
      or(isNull(shipmentTracking.trackingCheckedAt), lt(shipmentTracking.trackingCheckedAt, new Date(now.getTime() - TRACKING_SYNC_INTERVAL_MS)))))
    .limit(limit);
  let events = 0;
  for (const { tracking } of rows) events += await syncCarrierTracking(tracking, now);
  return { synced: rows.length, events };
}

/** Borra posiciones del repartidor sin actualizar hace más de 4 horas. */
export async function purgeStaleCourierPositions(now = new Date()) {
  if (!await tableExists(db, "courier_positions")) return 0;
  const deleted = await db.delete(courierPositions).where(lt(courierPositions.updatedAt, new Date(now.getTime() - COURIER_POSITION_TTL_MS))).returning({ id: courierPositions.shipmentId });
  return deleted.length;
}

export type CourierPosition = { lat: number; lng: number; accuracyM: number | null; updatedAt: string };

/** Posición vigente del repartidor: solo entrega propia «En camino» y con una lectura de menos de 4 horas. */
export async function readCourierPosition(order: Pick<Order, "delivery">, shipment: Pick<Shipment, "id" | "status"> | null | undefined, now = Date.now()): Promise<CourierPosition | null> {
  if (order.delivery !== "local" || !shipment || shipment.status !== "out_for_delivery" || !await tableExists(db, "courier_positions")) return null;
  const [row] = await db.select().from(courierPositions).where(eq(courierPositions.shipmentId, shipment.id)).limit(1);
  if (!row || !isCourierPositionFresh(row.updatedAt, now)) return null;
  return { lat: row.lat, lng: row.lng, accuracyM: row.accuracyM, updatedAt: row.updatedAt.toISOString() };
}

/** Destino para el mapa: el punto guardado por la entrega propia o, si no hay, la dirección geocodificada sin ambigüedad. */
async function destinationPoint(order: Order, saved: { lat: number | null; lng: number | null } | null) {
  if (saved?.lat != null && saved.lng != null && isValidCoordinates({ lat: saved.lat, lng: saved.lng })) return { lat: saved.lat, lng: saved.lng };
  if (order.delivery === "pickup" || !order.address) return null;
  const result = await within(geocodeAddress({ street: order.address.street, streetNumber: order.address.number, city: order.address.city, province: order.address.province }), 2_500, { status: "error" as const });
  if (result.status !== "ok") return null;
  const [first, ...rest] = result.candidates;
  // Solo si todos los candidatos están a menos de 1 km entre sí: un marcador equivocado confunde más que ninguno.
  return rest.every((candidate) => distanceMeters(first, candidate) <= 1_000) ? { lat: first.lat, lng: first.lng } : null;
}

export type OrderTracking = Awaited<ReturnType<typeof loadOrderTracking>>;

/**
 * Datos de seguimiento para `/pedido/[id]`. Si toca, sincroniza al transportista sin bloquear más de ~3 s.
 * Sin la migración 0010 devuelve `available: false` y la página muestra solo el estado del pedido.
 */
export async function loadOrderTracking(order: Order, shipment: Shipment | null | undefined) {
  const store = readStoreCoordinates(process.env);
  if (!shipment || !await trackingTablesReady()) return { available: false as const, store, destination: null, events: [] as TimelineEvent[], tracking: null, courier: null, distanceM: null };
  const [[delivery], [tracking]] = await Promise.all([
    tableExists(db, "order_delivery").then((ready) => ready ? db.select().from(orderDelivery).where(eq(orderDelivery.orderId, order.id)).limit(1) : []),
    db.select().from(shipmentTracking).where(eq(shipmentTracking.shipmentId, shipment.id)).limit(1),
  ]);
  if (tracking) await within(syncCarrierTracking(tracking), 3_000, 0);
  const [events, destination, courier] = await Promise.all([
    db.select().from(shipmentEvents).where(eq(shipmentEvents.shipmentId, shipment.id)).orderBy(desc(shipmentEvents.occurredAt)).limit(60),
    destinationPoint(order, delivery ?? null),
    readCourierPosition(order, shipment),
  ]);
  return {
    available: true as const, store, destination, courier, distanceM: delivery?.distanceM ?? null,
    events: buildTimeline(events.map((event) => ({ occurredAt: event.occurredAt, status: event.status, description: event.description, location: event.location, source: event.source }))),
    tracking: tracking ? { carrier: tracking.carrier, carrierShipmentId: tracking.carrierShipmentId, trackingUrl: tracking.trackingUrl,
      etaFrom: tracking.etaFrom?.toISOString() ?? null, etaTo: tracking.etaTo?.toISOString() ?? null } : null,
  };
}
