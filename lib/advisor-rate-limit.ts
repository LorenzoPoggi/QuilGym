import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { authRateLimits } from "./db/schema";
import { googleAdvisorKey } from "./advisor-config";

function signature(id: string) { return createHmac("sha256", googleAdvisorKey()).update(`quilgym-advisor:${id}`).digest("hex"); }
export function advisorVisitor(cookie?: string) {
  const [id = "", signed = ""] = (cookie ?? "").split(".");
  if (/^[a-f0-9-]{36}$/.test(id) && /^[a-f0-9]{64}$/.test(signed) && timingSafeEqual(Buffer.from(signed), Buffer.from(signature(id)))) return { id, cookie: `${id}.${signed}` };
  const next = randomUUID();
  return { id: next, cookie: `${next}.${signature(next)}` };
}

/** Upsert atómico compartido por todas las instancias; sin almacenar IP ni conversación. */
export async function consumeAdvisorLimit(key: string, max: number, windowMs: number, now = Date.now()) {
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

export async function allowAdvisorRequest(visitorId: string) {
  if (!await consumeAdvisorLimit("advisor:global:day", 200, 86400000)) return false;
  if (!await consumeAdvisorLimit("advisor:global:minute", 30, 60000)) return false;
  return consumeAdvisorLimit(`advisor:visitor:${visitorId}`, 8, 60000);
}
