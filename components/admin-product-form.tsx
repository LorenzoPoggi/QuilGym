"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { saveAdminProduct, type AdminImageInput, type AdminProductInput } from "@/lib/admin-actions";
import type { getAdminProduct, getAdminTaxonomy } from "@/lib/admin-catalog";

type Entry = NonNullable<Awaited<ReturnType<typeof getAdminProduct>>>;
type Taxonomy = Awaited<ReturnType<typeof getAdminTaxonomy>>;

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

export function AdminProductForm({ entry, taxonomy }: { entry?: Entry; taxonomy: Taxonomy }) {
  const router = useRouter();
  const product = entry?.product;
  const variant = entry?.variants.find((item) => item.isDefault) ?? entry?.variants[0];
  const [name, setName] = useState(product?.name ?? "");
  const [brandId, setBrandId] = useState(product?.brandId?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId?.toString() ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [status, setStatus] = useState<AdminProductInput["status"]>(product?.status ?? "draft");
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [label, setLabel] = useState(variant?.label ?? "");
  const [price, setPrice] = useState(variant?.priceArs.toString() ?? "");
  const [comparePrice, setComparePrice] = useState(variant?.compareAtPriceArs?.toString() ?? "");
  const [trackStock, setTrackStock] = useState(variant?.stock !== null && variant?.stock !== undefined);
  const [stock, setStock] = useState(variant?.stock?.toString() ?? "0");
  const [images, setImages] = useState<AdminImageInput[]>(entry?.images.map((item) => ({ url: item.url, kind: item.kind, width: item.width, height: item.height })) ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    if (images.length + files.length > 12) { setError("Podés cargar hasta 12 imágenes."); return; }
    setUploading(true); setError("");
    try {
      const added: AdminImageInput[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) throw new Error("Elegí imágenes de hasta 20 MB en JPG, PNG o WebP.");
        const prepared = await prepareImage(file);
        const blob = await upload(`quilgym/products/${crypto.randomUUID()}.webp`, prepared.file, { access: "public", handleUploadUrl: "/api/admin/upload" });
        added.push({ url: blob.url, kind: "product", width: prepared.width, height: prepared.height });
      }
      setImages((current) => [...current, ...added]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos subir la imagen."); }
    finally { setUploading(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    try {
      if (!categoryId || !price || (trackStock && stock === "")) { setError("Completá categoría, precio y stock cuando corresponda."); return; }
      const result = await saveAdminProduct({ id: product?.id, name, brandId: brandId ? Number(brandId) : null, categoryId: Number(categoryId), description,
        status, isFeatured, variantId: variant?.id, sku, label, priceArs: Number(price), compareAtPriceArs: comparePrice ? Number(comparePrice) : null,
        stock: trackStock ? Number(stock) : null, images });
      if (!result.ok) { setError(result.error); return; }
      router.push("/admin/productos"); router.refresh();
    } catch { setError("No pudimos guardar el producto. Revisá la conexión e intentá nuevamente."); }
    finally { setSaving(false); }
  }

  return <div className="admin-content admin-editor">
    <Link className="admin-back" href="/admin/productos"><ArrowLeft size={17}/> Volver a productos</Link>
    <header className="admin-page-head"><div><p className="admin-eyebrow">{product ? `PRODUCTO #${product.id}` : "NUEVO PRODUCTO"}</p><h1>{product ? "Editar producto" : "Agregar producto"}</h1><p>Los cambios publicados se reflejan en la tienda al guardar.</p></div></header>
    <form onSubmit={save} className="admin-editor-grid">
      <div className="admin-editor-main">
        <section className="admin-card"><h2>Información básica</h2><label>Nombre del producto<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={180} placeholder="Ej. Creatina monohidrato 300 g"/></label><div className="admin-form-row"><label>Marca<select value={brandId} onChange={(e) => setBrandId(e.target.value)}><option value="">Sin marca</option>{taxonomy.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Categoría<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required><option value="">Seleccionar</option>{taxonomy.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><label>Descripción<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={10000} placeholder="Características, uso y detalles del producto"/></label>{product && <small className="admin-help">URL actual: /producto/{product.slug}. El enlace se conserva aunque cambies el nombre.</small>}</section>
        <section className="admin-card"><h2>Fotos</h2><p className="admin-help">La primera foto de producto será la portada. Podés agregar rótulos nutricionales y quitar imágenes existentes.</p><div className="admin-image-grid">{images.map((image, index) => <div className="admin-image-tile" key={`${image.url}-${index}`}><Image src={image.url} alt={`Imagen ${index + 1}`} width={120} height={120}/><span>{image.kind === "nutrition" ? "Rótulo" : index === 0 ? "Portada" : "Producto"}</span><button type="button" aria-label={`Quitar imagen ${index + 1}`} onClick={() => setImages((current) => current.filter((_, i) => i !== index))}><Trash2 size={17}/></button><select aria-label={`Tipo de imagen ${index + 1}`} value={image.kind} onChange={(e) => setImages((current) => current.map((item, i) => i === index ? { ...item, kind: e.target.value as AdminImageInput["kind"] } : item))}><option value="product">Producto</option><option value="nutrition">Rótulo</option></select></div>)}<label className="admin-upload-tile"><ImagePlus size={28}/><span>{uploading ? "Subiendo…" : "Agregar fotos"}</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading || images.length >= 12} onChange={(e) => { void addImages(e.target.files); e.target.value = ""; }}/></label></div><small className="admin-help">Las imágenes se optimizan a WebP antes de subirse. Hasta 12 por producto.</small></section>
        <section className="admin-card"><h2>Precio e inventario</h2><div className="admin-form-row"><label>Precio en pesos<input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} required/></label><label>Precio anterior (opcional)<input type="number" min="0" step="1" value={comparePrice} onChange={(e) => setComparePrice(e.target.value)} placeholder="Para mostrar descuento"/></label></div><div className="admin-form-row"><label>SKU<input value={sku} onChange={(e) => setSku(e.target.value)} required maxLength={80} placeholder="Código único"/></label><label>Presentación<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Ej. 300 g"/></label></div><label className="admin-check"><input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)}/> Controlar stock</label>{trackStock ? <label>Unidades disponibles<input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} required/></label> : <p className="admin-help">Sin control: se mostrará disponible y no se descontarán unidades. Activá el control para llevar cantidades reales.</p>}{entry && entry.variants.length > 1 && <p className="admin-help">Este editor modifica la variante principal. Las otras {entry.variants.length - 1} variantes permanecen sin cambios.</p>}</section>
      </div>
      <aside className="admin-editor-side"><section className="admin-card"><h2>Publicación</h2><label>Estado<select value={status} onChange={(e) => setStatus(e.target.value as AdminProductInput["status"])}><option value="draft">Borrador</option><option value="active">Publicado</option><option value="archived">Archivado</option></select></label><p className="admin-help">Archivar lo oculta de la tienda sin perder los datos ni el historial.</p><label className="admin-check"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)}/> Destacar en la portada</label></section><button className="admin-primary admin-save" type="submit" disabled={saving || uploading}>{saving ? "Guardando…" : uploading ? "Esperá a que terminen las fotos" : "Guardar producto"}</button>{error && <p className="admin-error" role="alert">{error}</p>}</aside>
    </form>
  </div>;
}
