"use server";

import { inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "./admin-auth";
import { db } from "./db";
import { productCosts, productVariants } from "./db/schema";
import { tableExists } from "./db/table-exists";

export type CostInput = { variantId: number; costArs: number | null };
export type CostActionResult = { ok: true; saved: number } | { ok: false; error: string; invalid?: number[] };

/** Guarda costos unitarios (null = borrar el costo). Solo para el administrador. */
export async function saveVariantCosts(input: CostInput[]): Promise<CostActionResult> {
  if (!await getAdminUser()) return { ok: false, error: "No tenés permisos de administrador." };
  if (!Array.isArray(input) || !input.length) return { ok: false, error: "No hay cambios para guardar." };
  if (input.length > 2000) return { ok: false, error: "Demasiados cambios a la vez." };
  const invalid = input.filter((row) => !Number.isSafeInteger(row.variantId) || row.variantId < 1 || (row.costArs !== null && (!Number.isSafeInteger(row.costArs) || row.costArs < 0 || row.costArs > 100_000_000))).map((row) => row.variantId);
  if (invalid.length) return { ok: false, error: "Revisá los costos marcados: tienen que ser montos enteros en pesos.", invalid };
  if (!await tableExists(db, "product_costs")) return { ok: false, error: "Todavía no está activada la carga de costos (falta aplicar la migración 0009). Avisale a los programadores." };
  try {
    const ids = input.map((row) => row.variantId);
    const existing = new Set((await db.select({ id: productVariants.id }).from(productVariants).where(inArray(productVariants.id, ids))).map((row) => row.id));
    const toSave = input.filter((row) => existing.has(row.variantId) && row.costArs !== null) as { variantId: number; costArs: number }[];
    const toDelete = input.filter((row) => existing.has(row.variantId) && row.costArs === null).map((row) => row.variantId);
    if (toSave.length) await db.insert(productCosts).values(toSave)
      .onConflictDoUpdate({ target: productCosts.variantId, set: { costArs: sql`excluded.cost_ars`, updatedAt: new Date() } });
    if (toDelete.length) await db.delete(productCosts).where(inArray(productCosts.variantId, toDelete));
    revalidatePath("/admin/metricas"); revalidatePath("/admin/metricas/costos");
    return { ok: true, saved: toSave.length + toDelete.length };
  } catch {
    return { ok: false, error: "No pudimos guardar los costos. Intentá nuevamente." };
  }
}
