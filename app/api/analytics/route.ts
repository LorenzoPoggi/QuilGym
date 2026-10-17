import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { analyticsEnabled, analyticsIds, insertAnalyticsEvent } from "@/lib/analytics";
import { cleanUtm, isBot, normalizePath, productSlugFromPath, referrerHost } from "@/lib/analytics-core";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * Visita de página (analítica propia y anónima). Solo mismo origen, sin bots, con límite por visitante.
 * Responde 204 siempre que el pedido sea válido, aunque la analítica esté apagada: el navegador no necesita saberlo.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return new Response(null, { status: 403 });
  const userAgent = request.headers.get("user-agent");
  if (isBot(userAgent)) return done();
  const text = await request.text().catch(() => "");
  if (text.length > 2048) return new Response(null, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(text) as Record<string, unknown>; } catch { return new Response(null, { status: 400 }); }
  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  const path = normalizePath(body.path);
  if (!path) return new Response(null, { status: 400 });
  try {
    if (!await analyticsEnabled()) return done();
    const ids = analyticsIds(await cookies(), true);
    if (!ids || !await consumeRateLimit(`analytics:${ids.visitorId}`, 120, 60_000)) return done();
    const productSlug = productSlugFromPath(path);
    await insertAnalyticsEvent({
      ...ids, type: productSlug ? "product_view" : "page_view", path, productSlug, userAgent,
      referrerHost: referrerHost(body.referrer, request.nextUrl.hostname),
      utmSource: cleanUtm(body.utmSource), utmMedium: cleanUtm(body.utmMedium), utmCampaign: cleanUtm(body.utmCampaign),
    });
  } catch (error) {
    console.warn("[Analítica] No se pudo registrar la visita", { reason: error instanceof Error ? error.name : "error" });
  }
  return done();
}
