import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import { assertPreviewDatabase } from "./preview-safety";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida.");
  assertPreviewDatabase(url, process.env);
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 10000 });
  return { pool, database: drizzle(pool, { schema }) };
}
export type OrderTransaction = Parameters<Parameters<ReturnType<typeof connect>["database"]["transaction"]>[0]>[0];

/** HTTP no permite transacciones interactivas. El Pool WebSocket vive solo durante esta operación. */
export async function withOrderTransaction<T>(run: (tx: OrderTransaction) => Promise<T>): Promise<T> {
  const { pool, database } = connect();
  try { return await database.transaction(run); }
  finally { await pool.end(); }
}
