import "server-only";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { brands, categories, orderItems, productImages, products, productStockChanges, productVariants } from "./db/schema";
import { normalizeText } from "./slugify";

export type AdminStatus = "active" | "draft" | "archived";
export type AdminImageInput = { url: string; kind: "product" | "nutrition"; width: number; height: number };
export type AdminVariantInput = { id?: number; sku: string; label: string; priceArs: number; compareAtPriceArs: number | null; stock: number | null };
export type AdminProductInput = {
  id?: number; name: string; brandId: number | null; categoryId: number; description: string;
  status: AdminStatus; isFeatured: boolean; variants: AdminVariantInput[]; defaultIndex: number;
  removedVariantIds: number[]; images: AdminImageInput[];
};
export type AdminTaxonomyInput = { id?: number; name: string; slug: string; position?: number };
export type FieldErrors = Record<string, string>;

const validInteger = (value: unknown, min = 0) => Number.isSafeInteger(value) && Number(value) >= min;
const blobHost = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i;
export const BLOB_PREFIX = "quilgym/products/";
export const MAX_VARIANTS = 30;
export const ADMIN_PAGE_SIZE = 25;
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validImageUrl(url: unknown) {
  if (typeof url !== "string") return false;
  if (/^\/assets\/products\/[a-zA-Z0-9/_.,-]+$/.test(url) && !url.includes("..")) return true;
  try { const parsed = new URL(url); return parsed.protocol === "https:" && blobHost.test(parsed.hostname); }
  catch { return false; }
}

/** Solo blobs del store propio y bajo el prefijo de subidas del panel; nunca /assets locales. */
export function ownedBlobUrl(url: string, env: { BLOB_READ_WRITE_TOKEN?: string; BLOB_STORE_ID?: string } = process.env as { BLOB_READ_WRITE_TOKEN?: string; BLOB_STORE_ID?: string }) {
  const tokenStore = env.BLOB_READ_WRITE_TOKEN?.split("_")[3] ?? "";
  const storeId = (tokenStore || env.BLOB_STORE_ID || "").replace(/^store_/, "").toLowerCase();
  if (!storeId || !/^[a-z0-9]+$/.test(storeId)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === `${storeId}.public.blob.vercel-storage.com`
      && !parsed.search && !parsed.hash && new RegExp(`^/${BLOB_PREFIX}[a-zA-Z0-9_.-]+\\.(webp|png|jpe?g)$`).test(parsed.pathname);
  } catch { return false; }
}

export function validateProductInput(input: AdminProductInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!input || typeof input !== "object") return { form: "Datos inválidos." };
  if (input.id !== undefined && !validInteger(input.id, 1)) errors.form = "Producto inválido.";
  if (typeof input.name !== "string" || input.name.trim().length < 3 || input.name.length > 180) errors.name = "Ingresá un nombre de 3 a 180 caracteres.";
  if (!validInteger(input.categoryId, 1)) errors.categoryId = "Elegí una categoría.";
  if (input.brandId !== null && !validInteger(input.brandId, 1)) errors.brandId = "Elegí una marca válida.";
  if (typeof input.description !== "string" || input.description.length > 10000) errors.description = "La descripción admite hasta 10.000 caracteres.";
  if (!["active", "draft", "archived"].includes(input.status)) errors.status = "Estado inválido.";
  if (typeof input.isFeatured !== "boolean") errors.status = "Revisá la opción de destacado.";
  if (!Array.isArray(input.removedVariantIds) || input.removedVariantIds.some((id) => !validInteger(id, 1))) errors.form = "Variantes a quitar inválidas.";
  if (!Array.isArray(input.variants) || !input.variants.length || input.variants.length > MAX_VARIANTS) errors.variants = `Cargá entre 1 y ${MAX_VARIANTS} variantes.`;
  else {
    if (!validInteger(input.defaultIndex) || input.defaultIndex >= input.variants.length) errors.variants = "Elegí cuál es la variante principal.";
    const skus = new Map<string, number>();
    input.variants.forEach((variant, index) => {
      const key = (field: string) => `variants.${index}.${field}`;
      if (!variant || typeof variant !== "object") { errors[key("sku")] = "Variante inválida."; return; }
      if (variant.id !== undefined && !validInteger(variant.id, 1)) errors[key("sku")] = "Variante inválida.";
      if (variant.id !== undefined && input.removedVariantIds?.includes(variant.id)) errors[key("sku")] = "La variante no puede quitarse y editarse a la vez.";
      const sku = typeof variant.sku === "string" ? variant.sku.trim() : "";
      if (sku.length < 2 || sku.length > 80 || !/^[A-Za-z0-9._/-]+$/.test(sku)) errors[key("sku")] = "SKU de 2 a 80 caracteres: letras, números, punto, guion o barra.";
      else if (skus.has(sku.toUpperCase())) errors[key("sku")] = `Repite el SKU de la variante ${skus.get(sku.toUpperCase())! + 1}.`;
      else skus.set(sku.toUpperCase(), index);
      if (typeof variant.label !== "string" || variant.label.length > 120) errors[key("label")] = "La presentación admite hasta 120 caracteres.";
      if (!validInteger(variant.priceArs) || variant.priceArs > 100_000_000) errors[key("priceArs")] = "Ingresá un precio entero en pesos.";
      if (variant.compareAtPriceArs !== null && (!validInteger(variant.compareAtPriceArs) || variant.compareAtPriceArs <= variant.priceArs)) errors[key("compareAtPriceArs")] = "El precio anterior debe superar al actual.";
      if (variant.stock !== null && (!validInteger(variant.stock) || variant.stock > 1_000_000)) errors[key("stock")] = "El stock debe ser cero o un número positivo.";
    });
  }
  if (!Array.isArray(input.images) || input.images.length > 12 || input.images.some((image) => !image || !validImageUrl(image.url) || !["product", "nutrition"].includes(image.kind) || !validInteger(image.width, 1) || !validInteger(image.height, 1) || image.width > 6000 || image.height > 6000)) errors.images = "Revisá las imágenes (máximo 12).";
  else if (new Set(input.images.map((image) => image.url)).size !== input.images.length) errors.images = "Hay una imagen repetida.";
  else if (input.status === "active" && !input.images.some((image) => image.kind === "product")) errors.images = "Agregá una foto de producto antes de publicarlo.";
  return errors;
}

