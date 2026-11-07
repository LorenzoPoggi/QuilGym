/**
 * Une los productos duplicados por sabor en una sola ficha con variantes (data/product-variants.json).
 * Las variantes existentes se mueven al producto destino (conservan carritos, pedidos y costos) y los
 * sabores que el negocio nunca vendió se crean con stock 0. Los productos viejos se archivan.
 *
 *   npm run db:merge-flavors              → dry-run: ejecuta todo dentro de una transacción y la revierte
 *   npm run db:merge-flavors -- --apply   → aplica (una transacción por grupo)
 *
 * Antes: confirmar a qué base apunta DATABASE_URL. Fuera de quilgym_preview exige CONFIRM_DATABASE_WRITE=<base>.
 */
import { loadEnvConfig } from "@next/env";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import data from "../data/product-variants.json";
import { assertDatabaseWriteAllowed, databaseNameFromUrl } from "../lib/db/preview-safety";
import * as schema from "../lib/db/schema";
import { applyFlavorGroup, validateFlavorData, type FlavorData } from "../lib/flavor-merge";

loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const url = process.env.DATABASE_URL;
if (!url) { console.error("Falta DATABASE_URL."); process.exit(1); }
// El dry-run también abre una transacción de escritura (se revierte), así que exige la misma confirmación.
assertDatabaseWriteAllowed(url, process.env);
class Rollback extends Error {}

async function main() {
  const flavorData = data as FlavorData;
  const problems = validateFlavorData(flavorData);
  if (problems.length) { console.error(`✗ data/product-variants.json inválido:\n  ${problems.join("\n  ")}`); process.exit(1); }
  console.log(`Base: ${databaseNameFromUrl(url!)} · modo ${apply ? "APPLY (escribe)" : "dry-run (se revierte)"}\n`);
  const pool = new Pool({ connectionString: url });
  const database = drizzle(pool, { schema });
  try {
    for (const group of flavorData.groups) {
      try {
        await database.transaction(async (tx) => {
          const result = await applyFlavorGroup(tx, group);
          console.log(`${apply ? "✓" : "~"} ${group.slug}: movidos ${result.moved.join(", ") || "—"} · creados ${result.created.join(", ") || "—"} · renombrados ${result.relabeled.join(", ") || "—"} · ya existían ${result.skipped.join(", ") || "—"} · archivados ${result.archived.join(", ") || "—"}`);
          if (!apply) throw new Rollback();
        });
      } catch (error) {
        if (error instanceof Rollback) continue;
        console.error(`✗ ${group.slug}: ${error instanceof Error ? error.message : error}`);
        process.exitCode = 1;
      }
    }
  } finally { await pool.end(); }
  console.log(apply ? "\nListo. Los slugs viejos redirigen a la ficha nueva (next.config.ts)." : "\nDry-run: no se escribió nada. Para aplicar: npm run db:merge-flavors -- --apply");
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
