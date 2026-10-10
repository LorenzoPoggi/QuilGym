/**
 * Actualiza SOLO `products.description` desde data/product-content.json, buscando por slug.
 * No toca nombre, precio, stock ni imágenes (a diferencia de `npm run db:seed`).
 *
 *   npm run db:sync-descriptions              → dry-run (por defecto): muestra el diff, no escribe
 *   npm run db:sync-descriptions -- --apply   → aplica (confirmá antes a qué base apunta DATABASE_URL)
 */
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import content from "../data/product-content.json";
import { products } from "../lib/db/schema";
import { describeDescriptionSync, planDescriptionSync } from "../lib/product-description-sync";

loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
if (!process.env.DATABASE_URL) { console.error("Falta DATABASE_URL."); process.exit(1); }
const target = (() => { try { const url = new URL(process.env.DATABASE_URL!); return `${url.hostname.split(".")[0]}…/${url.pathname.slice(1)}`; } catch { return "(URL ilegible)"; } })();
const db = drizzle(neon(process.env.DATABASE_URL));

async function main() {
  console.log(`Base: ${target} · modo ${apply ? "APPLY (escribe)" : "dry-run (solo lectura)"}\n`);
  const rows = await db.select({ slug: products.slug, description: products.description }).from(products);
  const plan = planDescriptionSync(new Map(rows.map((row) => [row.slug, row.description])), content.products as Record<string, string>);
  console.log(describeDescriptionSync(plan));
  if (!apply) { console.log("\nDry-run: no se escribió nada. Para aplicar: npm run db:sync-descriptions -- --apply"); return; }
  const texts = content.products as Record<string, string>;
  for (const change of plan.changes) {
    await db.update(products).set({ description: texts[change.slug], updatedAt: new Date() }).where(eq(products.slug, change.slug));
    console.log(`✓ ${change.slug}`);
  }
  console.log("\nListo. Las fichas se actualizan cuando revalida la caché del catálogo (hasta 5 minutos).");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
