"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Save, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { saveVariantCosts } from "@/lib/admin-metrics-actions";
import type { CostRow } from "@/lib/admin-metrics";

const ars = (value: number) => `$${Math.round(value).toLocaleString("es-AR")}`;
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function AdminCostsEditor({ rows, ready }: { rows: CostRow[]; ready: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(rows.map((row) => [row.variantId, row.costArs === null ? "" : String(row.costArs)])));
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<number[]>([]);

  const original = useMemo(() => Object.fromEntries(rows.map((row) => [row.variantId, row.costArs === null ? "" : String(row.costArs)])), [rows]);
  const dirty = rows.filter((row) => values[row.variantId] !== original[row.variantId]);
  const missing = rows.filter((row) => !values[row.variantId]).length;
  const visible = rows.filter((row) => (!onlyMissing || !values[row.variantId]) && (!query || normalize(`${row.product} ${row.variant ?? ""} ${row.sku}`).includes(normalize(query))));

  async function save() {
    if (!dirty.length || busy) return;
    setBusy(true); setMessage(""); setError(""); setInvalid([]);
    try {
      const result = await saveVariantCosts(dirty.map((row) => ({ variantId: row.variantId, costArs: values[row.variantId] === "" ? null : Number(values[row.variantId]) })));
      if (!result.ok) { setError(result.error); setInvalid(result.invalid ?? []); return; }
      setMessage(`Listo: ${result.saved} ${result.saved === 1 ? "costo guardado" : "costos guardados"}.`);
      router.refresh();
    } catch { setError("No pudimos guardar. Revisá la conexión e intentá de nuevo."); }
    finally { setBusy(false); }
  }

  return <div className="costs-editor">
    <p className="admin-notice-inline" role="status">{message && <><CheckCircle2 size={17} aria-hidden="true"/> {message}</>}</p>
    {!ready && <p className="metrics-notice"><span><b>La carga de costos todavía no está activada.</b> Avisale a los programadores que apliquen la migración 0009.</span></p>}
    <section className="admin-card">
      <div className="costs-toolbar">
        <label className="costs-search"><Search size={17} aria-hidden="true"/><span className="sr-only">Buscar producto</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o SKU"/></label>
        <label className="costs-filter"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)}/> Solo sin costo ({missing})</label>
      </div>
      <div className="metrics-table-scroll" tabIndex={0} aria-label="Costos de productos"><table className="metrics-table costs-table">
        <thead><tr><th scope="col">Producto</th><th scope="col">Precio de venta</th><th scope="col">Costo unitario</th><th scope="col">Margen bruto</th></tr></thead>
        <tbody>{visible.map((row) => {
          const raw = values[row.variantId], cost = raw === "" ? null : Number(raw);
          const margin = cost !== null && row.priceArs > 0 ? (row.priceArs - cost) / row.priceArs : null;
          const inputId = `cost-${row.variantId}`;
          return <tr key={row.variantId} className={raw !== original[row.variantId] ? "is-dirty" : undefined}>
            <th scope="row"><label htmlFor={inputId}>{row.product}{row.variant ? ` · ${row.variant}` : ""}</label><small>{row.sku}{row.status === "draft" ? " · Borrador" : ""}</small></th>
            <td>{ars(row.priceArs)}</td>
            <td><span className="costs-input"><b aria-hidden="true">$</b><input id={inputId} inputMode="numeric" value={raw} onChange={(e) => setValues((all) => ({ ...all, [row.variantId]: e.target.value.replace(/\D/g, "") }))} placeholder="Sin cargar" disabled={!ready} aria-invalid={invalid.includes(row.variantId) || undefined}/></span></td>
            <td className={margin !== null && margin < 0 ? "costs-negative" : undefined}>{margin === null ? "—" : `${Math.round(margin * 100)}%`}{margin !== null && margin < 0 && <small> Vendés a pérdida</small>}</td>
          </tr>;
        })}</tbody>
      </table></div>
      {!visible.length && <p className="admin-help">No hay productos que coincidan con la búsqueda.</p>}
      <small className="admin-help">Cargá cuánto te cuesta cada unidad (lo que le pagás al proveedor). El costo se guarda en cada venta nueva, así la ganancia histórica no cambia si después actualizás el costo.</small>
    </section>
    <div className={`costs-savebar${dirty.length ? " is-visible" : ""}`} aria-live="polite">
      {error && <p className="admin-error" role="alert">{error}</p>}
      <span>{dirty.length ? `${dirty.length} ${dirty.length === 1 ? "cambio sin guardar" : "cambios sin guardar"}` : "Sin cambios"}</span>
      <button type="button" className="admin-primary" onClick={save} disabled={!dirty.length || busy || !ready}><Save size={16} aria-hidden="true"/>{busy ? "Guardando…" : "Guardar costos"}</button>
    </div>
  </div>;
}
