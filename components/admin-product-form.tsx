"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { ArrowLeft, CheckCircle2, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { discardAdminUploads, saveAdminProduct, type AdminImageInput, type AdminProductInput, type FieldErrors } from "@/lib/admin-actions";
import type { getAdminProduct, getAdminTaxonomy } from "@/lib/admin-catalog";

type Entry = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;
type Taxonomy = Awaited<ReturnType<typeof getAdminTaxonomy>>;
type VariantDraft = { key: string; id?: number; sku: string; label: string; price: string; comparePrice: string; trackStock: boolean; stock: string; hasOrders: boolean };
export type AdminNotice = "creado" | "guardado" | "archivado" | null;

const MAX_VARIANTS = 30;
const noticeText = { creado: "Producto creado.", guardado: "Cambios guardados.", archivado: "Producto archivado: ya no se muestra en la tienda." } as const;
const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const stockText = (stock: number | null) => stock === null ? "sin control" : `${stock} u.`;
const toNumber = (value: string) => value.trim() === "" ? NaN : Number(value);

async function prepareImage(file: File): Promise<{ file: File; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No pudimos procesar la imagen.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("No pudimos procesar la imagen.")), "image/webp", 0.85));
    return { file: new File([blob], "producto.webp", { type: "image/webp" }), width, height };
  } finally { bitmap.close(); }
}

function FieldMessage({ id, message }: { id: string; message?: string }) {
  return message ? <small className="admin-field-error" id={id}>{message}</small> : null;
}

