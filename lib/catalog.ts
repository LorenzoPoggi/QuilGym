import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { brands, categories, productImages, products, productVariants } from "./db/schema";
import { priceRanges, type CatalogQuery, type CatalogResult, type CatalogSort, type Facet, type ProductDetail, type ProductSummary } from "./catalog-types";
import { normalizeText } from "./slugify";
import { MAX_QUANTITY_PER_LINE } from "./cart-types";
import { maxQuantityFor } from "./pricing";
import { comboParts } from "./combo-contents";

export const CATALOG_TAG = "catalog";
export const PAGE_SIZE = 12;

const isAvailable = (stock: number | null) => stock === null || stock > 0;

/** Primera foto de producto (no rótulo) de cada id. */
export async function getPrimaryImages(productIds: number[]) {
  if (productIds.length === 0) return new Map<number, string>();
  const slugs = await db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.id, productIds));
  const rows = await db
    .select({ productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .where(and(inArray(productImages.productId, productIds), eq(productImages.kind, "product")))
    .orderBy(asc(productImages.productId), asc(productImages.position));
  const primary = new Map<number, string>();
  for (const row of rows) if (!primary.has(row.productId)) primary.set(row.productId, row.url);
  for (const product of slugs) {
    const comboPhoto = comboParts(product.slug)?.[0]?.photoUrl;
    if (comboPhoto) primary.set(product.id, comboPhoto);
  }
  return primary;
}

/** Hasta `limit` fotos de producto (no rótulos) de cada id, en orden. */
export async function getProductPhotos(productIds: number[], limit = 4) {
  const photos = new Map<number, string[]>();
  if (productIds.length === 0) return photos;
  const rows = await db
    .select({ productId: productImages.productId, url: productImages.url })
    .from(productImages)
    .where(and(inArray(productImages.productId, productIds), eq(productImages.kind, "product")))
    .orderBy(asc(productImages.productId), asc(productImages.position));
  for (const row of rows) {
    const list = photos.get(row.productId) ?? [];
    if (list.length < limit) photos.set(row.productId, [...list, row.url]);
  }
  return photos;
}

type CatalogRow = ProductSummary & { isFeatured: boolean; categoryPosition: number };

/**
 * Todos los productos activos con su variante por defecto. El catálogo es
 * chico, así que filtros, facetas y paginación se resuelven en el servidor
 * sobre este resultado cacheado. Si supera algunos miles de productos, pasar
 * los filtros a SQL o a un motor de búsqueda.
 */
const getActiveProducts = unstable_cache(async (): Promise<CatalogRow[]> => {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      isFeatured: products.isFeatured,
      variantId: productVariants.id,
      brandSlug: brands.slug,
      brandName: brands.name,
      categorySlug: categories.slug,
      categoryName: categories.name,
      categoryPosition: categories.position,
      priceArs: productVariants.priceArs,
      compareAtPriceArs: productVariants.compareAtPriceArs,
      stock: productVariants.stock,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(eq(products.status, "active"))
    .orderBy(asc(categories.position), asc(products.name));

  const photos = await getProductPhotos(rows.map((row) => row.id));

  return rows.map((row) => {
    const comboPhotos = comboParts(row.slug)?.map((part) => part.photoUrl);
    const photoUrls = comboPhotos?.length ? comboPhotos : photos.get(row.id) ?? [];
    return {
      id: row.id,
      variantId: row.variantId,
      slug: row.slug,
      name: row.name,
      brand: row.brandSlug && row.brandName ? { slug: row.brandSlug, name: row.brandName } : null,
      category: { slug: row.categorySlug, name: row.categoryName },
      priceArs: row.priceArs,
      compareAtPriceArs: row.compareAtPriceArs,
      inStock: isAvailable(row.stock),
      imageUrl: photoUrls[0] ?? null,
      photoUrls,
      isFeatured: row.isFeatured,
      categoryPosition: row.categoryPosition,
    };
  });
}, ["catalog:active-products:v3"], { tags: [CATALOG_TAG], revalidate: 300 });

function toSummary(row: CatalogRow): ProductSummary {
  const { id, variantId, slug, name, brand, category, priceArs, compareAtPriceArs, inStock, imageUrl, photoUrls } = row;
  return { id, variantId, slug, name, brand, category, priceArs, compareAtPriceArs, inStock, imageUrl, photoUrls };
}

function matchesQuery(product: ProductSummary, q: string) {
  const haystack = normalizeText(`${product.name} ${product.brand?.name ?? ""} ${product.category.name}`);
  return normalizeText(q).split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

function compare(sort: CatalogSort) {
  return (a: CatalogRow, b: CatalogRow) => {
    if (sort === "menor-precio") return a.priceArs - b.priceArs;
    if (sort === "mayor-precio") return b.priceArs - a.priceArs;
    if (sort === "nombre") return a.name.localeCompare(b.name, "es");
    return Number(b.inStock) - Number(a.inStock) || Number(b.isFeatured) - Number(a.isFeatured) || a.categoryPosition - b.categoryPosition || a.name.localeCompare(b.name, "es");
  };
}

function countBy(items: CatalogRow[], key: (item: CatalogRow) => { slug: string; name: string } | null): Facet[] {
  const counts = new Map<string, Facet>();
  for (const item of items) {
    const ref = key(item);
    if (!ref) continue;
    const facet = counts.get(ref.slug) ?? { ...ref, count: 0 };
    facet.count++;
    counts.set(ref.slug, facet);
  }
  return [...counts.values()];
}

export async function queryCatalog(query: CatalogQuery): Promise<CatalogResult> {
  const all = await getActiveProducts();
  const range = priceRanges.find((item) => item.slug === query.price);

  const base = all.filter((product) =>
    (!query.q || matchesQuery(product, query.q)) &&
    (!query.inStockOnly || product.inStock) &&
    (!range || ((range.min === undefined || product.priceArs >= range.min) && (range.max === undefined || product.priceArs < range.max))));

  const inCategory = query.category ? base.filter((product) => product.category.slug === query.category) : base;
  const filtered = query.brands.length ? inCategory.filter((product) => product.brand && query.brands.includes(product.brand.slug)) : inCategory;
  const sorted = [...filtered].sort(compare(query.sort));

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pageCount);

  // Las categorías se cuentan sin el filtro de categoría para poder cambiar de pestaña.
  const categoryFacets = countBy(base, (product) => product.category);
  const order = new Map(all.map((product) => [product.category.slug, product.categoryPosition]));
  categoryFacets.sort((a, b) => order.get(a.slug)! - order.get(b.slug)!);

  return {
    products: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toSummary),
    total: sorted.length,
    page,
    pageCount,
    categories: categoryFacets,
    brands: countBy(inCategory, (product) => product.brand).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es")),
  };
}

