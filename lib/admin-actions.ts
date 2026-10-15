"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { del } from "@vercel/blob";
import { getAdminUser } from "./admin-auth";
import { ownedBlobUrl, slugPattern, stockHistoryAvailable, validateProductInput, validateTaxonomyInput, type AdminProductInput, type AdminTaxonomyInput, type FieldErrors } from "./admin-catalog";
import { CATALOG_TAG } from "./catalog";
import { db } from "./db";
import { brands, categories, orderItems, productImages, products, productStockChanges, productVariants } from "./db/schema";
import { withOrderTransaction } from "./db/transaction";
import { slugify } from "./slugify";

export type { AdminImageInput, AdminProductInput, AdminTaxonomyInput, AdminVariantInput, FieldErrors } from "./admin-catalog";
export type ActionResult = { ok: true; id: number } | { ok: false; error: string; fields?: FieldErrors };

const unauthorized: ActionResult = { ok: false, error: "No tenés permisos de administrador. Ingresá con Google usando la cuenta autorizada." };
const firstError = (fields: FieldErrors) => fields.form ?? "Revisá los campos marcados.";
class FieldError extends Error { constructor(public fields: FieldErrors) { super("field"); } }
const isUniqueViolation = (error: unknown) => {
  const value = error as { code?: string; cause?: { code?: string }; message?: string };
  return value?.code === "23505" || value?.cause?.code === "23505" || /duplicate key|unique/i.test(value?.message ?? "");
};

function revalidateCatalog(paths: string[] = []) {
  updateTag(CATALOG_TAG);
  for (const path of ["/", "/productos", "/buscar", "/admin/productos", ...paths]) revalidatePath(path);
  revalidatePath("/productos/[slug]", "page");
}

/** Borra blobs propios que ya no figuran en ninguna fila de product_images. Nunca toca /assets locales. */
async function removeOrphanBlobs(urls: string[]) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 0;
  const candidates = [...new Set(urls)].filter((url) => ownedBlobUrl(url));
  if (!candidates.length) return 0;
  try {
    const referenced = new Set((await db.select({ url: productImages.url }).from(productImages).where(inArray(productImages.url, candidates))).map((row) => row.url));
    const orphans = candidates.filter((url) => !referenced.has(url));
    if (orphans.length) await del(orphans);
    return orphans.length;
  } catch (error) {
    console.warn("[admin] No se pudieron borrar imágenes huérfanas:", error instanceof Error ? error.name : "error");
    return 0;
  }
}

