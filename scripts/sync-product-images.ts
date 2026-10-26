/**
 * Sincroniza SOLO las imágenes de productos (`product_images`) con data/product-images.json.
 * No toca nombre, precio, stock ni descripción (a diferencia de `npm run db:seed`).
 * En combos quita sus imágenes: las vistas usan ComboVisual con las fotos de los productos incluidos.
 *
 *   npm run db:sync-images              → dry-run (por defecto): muestra el diff, no escribe nada
 *   npm run db:sync-images -- --apply   → aplica. Antes: desplegar los assets nuevos de public/assets/products
 *                                         en el entorno que usa esa base y confirmar a qué base apunta DATABASE_URL.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import images from "../data/product-images.json";
import { assertDatabaseWriteAllowed } from "../lib/db/preview-safety";
import { productImages, productVariants, products, variantImages } from "../lib/db/schema";
import variantManifestData from "../data/variant-images.json";
import { tableExists } from "../lib/db/table-exists";
import { flavorKey } from "../lib/flavors";
import { describeImageSync, planImageSync, type ManifestImage, type StoredImage } from "../lib/product-image-sync";

loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
if (!process.env.DATABASE_URL) { console.error("Falta DATABASE_URL."); process.exit(1); }
if (apply) assertDatabaseWriteAllowed(process.env.DATABASE_URL, process.env);
const target = (() => { try { const url = new URL(process.env.DATABASE_URL!); return `${url.hostname.split(".")[0]}…/${url.pathname.slice(1)}`; } catch { return "(URL ilegible)"; } })();
const db = drizzle(neon(process.env.DATABASE_URL));
const manifest = images as Record<string, ManifestImage[]>;
const variantManifest = variantManifestData as Record<string, ManifestImage[]>;

async function main() {
  console.log(`Base: ${target} · modo ${apply ? "APPLY (escribe)" : "dry-run (solo lectura)"}\n`);
  const missingFiles = Object.values(manifest).flat().filter((image) => !existsSync(path.join(process.cwd(), "public", image.path)));
  if (missingFiles.length) {
    console.error(`✗ ${missingFiles.length} archivo(s) del manifiesto no existen en public/: ${missingFiles.slice(0, 5).map((image) => image.path).join(", ")}…`);
    process.exit(1);
  }
  const rows = await db.select({ slug: products.slug, id: products.id, url: productImages.url, kind: productImages.kind, width: productImages.width, height: productImages.height, position: productImages.position })
    .from(products).leftJoin(productImages, eq(productImages.productId, products.id)).orderBy(asc(products.slug), asc(productImages.position));
  const ids = new Map<string, number>();
  const stored = new Map<string, StoredImage[]>();
  for (const row of rows) {
    ids.set(row.slug, row.id);
    const list = stored.get(row.slug) ?? [];
    if (row.url && row.kind) list.push({ url: row.url, kind: row.kind, width: row.width!, height: row.height!, position: row.position! });
    stored.set(row.slug, list);
  }
  const plan = planImageSync(stored, manifest);
  console.log(describeImageSync(plan));

  // Fotos por sabor (tabla variant_images, migración 0012): solo se comparan los sabores con galería en data/variant-images.json.
  const variantIds = new Map<string, number>();
  const variantStored = new Map<string, StoredImage[]>();
  const wantsVariants = Object.keys(variantManifest).length > 0;
  const variantsReady = wantsVariants && await tableExists(db, "variant_images");
  if (wantsVariants && !variantsReady) console.log("\nFotos por sabor: falta aplicar la migración 0012 (tabla variant_images); se omiten.");
  if (variantsReady) {
    const variantRows = await db.select({ slug: products.slug, variantId: productVariants.id, label: productVariants.label, url: variantImages.url, kind: variantImages.kind, width: variantImages.width, height: variantImages.height, position: variantImages.position })
      .from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).leftJoin(variantImages, eq(variantImages.variantId, productVariants.id))
      .orderBy(asc(products.slug), asc(productVariants.id), asc(variantImages.position));
    for (const row of variantRows) {
      if (!row.label) continue;
      const key = `${row.slug}#${flavorKey(row.label)}`;
      variantIds.set(key, row.variantId);
      const list = variantStored.get(key) ?? [];
      if (row.url && row.kind) list.push({ url: row.url, kind: row.kind, width: row.width!, height: row.height!, position: row.position! });
      variantStored.set(key, list);
    }
  }
  const variantPlan = variantsReady ? planImageSync(new Map([...variantStored].filter(([key]) => variantManifest[key])), variantManifest) : null;
  if (variantPlan) {
    console.log("\n— Fotos por sabor —");
    console.log(describeImageSync(variantPlan));
  }
  if (!apply) { console.log("\nDry-run: no se escribió nada. Para aplicar: npm run db:sync-images -- --apply"); return; }

  for (const change of plan.changes) {
    const productId = ids.get(change.slug)!;
    const values = change.after.map((image, position) => ({ productId, url: image.path, kind: image.kind, width: image.width, height: image.height, position }));
    // batch = una transacción por producto en el driver HTTP de Neon: nunca queda a medias.
    await db.batch([
      db.delete(productImages).where(eq(productImages.productId, productId)),
      ...(values.length ? [db.insert(productImages).values(values)] : []),
    ]);
    console.log(`✓ ${change.slug}`);
  }
  for (const change of variantPlan?.changes ?? []) {
    const variantId = variantIds.get(change.slug)!;
    const values = change.after.map((image, position) => ({ variantId, url: image.path, kind: image.kind, width: image.width, height: image.height, position }));
    await db.batch([
      db.delete(variantImages).where(eq(variantImages.variantId, variantId)),
      ...(values.length ? [db.insert(variantImages).values(values)] : []),
    ]);
    console.log(`✓ ${change.slug}`);
  }
  console.log("\nListo. El catálogo cacheado se actualiza en hasta 5 minutos. Las carpetas public/assets/products/combo-* se pueden borrar cuando todas las bases estén sincronizadas.");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
