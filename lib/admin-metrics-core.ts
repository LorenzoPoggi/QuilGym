/**
 * Cálculos puros del tablero de ventas y rentabilidad (sin base de datos, con tests).
 * Ganancia neta = ventas netas de productos − costo de mercadería − comisiones − impuestos.
 * El envío cobrado se considera neutro (se cobra lo que cuesta); se informa aparte.
 */

export type MetricsPreset = "hoy" | "7d" | "30d" | "mes" | "mes-anterior" | "personalizado";
export type MetricsItem = { slug: string; name: string; category: string; quantity: number; unitPriceArs: number; unitCostArs: number | null; costFromSale: boolean };
export type MetricsOrder = {
  id: string; createdAt: Date; subtotalArs: number; discountArs: number; shippingArs: number; totalArs: number;
  paymentMethod: "mercadopago" | "transfer" | "cash"; paymentChoice: string; feeArs: number | null; items: MetricsItem[];
};
export type MetricsConfig = { salesTaxPercent: number | null; estimatedMercadoPagoFeePercent: number | null };
export type MetricsRange = { preset: MetricsPreset; start: Date; end: Date; prevStart: Date; prevEnd: Date; from: string; to: string; label: string; days: string[] };

const DAY = 86_400_000;
const OFFSET = 3 * 3_600_000; // Argentina: UTC−3 todo el año.
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const argentinaDate = (date: Date) => new Date(date.getTime() - OFFSET).toISOString().slice(0, 10);
export const argentinaDayStart = (day: string) => new Date(`${day}T00:00:00.000-03:00`);
const addDays = (day: string, amount: number) => argentinaDate(new Date(argentinaDayStart(day).getTime() + amount * DAY));
const daysBetween = (from: string, to: string) => Math.round((argentinaDayStart(to).getTime() - argentinaDayStart(from).getTime()) / DAY) + 1;
const validDay = (value: string | undefined): value is string => !!value && datePattern.test(value) && argentinaDate(argentinaDayStart(value)) === value;
const shortDay = (day: string) => { const [, m, d] = day.split("-"); return `${Number(d)}/${Number(m)}`; };

export const presetLabels: Record<MetricsPreset, string> = {
  hoy: "Hoy", "7d": "Últimos 7 días", "30d": "Últimos 30 días", mes: "Este mes", "mes-anterior": "Mes anterior", personalizado: "Personalizado",
};

/** Resuelve el período pedido por URL; el anterior tiene la misma cantidad de días y termina donde empieza este. */
export function resolveRange(params: { p?: string; desde?: string; hasta?: string }, now = new Date()): MetricsRange {
  const today = argentinaDate(now);
  let preset: MetricsPreset = (Object.keys(presetLabels) as MetricsPreset[]).includes(params.p as MetricsPreset) ? params.p as MetricsPreset : "30d";
  let from: string, to: string;
  if (preset === "personalizado" && validDay(params.desde) && validDay(params.hasta) && params.desde <= params.hasta && daysBetween(params.desde, params.hasta) <= 731) {
    from = params.desde; to = params.hasta > today ? today : params.hasta;
    if (from > to) from = to;
  } else {
    if (preset === "personalizado") preset = "30d";
    const month = today.slice(0, 7);
    if (preset === "hoy") { from = today; to = today; }
    else if (preset === "7d") { from = addDays(today, -6); to = today; }
    else if (preset === "mes") { from = `${month}-01`; to = today; }
    else if (preset === "mes-anterior") { to = addDays(`${month}-01`, -1); from = `${to.slice(0, 7)}-01`; }
    else { from = addDays(today, -29); to = today; }
  }
  const length = daysBetween(from, to);
  const start = argentinaDayStart(from), end = argentinaDayStart(addDays(to, 1));
  const prevStart = argentinaDayStart(addDays(from, -length));
  const days = Array.from({ length }, (_, index) => addDays(from, index));
  const label = from === to ? shortDay(from) : `${shortDay(from)} al ${shortDay(to)}`;
  return { preset, start, end, prevStart, prevEnd: start, from, to, label, days };
}

export const paymentLabels: Record<string, string> = {
  mercadopago: "Mercado Pago", mercado_credito: "Mercado Crédito", debit_card: "Tarjeta de débito", credit_card: "Tarjeta de crédito", cash: "Efectivo", transfer: "Transferencia",
};

type OrderResult = { net: number; cogs: number; fee: number; tax: number; profit: number; units: number; unitsWithCost: number; unitsWithSaleCost: number; feeKind: "none" | "real" | "estimated" | "missing" };

function evaluateOrder(order: MetricsOrder, config: MetricsConfig): OrderResult {
  const net = order.subtotalArs - order.discountArs;
  let cogs = 0, units = 0, unitsWithCost = 0, unitsWithSaleCost = 0;
  for (const item of order.items) {
    units += item.quantity;
    if (item.unitCostArs !== null) { cogs += item.unitCostArs * item.quantity; unitsWithCost += item.quantity; if (item.costFromSale) unitsWithSaleCost += item.quantity; }
  }
  let fee = 0; let feeKind: OrderResult["feeKind"] = "none";
  if (order.paymentMethod === "mercadopago") {
    if (order.feeArs !== null) { fee = order.feeArs; feeKind = "real"; }
    else if (config.estimatedMercadoPagoFeePercent !== null) { fee = Math.round(order.totalArs * config.estimatedMercadoPagoFeePercent / 100); feeKind = "estimated"; }
    else feeKind = "missing";
  }
  const tax = config.salesTaxPercent !== null ? Math.round(net * config.salesTaxPercent / 100) : 0;
  return { net, cogs, fee, tax, profit: net - cogs - fee - tax, units, unitsWithCost, unitsWithSaleCost, feeKind };
}