export function AdminProductForm({ entry, taxonomy, notice = null }: { entry?: Entry; taxonomy: Taxonomy; notice?: AdminNotice }) {
  const router = useRouter();
  const product = entry?.product;
  const initialVariants: VariantDraft[] = entry?.variants.length ? entry.variants.map((variant) => ({ key: `v${variant.id}`, id: variant.id, sku: variant.sku, label: variant.label ?? "", price: String(variant.priceArs), comparePrice: variant.compareAtPriceArs?.toString() ?? "", trackStock: variant.stock !== null, stock: variant.stock?.toString() ?? "0", hasOrders: variant.hasOrders }))
    : [{ key: "nueva-0", sku: "", label: "", price: "", comparePrice: "", trackStock: false, stock: "0", hasOrders: false }];
  const [name, setName] = useState(product?.name ?? "");
  const [brandId, setBrandId] = useState(product?.brandId?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId?.toString() ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [status, setStatus] = useState<AdminProductInput["status"]>(product?.status ?? "draft");
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [variants, setVariants] = useState(initialVariants);
  const [defaultKey, setDefaultKey] = useState(initialVariants[0].key);
  const [removed, setRemoved] = useState<number[]>([]);
  const [images, setImages] = useState<AdminImageInput[]>(entry?.images.map((item) => ({ url: item.url, kind: item.kind, width: item.width, height: item.height })) ?? []);
  const [pendingUploads, setPendingUploads] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [showNotice, setShowNotice] = useState(notice !== null);
  const submitting = useRef(false);
  const leaving = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nextKey = useRef(0);

  const snapshot = JSON.stringify({ name, brandId, categoryId, description, status, isFeatured, variants, defaultKey, removed, images });
  const [initialSnapshot] = useState(snapshot);
  const dirty = snapshot !== initialSnapshot || pendingUploads.length > 0;
  const dirtyRef = useRef(dirty);
  const pendingRef = useRef(pendingUploads);
  useEffect(() => { dirtyRef.current = dirty; pendingRef.current = pendingUploads; }, [dirty, pendingUploads]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current && !leaving.current) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || leaving.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== location.origin) return;
      if (!window.confirm("Tenés cambios sin guardar. ¿Salir sin guardar?")) { event.preventDefault(); event.stopPropagation(); return; }
      leaving.current = true;
      if (pendingRef.current.length) void discardAdminUploads(pendingRef.current);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); };
  }, []);

  useEffect(() => {
    if (!Object.keys(errors).length) return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [errors]);

  const fieldError = (field: string) => errors[field];
  const invalid = (field: string) => ({ "aria-invalid": fieldError(field) ? true : undefined, "aria-describedby": fieldError(field) ? `error-${field.replaceAll(".", "-")}` : undefined });
  const updateVariant = (key: string, patch: Partial<VariantDraft>) => setVariants((current) => current.map((variant) => variant.key === key ? { ...variant, ...patch } : variant));
  const defaultIndex = Math.max(0, variants.findIndex((variant) => variant.key === defaultKey));
  const productImages = useMemo(() => images.filter((image) => image.kind === "product"), [images]);

  function addVariant() {
    if (variants.length >= MAX_VARIANTS) return;
    const base = variants[variants.length - 1];
    setVariants((current) => [...current, { key: `nueva-${++nextKey.current}`, sku: "", label: "", price: base?.price ?? "", comparePrice: "", trackStock: base?.trackStock ?? false, stock: "0", hasOrders: false }]);
  }
  function removeVariant(variant: VariantDraft) {
    if (variants.length === 1 || variant.key === defaultKey || variant.hasOrders) return;
    if (variant.id !== undefined) setRemoved((current) => [...current, variant.id!]);
    setVariants((current) => current.filter((item) => item.key !== variant.key));
    setErrors({});
  }

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > 12) { setFormError("Podés cargar hasta 12 imágenes."); return; }
    setUploading(true); setFormError("");
    const added: AdminImageInput[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) throw new Error("Elegí imágenes de hasta 20 MB en JPG, PNG o WebP.");
        const prepared = await prepareImage(file);
        const blob = await upload(`quilgym/products/${crypto.randomUUID()}.webp`, prepared.file, { access: "public", handleUploadUrl: "/api/admin/upload" });
        added.push({ url: blob.url, kind: "product", width: prepared.width, height: prepared.height });
      }
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "No pudimos subir la imagen."); }
    finally {
      if (added.length) { setImages((current) => [...current, ...added]); setPendingUploads((current) => [...current, ...added.map((image) => image.url)]); }
      setUploading(false);
    }
  }
  function removeImage(index: number) {
    const image = images[index];
    setImages((current) => current.filter((_, i) => i !== index));
    if (pendingUploads.includes(image.url)) { setPendingUploads((current) => current.filter((url) => url !== image.url)); void discardAdminUploads([image.url]); }
  }
  function moveImage(index: number, direction: -1 | 1) {
    setImages((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  async function cancel() {
    if (dirty && !window.confirm("Tenés cambios sin guardar. ¿Descartarlos?")) return;
    leaving.current = true;
    if (pendingUploads.length) await discardAdminUploads(pendingUploads).catch(() => null);
    router.push("/admin/productos");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || uploading) return;
    const local: FieldErrors = {};
    if (!categoryId) local.categoryId = "Elegí una categoría.";
    variants.forEach((variant, index) => {
      if (!Number.isSafeInteger(toNumber(variant.price)) || toNumber(variant.price) < 0) local[`variants.${index}.priceArs`] = "Ingresá un precio entero en pesos.";
      if (variant.comparePrice && !Number.isSafeInteger(toNumber(variant.comparePrice))) local[`variants.${index}.compareAtPriceArs`] = "Ingresá un número entero.";
      if (variant.trackStock && (!Number.isSafeInteger(toNumber(variant.stock)) || toNumber(variant.stock) < 0)) local[`variants.${index}.stock`] = "Ingresá cero o un número positivo.";
    });
    if (Object.keys(local).length) { setErrors(local); setFormError("Revisá los campos marcados."); return; }
    submitting.current = true; setSaving(true); setErrors({}); setFormError(""); setShowNotice(false);
    try {
      const result = await saveAdminProduct({ id: product?.id, name, brandId: brandId ? Number(brandId) : null, categoryId: Number(categoryId), description, status, isFeatured, images,
        variants: variants.map((variant) => ({ id: variant.id, sku: variant.sku, label: variant.label, priceArs: Number(variant.price), compareAtPriceArs: variant.comparePrice ? Number(variant.comparePrice) : null, stock: variant.trackStock ? Number(variant.stock) : null })),
        defaultIndex, removedVariantIds: removed });
      if (!result.ok) { setErrors(result.fields ?? {}); setFormError(result.error); return; }
      leaving.current = true; setPendingUploads([]);
      const aviso = !product ? "creado" : status === "archived" && product.status !== "archived" ? "archivado" : "guardado";
      router.replace(`/admin/productos/${result.id}?aviso=${aviso}`, { scroll: true });
      router.refresh();
    } catch { setFormError("No pudimos guardar el producto. Revisá la conexión e intentá nuevamente."); }
    finally { submitting.current = false; setSaving(false); }
  }

  const statusLabel = { active: "Publicado", draft: "Borrador", archived: "Archivado" }[status];
  return <div className="admin-content admin-editor">
    <Link className="admin-back" href="/admin/productos"><ArrowLeft size={17}/> Volver a productos</Link>
    <header className="admin-page-head"><div><p className="admin-eyebrow">{product ? `PRODUCTO #${product.id}` : "NUEVO PRODUCTO"}</p><h1>{product ? "Editar producto" : "Agregar producto"}</h1><p>Los cambios publicados se reflejan en la tienda al guardar.</p></div>{product?.status === "active" && <a className="admin-secondary" href={`/productos/${product.slug}`} target="_blank" rel="noreferrer">Ver en la tienda</a>}</header>
    {notice && showNotice && <div className="admin-notice" role="status"><CheckCircle2 size={19}/><p>{noticeText[notice]} <Link href="/admin/productos">Volver al listado</Link></p><button type="button" aria-label="Cerrar aviso" onClick={() => setShowNotice(false)}><X size={17}/></button></div>}
    <form ref={formRef} onSubmit={save} className="admin-editor-grid" noValidate aria-busy={saving}>
      <div className="admin-editor-main">
        <section className="admin-card"><h2>Información básica</h2>
          <label>Nombre del producto<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={180} placeholder="Ej. Creatina monohidrato 300 g" {...invalid("name")}/><FieldMessage id="error-name" message={fieldError("name")}/></label>
          <div className="admin-form-row"><label>Marca<select value={brandId} onChange={(e) => setBrandId(e.target.value)} {...invalid("brandId")}><option value="">Sin marca</option>{taxonomy.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><FieldMessage id="error-brandId" message={fieldError("brandId")}/></label><label>Categoría<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required {...invalid("categoryId")}><option value="">Seleccionar</option>{taxonomy.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><FieldMessage id="error-categoryId" message={fieldError("categoryId")}/></label></div>
          <small className="admin-help admin-help--inline">¿Falta una marca o categoría? Creala en <Link href="/admin/productos/marcas">Marcas</Link> o <Link href="/admin/productos/categorias">Categorías</Link> (guardá antes este producto).</small>
          <label>Descripción<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={10000} placeholder="Características, uso y detalles del producto" {...invalid("description")}/><FieldMessage id="error-description" message={fieldError("description")}/></label>
          {product && <small className="admin-help">URL actual: /productos/{product.slug}. El enlace se conserva aunque cambies el nombre.</small>}</section>
        <section className="admin-card" aria-describedby={fieldError("images") ? "error-images" : undefined}><h2>Fotos</h2><p className="admin-help">La primera foto de producto ({productImages.length ? "marcada como portada" : "todavía no hay"}) es la portada. Podés agregar rótulos nutricionales, reordenar y quitar imágenes.</p><FieldMessage id="error-images" message={fieldError("images")}/>
          <div className="admin-image-grid">{images.map((image, index) => <div className="admin-image-tile" key={image.url}><Image src={image.url} alt={`Imagen ${index + 1}`} width={120} height={120}/><span>{image.kind === "nutrition" ? "Rótulo" : image === productImages[0] ? "Portada" : "Producto"}{pendingUploads.includes(image.url) ? " · sin guardar" : ""}</span><button type="button" className="admin-image-remove" aria-label={`Quitar imagen ${index + 1}`} onClick={() => removeImage(index)}><Trash2 size={17}/></button><div className="admin-image-tools"><select aria-label={`Tipo de imagen ${index + 1}`} value={image.kind} onChange={(e) => setImages((current) => current.map((item, i) => i === index ? { ...item, kind: e.target.value as AdminImageInput["kind"] } : item))}><option value="product">Producto</option><option value="nutrition">Rótulo</option></select><button type="button" aria-label={`Mover imagen ${index + 1} antes`} disabled={index === 0} onClick={() => moveImage(index, -1)}>←</button><button type="button" aria-label={`Mover imagen ${index + 1} después`} disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}>→</button></div></div>)}
            <label className="admin-upload-tile"><ImagePlus size={28}/><span>{uploading ? "Subiendo…" : "Agregar fotos"}</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading || images.length >= 12} onChange={(e) => { void addImages(e.target.files); e.target.value = ""; }}/></label></div>
          <small className="admin-help">Las imágenes se optimizan a WebP antes de subirse. Hasta 12 por producto. Las fotos subidas que quites se borran del almacenamiento al guardar.</small></section>
        <section className="admin-card"><div className="admin-card-head"><h2>Variantes, precio e inventario</h2><button type="button" className="admin-secondary" onClick={addVariant} disabled={variants.length >= MAX_VARIANTS}><Plus size={16}/> Agregar variante</button></div>
          <p className="admin-help">La variante principal define el precio de la tarjeta. Con más de una variante, la ficha muestra un selector con cada presentación.</p><FieldMessage id="error-variants" message={fieldError("variants")}/>
          <div className="admin-variants">{variants.map((variant, index) => { const f = (field: string) => `variants.${index}.${field}`; const isDefault = variant.key === defaultKey; return <fieldset className={`admin-variant${isDefault ? " is-default" : ""}`} key={variant.key}>
            <legend>{variant.label || variant.sku || `Variante ${index + 1}`}{isDefault && <span className="admin-status admin-status--active">Principal</span>}{!variant.id && <span className="admin-status admin-status--draft">Nueva</span>}</legend>
            <div className="admin-form-row"><label>SKU<input value={variant.sku} onChange={(e) => updateVariant(variant.key, { sku: e.target.value })} required maxLength={80} placeholder="Código único" {...invalid(f("sku"))}/><FieldMessage id={`error-variants-${index}-sku`} message={fieldError(f("sku"))}/></label><label>Presentación<input value={variant.label} onChange={(e) => updateVariant(variant.key, { label: e.target.value })} maxLength={120} placeholder="Ej. 300 g · Frutilla" {...invalid(f("label"))}/><FieldMessage id={`error-variants-${index}-label`} message={fieldError(f("label"))}/></label></div>
            <div className="admin-form-row"><label>Precio en pesos<input type="number" inputMode="numeric" min="0" step="1" value={variant.price} onChange={(e) => updateVariant(variant.key, { price: e.target.value })} required {...invalid(f("priceArs"))}/><FieldMessage id={`error-variants-${index}-priceArs`} message={fieldError(f("priceArs"))}/></label><label>Precio anterior (opcional)<input type="number" inputMode="numeric" min="0" step="1" value={variant.comparePrice} onChange={(e) => updateVariant(variant.key, { comparePrice: e.target.value })} placeholder="Solo con descuento real" {...invalid(f("compareAtPriceArs"))}/><FieldMessage id={`error-variants-${index}-compareAtPriceArs`} message={fieldError(f("compareAtPriceArs"))}/></label></div>
            <div className="admin-variant-stock"><label className="admin-check"><input type="checkbox" checked={variant.trackStock} onChange={(e) => updateVariant(variant.key, { trackStock: e.target.checked })}/> Controlar stock</label>{variant.trackStock ? <label>Unidades disponibles<input type="number" inputMode="numeric" min="0" step="1" value={variant.stock} onChange={(e) => updateVariant(variant.key, { stock: e.target.value })} required {...invalid(f("stock"))}/><FieldMessage id={`error-variants-${index}-stock`} message={fieldError(f("stock"))}/></label> : <p className="admin-help">Sin control: se muestra disponible y no se descuentan unidades.</p>}</div>
            <div className="admin-variant-actions"><label className="admin-check"><input type="radio" name="variante-principal" checked={isDefault} onChange={() => setDefaultKey(variant.key)}/> Variante principal</label>
              {variant.hasOrders ? <span className="admin-help">Tiene pedidos: no se puede borrar. {!(variant.trackStock && variant.stock === "0") && <button type="button" className="admin-link-button" onClick={() => updateVariant(variant.key, { trackStock: true, stock: "0" })}>Dejar sin stock</button>}</span>
                : <button type="button" className="admin-link-button admin-link-button--danger" disabled={variants.length === 1 || isDefault} title={isDefault ? "Elegí otra variante principal antes de quitarla" : undefined} onClick={() => removeVariant(variant)}><Trash2 size={15}/> Quitar variante</button>}</div>
          </fieldset>; })}</div>
          {removed.length > 0 && <p className="admin-help">Al guardar se borran {removed.length === 1 ? "1 variante" : `${removed.length} variantes`} sin pedidos.</p>}</section>
      </div>
      <aside className="admin-editor-side"><section className="admin-card"><h2>Publicación</h2><label>Estado<select value={status} onChange={(e) => setStatus(e.target.value as AdminProductInput["status"])} {...invalid("status")}><option value="draft">Borrador</option><option value="active">Publicado</option><option value="archived">Archivado</option></select><FieldMessage id="error-status" message={fieldError("status")}/></label><p className="admin-help">Archivar lo oculta de la tienda sin perder los datos ni el historial.</p><label className="admin-check"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)}/> Destacar en la portada</label></section>
        <button className="admin-primary admin-save" type="submit" disabled={saving || uploading}>{saving ? "Guardando…" : uploading ? "Esperá a que terminen las fotos" : product ? `Guardar · ${statusLabel}` : "Crear producto"}</button>
        <button className="admin-secondary admin-save" type="button" onClick={() => void cancel()} disabled={saving}>{product ? "Descartar cambios" : "Cancelar alta"}</button>
        <p className="admin-dirty" aria-live="polite">{dirty && !saving ? "Hay cambios sin guardar." : ""}</p>
        {formError && <p className="admin-error" role="alert">{formError}</p>}
        {entry && <section className="admin-card admin-history"><h2>Historial de stock</h2>{entry.stockHistory === null ? <p className="admin-help">Se activa al aplicar la migración 0007 en la base.</p> : entry.stockHistory.length ? <ol>{entry.stockHistory.map((change) => <li key={change.id}><strong>{change.sku}</strong><span>{stockText(change.previousStock)} → {stockText(change.newStock)}</span><small>{dateFormat.format(new Date(change.createdAt))}{change.changedBy ? ` · ${change.changedBy}` : ""}</small></li>)}</ol> : <p className="admin-help">Todavía no hay cambios registrados desde el panel. Las ventas descuentan stock sin registrarse acá.</p>}</section>}
      </aside>
    </form>
  </div>;
}
