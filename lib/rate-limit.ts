import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { authRateLimits } from "./db/schema";

/** Contador atómico compartido entre instancias, con ventana fija y clave opaca por el caller. */
export async function consumeRateLimit(key: string, max: number, windowMs: number, now = Date.now()) {
  const window = Math.floor(now / windowMs) * windowMs;
  const [row] = await db.insert(authRateLimits).values({ id: key, key, count: 1, lastRequest: window }).onConflictDoUpdate({
    target: authRateLimits.key,
    set: {
      count: sql`case when ${authRateLimits.lastRequest} = ${window} then ${authRateLimits.count} + 1 else 1 end`,
      lastRequest: window,
    },
  }).returning({ count: authRateLimits.count });
  return row.count <= max;
}
