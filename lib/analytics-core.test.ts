import { describe, expect, it } from "vitest";
import { cleanUtm, deviceFromUserAgent, funnel, isBot, normalizePath, productInterest, productSlugFromPath, referrerHost, sourceLabel, trafficSummary, type TrafficTotals } from "./analytics-core";

const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ipad = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const androidTablet = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

describe("captura", () => {
  it("clasifica el dispositivo", () => {
    expect(deviceFromUserAgent(chrome)).toBe("desktop");
    expect(deviceFromUserAgent(iphone)).toBe("mobile");
    expect(deviceFromUserAgent(ipad)).toBe("tablet");
    expect(deviceFromUserAgent(androidTablet)).toBe("tablet");
    expect(deviceFromUserAgent(null)).toBe("desktop");
  });

  it("descarta robots, previsualizadores y navegadores automatizados", () => {
    expect(isBot(chrome)).toBe(false);
    expect(isBot(iphone)).toBe(false);
    for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "WhatsApp/2.23", "Mozilla/5.0 HeadlessChrome/140.0", "curl/8.4.0", "", null]) expect(isBot(ua)).toBe(true);
  });

  it("normaliza la ruta y rechaza el panel, la API y valores raros", () => {
    expect(normalizePath("/productos/creatina-star?utm_source=ig#x")).toBe("/productos/creatina-star");
    expect(normalizePath("/carrito/")).toBe("/carrito");
    expect(normalizePath("/")).toBe("/");
    for (const raw of ["/admin/pedidos", "/api/cart", "/_next/static/x.js", "//evil.com", "https://x.com/", "productos", 42, null, `/${"a".repeat(300)}`]) expect(normalizePath(raw)).toBeNull();
  });

  it("reconoce la ficha de producto", () => {
    expect(productSlugFromPath("/productos/creatina-star-300g")).toBe("creatina-star-300g");
    expect(productSlugFromPath("/productos")).toBeNull();
    expect(productSlugFromPath("/productos/a/b")).toBeNull();
  });

  it("guarda solo el dominio externo que trajo la visita", () => {
    expect(referrerHost("https://www.google.com/search?q=creatina", "quilgym.vercel.app")).toBe("google.com");
    expect(referrerHost("https://quilgym.vercel.app/productos", "quilgym.vercel.app")).toBeNull();
    expect(referrerHost("javascript:alert(1)", "quilgym.vercel.app")).toBeNull();
    expect(referrerHost("no es una url", "quilgym.vercel.app")).toBeNull();
  });

  it("limpia los parámetros utm", () => {
    expect(cleanUtm(" Instagram ")).toBe("instagram");
    expect(cleanUtm("<script>")).toBeNull();
    expect(cleanUtm(5)).toBeNull();
  });

  it("nombra el origen del tráfico", () => {
    expect(sourceLabel({ utmSource: "instagram", referrerHost: "google.com" })).toBe("Instagram");
    expect(sourceLabel({ utmSource: null, referrerHost: "google.com.ar" })).toBe("Google");
    expect(sourceLabel({ utmSource: null, referrerHost: "l.instagram.com" })).toBe("Instagram");
    expect(sourceLabel({ utmSource: null, referrerHost: null })).toBe("Directo");
    expect(sourceLabel({ utmSource: null, referrerHost: "blog.ejemplo.com" })).toBe("blog.ejemplo.com");
  });
});

const totals: TrafficTotals = { visitors: 200, newVisitors: 150, sessions: 250, pageViews: 1000, productSessions: 120, cartSessions: 40, checkoutSessions: 20, purchaseSessions: 10, buyers: 9, orders: 11, revenue: 550_000 };

describe("tablero", () => {
  it("calcula conversión, abandono y promedios", () => {
    const s = trafficSummary(totals);
    expect(s.conversionRate).toBeCloseTo(0.04);
    expect(s.buyerRate).toBeCloseTo(0.045);
    expect(s.cartAbandonment).toBeCloseTo(0.75);
    expect(s.checkoutAbandonment).toBeCloseTo(0.5);
    expect(s.pagesPerSession).toBe(4);
    expect(s.revenuePerVisitor).toBe(2750);
    expect(s.returningVisitors).toBe(50);
  });

  it("sin datos no divide por cero", () => {
    const s = trafficSummary({ ...totals, visitors: 0, newVisitors: 0, sessions: 0, pageViews: 0, productSessions: 0, cartSessions: 0, checkoutSessions: 0, purchaseSessions: 0, buyers: 0 });
    expect([s.conversionRate, s.buyerRate, s.cartAbandonment, s.checkoutAbandonment, s.pagesPerSession, s.revenuePerVisitor]).toEqual([null, null, null, null, null, null]);
  });

  it("arma el embudo con la caída entre etapas", () => {
    const steps = funnel(totals);
    expect(steps.map((step) => step.sessions)).toEqual([250, 120, 40, 20, 10]);
    expect(steps[0].fromStart).toBe(1);
    expect(steps[2].fromPrevious).toBeCloseTo(40 / 120);
    expect(steps[4].fromStart).toBeCloseTo(0.04);
  });

  it("cruza vistas y ventas por producto", () => {
    const rows = productInterest([{ slug: "a", name: "A", views: 100 }, { slug: "b", name: "B", views: 300 }], [{ slug: "a", units: 10 }]);
    expect(rows.map((row) => row.slug)).toEqual(["b", "a"]);
    expect(rows[0].units).toBe(0);
    expect(rows[1].viewToSale).toBeCloseTo(0.1);
  });
});
