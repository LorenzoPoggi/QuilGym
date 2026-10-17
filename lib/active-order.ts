import "server-only";
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import { orders, shipments, shipmentTracking } from "./db/schema";
import { tableExists } from "./db/table-exists";
import { currentUser } from "./auth";
import { readRememberedOrders } from "./order-cookie-server";
import { orderAccessToken } from "./order-access";
import { orderAccessSecret, getCheckoutConfig } from "./checkout-config";
import { ACTIVE_ORDER_WINDOW_MS, activeOrderMessage, type ActiveOrder } from "./active-order-core";

/**
 * Pedido en curso más reciente del visitante: los de su cuenta si hay sesión y, además, los de invitado guardados en
 * la cookie firmada `qg_orders`. Un pedido de cuenta nunca se muestra solo por la cookie (misma regla que
 * `findOwnedOrder`). Aprobado o en efectivo pendiente, envío no entregado y de los últimos 30 días.
 */
export async function getActiveOrder(now = new Date()): Promise<ActiveOrder | null> {
  const [user, remembered] = await Promise.all([currentUser(), readRememberedOrders()]);
  if (!user && !remembered.length) return null;
  const owner = or(user ? eq(orders.userId, user.id) : undefined, remembered.length ? and(inArray(orders.id, remembered), isNull(orders.userId)) : undefined);
  const [row] = await db.select({ order: orders, shipmentId: shipments.id, shipmentStatus: shipments.status }).from(orders)
    .innerJoin(shipments, eq(shipments.orderId, orders.id))
    .where(and(owner,
      // Los pedidos simulados solo aparecen mientras el modo demo está activo (desarrollo local).
      getCheckoutConfig().demo ? undefined : eq(orders.isDemo, false),
      gte(orders.createdAt, new Date(now.getTime() - ACTIVE_ORDER_WINDOW_MS)),
      or(eq(orders.status, "approved"), and(eq(orders.status, "pending"), eq(orders.paymentMethod, "cash"))),
      ne(shipments.status, "delivered")))
    .orderBy(desc(orders.createdAt), sql`${orders.id} desc`).limit(1);
  if (!row) return null;
  const [tracking] = await tableExists(db, "shipment_tracking")
    ? await db.select({ etaFrom: shipmentTracking.etaFrom, etaTo: shipmentTracking.etaTo }).from(shipmentTracking).where(eq(shipmentTracking.shipmentId, row.shipmentId)).limit(1)
    : [];
  return activeOrderMessage({
    id: row.order.id, delivery: row.order.delivery, orderStatus: row.order.status, paymentMethod: row.order.paymentMethod, shipmentStatus: row.shipmentStatus,
    etaFrom: tracking?.etaFrom ?? null, etaTo: tracking?.etaTo ?? null, token: orderAccessToken(row.order.id, orderAccessSecret()), now,
  });
}
