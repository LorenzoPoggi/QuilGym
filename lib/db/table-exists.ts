import { sql, type SQL } from "drizzle-orm";

type Executor = { execute: (query: SQL) => PromiseLike<unknown> };

/**
 * Indica si existe una tabla creada por una migración opcional. `to_regclass` nunca falla, así que es seguro
 * dentro de una transacción. Ante cualquier error responde `false`: la función nueva se desactiva sin romper la tienda.
 */
export async function tableExists(executor: Executor, name: string) {
  if (!/^[a-z_]+$/.test(name)) return false;
  try {
    const result = await executor.execute(sql`select to_regclass(${`public.${name}`}) is not null as "exists"`) as { rows?: { exists: boolean }[] } | { exists: boolean }[];
    const rows = Array.isArray(result) ? result : result.rows ?? [];
    return rows[0]?.exists === true;
  } catch { return false; }
}
