"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "./admin-auth";
import { CATALOG_TAG } from "./catalog";
import { db } from "./db";
import { brands, categories, productImages, products, productVariants } from "./db/schema";
import { withOrderTransaction } from "./db/transaction";
import { slugify } from "./slugify";

export type AdminImageInput = { url: string; kind: "product" | "nutrition"; width: number; height: number };
export type AdminProductInput = {
  id?: number; name: string; brandId: number | null; categoryId: number; description: string;
  status: "active" | "draft" | "archived"; isFeatured: boolean;
  variantId?: number; sku: string; label: string; priceArs: number;
  compareAtPriceArs: number | null; stock: number | null; images: AdminImageInput[];
};

type ActionResult = { ok: true; id: number } | { ok: false; error: string };
const validInteger = (value: unknown, min = 0) => Number.isSafeInteger(value) && Number(value) >= min;
const blobHost = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;

function validImageUrl(url: string) {
  if (/^\/assets\/products\/[a-zA-Z0-9/_.,-]+$/.test(url)) return true;
  try { const parsed = new URL(url); return parsed.protocol === "https:" && blobHost.test(parsed.hostname); }
  catch { return false; }
}

function validate(input: AdminProductInput): string | null {
  if (input.id !== undefined && !validInteger(input.id, 1)) return "Producto inválido.";
  if (typeof input.name !== "string" || input.name.trim().length < 3 || input.name.length > 180) return "Ingresá un nombre de 3 a 180 caracteres.";
  if (!validInteger(input.categoryId, 1) || (input.brandId !== null && !validInteger(input.brandId, 1))) return "Elegí una categoría y una marca válidas.";
  if (typeof input.description !== "string" || input.description.length > 10000) return "La descripción es demasiado larga.";
  if (!["active", "draft", "archived"].includes(input.status) || typeof input.isFeatured !== "boolean") return "Estado inválido.";
  if (input.variantId !== undefined && !validInteger(input.variantId, 1)) return "Variante inválida.";
  if (typeof input.sku !== "string" || input.sku.trim().length < 2 || input.sku.length > 80) return "Ingresá un SKU de 2 a 80 caracteres.";
  if (typeof input.label !== "string" || input.label.length > 120) return "La presentación es demasiado larga.";
  if (!validInteger(input.priceArs) || (input.compareAtPriceArs !== null && (!validInteger(input.compareAtPriceArs) || input.compareAtPriceArs <= input.priceArs))) return "Revisá los precios: el anterior debe superar al actual.";
  if (input.stock !== null && !validInteger(input.stock)) return "El stock debe ser cero o un número positivo.";
  if (!Array.isArray(input.images) || input.images.length > 12 || input.images.some((image) => !image || !validImageUrl(image.url) || !["product", "nutrition"].includes(image.kind) || !validInteger(image.width, 1) || !validInteger(image.height, 1) || image.width > 6000 || image.height > 6000)) return "Revisá las imágenes (máximo 12).";
  if (input.status === "active" && !input.images.some((image) => image.kind === "product")) return "Agregá una foto de producto antes de publicarlo.";
  return null;
}

export async function saveAdminProduct(input: AdminProductInput): Promise<ActionResult> {
  if (!await getAdminUser()) return { ok: false, error: "No tenés permisos de administrador. Ingresá con Google usando la cuenta autorizada." };
  const validationError = validate(input);
  if (validationError) return { ok: false, error: validationError };
  const [category, brand] = await Promise.all([
    db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId)).limit(1),
    input.brandId === null ? Promise.resolve([{ id: null }]) : db.select({ id: brands.id }).from(brands).where(eq(brands.id, input.brandId)).limit(1),
  ]);
  if (!category.length || !brand.length) return { ok: false, error: "La categoría o marca ya no existe." };
  try {
    const result = await withOrderTransaction(async (tx) => {
      let id = input.id;
      let oldSlug: string | undefined;
      if (id) {
        const [old] = await tx.select({ id: products.id, slug: products.slug }).from(products).where(eq(products.id, id)).limit(1);
        if (!old) throw new Error("No encontramos el producto.");
        oldSlug = old.slug;
        await tx.update(products).set({ name: input.name.trim(), brandId: input.brandId, categoryId: input.categoryId, description: input.description.trim() || null, status: input.status, isFeatured: input.isFeatured }).where(eq(products.id, id));
      } else {
        const [created] = await tx.insert(products).values({ slug: `nuevo-${crypto.randomUUID()}`, name: input.name.trim(), brandId: input.brandId, categoryId: input.categoryId, description: input.description.trim() || null, status: input.status, isFeatured: input.isFeatured }).returning({ id: products.id });
        id = created.id;
        await tx.update(products).set({ slug: `${slugify(input.name) || "producto"}-${id}` }).where(eq(products.id, id));
      }
      if (input.variantId) {
        const [variant] = await tx.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.id, input.variantId), eq(productVariants.productId, id))).limit(1);
        if (!variant) throw new Error("La variante no corresponde a este producto.");
        await tx.update(productVariants).set({ sku: input.sku.trim(), label: input.label.trim() || null, priceArs: input.priceArs, compareAtPriceArs: input.compareAtPriceArs, stock: input.stock }).where(eq(productVariants.id, input.variantId));
      } else {
        await tx.insert(productVariants).values({ productId: id, sku: input.sku.trim(), label: input.label.trim() || null, priceArs: input.priceArs, compareAtPriceArs: input.compareAtPriceArs, stock: input.stock, isDefault: true });
      }
      await tx.delete(productImages).where(eq(productImages.productId, id));
      if (input.images.length) await tx.insert(productImages).values(input.images.map((image, position) => ({ productId: id, url: image.url, kind: image.kind, width: image.width, height: image.height, position })));
      return { id, oldSlug };
    });
    updateTag(CATALOG_TAG);
    revalidatePath("/");
    revalidatePath("/productos");
    if (result.oldSlug) revalidatePath(`/productos/${result.oldSlug}`);
    revalidatePath("/admin/productos");
    return { ok: true, id: result.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("product_variants_sku_unique") || message.includes("duplicate key")) return { ok: false, error: "Ese SKU ya existe. Elegí otro." };
    return { ok: false, error: message === "No encontramos el producto." || message === "La variante no corresponde a este producto." ? message : "No pudimos guardar el producto. Intentá nuevamente." };
  }
}