export async function saveAdminProduct(input: AdminProductInput): Promise<ActionResult> {
  const admin = await getAdminUser();
  if (!admin) return unauthorized;
  const fields = validateProductInput(input);
  if (Object.keys(fields).length) return { ok: false, error: firstError(fields), fields };
  const [category, brand] = await Promise.all([
    db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId)).limit(1),
    input.brandId === null ? Promise.resolve([{ id: null }]) : db.select({ id: brands.id }).from(brands).where(eq(brands.id, input.brandId)).limit(1),
  ]);
  if (!category.length) return { ok: false, error: "La categoría ya no existe.", fields: { categoryId: "La categoría ya no existe." } };
  if (!brand.length) return { ok: false, error: "La marca ya no existe.", fields: { brandId: "La marca ya no existe." } };
  const values = { name: input.name.trim(), brandId: input.brandId, categoryId: input.categoryId, description: input.description.trim() || null, status: input.status, isFeatured: input.isFeatured };
  try {
    const result = await withOrderTransaction(async (tx) => {
      let id = input.id;
      let oldSlug: string | undefined;
      if (id) {
        const [old] = await tx.select({ id: products.id, slug: products.slug }).from(products).where(eq(products.id, id)).limit(1).for("update");
        if (!old) throw new FieldError({ form: "No encontramos el producto." });
        oldSlug = old.slug;
        await tx.update(products).set(values).where(eq(products.id, id));
      } else {
        const [created] = await tx.insert(products).values({ ...values, slug: `nuevo-${crypto.randomUUID()}` }).returning({ id: products.id });
        id = created.id;
        await tx.update(products).set({ slug: `${slugify(input.name) || "producto"}-${id}` }).where(eq(products.id, id));
      }
      const productId = id;
      const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, productId)).for("update");
      const byId = new Map(existing.map((variant) => [variant.id, variant]));
      const errors: FieldErrors = {};
      input.variants.forEach((variant, index) => { if (variant.id !== undefined && !byId.has(variant.id)) errors[`variants.${index}.sku`] = "La variante no corresponde a este producto."; });
      if (input.removedVariantIds.some((removed) => !byId.has(removed))) errors.form = "Una variante a quitar no corresponde a este producto.";
      const kept = new Set(input.variants.flatMap((variant) => variant.id === undefined ? [] : [variant.id]));
      if (existing.some((variant) => !kept.has(variant.id) && !input.removedVariantIds.includes(variant.id))) errors.form = "El producto cambió mientras lo editabas. Recargá la página.";
      if (input.removedVariantIds.length) {
        const withOrders = new Set((await tx.selectDistinct({ id: orderItems.variantId }).from(orderItems).where(inArray(orderItems.variantId, input.removedVariantIds))).map((row) => row.id));
        if (withOrders.size) errors.variants = `No se pueden borrar variantes con pedidos (${existing.filter((variant) => withOrders.has(variant.id)).map((variant) => variant.sku).join(", ")}). Dejalas sin stock para retirarlas de la venta.`;
      }
      const skus = input.variants.map((variant) => variant.sku.trim());
      const taken = await tx.select({ id: productVariants.id, sku: productVariants.sku }).from(productVariants).where(and(inArray(productVariants.sku, skus), ne(productVariants.productId, productId)));
      for (const row of taken) errors[`variants.${skus.indexOf(row.sku)}.sku`] = "Ese SKU ya lo usa otro producto.";
      if (Object.keys(errors).length) throw new FieldError(errors);

      if (input.removedVariantIds.length) await tx.delete(productVariants).where(and(eq(productVariants.productId, productId), inArray(productVariants.id, input.removedVariantIds)));
      await tx.update(productVariants).set({ isDefault: false }).where(and(eq(productVariants.productId, productId), eq(productVariants.isDefault, true)));
      const changes: { variantId: number; sku: string; previousStock: number | null; newStock: number | null }[] = [];
      for (const [index, variant] of input.variants.entries()) {
        const position = index === input.defaultIndex ? 0 : index < input.defaultIndex ? index + 1 : index;
        const data = { sku: variant.sku.trim(), label: variant.label.trim() || null, priceArs: variant.priceArs, compareAtPriceArs: variant.compareAtPriceArs, stock: variant.stock, isDefault: index === input.defaultIndex, position };
        if (variant.id !== undefined) {
          await tx.update(productVariants).set(data).where(eq(productVariants.id, variant.id));
          const before = byId.get(variant.id)!.stock;
          if (before !== variant.stock) changes.push({ variantId: variant.id, sku: data.sku, previousStock: before, newStock: variant.stock });
        } else {
          const [created] = await tx.insert(productVariants).values({ ...data, productId }).returning({ id: productVariants.id });
          changes.push({ variantId: created.id, sku: data.sku, previousStock: null, newStock: variant.stock });
        }
      }
      if (changes.length && await stockHistoryAvailable(tx)) await tx.insert(productStockChanges).values(changes.map((change) => ({ ...change, productId, source: input.id ? "admin" : "alta", changedBy: admin.email })));

      const oldImages = await tx.select({ url: productImages.url }).from(productImages).where(eq(productImages.productId, productId));
      await tx.delete(productImages).where(eq(productImages.productId, productId));
      if (input.images.length) await tx.insert(productImages).values(input.images.map((image, position) => ({ productId, url: image.url, kind: image.kind, width: image.width, height: image.height, position })));
      const keptUrls = new Set(input.images.map((image) => image.url));
      return { id: productId, oldSlug, removedUrls: oldImages.map((image) => image.url).filter((url) => !keptUrls.has(url)) };
    });
    await removeOrphanBlobs(result.removedUrls);
    revalidateCatalog(result.oldSlug ? [`/productos/${result.oldSlug}`, `/admin/productos/${result.id}`] : []);
    return { ok: true, id: result.id };
  } catch (error) {
    if (error instanceof FieldError) return { ok: false, error: firstError(error.fields), fields: error.fields };
    if (isUniqueViolation(error)) return { ok: false, error: "Ese SKU ya existe. Elegí otro.", fields: { variants: "Hay un SKU repetido." } };
    return { ok: false, error: "No pudimos guardar el producto. Intentá nuevamente." };
  }
}