export async function getAllProducts() {
  return (await getActiveProducts()).map(toSummary);
}

/** Productos en el mismo orden de relevancia que usa el catálogo, para búsqueda predictiva. */
export async function getSearchProducts() {
  return (await getActiveProducts()).sort(compare("relevancia")).map(toSummary);
}

export async function getFeaturedProducts(limit = 4) {
  const products = await getActiveProducts();
  const featured = products.filter((product) => product.isFeatured);
  const remaining = products.filter((product) => !product.isFeatured).sort(compare("relevancia"));
  return [...featured, ...remaining].slice(0, limit).map(toSummary);
}

export async function getProductsByCategory(categorySlug: string, limit: number, excludeSlug?: string) {
  return (await getActiveProducts())
    .filter((product) => product.category.slug === categorySlug && product.slug !== excludeSlug)
    .sort(compare("relevancia"))
    .slice(0, limit)
    .map(toSummary);
}

export async function getBrands() {
  return countBy(await getActiveProducts(), (product) => product.brand).sort((a, b) => b.count - a.count);
}

export async function getCategories() {
  return (await queryCatalog({ brands: [], inStockOnly: false, sort: "relevancia", page: 1 })).categories;
}

export const getProduct = unstable_cache(async (slug: string): Promise<ProductDetail | null> => {
  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.status, "active")),
    with: { brand: true, category: true, variants: { orderBy: [asc(productVariants.position), asc(productVariants.id)] }, images: { orderBy: [asc(productImages.position)] } },
  });
  if (!product || product.variants.length === 0) return null;

  const main = product.variants.find((variant) => variant.isDefault) ?? product.variants[0];
  const photoUrls = product.images.filter((image) => image.kind === "product").slice(0, 4).map((image) => image.url);
  return {
    id: product.id,
    variantId: main.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    brand: product.brand ? { slug: product.brand.slug, name: product.brand.name } : null,
    category: { slug: product.category.slug, name: product.category.name },
    priceArs: main.priceArs,
    compareAtPriceArs: main.compareAtPriceArs,
    inStock: product.variants.some((variant) => isAvailable(variant.stock)),
    imageUrl: photoUrls[0] ?? null,
    photoUrls,
    images: product.images.map(({ url, kind, width, height }) => ({ url, kind, width, height })),
    variants: product.variants.map((variant) => ({ id: variant.id, sku: variant.sku, label: variant.label, priceArs: variant.priceArs, inStock: isAvailable(variant.stock), maxQuantity: maxQuantityFor(variant.stock, MAX_QUANTITY_PER_LINE) })),
  };
}, ["catalog:product:v2"], { tags: [CATALOG_TAG], revalidate: 300 });
