/**
 * Carga el catálogo inicial en la base a partir de data/tiendanube-catalog.json.
 * Es idempotente: actualiza por slug y se puede correr varias veces.
 *
 *   npm run db:seed
 */
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import catalog from "../data/tiendanube-catalog.json";
import { brands, categories, products, productVariants } from "../lib/db/schema";
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

  for (const item of source) {
    const slug = slugify(item.name);
    const [product] = await db.insert(products)
      .values({ slug, name: item.name, categoryId: categoryId.get(item.category)!, brandId: item.brand ? brandId.get(item.brand)! : null, status: "active", isFeatured: featured.has(slug) })
      .onConflictDoUpdate({ target: products.slug, set: { name: sql`excluded.name`, categoryId: sql`excluded.category_id`, brandId: sql`excluded.brand_id`, isFeatured: sql`excluded.is_featured` } })
      .returning();

    await db.insert(productVariants)
      .values({ productId: product.id, sku: `QG-${String(product.id).padStart(4, "0")}`, priceArs: item.priceArs, stock: item.inStock ? null : 0, isDefault: true })
      .onConflictDoUpdate({ target: productVariants.sku, set: { priceArs: sql`excluded.price_ars`, stock: sql`excluded.stock` } });
  }

  console.log(`Catálogo cargado: ${source.length} productos, ${brandRows.length} marcas, ${categoryRows.length} categorías.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