export type MetricsSummary = {
  sales: number; netSales: number; orders: number; averageTicket: number; units: number; cogs: number; fees: number; shipping: number;
  taxes: number; profit: number; margin: number | null;
  coverage: { units: number; unitsWithCost: number; unitsWithEstimatedCost: number; mercadoPagoOrders: number; realFees: number; estimatedFees: number; missingFees: number };
};

export function summarize(orders: MetricsOrder[], config: MetricsConfig): MetricsSummary {
  const s: MetricsSummary = { sales: 0, netSales: 0, orders: orders.length, averageTicket: 0, units: 0, cogs: 0, fees: 0, shipping: 0, taxes: 0, profit: 0, margin: null,
    coverage: { units: 0, unitsWithCost: 0, unitsWithEstimatedCost: 0, mercadoPagoOrders: 0, realFees: 0, estimatedFees: 0, missingFees: 0 } };
  for (const order of orders) {
    const r = evaluateOrder(order, config);
    s.sales += order.totalArs; s.netSales += r.net; s.shipping += order.shippingArs; s.units += r.units;
    s.cogs += r.cogs; s.fees += r.fee; s.taxes += r.tax; s.profit += r.profit;
    s.coverage.units += r.units; s.coverage.unitsWithCost += r.unitsWithCost; s.coverage.unitsWithEstimatedCost += r.unitsWithCost - r.unitsWithSaleCost;
    if (order.paymentMethod === "mercadopago") {
      s.coverage.mercadoPagoOrders++;
      if (r.feeKind === "real") s.coverage.realFees++; else if (r.feeKind === "estimated") s.coverage.estimatedFees++; else s.coverage.missingFees++;
    }
  }
  s.averageTicket = s.orders ? Math.round(s.sales / s.orders) : 0;
  s.margin = s.netSales > 0 ? s.profit / s.netSales : null;
  return s;
}

/** Variación porcentual contra el período anterior; null si antes no hubo base para comparar. */
export const change = (current: number, previous: number) => previous === 0 ? null : (current - previous) / Math.abs(previous);

export type DailyPoint = { day: string; label: string; sales: number; profit: number; orders: number };
export function daily(orders: MetricsOrder[], range: MetricsRange, config: MetricsConfig): DailyPoint[] {
  const map = new Map(range.days.map((day) => [day, { day, label: shortDay(day), sales: 0, profit: 0, orders: 0 }]));
  for (const order of orders) {
    const point = map.get(argentinaDate(order.createdAt));
    if (!point) continue;
    const r = evaluateOrder(order, config);
    point.sales += order.totalArs; point.profit += r.profit; point.orders++;
  }
  return [...map.values()];
}

export type ProductRow = { slug: string; name: string; units: number; revenue: number; cogs: number; profit: number; margin: number | null; costComplete: boolean };
/** Facturación por producto prorrateando el descuento del cupón sobre los ítems del pedido. */
export function topProducts(orders: MetricsOrder[], limit = 10): ProductRow[] {
  const map = new Map<string, ProductRow & { unitsWithCost: number }>();
  for (const order of orders) {
    const ratio = order.subtotalArs > 0 ? (order.subtotalArs - order.discountArs) / order.subtotalArs : 0;
    for (const item of order.items) {
      const row = map.get(item.slug) ?? { slug: item.slug, name: item.name, units: 0, revenue: 0, cogs: 0, profit: 0, margin: null, costComplete: true, unitsWithCost: 0 };
      const revenue = item.unitPriceArs * item.quantity * ratio;
      row.units += item.quantity; row.revenue += revenue;
      if (item.unitCostArs !== null) { row.cogs += item.unitCostArs * item.quantity; row.unitsWithCost += item.quantity; }
      map.set(item.slug, row);
    }
  }
  return [...map.values()].map(({ unitsWithCost, ...row }) => {
    const revenue = Math.round(row.revenue);
    const costComplete = unitsWithCost === row.units;
    const profit = revenue - row.cogs;
    return { ...row, revenue, profit, costComplete, margin: costComplete && revenue > 0 ? profit / revenue : null };
  }).sort((a, b) => b.revenue - a.revenue || b.units - a.units).slice(0, limit);
}

export type BreakdownRow = { key: string; label: string; value: number; orders: number; share: number };
export function byPayment(orders: MetricsOrder[]): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const order of orders) {
    const row = map.get(order.paymentChoice) ?? { key: order.paymentChoice, label: paymentLabels[order.paymentChoice] ?? order.paymentChoice, value: 0, orders: 0, share: 0 };
    row.value += order.totalArs; row.orders++;
    map.set(order.paymentChoice, row);
  }
  return withShares([...map.values()]);
}

export function byCategory(orders: MetricsOrder[]): BreakdownRow[] {
  const map = new Map<string, BreakdownRow & { orderIds: Set<string> }>();
  for (const order of orders) {
    const ratio = order.subtotalArs > 0 ? (order.subtotalArs - order.discountArs) / order.subtotalArs : 0;
    for (const item of order.items) {
      const row = map.get(item.category) ?? { key: item.category, label: item.category, value: 0, orders: 0, share: 0, orderIds: new Set<string>() };
      row.value += item.unitPriceArs * item.quantity * ratio; row.orderIds.add(order.id);
      map.set(item.category, row);
    }
  }
  return withShares([...map.values()].map(({ orderIds, ...row }) => ({ ...row, value: Math.round(row.value), orders: orderIds.size })));
}

function withShares(rows: BreakdownRow[]) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({ ...row, share: total > 0 ? row.value / total : 0 })).sort((a, b) => b.value - a.value);
}
