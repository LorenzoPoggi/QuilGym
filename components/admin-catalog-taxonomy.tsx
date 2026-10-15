"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { deleteAdminBrand, deleteAdminCategory, saveAdminBrand, saveAdminCategory, type ActionResult, type FieldErrors } from "@/lib/admin-actions";

export type TaxonomyRow = { id: number; name: string; slug: string; position?: number; products: number; updatedAt: Date };
type Kind = "brand" | "category";
const copy = { brand: { singular: "marca", add: "Agregar marca", slugHelp: "Se usa en el filtro de la tienda (?marca=…). Cambiarlo rompe enlaces guardados y puede desvincular el logo de la cinta." },
  category: { singular: "categoría", add: "Agregar categoría", slugHelp: "Se usa en la URL del catálogo (?categoria=…). Cambiarlo rompe enlaces guardados." } } as const;

function TaxonomyForm({ kind, row, onSaved }: { kind: Kind; row?: TaxonomyRow; onSaved: (message: string) => void }) {
  const router = useRouter();
  const [name, setName] = useState(row?.name ?? "");
  const [slug, setSlug] = useState(row?.slug ?? "");
  const [position, setPosition] = useState(String(row?.position ?? 0));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const prefix = row ? `t${row.id}` : "nuevo";
  const dirty = !row || name !== row.name || slug !== row.slug || (kind === "category" && position !== String(row.position ?? 0));
  const invalid = (field: string) => ({ "aria-invalid": errors[field] ? true : undefined, "aria-describedby": errors[field] ? `${prefix}-${field}-error` : undefined });

  async function run(action: () => Promise<ActionResult>, message: string, reset = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setErrors({}); setError("");
    try {
      const result = await action();
      if (!result.ok) { setErrors(result.fields ?? {}); setError(result.error); return; }
      if (reset) { setName(""); setSlug(""); setPosition("0"); }
      onSaved(message); router.refresh();
    } catch { setError("No pudimos completar la acción. Revisá la conexión."); }
    finally { pending.current = false; setBusy(false); }
  }
  const input = { id: row?.id, name, slug: slug.trim(), position: kind === "category" ? Number(position) : undefined };
  const save = () => run(() => kind === "brand" ? saveAdminBrand(input) : saveAdminCategory(input), row ? `${name.trim()}: cambios guardados.` : `${name.trim()}: ${copy[kind].singular} creada.`, !row);
  const remove = () => { if (row && window.confirm(`¿Borrar ${copy[kind].singular} «${row.name}»?`)) void run(() => kind === "brand" ? deleteAdminBrand(row.id) : deleteAdminCategory(row.id), `${row.name}: ${copy[kind].singular} borrada.`); };

  return <form className={`admin-taxonomy-row${row ? "" : " is-new"}`} onSubmit={(event) => { event.preventDefault(); void save(); }} noValidate aria-busy={busy}>
    <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder={kind === "brand" ? "Ej. Star Nutrition" : "Ej. Proteínas"} {...invalid("name")}/>{errors.name && <small className="admin-field-error" id={`${prefix}-name-error`}>{errors.name}</small>}</label>
    <label>Identificador<input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} maxLength={80} placeholder="Se genera con el nombre" pattern="[a-z0-9-]*" {...invalid("slug")}/>{errors.slug && <small className="admin-field-error" id={`${prefix}-slug-error`}>{errors.slug}</small>}</label>
    {kind === "category" && <label className="admin-taxonomy-position">Orden<input type="number" inputMode="numeric" min="0" max="10000" step="1" value={position} onChange={(e) => setPosition(e.target.value)} {...invalid("position")}/>{errors.position && <small className="admin-field-error" id={`${prefix}-position-error`}>{errors.position}</small>}</label>}
    <div className="admin-taxonomy-meta">{row ? <span>{row.products === 1 ? "1 producto" : `${row.products} productos`}</span> : <span>Nueva</span>}</div>
    <div className="admin-taxonomy-actions">
      <button className={row ? "admin-secondary" : "admin-primary"} type="submit" disabled={busy || !dirty}>{busy ? "Guardando…" : row ? "Guardar" : <><Plus size={16}/> {copy[kind].add}</>}</button>
      {row && <button type="button" className="admin-icon-button" onClick={remove} disabled={busy || row.products > 0} aria-label={`Borrar ${row.name}`} title={row.products > 0 ? "Tiene productos asociados: reasignalos antes de borrar" : `Borrar ${copy[kind].singular}`}><Trash2 size={17}/></button>}
    </div>
    {error && <p className="admin-error admin-taxonomy-error" role="alert">{error}</p>}
  </form>;
}

export function AdminTaxonomyManager({ kind, rows }: { kind: Kind; rows: TaxonomyRow[] }) {
  const [message, setMessage] = useState("");
  return <div className="admin-taxonomy">
    <p className="admin-notice-inline" role="status">{message && <><CheckCircle2 size={17}/> {message}</>}</p>
    <section className="admin-card"><h2>{copy[kind].add}</h2><TaxonomyForm kind={kind} onSaved={setMessage}/><small className="admin-help">{copy[kind].slugHelp}</small></section>
    <section className="admin-card"><h2>{kind === "brand" ? `Marcas (${rows.length})` : `Categorías (${rows.length})`}</h2>{rows.length ? <div className="admin-taxonomy-list">{rows.map((row) => <TaxonomyForm key={`${row.id}-${new Date(row.updatedAt).getTime()}`} kind={kind} row={row} onSaved={setMessage}/>)}</div> : <p className="admin-help">Todavía no hay registros.</p>}
      <small className="admin-help">Solo se pueden borrar las que no tienen productos (incluidos borradores y archivados).</small></section>
  </div>;
}