/** Fotos subidas que nunca se guardaron (se quitaron antes de guardar o se canceló el alta). */
export async function discardAdminUploads(urls: string[]): Promise<{ ok: boolean; removed: number }> {
  if (!await getAdminUser()) return { ok: false, removed: 0 };
  if (!Array.isArray(urls) || urls.length > 24 || urls.some((url) => typeof url !== "string" || url.length > 500)) return { ok: false, removed: 0 };
  return { ok: true, removed: await removeOrphanBlobs(urls) };
}

async function saveTaxonomy(kind: "brand" | "category", input: AdminTaxonomyInput): Promise<ActionResult> {
  if (!await getAdminUser()) return unauthorized;
  const fields = validateTaxonomyInput(input, kind === "category");
  if (Object.keys(fields).length) return { ok: false, error: firstError(fields), fields };
  const slug = input.slug || slugify(input.name);
  if (!slugPattern.test(slug)) return { ok: false, error: "No pudimos generar un identificador. Escribilo a mano.", fields: { slug: "Escribí un identificador válido." } };
  const table = kind === "brand" ? brands : categories;
  const data = { name: input.name.trim(), slug, ...(kind === "category" ? { position: input.position ?? 0 } : {}) };
  try {
    const [duplicate] = await db.select({ id: table.id }).from(table).where(input.id ? and(eq(table.slug, slug), ne(table.id, input.id)) : eq(table.slug, slug)).limit(1);
    if (duplicate) return { ok: false, error: "Ese identificador ya está en uso.", fields: { slug: "Ese identificador ya está en uso." } };
    let id = input.id;
    if (id) {
      const [updated] = await db.update(table).set(data).where(eq(table.id, id)).returning({ id: table.id });
      if (!updated) return { ok: false, error: "No encontramos el registro." };
    } else id = (await db.insert(table).values(data).returning({ id: table.id }))[0].id;
    revalidateCatalog([kind === "brand" ? "/admin/productos/marcas" : "/admin/productos/categorias"]);
    return { ok: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Ese identificador ya está en uso.", fields: { slug: "Ese identificador ya está en uso." } };
    return { ok: false, error: "No pudimos guardar. Intentá nuevamente." };
  }
}

async function deleteTaxonomy(kind: "brand" | "category", id: number): Promise<ActionResult> {
  if (!await getAdminUser()) return unauthorized;
  if (!Number.isSafeInteger(id) || id < 1) return { ok: false, error: "Registro inválido." };
  const table = kind === "brand" ? brands : categories;
  const column = kind === "brand" ? products.brandId : products.categoryId;
  try {
    const [used] = await db.select({ id: products.id }).from(products).where(eq(column, id)).limit(1);
    if (used) return { ok: false, error: "No se puede borrar: tiene productos asociados (incluidos borradores o archivados). Reasignalos primero." };
    const [deleted] = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id });
    if (!deleted) return { ok: false, error: "No encontramos el registro." };
    revalidateCatalog([kind === "brand" ? "/admin/productos/marcas" : "/admin/productos/categorias"]);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No se puede borrar: tiene productos asociados o hubo un error. Intentá nuevamente." };
  }
}

export async function saveAdminBrand(input: AdminTaxonomyInput) { return saveTaxonomy("brand", input); }
export async function saveAdminCategory(input: AdminTaxonomyInput) { return saveTaxonomy("category", input); }
export async function deleteAdminBrand(id: number) { return deleteTaxonomy("brand", id); }
export async function deleteAdminCategory(id: number) { return deleteTaxonomy("category", id); }
