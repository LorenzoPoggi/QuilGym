import "server-only";
import { and, asc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { orders, payments } from "./db/schema";
import { withOrderTransaction } from "./db/transaction";
import { pendingOrderTtlHours } from "./checkout-config";
import { transitionOrder } from "./order-service";

const BATCH_SIZE = 50;

/**
 * Cancela pedidos pendientes vencidos para liberar stock y cupón (lo hace `transitionOrder`, una sola vez).
 * No toca pedidos con un pago en curso en Mercado Pago (por ejemplo, en revisión manual): su ciclo lo resuelve
 * el webhook. Sí vence los que solo tuvieron intentos rechazados o cancelados. Los pedidos demo nunca reservan nada.
 */
export async function expirePendingOrders(now = new Date(), ttlHours = pendingOrderTtlHours()) {
  const cutoff = new Date(now.getTime() - ttlHours * 60 * 60_000);
  return withOrderTransaction(async (tx) => {
    const rows = await tx.select({ order: orders }).from(orders)
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .where(and(eq(orders.status, "pending"), eq(orders.isDemo, false), lt(orders.createdAt, cutoff),
        or(isNull(payments.providerId), inArray(payments.status, ["rejected", "cancelled"]))))
      .orderBy(asc(orders.createdAt)).limit(BATCH_SIZE)
      .for("update", { skipLocked: true });
    let cancelled = 0;
    for (const { order } of rows) if (await transitionOrder(tx, order, "cancelled", "expired")) cancelled += 1;
    return { cancelled, cutoff };
  });
}
