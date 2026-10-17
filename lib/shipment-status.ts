import "server-only";
import { eq } from "drizzle-orm";
import { courierPositions, shipments } from "./db/schema";
import { tableExists } from "./db/table-exists";
import type { OrderTransaction } from "./db/transaction";
import { recordShipmentEvent } from "./tracking";
import { adminEventDescriptions } from "./tracking-core";
import type { ShipmentStatus } from "./admin-orders-types";

/**
 * Cambia el estado de un envío dentro de la transacción del panel y deja constancia en la línea de tiempo.
 * Al entregar, borra la última posición del repartidor (solo se conserva durante el reparto).
 */
export async function applyShipmentStatus(tx: OrderTransaction, shipment: { id: string; status: string }, status: ShipmentStatus, changes: { trackingCode?: string | null } = {}, description?: string) {
  await tx.update(shipments).set({ status, ...changes }).where(eq(shipments.id, shipment.id));
  if (shipment.status !== status) await recordShipmentEvent(tx, shipment.id, status, description ?? adminEventDescriptions[status] ?? status);
  if (status === "delivered" && await tableExists(tx, "courier_positions")) await tx.delete(courierPositions).where(eq(courierPositions.shipmentId, shipment.id));
}
