import "server-only";
import { eq } from "drizzle-orm";
import { courierPositions, orderEmails, shipments } from "./db/schema";
import { tableExists } from "./db/table-exists";
import type { OrderTransaction } from "./db/transaction";
import { recordShipmentEvent } from "./tracking";
import { adminEventDescriptions } from "./tracking-core";
import type { ShipmentStatus } from "./admin-orders-types";

/** Estados del envío que avisan al cliente por email (una sola vez por pedido y evento: índice único de la outbox). */
export const SHIPMENT_EMAIL_EVENTS: ShipmentStatus[] = ["ready_for_pickup", "shipped", "out_for_delivery", "delivered"];

/**
 * Cambia el estado de un envío dentro de la transacción del panel, deja constancia en la línea de tiempo y encola el
 * aviso por email. Solo lo usan acciones del negocio: la sincronización con el transportista nunca cambia estados.
 * Al entregar, borra la última posición del repartidor (solo se conserva durante el reparto).
 */
export async function applyShipmentStatus(tx: OrderTransaction, order: { id: string; isDemo: boolean }, shipment: { id: string; status: string }, status: ShipmentStatus, changes: { trackingCode?: string | null } = {}, description?: string) {
  await tx.update(shipments).set({ status, ...changes }).where(eq(shipments.id, shipment.id));
  if (shipment.status === status) return;
  await recordShipmentEvent(tx, shipment.id, status, description ?? adminEventDescriptions[status] ?? status);
  if (!order.isDemo && SHIPMENT_EMAIL_EVENTS.includes(status)) await tx.insert(orderEmails).values({ orderId: order.id, event: status }).onConflictDoNothing();
  if (status === "delivered" && await tableExists(tx, "courier_positions")) await tx.delete(courierPositions).where(eq(courierPositions.shipmentId, shipment.id));
}
