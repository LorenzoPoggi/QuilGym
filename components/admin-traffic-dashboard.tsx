import Link from "next/link";
import { AlertTriangle, Eye } from "lucide-react";
import type { TrafficData } from "@/lib/admin-traffic";
import { trafficPresetLabels, trafficPresets, type DeviceRow, type SourceRow, type TrafficRange } from "@/lib/admin-traffic-core";
import { funnel, trafficSummary } from "@/lib/analytics-core";
import { change } from "@/lib/admin-metrics-core";
import { Delta } from "./admin-metrics-dashboard";
import { MetricsTabs } from "./admin-metrics-tabs";
import { TrafficChart } from "./admin-traffic-chart";

const num = (value: number) => Math.round(value).toLocaleString("es-AR");
const dec = (value: number | null) => value === null ? "—" : value.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const ars = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;
const pct = (value: number | null, digits = 1) => value === null ? "—" : `${(value * 100).toLocaleString("es-AR", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;
const changeOf = (current: number | null, previous: number | null) => current === null || previous === null ? null : change(current, previous);

function Shares({ title, rows, empty }: { title: string; rows: { key: string; label: string; sessions: number; share: number; note?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.sessions));
  return <section className="admin-card metrics-breakdown">
    <h2>{title}</h2>
    {rows.length ? <ul>{rows.map((row) => <li key={row.key}>
      <div className="metrics-breakdown__label"><span>{row.label}</span><b>{num(row.sessions)} {row.sessions === 1 ? "sesión" : "sesiones"}</b></div>
      <div className="metrics-breakdown__track" aria-hidden="true"><i style={{ width: `${Math.max(2, (row.sessions / max) * 100)}%` }}/></div>
      <small>{pct(row.share, 0)} del total{row.note ? ` · ${row.note}` : ""}</small>
    </li>)}</ul> : <p className="admin-help">{empty}</p>}
  </section>;
}

const sourceRows = (sources: SourceRow[]) => sources.map((row) => ({
  key: row.label, label: row.label, sessions: row.sessions, share: row.share,
  note: row.purchases > 0 ? `${row.purchases} ${row.purchases === 1 ? "compra" : "compras"} (${pct(row.conversion)})` : "sin compras",
}));
const deviceRows = (devices: DeviceRow[]) => devices.map((row) => ({ key: row.key, label: row.label, sessions: row.sessions, share: row.share }));

/** Tablero de tráfico y conversión (servidor). La página le pasa los datos leídos de la base. */
export function TrafficDashboard({ range, data }: { range: TrafficRange; data: TrafficData }) {
  const now = trafficSummary(data.current), before = trafficSummary(data.previous);
  const steps = funnel(data.current);
  const hasVisits = data.current.sessions > 0;

  const tiles: { label: string; value: string; delta: number | null; neutral?: boolean; hint?: string }[] = [
    { label: "Sesiones", value: num(now.sessions), delta: changeOf(now.sessions, before.sessions), hint: "Cada visita a la tienda, hasta 30 min sin actividad" },
    { label: "Páginas vistas", value: num(now.pageViews), delta: changeOf(now.pageViews, before.pageViews) },
    { label: "Páginas por sesión", value: dec(now.pagesPerSession), delta: changeOf(now.pagesPerSession, before.pagesPerSession) },
    { label: "Conversión", value: pct(now.conversionRate), delta: changeOf(now.conversionRate, before.conversionRate), hint: "Sesiones que terminaron en un pedido pagado" },
    { label: "Abandono del carrito", value: pct(now.cartAbandonment, 0), delta: changeOf(now.cartAbandonment, before.cartAbandonment), neutral: true, hint: "Agregaron al carrito y no compraron" },
    { label: "Abandono del checkout", value: pct(now.checkoutAbandonment, 0), delta: changeOf(now.checkoutAbandonment, before.checkoutAbandonment), neutral: true, hint: "Entraron al checkout y no compraron" },
    { label: "Pedidos pagados", value: num(now.orders), delta: changeOf(now.orders, before.orders), hint: "Con una visita registrada" },
    { label: "Ingreso por visitante", value: now.revenuePerVisitor === null ? "—" : ars(now.revenuePerVisitor), delta: changeOf(now.revenuePerVisitor, before.revenuePerVisitor) },
  ];

  return <div className="admin-content metrics-page">
    <header className="admin-page-head"><div><p className="admin-eyebrow">NEGOCIO</p><h1>Métricas</h1><p>Visitas y conversión de la tienda. {trafficPresetLabels[range.preset]}: {range.label}.</p></div></header>

    <MetricsTabs active="trafico"/>

    <nav className="metrics-periods" aria-label="Período">
      {trafficPresets.map((preset) => <Link key={preset} href={`/admin/metricas/trafico?p=${preset}`} aria-current={range.preset === preset ? "page" : undefined}>{trafficPresetLabels[preset]}</Link>)}
    </nav>

    {!data.ready && <div className="metrics-notices"><p className="metrics-notice"><AlertTriangle size={18} aria-hidden="true"/><span><b>Falta activar el registro de visitas.</b> Avisale a los programadores que apliquen la migración 0011. Hasta entonces no hay datos de tráfico.</span></p></div>}

    {data.ready && !hasVisits && <section className="admin-card metrics-empty"><Eye size={34} aria-hidden="true"/><h2>Todavía no hay visitas en este período</h2>
      <p>La tienda cuenta visitas de forma anónima (sin guardar IP ni datos personales) y deja afuera a los robots y al panel de administración. Cuando entren visitas, vas a ver acá de dónde llegan, qué miran y dónde se pierden las ventas.</p>
      {range.preset !== "90d" && <Link className="admin-primary" href="/admin/metricas/trafico?p=90d">Ver últimos 90 días</Link>}</section>}

    {data.ready && hasVisits && <>
      <section className="metrics-hero" aria-label="Visitantes">
        <div>
          <p className="metrics-hero__label">Visitantes únicos</p>
          <p className="metrics-hero__value">{num(now.visitors)}</p>
          <Delta value={changeOf(now.visitors, before.visitors)}/>
        </div>
        <dl className="metrics-hero__side">
          <div><dt>Nuevos</dt><dd>{num(now.newVisitors)}</dd></div>
          <div><dt>Volvieron</dt><dd>{num(now.returningVisitors)}</dd></div>
        </dl>
        <p className="metrics-hero__formula">Cada navegador cuenta como un visitante. Si alguien entra desde el celular y desde la compu, son dos.</p>
      </section>

      <section className="metrics-tiles" aria-label="Indicadores">
        {tiles.map((tile) => <article key={tile.label} className="metrics-tile">
          <h3>{tile.label}</h3><p className="metrics-tile__value">{tile.value}</p>
          <Delta value={tile.delta} tone={tile.neutral ? "neutral" : "good-up"}/>
          {tile.hint && <small>{tile.hint}</small>}
        </article>)}
      </section>

      <section className="admin-card"><h2>Visitas por día</h2><TrafficChart points={data.daily}/></section>

      <section className="admin-card traffic-funnel">
        <h2>Del recorrido a la compra</h2>
        <p className="admin-help">Sesiones que llegaron a cada paso en el período.</p>
        <ol>{steps.map((step) => <li key={step.key}>
          <div className="metrics-breakdown__label"><span>{step.label}</span><b>{num(step.sessions)}</b></div>
          <div className="metrics-breakdown__track" aria-hidden="true"><i style={{ width: `${step.sessions > 0 ? Math.max(1.5, (step.fromStart ?? 0) * 100) : 0}%` }}/></div>
          <small>{step.key === "visit" ? "Punto de partida" : `${pct(step.fromStart)} del total · ${pct(step.fromPrevious, 0)} del paso anterior`}</small>
        </li>)}</ol>
      </section>

      <div className="metrics-split">
        <Shares title="De dónde llegan" rows={sourceRows(data.sources)} empty="Sin visitas en el período."/>
        <Shares title="Desde qué dispositivo" rows={deviceRows(data.devices)} empty="Sin visitas en el período."/>
      </div>

      <section className="admin-card">
        <h2>Productos más vistos</h2>
        {data.products.length ? <>
          <div className="metrics-table-scroll" tabIndex={0} aria-label="Tabla de productos más vistos"><table className="metrics-table metrics-products">
            <thead><tr><th scope="col">Producto</th><th scope="col">Vistas</th><th scope="col">Unidades vendidas</th><th scope="col">De vista a venta</th></tr></thead>
            <tbody>{data.products.map((row) => <tr key={row.slug}>
              <th scope="row"><span>{row.name}</span><span className="metrics-bar-inline" aria-hidden="true"><i style={{ width: `${(row.views / Math.max(1, data.products[0].views)) * 100}%` }}/></span></th>
              <td>{num(row.views)}</td><td>{num(row.units)}</td>
              <td>{row.units === 0 && row.views >= 10 ? <span className="metrics-missing">Sin ventas</span> : pct(row.viewToSale)}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="admin-help">Los productos muy vistos y con pocas ventas son una oportunidad: revisá precio, fotos, descripción y stock.</p>
        </> : <p className="admin-help">Todavía nadie abrió la ficha de un producto en este período.</p>}
      </section>
    </>}

    <p className="admin-help metrics-footnote">Las visitas son anónimas y no incluyen robots ni el panel. Las compras son pedidos pagados y reales (no de prueba) vinculados a una visita. Los días se calculan en horario de Argentina. <Link href="/admin/metricas">Ver ventas</Link></p>
  </div>;
}
