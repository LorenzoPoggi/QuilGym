/**
 * Actualiza SOLO `products.name` desde data/tiendanube-catalog.json, buscando por `siteSlug`.
 * No toca precio, stock, descripción, imágenes ni slugs (a diferencia de `npm run db:seed`).
 *
 *   npm run db:sync-names -- --dry-run   → muestra los cambios sin aplicarlos
 *   npm run db:sync-names                → aplica
 */
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import catalog from "../data/tiendanube-catalog.json";
import { products } from "../lib/db/schema";

loadEnvConfig(process.cwd());
const db = drizzle(neon(process.env.DATABASE_URL!));
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const current = new Map((await db.select({ slug: products.slug, name: products.name }).from(products)).map((row) => [row.slug, row.name]));
  const changes = catalog.products.filter((item) => current.has(item.siteSlug) && current.get(item.siteSlug) !== item.name);
  const missing = catalog.products.filter((item) => !current.has(item.siteSlug));

  for (const item of changes) console.log(`  ${item.siteSlug}\n    ${current.get(item.siteSlug)}  →  ${item.name}`);
  if (missing.length) console.log(`\nSin producto en la base (no se crean acá): ${missing.map((item) => item.siteSlug).join(", ")}`);
  console.log(`\n${changes.length} nombre(s) a actualizar${dryRun ? " (dry run: no se aplicó nada)" : ""}.`);
  if (dryRun) return;

  for (const item of changes) await db.update(products).set({ name: item.name, updatedAt: new Date() }).where(eq(products.slug, item.siteSlug));
  console.log("Listo. El catálogo cacheado se actualiza en hasta 5 minutos.");
}

main().catch((error) => { console.error(error); process.exit(1); });
