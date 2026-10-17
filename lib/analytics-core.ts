/**
 * Analítica propia: reglas puras (sin base de datos ni Next) para limpiar lo que manda el navegador y calcular el
 * embudo del tablero. Nunca se guarda IP, email ni datos personales: solo ids aleatorios, la ruta y el origen.
 */

export type AnalyticsEventType = "page_view" | "product_view" | "add_to_cart" | "checkout_start";
export type Device = "mobile" | "tablet" | "desktop";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/** Robots, previsualizadores de links y navegadores automatizados (incluidos los E2E) no cuentan como visitas. */
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|axios|node-fetch|undici|go-http|java\/|okhttp|playwright|puppeteer|selenium/i;
export const isBot = (userAgent: string | null | undefined) => !userAgent || userAgent.length < 10 || BOT.test(userAgent);

export function deviceFromUserAgent(userAgent: string | null | undefined): Device {
  const ua = userAgent ?? "";
  if (/ipad|tablet|kindle|silk|playbook|android(?!.*mobile)/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** Ruta limpia (sin query ni hash). Rechaza rutas internas, del panel o de la API. */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.length > 300) return null;
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (!/^[\w\-./%~]*$/.test(path) || path.length > 200) return null;
  if (/^\/(admin|api|_next)(\/|$)/.test(path)) return null;
  return path;
}

export function productSlugFromPath(path: string) {
  return /^\/productos\/([a-z0-9-]{1,120})$/.exec(path)?.[1] ?? null;
}

/** Dominio externo de donde vino la visita; null si es directo o del propio sitio. */
export function referrerHost(referrer: unknown, ownHost: string): string | null {
  if (typeof referrer !== "string" || !referrer || referrer.length > 500) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host && host !== ownHost.toLowerCase().replace(/^www\./, "") ? host.slice(0, 120) : null;
  } catch { return null; }
}

export function cleanUtm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toLowerCase().slice(0, 60);
  return /^[a-z0-9._\- ]+$/.test(clean) ? clean : null;
}

/** Nombre legible del origen: la campaña (utm_source) manda; si no, el dominio que trajo la visita. */
export function sourceLabel(input: { utmSource: string | null; referrerHost: string | null }) {
  if (input.utmSource) return input.utmSource.charAt(0).toUpperCase() + input.utmSource.slice(1);
  const host = input.referrerHost;
  if (!host) return "Directo";
  if (/(^|\.)google\./.test(host)) return "Google";
  if (/instagram\.com$/.test(host)) return "Instagram";
  if (/facebook\.com$|fb\.com$|fb\.me$/.test(host)) return "Facebook";
  if (/whatsapp\.com$|wa\.me$/.test(host)) return "WhatsApp";
  if (/tiktok\.com$/.test(host)) return "TikTok";
  if (/bing\.com$/.test(host)) return "Bing";
  if (/mercadolibre\.|mercadopago\./.test(host)) return "Mercado Libre / Pago";
  return host;
}

/** Totales del período que lee el servidor. Las etapas del embudo se cuentan por sesión. */
export type TrafficTotals = {
  visitors: number; newVisitors: number; sessions: number; pageViews: number;
  productSessions: number; cartSessions: number; checkoutSessions: number; purchaseSessions: number;
  buyers: number; orders: number; revenue: number;
};

export type FunnelStep = { key: string; label: string; sessions: number; fromStart: number | null; fromPrevious: number | null };

const ratio = (part: number, whole: number) => whole > 0 ? Math.min(1, part / whole) : null;

export function funnel(t: TrafficTotals): FunnelStep[] {
  const steps = [
    { key: "visit", label: "Visitaron la tienda", sessions: t.sessions },
    { key: "product", label: "Vieron un producto", sessions: t.productSessions },
    { key: "cart", label: "Agregaron al carrito", sessions: t.cartSessions },
    { key: "checkout", label: "Empezaron el checkout", sessions: t.checkoutSessions },
    { key: "purchase", label: "Compraron", sessions: t.purchaseSessions },
  ];
  return steps.map((step, index) => ({ ...step, fromStart: index === 0 ? (t.sessions ? 1 : null) : ratio(step.sessions, t.sessions), fromPrevious: index === 0 ? null : ratio(step.sessions, steps[index - 1].sessions) }));
}

export type TrafficSummary = {
  visitors: number; sessions: number; pageViews: number; pagesPerSession: number | null;
  conversionRate: number | null; buyerRate: number | null; cartAbandonment: number | null; checkoutAbandonment: number | null;
  revenuePerVisitor: number | null; newVisitors: number; returningVisitors: number; orders: number; revenue: number;
};

export function trafficSummary(t: TrafficTotals): TrafficSummary {
  const abandon = (started: number) => started > 0 ? Math.max(0, 1 - t.purchaseSessions / started) : null;
  return {
    visitors: t.visitors, sessions: t.sessions, pageViews: t.pageViews,
    pagesPerSession: t.sessions ? t.pageViews / t.sessions : null,
    conversionRate: ratio(t.purchaseSessions, t.sessions),
    buyerRate: ratio(t.buyers, t.visitors),
    cartAbandonment: abandon(t.cartSessions),
    checkoutAbandonment: abandon(t.checkoutSessions),
    revenuePerVisitor: t.visitors ? Math.round(t.revenue / t.visitors) : null,
    newVisitors: Math.min(t.newVisitors, t.visitors), returningVisitors: Math.max(0, t.visitors - t.newVisitors),
    orders: t.orders, revenue: t.revenue,
  };
}

export type ProductInterestRow = { slug: string; name: string; views: number; units: number; viewToSale: number | null };
/** Cruza vistas y ventas por producto. Los de muchas vistas y pocas ventas son oportunidades (precio, fotos, stock). */
export function productInterest(views: { slug: string; name: string; views: number }[], sales: { slug: string; units: number }[], limit = 10): ProductInterestRow[] {
  const sold = new Map(sales.map((row) => [row.slug, row.units]));
  return views.map((row) => {
    const units = sold.get(row.slug) ?? 0;
    return { ...row, units, viewToSale: row.views > 0 ? Math.min(1, units / row.views) : null };
  }).sort((a, b) => b.views - a.views || b.units - a.units).slice(0, limit);
}
