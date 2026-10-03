/**
 * Carga el catálogo inicial en la base a partir de data/tiendanube-catalog.json,
 * con descripciones (data/product-content.json) e imágenes (data/product-images.json,
 * generado por scripts/build-product-images.mjs).
 * Es idempotente: actualiza por slug y se puede correr varias veces.
 *
 *   npm run db:seed
 */
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { eq, notInArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import catalog from "../data/tiendanube-catalog.json";
import content from "../data/product-content.json";
import images from "../data/product-images.json";
import { brands, categories, productImages, products, productVariants } from "../lib/db/schema";
import { slugify } from "../lib/slugify";

loadEnvConfig(process.cwd());
const db = drizzle(neon(process.env.DATABASE_URL!));

const categoryOrder = ["Proteínas", "Creatinas", "Pre-entrenos", "Aminoácidos", "Ganadores de peso", "Vitaminas y minerales", "Colágeno", "Snacks", "Combos", "Accesorios", "Otros"];

// Selección inicial para la home; se reemplaza cuando haya datos de ventas.
const featured = new Set(["proteina-star-2lb", "creatina-star-300gr-clasica", "creatina-gold-300-gr", "mutant-mass-1-5-kg"]);

async function main() {
  const source = catalog.products;

  const categoryRows = await db.insert(categories)
    .values([...new Set(source.map((p) => p.category))].map((name) => ({ name, slug: slugify(name), position: categoryOrder.indexOf(name) })))
    .onConflictDoUpdate({ target: categories.slug, set: { name: sql`excluded.name`, position: sql`excluded.position` } })
    .returning();

  const brandRows = await db.insert(brands)
    .values([...new Set(source.flatMap((p) => p.brand ? [p.brand] : []))].map((name) => ({ name, slug: slugify(name) })))
    .onConflictDoUpdate({ target: brands.slug, set: { name: sql`excluded.name` } })
    .returning();

  const categoryId = new Map(categoryRows.map((row) => [row.name, row.id]));
  const brandId = new Map(brandRows.map((row) => [row.name, row.id]));

  const descriptions: Record<string, string> = content.products;
  const gallery = images as Record<string, { path: string; kind: "product" | "nutrition"; width: number; height: number }[]>;
  let imageCount = 0;

  for (const item of source) {
    const slug = slugify(item.name);
    const [product] = await db.insert(products)
      .values({ slug, name: item.name, description: descriptions[slug] ?? null, categoryId: categoryId.get(item.category)!, brandId: item.brand ? brandId.get(item.brand)! : null, status: "active", isFeatured: featured.has(slug) })
      .onConflictDoUpdate({ target: products.slug, set: { name: sql`excluded.name`, description: sql`excluded.description`, categoryId: sql`excluded.category_id`, brandId: sql`excluded.brand_id`, isFeatured: sql`excluded.is_featured` } })
      .returning();

    await db.delete(productImages).where(eq(productImages.productId, product.id));
    const rows = (gallery[slug] ?? []).map((image, position) => ({ productId: product.id, url: image.path, kind: image.kind, width: image.width, height: image.height, position }));
    if (rows.length) await db.insert(productImages).values(rows);
    imageCount += rows.length;

    await db.insert(productVariants)
      .values({ productId: product.id, sku: `QG-${String(product.id).padStart(4, "0")}`, priceArs: item.priceArs, stock: item.inStock ? null : 0, isDefault: true })
      .onConflictDoUpdate({ target: productVariants.sku, set: { priceArs: sql`excluded.price_ars`, stock: sql`excluded.stock` } });
  }

  // Marcas que quedaron sin productos (p. ej. tras corregir una marca mal cargada).
  await db.delete(brands).where(notInArray(brands.id, db.select({ id: products.brandId }).from(products).where(sql`${products.brandId} is not null`)));

  console.log(`Catálogo cargado: ${source.length} productos, ${brandRows.length} marcas, ${categoryRows.length} categorías, ${imageCount} imágenes.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
