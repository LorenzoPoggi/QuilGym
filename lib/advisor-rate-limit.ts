import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { googleAdvisorKey } from "./advisor-config";
import { consumeRateLimit } from "./rate-limit";

function signature(id: string) { return createHmac("sha256", googleAdvisorKey()).update(`quilgym-advisor:${id}`).digest("hex"); }
export function advisorVisitor(cookie?: string) {
  const [id = "", signed = ""] = (cookie ?? "").split(".");
  if (/^[a-f0-9-]{36}$/.test(id) && /^[a-f0-9]{64}$/.test(signed) && timingSafeEqual(Buffer.from(signed), Buffer.from(signature(id)))) return { id, cookie: `${id}.${signed}` };
  const next = randomUUID();
  return { id: next, cookie: `${next}.${signature(next)}` };
}

/** Alias de compatibilidad para el límite específico del asesor. */
export const consumeAdvisorLimit = consumeRateLimit;

export async function allowAdvisorRequest(visitorId: string) {
  if (!await consumeAdvisorLimit("advisor:global:day", 200, 86400000)) return false;
  if (!await consumeAdvisorLimit("advisor:global:minute", 30, 60000)) return false;
  return consumeAdvisorLimit(`advisor:visitor:${visitorId}`, 8, 60000);
}