export function validateTaxonomyInput(input: AdminTaxonomyInput, withPosition: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!input || typeof input !== "object") return { form: "Datos inválidos." };
  if (input.id !== undefined && !validInteger(input.id, 1)) errors.form = "Registro inválido.";
  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80) errors.name = "Ingresá un nombre de 2 a 80 caracteres.";
  if (typeof input.slug !== "string" || input.slug.length > 80 || (input.slug !== "" && !slugPattern.test(input.slug))) errors.slug = "Usá minúsculas, números y guiones (ej. star-nutrition).";
  if (withPosition && (!validInteger(input.position) || Number(input.position) > 10000)) errors.position = "La posición debe ser un número entero de 0 a 10.000.";
  return errors;
}

export type AdminCatalogRow = Awaited<ReturnType<typeof getAdminCatalog>>[number];
export type AdminCatalogParams = { q?: string; estado?: string; marca?: string; categoria?: string; orden?: string; pagina?: string };
export const adminSorts = { actualizado: "Últimos actualizados", nombre: "Nombre (A-Z)", "precio-asc": "Precio: menor a mayor", "precio-desc": "Precio: mayor a menor", "stock-asc": "Stock: menor a mayor", "stock-desc": "Stock: mayor a menor" } as const;
type SortKey = keyof typeof adminSorts;

const stockRank = (stock: number | null) => stock === null ? Number.POSITIVE_INFINITY : stock;
export function queryAdminCatalog<T extends { name: string; brand: string | null; brandId: number | null; categoryId: number; category: string; slug: string; sku: string | null; status: AdminStatus; priceArs: number | null; stock: number | null; updatedAt: Date }>(rows: T[], params: AdminCatalogParams) {
  const estado = ["active", "draft", "archived"].includes(params.estado ?? "") ? params.estado as AdminStatus : "todos";
  const orden: SortKey = params.orden && params.orden in adminSorts ? params.orden as SortKey : "actualizado";
  const marca = params.marca === "sin-marca" ? "sin-marca" : validInteger(Number(params.marca), 1) ? Number(params.marca) : null;
  const categoria = validInteger(Number(params.categoria), 1) ? Number(params.categoria) : null;
  const q = (params.q ?? "").trim().slice(0, 120);
  const terms = normalizeText(q).split(/\s+/).filter(Boolean);
  const base = rows.filter((row) => (marca === null || (marca === "sin-marca" ? row.brandId === null : row.brandId === marca))
    && (categoria === null || row.categoryId === categoria)
    && (!terms.length || terms.every((term) => normalizeText(`${row.name} ${row.brand ?? ""} ${row.category} ${row.slug} ${row.sku ?? ""}`).includes(term))));
  const counts = { todos: base.length, active: 0, draft: 0, archived: 0 };
  for (const row of base) counts[row.status]++;
  const filtered = base.filter((row) => estado === "todos" || row.status === estado);
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "es");
  const compare: Record<SortKey, (a: T, b: T) => number> = {
    actualizado: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || byName(a, b), nombre: byName,
    "precio-asc": (a, b) => (a.priceArs ?? Infinity) - (b.priceArs ?? Infinity) || byName(a, b),
    "precio-desc": (a, b) => (b.priceArs ?? -1) - (a.priceArs ?? -1) || byName(a, b),
    "stock-asc": (a, b) => stockRank(a.stock) - stockRank(b.stock) || byName(a, b),
    "stock-desc": (a, b) => (b.stock ?? -1) - (a.stock ?? -1) || byName(a, b),
  };
  const sorted = [...filtered].sort(compare[orden]);
  const pages = Math.max(1, Math.ceil(sorted.length / ADMIN_PAGE_SIZE));
  const requested = Number(params.pagina);
  const page = Number.isSafeInteger(requested) && requested >= 1 ? Math.min(requested, pages) : 1;
  return { items: sorted.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE), total: sorted.length, page, pages, counts,
    params: { q, estado, orden, marca: marca === null ? "" : String(marca), categoria: categoria === null ? "" : String(categoria) } };
}

