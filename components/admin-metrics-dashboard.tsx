import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Minus, PackageSearch } from "lucide-react";
import type { MetricsData } from "@/lib/admin-metrics";
import { byCategory, byPayment, change, daily, presetLabels, summarize, topProducts, type BreakdownRow, type MetricsPreset, type MetricsRange } from "@/lib/admin-metrics-core";
import { metricsConfig } from "@/lib/metrics-config";
import { SalesProfitChart } from "./admin-metrics-chart";
import { MetricsTabs } from "./admin-metrics-tabs";

const ars = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;
const pct = (value: number | null, digits = 1) => value === null ? "—" : `${(value * 100).toLocaleString("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;
const presets: MetricsPreset[] = ["hoy", "7d", "30d", "mes", "mes-anterior"];

/** Variación contra el período anterior. `tone` neutral para costos: subir no es «bueno» ni «malo». */
export function Delta({ value, tone = "good-up" }: { value: number | null; tone?: "good-up" | "neutral" }) {
  if (value === null) return <span className="metrics-delta metrics-delta--none">Sin datos del período anterior</span>;
  const rounded = Math.round(value * 1000) / 10;
  const Icon = rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;
  const state = tone === "neutral" || rounded === 0 ? "neutral" : rounded > 0 ? "up" : "down";
  return <span className={`metrics-delta metrics-delta--${state}`}><Icon size={15} aria-hidden="true"/>{rounded > 0 ? "+" : ""}{rounded.toLocaleString("es-AR")}% <span className="metrics-delta__vs">vs. período anterior</span></span>;
}

function Breakdown({ title, rows, empty }: { title: string; rows: BreakdownRow[]; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className="admin-card metrics-breakdown">
    <h2>{title}</h2>
    {rows.length ? <ul>{rows.map((row) => <li key={row.key}>
      <div className="metrics-breakdown__label"><span>{row.label}</span><b>{ars(row.value)}</b></div>
      <div className="metrics-breakdown__track" aria-hidden="true"><i style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}/></div>
      <small>{pct(row.share, 0)} del total · {row.orders} {row.orders === 1 ? "pedido" : "pedidos"}</small>
    </li>)}</ul> : <p className="admin-help">{empty}</p>}
  </section>;
}

/** Tablero de métricas (servidor). La página le pasa los pedidos leídos de la base. */
export function MetricsDashboard({ range, data }: { range: MetricsRange; data: MetricsData }) {
  const now = summarize(data.current, metricsConfig), before = summarize(data.previous, metricsConfig);
  const points = daily(data.current, range, metricsConfig);
  const products = topProducts(data.current);
  const coverage = now.coverage;
  const missingCostUnits = coverage.units - coverage.unitsWithCost;
  const profitIsPartial = missingCostUnits > 0 || coverage.missingFees > 0;

  const tiles = [
    { label: "Ventas", value: ars(now.sales), delta: change(now.sales, before.sales), hint: "Total cobrado, con envíos" },
    { label: "Pedidos pagados", value: now.orders.toLocaleString("es-AR"), delta: change(now.orders, before.orders) },
    { label: "Ticket promedio", value: ars(now.averageTicket), delta: change(now.averageTicket, before.averageTicket) },
    { label: "Unidades vendidas", value: now.units.toLocaleString("es-AR"), delta: change(now.units, before.units) },
    { label: "Costo de mercadería", value: ars(now.cogs), delta: change(now.cogs, before.cogs), neutral: true, hint: missingCostUnits ? `${missingCostUnits} ${missingCostUnits === 1 ? "unidad" : "unidades"} sin costo cargado` : undefined },
    { label: "Comisiones Mercado Pago", value: ars(now.fees), delta: change(now.fees, before.fees), neutral: true, hint: coverage.estimatedFees ? `${coverage.estimatedFees} estimadas` : undefined },
    { label: "Envíos cobrados", value: ars(now.shipping), delta: change(now.shipping, before.shipping), neutral: true, hint: "Se consideran costo de envío: no suman ganancia" },
    ...(metricsConfig.salesTaxPercent !== null ? [{ label: "Impuestos", value: ars(now.taxes), delta: change(now.taxes, before.taxes), neutral: true, hint: `${metricsConfig.salesTaxPercent}% sobre ventas netas` }] : []),
  ];

  return <div className="admin-content metrics-page">
    <header className="admin-page-head"><div><p className="admin-eyebrow">NEGOCIO</p><h1>Métricas</h1><p>Ventas y rentabilidad de los pedidos pagados. {presetLabels[range.preset]}: {range.label}.</p></div></header>

    <MetricsTabs active="ventas"/>

    <nav className="metrics-periods" aria-label="Período">
      {presets.map((preset) => <Link key={preset} href={`/admin/metricas?p=${preset}`} aria-current={range.preset === preset ? "page" : undefined}>{presetLabels[preset]}</Link>)}
      <form className="metrics-custom" action="/admin/metricas">
        <input type="hidden" name="p" value="personalizado"/>
        <label><span>Desde</span><input type="date" name="desde" defaultValue={range.from} required/></label>
        <label><span>Hasta</span><input type="date" name="hasta" defaultValue={range.to} required/></label>
        <button type="submit" className={range.preset === "personalizado" ? "is-current" : undefined}>Aplicar</button>
      </form>
    </nav>

    {(!data.ready || data.variantsWithoutCost > 0 || coverage.missingFees > 0) && <div className="metrics-notices">
      {!data.ready && <p className="metrics-notice"><AlertTriangle size={18} aria-hidden="true"/><span><b>Falta activar el cálculo de costos y comisiones.</b> Avisale a los programadores que apliquen la migración 0009. Mientras tanto, la ganancia no descuenta costos ni comisiones.</span></p>}
      {data.ready && data.variantsWithoutCost > 0 && <p className="metrics-notice"><PackageSearch size={18} aria-hidden="true"/><span><b>{data.variantsWithoutCost} {data.variantsWithoutCost === 1 ? "producto no tiene" : "productos no tienen"} costo cargado.</b> Sin el costo, la ganancia aparece más alta de lo real. <Link href="/admin/metricas/costos">Cargar costos</Link></span></p>}
      {coverage.missingFees > 0 && <p className="metrics-notice"><AlertTriangle size={18} aria-hidden="true"/><span><b>{coverage.missingFees} {coverage.missingFees === 1 ? "pago de Mercado Pago no tiene" : "pagos de Mercado Pago no tienen"} la comisión registrada.</b> No se descuenta de la ganancia; los pagos nuevos la guardan solos.</span></p>}
    </div>}

    {now.orders === 0 ? <section className="admin-card metrics-empty"><BarChart3 size={34} aria-hidden="true"/><h2>Todavía no hay ventas en este período</h2><p>Cuando entren pedidos pagados, vas a ver acá las ventas, la ganancia y los productos más vendidos. Probá con un período más largo.</p>
      {range.preset !== "30d" && <Link className="admin-primary" href="/admin/metricas?p=30d">Ver últimos 30 días</Link>}</section> : <>
      <section className="metrics-hero" aria-label="Ganancia neta">
        <div>
          <p className="metrics-hero__label">Ganancia neta {profitIsPartial && <span className="metrics-badge">Parcial</span>}</p>
          <p className="metrics-hero__value">{ars(now.profit)}</p>
          <Delta value={change(now.profit, before.profit)}/>
        </div>
        <dl className="metrics-hero__side">
          <div><dt>Margen neto</dt><dd>{pct(now.margin)}</dd></div>
          <div><dt>Ventas netas de productos</dt><dd>{ars(now.netSales)}</dd></div>
        </dl>
        <p className="metrics-hero__formula">Ventas netas − costo de mercadería − comisiones{metricsConfig.salesTaxPercent !== null ? " − impuestos" : ""}. Los cupones ya están descontados.</p>
      </section>

      <section className="metrics-tiles" aria-label="Indicadores">
        {tiles.map((tile) => <article key={tile.label} className="metrics-tile">
          <h3>{tile.label}</h3><p className="metrics-tile__value">{tile.value}</p>
          <Delta value={tile.delta} tone={tile.neutral ? "neutral" : "good-up"}/>
          {tile.hint && <small>{tile.hint}</small>}
        </article>)}
      </section>

      <section className="admin-card"><h2>Ventas y ganancia por día</h2><SalesProfitChart points={points}/></section>

      <section className="admin-card">
        <h2>Productos más vendidos</h2>
        <div className="metrics-table-scroll" tabIndex={0} aria-label="Tabla de productos más vendidos"><table className="metrics-table metrics-products">
          <thead><tr><th scope="col">Producto</th><th scope="col">Unidades</th><th scope="col">Facturación</th><th scope="col">Ganancia</th><th scope="col">Margen</th></tr></thead>
          <tbody>{products.map((row) => <tr key={row.slug}>
            <th scope="row"><span>{row.name}</span><span className="metrics-bar-inline" aria-hidden="true"><i style={{ width: `${(row.revenue / Math.max(1, products[0].revenue)) * 100}%` }}/></span></th>
            <td>{row.units}</td><td>{ars(row.revenue)}</td>
            <td>{row.costComplete ? ars(row.profit) : <span className="metrics-missing">Falta costo</span>}</td>
            <td>{pct(row.margin, 0)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <div className="metrics-split">
        <Breakdown title="Ventas por medio de pago" rows={byPayment(data.current)} empty="Sin ventas en el período."/>
        <Breakdown title="Ventas por categoría" rows={byCategory(data.current)} empty="Sin ventas en el período."/>
      </div>
    </>}
    <p className="admin-help metrics-footnote">Solo se cuentan pedidos pagados y reales (no de prueba). Los días se calculan en horario de Argentina. <Link href="/admin/metricas/costos">Costos de productos</Link></p>
  </div>;
}
