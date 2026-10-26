import { loadEnvConfig } from "@next/env";
import { assertDatabaseWriteAllowed } from "../lib/db/preview-safety";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

try {
  const database = assertDatabaseWriteAllowed(url, process.env);
  console.log(`Base autorizada para escritura: ${database}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo validar la base de destino.");
  process.exit(1);
}
