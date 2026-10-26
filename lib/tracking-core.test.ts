import { describe, expect, it } from "vitest";
import { buildTimeline, carrierTrackingPage, etaWindowFromChoice, formatEtaWindow, isCourierPositionFresh, needsTrackingSync, safeExternalHttpsUrl, trackingSteps } from "./tracking-core";

const at = (iso: string) => new Date(iso);
const event = (iso: string, description: string, source = "admin") => ({ occurredAt: at(iso), status: "x", description, location: null, source });

describe("línea de tiempo", () => {
  it("ordena de más reciente a más antigua, descarta duplicados y eventos inválidos", () => {
    const timeline = buildTimeline([
      event("2026-10-17T10:00:00Z", "Preparando"),
      event("2026-10-17T15:00:00Z", "En camino"),
      event("2026-10-17T15:00:00Z", "en camino ", "carrier"),
      event("2026-10-17T12:00:00Z", "  "),
      { ...event("2026-10-17T13:00:00Z", "Fecha rota"), occurredAt: new Date("nope") },
    ]);
    expect(timeline.map((item) => item.description)).toEqual(["En camino", "Preparando"]);
  });
  it("respeta el tope", () => {
    const many = Array.from({ length: 40 }, (_, index) => event(new Date(Date.UTC(2026, 9, 1, index)).toISOString(), `Evento ${index}`));
    expect(buildTimeline(many, 30)).toHaveLength(30);
    expect(buildTimeline(many, 30)[0].description).toBe("Evento 39");
  });
});

describe("pasos del pedido", () => {
  const states = (steps: ReturnType<typeof trackingSteps>) => steps?.map((step) => `${step.key}:${step.state}`);
  it("entrega propia pagada y en camino", () => {
    expect(states(trackingSteps({ delivery: "local", orderStatus: "approved", paymentMethod: "mercadopago", shipmentStatus: "out_for_delivery" })))
      .toEqual(["received:done", "payment:done", "preparing:done", "out_for_delivery:current", "delivered:todo"]);
  });
  it("con efectivo el pago va al final y el pedido avanza aunque esté pendiente", () => {
    expect(states(trackingSteps({ delivery: "local", orderStatus: "pending", paymentMethod: "cash", shipmentStatus: "pending" })))
      .toEqual(["received:done", "preparing:current", "out_for_delivery:todo", "delivered:todo", "payment:todo"]);
  });
  it("sin pago aprobado los pasos del envío esperan", () => {
    expect(states(trackingSteps({ delivery: "shipping", orderStatus: "pending", paymentMethod: "mercadopago", shipmentStatus: "pending" })))
      .toEqual(["received:done", "payment:current", "preparing:todo", "shipped:todo", "out_for_delivery:todo", "delivered:todo"]);
  });
  it("entregado completa todo y los pedidos cerrados no muestran pasos", () => {
    expect(states(trackingSteps({ delivery: "pickup", orderStatus: "approved", paymentMethod: "mercadopago", shipmentStatus: "delivered" })))
      .toEqual(["received:done", "payment:done", "preparing:done", "ready_for_pickup:done", "delivered:done"]);
    expect(trackingSteps({ delivery: "local", orderStatus: "cancelled", paymentMethod: "mercadopago", shipmentStatus: "pending" })).toBeNull();
  });
});

describe("ventana de llegada", () => {
  const now = at("2026-10-17T13:00:00-03:00");
  it("formatea en la hora de Argentina", () => {
    expect(formatEtaWindow(at("2026-10-17T14:00:00-03:00"), at("2026-10-17T18:00:00-03:00"), now)).toBe("Llega hoy entre las 14:00 y las 18:00");
    expect(formatEtaWindow(at("2026-10-18T09:00:00-03:00"), at("2026-10-18T12:30:00-03:00"), now)).toBe("Llega mañana entre las 09:00 y las 12:30");
    expect(formatEtaWindow(at("2026-10-17T22:00:00-03:00"), at("2026-10-18T10:00:00-03:00"), now)).toBe("Llega entre hoy a las 22:00 y mañana a las 10:00");
    expect(formatEtaWindow(null, at("2026-10-17T18:00:00-03:00"), now)).toBeNull();
    expect(formatEtaWindow(at("2026-10-17T18:00:00-03:00"), at("2026-10-17T14:00:00-03:00"), now)).toBeNull();
  });
  it("calcula las opciones rápidas y valida la personalizada", () => {
    expect(etaWindowFromChoice({ kind: "5h" }, now)).toEqual({ from: now, to: new Date(now.getTime() + 5 * 3_600_000) });
    expect(etaWindowFromChoice({ kind: "24h" }, now)?.to.getTime()).toBe(now.getTime() + 24 * 3_600_000);
    const custom = { kind: "custom", from: "2026-10-17T16:00:00-03:00", to: "2026-10-17T19:00:00-03:00" };
    expect(etaWindowFromChoice(custom, now)).toEqual({ from: at(custom.from), to: at(custom.to) });
    expect(etaWindowFromChoice({ ...custom, to: custom.from }, now)).toBeNull();
    expect(etaWindowFromChoice({ ...custom, from: "2026-10-17T08:00:00-03:00" }, now)).toBeNull();
    expect(etaWindowFromChoice({ ...custom, to: "2026-11-30T10:00:00-03:00" }, now)).toBeNull();
    expect(etaWindowFromChoice({ kind: "3h" }, now)).toBeNull();
    expect(etaWindowFromChoice(null, now)).toBeNull();
  });
});

describe("frescura", () => {
  const now = Date.parse("2026-10-17T16:00:00Z");
  it("sincroniza con el transportista cada 30 minutos", () => {
    expect(needsTrackingSync(null, now)).toBe(true);
    expect(needsTrackingSync(new Date(now - 10 * 60_000), now)).toBe(false);
    expect(needsTrackingSync(new Date(now - 31 * 60_000), now)).toBe(true);
  });
  it("descarta la posición del repartidor pasadas 4 horas", () => {
    expect(isCourierPositionFresh(new Date(now - 3 * 3_600_000), now)).toBe(true);
    expect(isCourierPositionFresh(new Date(now - 5 * 3_600_000), now)).toBe(false);
    expect(isCourierPositionFresh(null, now)).toBe(false);
  });
  it("usa la URL del transportista solo si es https", () => {
    expect(carrierTrackingPage("correo_argentino", "https://example.com/x")).toBe("https://example.com/x");
    expect(carrierTrackingPage("correo_argentino", "javascript:alert(1)")).toMatch(/^https:\/\/www\.correoargentino\.com\.ar\//);
    expect(carrierTrackingPage("own", null)).toBeNull();
  });
  it("rechaza credenciales, protocolos inseguros y URLs excesivas", () => {
    expect(safeExternalHttpsUrl("https://tracking.example/path?q=1")).toBe("https://tracking.example/path?q=1");
    expect(safeExternalHttpsUrl("https://user:secret@tracking.example/path")).toBeNull();
    expect(safeExternalHttpsUrl("http://tracking.example/path")).toBeNull();
    expect(safeExternalHttpsUrl("https://tracking.example/" + "a".repeat(2048))).toBeNull();
    expect(safeExternalHttpsUrl("not a url")).toBeNull();
  });
});
