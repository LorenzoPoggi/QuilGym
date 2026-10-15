"use client";

import { useId, useState } from "react";
import type { DailyPoint } from "@/lib/admin-metrics-core";

const ars = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;
/** Etiqueta corta del eje: $350 mil, $1,2 M. */
export function compactArs(value: number) {
  const abs = Math.abs(value), sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString("es-AR")} mil`;
  return `${sign}$${Math.round(abs)}`;
}

function niceStep(max: number) {
  const raw = max / 4, power = 10 ** Math.floor(Math.log10(raw || 1)), unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

/** Ventas (barras) y ganancia (línea) por día, en una sola escala de pesos. */
export function SalesProfitChart({ points }: { points: DailyPoint[] }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 760, height = 260, left = 64, right = 12, top = 14, bottom = 34;
  const plotW = width - left - right, plotH = height - top - bottom;
  const maxValue = Math.max(1, ...points.map((p) => Math.max(p.sales, p.profit)));
  const minValue = Math.min(0, ...points.map((p) => p.profit));
  const step = niceStep(maxValue - minValue);
  const yMax = Math.ceil(maxValue / step) * step, yMin = Math.floor(minValue / step) * step;
  const y = (value: number) => top + plotH - ((value - yMin) / (yMax - yMin || 1)) * plotH;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(28, band - Math.max(2, band * 0.28)));
  const x = (index: number) => left + band * index + band / 2;
  const ticks: number[] = []; for (let v = yMin; v <= yMax + step / 2; v += step) ticks.push(v);
  const labelEvery = Math.ceil(points.length / 10);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.profit).toFixed(1)}`).join(" ");
  const current = active !== null ? points[active] : null;

  return <div className="metrics-chart">
    <div className="metrics-legend" aria-hidden="true"><span><i className="metrics-swatch metrics-swatch--sales"/>Ventas</span><span><i className="metrics-swatch metrics-swatch--profit"/>Ganancia neta</span></div>
    <div className="metrics-chart__frame">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title`} onMouseLeave={() => setActive(null)}>
        <title id={`${id}-title`}>Ventas y ganancia neta por día. La tabla de abajo tiene los valores.</title>
        {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "metrics-axis-zero" : "metrics-grid"}/>
          <text x={left - 8} y={y(tick) + 4} className="metrics-tick" textAnchor="end">{compactArs(tick)}</text></g>)}
        {points.map((p, i) => {
          const h = Math.abs(y(p.sales) - y(0)), r = Math.min(4, h, barW / 2), x0 = x(i) - barW / 2;
          return <g key={p.day}>
            {p.sales > 0 && <path className="metrics-bar" d={`M${x0},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`} opacity={active === null || active === i ? 1 : .45}/>}
            {i % labelEvery === 0 && <text x={x(i)} y={height - 12} className="metrics-tick" textAnchor="middle">{p.label}</text>}
            <rect x={left + band * i} y={top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} tabIndex={-1}/>
          </g>;
        })}
        <path d={line} className="metrics-line"/>
        {points.map((p, i) => (points.length <= 31 || i === active) && <circle key={p.day} cx={x(i)} cy={y(p.profit)} r={active === i ? 5 : 3} className="metrics-dot"/>)}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={top} y2={top + plotH} className="metrics-crosshair"/>}
      </svg>
      {current && <div className="metrics-tooltip" style={{ left: `${(x(active!) / width) * 100}%` }} role="status">
        <strong>{current.label}</strong>
        <span><i className="metrics-swatch metrics-swatch--sales"/>Ventas <b>{ars(current.sales)}</b></span>
        <span><i className="metrics-swatch metrics-swatch--profit"/>Ganancia <b>{ars(current.profit)}</b></span>
        <small>{current.orders} {current.orders === 1 ? "pedido" : "pedidos"}</small>
      </div>}
    </div>
    <details className="metrics-table-toggle"><summary>Ver los datos en una tabla</summary>
      <div className="metrics-table-scroll" tabIndex={0}><table className="metrics-table"><thead><tr><th scope="col">Día</th><th scope="col">Pedidos</th><th scope="col">Ventas</th><th scope="col">Ganancia neta</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.day}><th scope="row">{p.label}</th><td>{p.orders}</td><td>{ars(p.sales)}</td><td>{ars(p.profit)}</td></tr>)}</tbody></table></div>
    </details>
  </div>;
}
