"use client";

import { useId, useState, useSyncExternalStore } from "react";
import type { DailyTrafficPoint } from "@/lib/admin-traffic-core";

const count = (value: number) => Math.round(value).toLocaleString("es-AR");

/** Paso redondo para el eje (1, 2, 5, 10, 20...) y siempre entero: son visitas, no pesos. */
function niceStep(max: number) {
  const raw = Math.max(1, max / 4), power = 10 ** Math.floor(Math.log10(raw)), unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

// En pantallas angostas el viewBox de 760 se escalaba a menos de la mitad y las etiquetas quedaban ilegibles.
const narrowQuery = "(max-width: 600px)";
function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia(narrowQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const isNarrow = () => window.matchMedia(narrowQuery).matches;

/** Visitantes (barras) y páginas vistas (línea) por día, en una sola escala. */
export function TrafficChart({ points }: { points: DailyTrafficPoint[] }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  const width = narrow ? 360 : 760, height = narrow ? 240 : 260, left = narrow ? 36 : 44, right = narrow ? 6 : 12, top = 14, bottom = 34;
  const plotW = width - left - right, plotH = height - top - bottom;
  const maxValue = Math.max(1, ...points.map((p) => Math.max(p.visitors, p.pageViews)));
  const step = niceStep(maxValue);
  const yMax = Math.ceil(maxValue / step) * step;
  const y = (value: number) => top + plotH - (value / (yMax || 1)) * plotH;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(28, band - Math.max(2, band * 0.28)));
  const x = (index: number) => left + band * index + band / 2;
  const ticks: number[] = []; for (let v = 0; v <= yMax + step / 2; v += step) ticks.push(v);
  const labelEvery = Math.ceil(points.length / (narrow ? 5 : 10));
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pageViews).toFixed(1)}`).join(" ");
  const current = active !== null ? points[active] : null;
  const tickClass = narrow ? "metrics-tick metrics-tick--narrow" : "metrics-tick";

  return <div className="metrics-chart">
    <div className="metrics-legend" aria-hidden="true"><span><i className="metrics-swatch metrics-swatch--sales"/>Visitantes</span><span><i className="metrics-swatch metrics-swatch--profit"/>Páginas vistas</span></div>
    <div className="metrics-chart__frame">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title`} onMouseLeave={() => setActive(null)}>
        <title id={`${id}-title`}>Visitantes y páginas vistas por día. La tabla de abajo tiene los valores.</title>
        {ticks.map((tick) => <g key={tick}><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "metrics-axis-zero" : "metrics-grid"}/>
          <text x={left - 8} y={y(tick) + 4} className={tickClass} textAnchor="end">{count(tick)}</text></g>)}
        {points.map((p, i) => {
          const h = Math.abs(y(p.visitors) - y(0)), r = Math.min(4, h, barW / 2), x0 = x(i) - barW / 2;
          return <g key={p.day}>
            {p.visitors > 0 && <path className="metrics-bar" d={`M${x0},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`} opacity={active === null || active === i ? 1 : .45}/>}
            {i % labelEvery === 0 && <text x={x(i)} y={height - 12} className={tickClass} textAnchor="middle">{p.label}</text>}
            <rect x={left + band * i} y={top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} tabIndex={-1}/>
          </g>;
        })}
        <path d={line} className="metrics-line"/>
        {points.map((p, i) => (points.length <= 31 || i === active) && <circle key={p.day} cx={x(i)} cy={y(p.pageViews)} r={active === i ? 5 : 3} className="metrics-dot"/>)}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={top} y2={top + plotH} className="metrics-crosshair"/>}
      </svg>
      {current && <div className="metrics-tooltip" style={{ left: `${(x(active!) / width) * 100}%` }} role="status">
        <strong>{current.label}</strong>
        <span><i className="metrics-swatch metrics-swatch--sales"/>Visitantes <b>{count(current.visitors)}</b></span>
        <span><i className="metrics-swatch metrics-swatch--profit"/>Páginas vistas <b>{count(current.pageViews)}</b></span>
        <small>{count(current.sessions)} {current.sessions === 1 ? "sesión" : "sesiones"}</small>
      </div>}
    </div>
    <details className="metrics-table-toggle"><summary>Ver los datos en una tabla</summary>
      <div className="metrics-table-scroll" tabIndex={0}><table className="metrics-table"><thead><tr><th scope="col">Día</th><th scope="col">Visitantes</th><th scope="col">Sesiones</th><th scope="col">Páginas vistas</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.day}><th scope="row">{p.label}</th><td>{count(p.visitors)}</td><td>{count(p.sessions)}</td><td>{count(p.pageViews)}</td></tr>)}</tbody></table></div>
    </details>
  </div>;
}
