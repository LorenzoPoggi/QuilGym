import { describe, expect, it } from "vitest";
import { byCategory, byPayment, change, daily, resolveRange, summarize, topProducts, type MetricsConfig, type MetricsOrder } from "./admin-metrics-core";

const noConfig: MetricsConfig = { salesTaxPercent: null, estimatedMercadoPagoFeePercent: null };
const order = (overrides: Partial<MetricsOrder> = {}): MetricsOrder => ({
  id: "o1", createdAt: new Date("2026-10-10T15:00:00Z"), subtotalArs: 100_000, discountArs: 0, shippingArs: 4_500, totalArs: 104_500,
  paymentMethod: "mercadopago", paymentChoice: "credit_card", feeArs: 7_000,
  items: [{ slug: "proteina", name: "Proteína", category: "Proteínas", quantity: 2, unitPriceArs: 50_000, unitCostArs: 30_000, costFromSale: true }],
  ...overrides,
});

describe("períodos", () => {
  const now = new Date("2026-10-13T15:00:00Z");
  it("últimos 30 días por defecto y período anterior de igual largo", () => {
    const range = resolveRange({}, now);
    expect(range).toMatchObject({ preset: "30d", from: "2026-09-14", to: "2026-10-13" });
    expect(range.days).toHaveLength(30);
    expect(range.start.toISOString()).toBe("2026-09-14T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-14T03:00:00.000Z");
    expect(range.prevStart.toISOString()).toBe("2026-08-15T03:00:00.000Z");
  });
  it("este mes y mes anterior", () => {
    expect(resolveRange({ p: "mes" }, now)).toMatchObject({ from: "2026-10-01", to: "2026-10-13" });
    expect(resolveRange({ p: "mes-anterior" }, now)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  });
  it("usa la fecha de Argentina cerca de medianoche", () => {
    expect(resolveRange({ p: "hoy" }, new Date("2026-10-14T02:30:00Z"))).toMatchObject({ from: "2026-10-13", to: "2026-10-13" });
  });
  it("personalizado válido, recortado a hoy, y vuelve a 30 días si es inválido", () => {
    expect(resolveRange({ p: "personalizado", desde: "2026-10-01", hasta: "2026-12-31" }, now)).toMatchObject({ from: "2026-10-01", to: "2026-10-13" });
    expect(resolveRange({ p: "personalizado", desde: "2026-10-20", hasta: "2026-10-01" }, now).preset).toBe("30d");
    expect(resolveRange({ p: "personalizado", desde: "2026-02-31", hasta: "2026-03-01" }, now).preset).toBe("30d");
  });
});

describe("resumen de rentabilidad", () => {
  it("calcula ganancia neta y margen con costo y comisión reales", () => {
    const s = summarize([order()], noConfig);
    expect(s).toMatchObject({ sales: 104_500, netSales: 100_000, orders: 1, units: 2, cogs: 60_000, fees: 7_000, shipping: 4_500, profit: 33_000, averageTicket: 104_500 });
    expect(s.margin).toBeCloseTo(0.33);
  });
  it("descuenta cupones e impuestos sobre las ventas netas", () => {
    const s = summarize([order({ discountArs: 10_000, totalArs: 94_500 })], { salesTaxPercent: 3.5, estimatedMercadoPagoFeePercent: null });
    expect(s.netSales).toBe(90_000);
    expect(s.taxes).toBe(3_150);
    expect(s.profit).toBe(90_000 - 60_000 - 7_000 - 3_150);
  });
  it("estima la comisión de pagos viejos solo si está configurada; efectivo no tiene comisión", () => {
    const old = order({ feeArs: null });
    expect(summarize([old], noConfig).coverage).toMatchObject({ mercadoPagoOrders: 1, missingFees: 1, realFees: 0 });
    const estimated = summarize([old], { salesTaxPercent: null, estimatedMercadoPagoFeePercent: 6 });
    expect(estimated.fees).toBe(Math.round(104_500 * 0.06));
    expect(estimated.coverage.estimatedFees).toBe(1);
    expect(summarize([order({ paymentMethod: "cash", paymentChoice: "cash", feeArs: null })], noConfig).fees).toBe(0);
  });
  it("informa productos sin costo y costos estimados", () => {
    const s = summarize([order({ items: [
      { slug: "a", name: "A", category: "X", quantity: 1, unitPriceArs: 60_000, unitCostArs: null, costFromSale: false },
      { slug: "b", name: "B", category: "X", quantity: 1, unitPriceArs: 40_000, unitCostArs: 20_000, costFromSale: false },
    ] })], noConfig);
    expect(s.coverage).toMatchObject({ units: 2, unitsWithCost: 1, unitsWithEstimatedCost: 1 });
    expect(s.cogs).toBe(20_000);
  });
  it("sin ventas no hay margen", () => {
    expect(summarize([], noConfig)).toMatchObject({ sales: 0, orders: 0, averageTicket: 0, margin: null });
  });
});

describe("comparación y desgloses", () => {
  it("variación contra el período anterior", () => {
    expect(change(150, 100)).toBeCloseTo(0.5);
    expect(change(50, 100)).toBeCloseTo(-0.5);
    expect(change(10, 0)).toBeNull();
  });
  it("agrupa por día en hora de Argentina", () => {
    const range = resolveRange({ p: "7d" }, new Date("2026-10-13T15:00:00Z"));
    const points = daily([order({ createdAt: new Date("2026-10-11T02:00:00Z") })], range, noConfig);
    expect(points).toHaveLength(7);
    expect(points.find((p) => p.day === "2026-10-10")).toMatchObject({ sales: 104_500, orders: 1, profit: 33_000 });
  });
  it("ranking de productos con descuento prorrateado y margen solo con costo completo", () => {
    const rows = topProducts([order({ discountArs: 10_000, totalArs: 94_500 }), order({ id: "o2", items: [{ slug: "creatina", name: "Creatina", category: "Creatinas", quantity: 1, unitPriceArs: 30_000, unitCostArs: null, costFromSale: false }], subtotalArs: 30_000, totalArs: 34_500 })]);
    expect(rows[0]).toMatchObject({ slug: "proteina", units: 2, revenue: 90_000, cogs: 60_000, profit: 30_000, costComplete: true });
    expect(rows[1]).toMatchObject({ slug: "creatina", costComplete: false, margin: null });
  });
  it("ventas por medio de pago y por categoría con participación", () => {
    const orders = [order(), order({ id: "o2", paymentMethod: "cash", paymentChoice: "cash", feeArs: null, totalArs: 54_500, subtotalArs: 50_000,
      items: [{ slug: "creatina", name: "Creatina", category: "Creatinas", quantity: 1, unitPriceArs: 50_000, unitCostArs: 25_000, costFromSale: true }] })];
    const payments = byPayment(orders);
    expect(payments.map((row) => row.label)).toEqual(["Tarjeta de crédito", "Efectivo"]);
    expect(payments[0].share + payments[1].share).toBeCloseTo(1);
    expect(byCategory(orders)).toMatchObject([{ label: "Proteínas", value: 100_000, orders: 1 }, { label: "Creatinas", value: 50_000, orders: 1 }]);
  });
});