export async function getAdminCatalog() {
  const rows = await db.select({
    id: products.id, slug: products.slug, name: products.name, status: products.status, brandId: products.brandId, categoryId: products.categoryId,
    category: categories.name, brand: brands.name, sku: productVariants.sku, priceArs: productVariants.priceArs,
    stock: productVariants.stock, updatedAt: products.updatedAt,
  }).from(products).innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
    .orderBy(desc(products.updatedAt));
  const [images, variantCounts] = await Promise.all([
    db.select({ productId: productImages.productId, url: productImages.url }).from(productImages).where(eq(productImages.kind, "product")).orderBy(asc(productImages.position)),
    db.select({ productId: productVariants.productId, total: count() }).from(productVariants).groupBy(productVariants.productId),
  ]);
  const firstImage = new Map<number, string>();
  for (const image of images) if (!firstImage.has(image.productId)) firstImage.set(image.productId, image.url);
  const variants = new Map(variantCounts.map((row) => [row.productId, Number(row.total)]));
  const seen = new Set<number>();
  return rows.filter((row) => !seen.has(row.id) && seen.add(row.id))
    .map((row) => ({ ...row, imageUrl: firstImage.get(row.id) ?? null, variantCount: variants.get(row.id) ?? 0 }));
}

/** La tabla de historial llega con la migración 0007; sin ella el panel sigue funcionando. */
export async function stockHistoryAvailable(executor: { execute: (query: SQL) => PromiseLike<unknown> } = db) {
  try {
    const result = await executor.execute(sql`select to_regclass('public.product_stock_changes') is not null as "exists"`) as unknown as { rows?: { exists: boolean }[] } | { exists: boolean }[];
    const rows = Array.isArray(result) ? result : result.rows ?? [];
    return rows[0]?.exists === true;
  } catch { return false; }
}

export async function getAdminProduct(id: number) {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;
  const [variants, images, historyReady] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(desc(productVariants.isDefault), asc(productVariants.position), asc(productVariants.id)),
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position)),
    stockHistoryAvailable(),
  ]);
  const ordered = variants.length ? await db.selectDistinct({ variantId: orderItems.variantId }).from(orderItems).where(inArray(orderItems.variantId, variants.map((variant) => variant.id))) : [];
  const withOrders = new Set(ordered.map((row) => row.variantId));
  const stockHistory = historyReady ? await db.select({ id: productStockChanges.id, sku: productStockChanges.sku, previousStock: productStockChanges.previousStock, newStock: productStockChanges.newStock, changedBy: productStockChanges.changedBy, createdAt: productStockChanges.createdAt })
    .from(productStockChanges).where(eq(productStockChanges.productId, id)).orderBy(desc(productStockChanges.createdAt), desc(productStockChanges.id)).limit(20) : null;
  return { product, variants: variants.map((variant) => ({ ...variant, hasOrders: withOrders.has(variant.id) })), images, stockHistory };
}

export async function getAdminTaxonomy() {
  const [brandRows, categoryRows] = await Promise.all([
    db.select().from(brands).orderBy(asc(brands.name)),
    db.select().from(categories).orderBy(asc(categories.position), asc(categories.name)),
  ]);
  return { brands: brandRows, categories: categoryRows };
}

export async function getAdminTaxonomyWithCounts() {
  const [taxonomy, brandCounts, categoryCounts] = await Promise.all([
    getAdminTaxonomy(),
    db.select({ id: products.brandId, total: count() }).from(products).groupBy(products.brandId),
    db.select({ id: products.categoryId, total: count() }).from(products).groupBy(products.categoryId),
  ]);
  const brandTotals = new Map(brandCounts.map((row) => [row.id, Number(row.total)]));
  const categoryTotals = new Map(categoryCounts.map((row) => [row.id, Number(row.total)]));
  return {
    brands: taxonomy.brands.map((brand) => ({ ...brand, products: brandTotals.get(brand.id) ?? 0 })),
    categories: taxonomy.categories.map((category) => ({ ...category, products: categoryTotals.get(category.id) ?? 0 })),
  };
}
