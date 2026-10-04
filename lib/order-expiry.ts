import "server-only";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { orders, payments } from "./db/schema";
import { withOrderTransaction } from "./db/transaction";
import { pendingOrderTtlHours } from "./checkout-config";
import { transitionOrder } from "./order-service";

const BATCH_SIZE = 50;

/**
 * Cancela pedidos pendientes vencidos para liberar stock y cupón (lo hace `transitionOrder`, una sola vez).
 * No toca pedidos con un pago iniciado en Mercado Pago: su ciclo lo resuelve el webhook
 * (por ejemplo, un cupón de Rapipago todavía vigente). Los pedidos demo nunca reservan nada.
 */
export async function expirePendingOrders(now = new Date(), ttlHours = pendingOrderTtlHours()) {
  const cutoff = new Date(now.getTime() - ttlHours * 60 * 60_000);
  return withOrderTransaction(async (tx) => {
    const rows = await tx.select({ order: orders }).from(orders)
      .innerJoin(payments, eq(payments.orderId, orders.id))
      .where(and(eq(orders.status, "pending"), eq(orders.isDemo, false), lt(orders.createdAt, cutoff), isNull(payments.providerId)))
      .orderBy(asc(orders.createdAt)).limit(BATCH_SIZE)
      .for("update", { skipLocked: true });
    let cancelled = 0;
    for (const { order } of rows) if (await transitionOrder(tx, order, "cancelled")) cancelled += 1;
    return { cancelled, cutoff };
  });
}
