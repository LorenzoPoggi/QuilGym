import "server-only";
import { and, asc, eq, inArray, lt, notExists } from "drizzle-orm";
import { carts, orders, authRateLimits } from "./db/schema";
import { withOrderTransaction } from "./db/transaction";

const BATCH_SIZE = 50;
const RATE_LIMIT_BATCH_SIZE = 500;
const MAX_RATE_LIMIT_BATCHES = 20;
const RATE_LIMIT_RETENTION_MS = 48 * 60 * 60_000;
export const ABANDONED_CART_RETENTION_DAYS = 60;

/**
 * Elimina carritos inactivos por al menos el tiempo de vida de la cookie.
 * Conserva cualquier carrito ligado a una orden (FK restrict) y limpia sus contadores.
 */
export async function expireAbandonedCarts(now = new Date(), retentionDays = ABANDONED_CART_RETENTION_DAYS) {
  if (!Number.isInteger(retentionDays) || retentionDays < 60 || retentionDays > 365) throw new Error("Retención de carrito fuera de rango.");
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60_000);
  return withOrderTransaction(async (tx) => {
    const stale = await tx.select({ id: carts.id }).from(carts)
      .where(and(lt(carts.updatedAt, cutoff), notExists(
        tx.select({ id: orders.id }).from(orders).where(eq(orders.cartId, carts.id)),
      )))
      .orderBy(asc(carts.updatedAt)).limit(BATCH_SIZE)
      .for("update", { skipLocked: true });
    const ids = stale.map(({ id }) => id);
    const removed = ids.length
      ? await tx.delete(carts).where(inArray(carts.id, ids)).returning({ id: carts.id })
      : [];
    const limitKeys = removed.flatMap(({ id }) => [`coupon:apply:${id}`, `checkout:quote:${id}`, `checkout:submit:${id}`]);
    const removedCartLimits = limitKeys.length
      ? await tx.delete(authRateLimits).where(inArray(authRateLimits.key, limitKeys)).returning({ key: authRateLimits.key })
      : [];

    // Todas las ventanas de rate limit duran como máximo un día. Retener 48 h
    // deja margen ante demoras del cron y evita crecimiento ilimitado de filas
    // de visitantes, pedidos y claves globales. Se revalida el timestamp en el
    // DELETE por si una solicitud actualizó la fila después de seleccionarla.
    const rateLimitCutoff = now.getTime() - RATE_LIMIT_RETENTION_MS;
    let expiredLimitsDeleted = 0;
    for (let batch = 0; batch < MAX_RATE_LIMIT_BATCHES; batch++) {
      const expiredLimits = await tx.select({ key: authRateLimits.key }).from(authRateLimits)
        .where(lt(authRateLimits.lastRequest, rateLimitCutoff))
        .orderBy(asc(authRateLimits.lastRequest)).limit(RATE_LIMIT_BATCH_SIZE)
        .for("update", { skipLocked: true });
      const expiredKeys = expiredLimits.map(({ key }) => key);
      if (!expiredKeys.length) break;
      const removed = await tx.delete(authRateLimits).where(and(
        inArray(authRateLimits.key, expiredKeys),
        lt(authRateLimits.lastRequest, rateLimitCutoff),
      )).returning({ key: authRateLimits.key });
      expiredLimitsDeleted += removed.length;
      if (expiredLimits.length < RATE_LIMIT_BATCH_SIZE) break;
    }

    return {
      deleted: removed.length,
      rateLimitsDeleted: removedCartLimits.length + expiredLimitsDeleted,
      cutoff,
    };
  });
}
