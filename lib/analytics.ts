import "server-only";
import { randomUUID } from "node:crypto";
import { lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { db } from "./db";
import { analyticsEvents, analyticsOrderVisitors } from "./db/schema";
import { tableExists } from "./db/table-exists";
import { deviceFromUserAgent, isBot, isUuid, normalizePath, productSlugFromPath, type AnalyticsEventType } from "./analytics-core";

export const VISITOR_COOKIE = "qg_vid";
export const SESSION_COOKIE = "qg_sid";
const VISITOR_MAX_AGE = 395 * 24 * 60 * 60; // ~13 meses
const SESSION_MAX_AGE = 30 * 60; // la sesión se corta tras 30 minutos sin actividad
export const ANALYTICS_RETENTION_DAYS = 400;

let enabledCache: { value: boolean; at: number } | null = null;
/** La analítica se apaga sola si falta la migración 0011. El resultado se cachea 5 minutos por instancia. */
export async function analyticsEnabled() {
  if (enabledCache && Date.now() - enabledCache.at < 5 * 60_000) return enabledCache.value;
  const value = await tableExists(db, "analytics_events") && await tableExists(db, "analytics_order_visitors");
  enabledCache = { value, at: Date.now() };
  return value;
}

type Ids = { visitorId: string; sessionId: string };
type CookieStore = Awaited<ReturnType<typeof cookies>>;

/** Lee los ids anónimos; si `create`, genera los que falten y renueva la sesión (solo en Route Handlers y Server Actions). */
export function analyticsIds(store: CookieStore, create: boolean): Ids | null {
  let visitorId = store.get(VISITOR_COOKIE)?.value;
  let sessionId = store.get(SESSION_COOKIE)?.value;
  if (!create) return isUuid(visitorId) && isUuid(sessionId) ? { visitorId, sessionId } : null;
  if (!isUuid(visitorId)) visitorId = randomUUID();
  if (!isUuid(sessionId)) sessionId = randomUUID();
  const base = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  try {
    store.set(VISITOR_COOKIE, visitorId, { ...base, maxAge: VISITOR_MAX_AGE });
    store.set(SESSION_COOKIE, sessionId, { ...base, maxAge: SESSION_MAX_AGE });
  } catch { return null; } // Server Component: no se pueden escribir cookies.
  return { visitorId, sessionId };
}

export type EventInput = Ids & {
  type: AnalyticsEventType; path: string; productSlug?: string | null; referrerHost?: string | null;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null; userAgent: string | null;
};

export async function insertAnalyticsEvent(event: EventInput) {
  if (!await analyticsEnabled()) return;
  await db.insert(analyticsEvents).values({
    visitorId: event.visitorId, sessionId: event.sessionId, type: event.type, path: event.path, productSlug: event.productSlug ?? null,
    referrerHost: event.referrerHost ?? null, utmSource: event.utmSource ?? null, utmMedium: event.utmMedium ?? null, utmCampaign: event.utmCampaign ?? null,
    device: deviceFromUserAgent(event.userAgent),
  });
}

/**
 * Evento de negocio registrado en el servidor (agregar al carrito, entrar al checkout), así no lo pierde un bloqueador.
 * Lee cookies y headers ahora y guarda después de responder. Nunca hace fallar la acción que lo llama.
 */
export async function trackServerEvent(type: Extract<AnalyticsEventType, "add_to_cart" | "checkout_start">, options: { productSlug?: string | null; canWriteCookies: boolean }) {
  try {
    const [store, headerList] = await Promise.all([cookies(), headers()]);
    const userAgent = headerList.get("user-agent");
    if (isBot(userAgent)) return;
    const ids = analyticsIds(store, options.canWriteCookies);
    if (!ids) return;
    let path = type === "checkout_start" ? "/checkout" : "/";
    try { path = normalizePath(new URL(headerList.get("referer") ?? "").pathname) ?? path; } catch { /* sin referer */ }
    const productSlug = options.productSlug ?? productSlugFromPath(path);
    after(() => insertAnalyticsEvent({ ...ids, type, path, productSlug, userAgent }).catch(() => undefined));
  } catch { /* La analítica es accesoria. */ }
}

/** Vincula el pedido recién creado con la visita que lo hizo (conversión). */
export async function linkOrderToVisit(orderId: string) {
  try {
    const ids = analyticsIds(await cookies(), true);
    if (!ids) return;
    after(async () => {
      if (!await analyticsEnabled()) return;
      await db.insert(analyticsOrderVisitors).values({ orderId, ...ids }).onConflictDoNothing().catch(() => undefined);
    });
  } catch { /* La analítica es accesoria. */ }
}

/** Purga diaria de eventos crudos viejos (los pedidos y sus totales no se tocan). */
export async function purgeOldAnalytics(now = new Date()) {
  if (!await analyticsEnabled()) return 0;
  const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60_000);
  const deleted = await db.delete(analyticsEvents).where(lt(analyticsEvents.occurredAt, cutoff)).returning({ id: analyticsEvents.id });
  return deleted.length;
}
