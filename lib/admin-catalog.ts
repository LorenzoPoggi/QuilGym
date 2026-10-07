import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { brands, categories, productImages, products, productVariants } from "./db/schema";

export async function getAdminCatalog() {
  const rows = await db.select({
    id: products.id, slug: products.slug, name: products.name, status: products.status,
    category: categories.name, brand: brands.name, priceArs: productVariants.priceArs,
    stock: productVariants.stock, updatedAt: products.updatedAt,
  }).from(products).innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isDefault, true)))
    .orderBy(desc(products.updatedAt));
  const images = await db.select({ productId: productImages.productId, url: productImages.url })
    .from(productImages).where(eq(productImages.kind, "product"))
    .orderBy(asc(productImages.position));
  const firstImage = new Map<number, string>();
  for (const image of images) if (!firstImage.has(image.productId)) firstImage.set(image.productId, image.url);
  const seen = new Set<number>();
  return rows.filter((row) => !seen.has(row.id) && seen.add(row.id))
    .map((row) => ({ ...row, imageUrl: firstImage.get(row.id) ?? null }));
}

export async function getAdminProduct(id: number) {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;
  const [variants, images] = await Promise.all([
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.position)),
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position)),
  ]);
  return { product, variants, images };
}

export async function getAdminTaxonomy() {
  const [brandRows, categoryRows] = await Promise.all([
    db.select().from(brands).orderBy(asc(brands.name)),
    db.select().from(categories).orderBy(asc(categories.position), asc(categories.name)),
  ]);
  return { brands: brandRows, categories: categoryRows };
}
