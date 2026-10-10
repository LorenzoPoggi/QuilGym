import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { assertPreviewDatabase } from "./preview-safety";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida. Copiá .env.example a .env.local y completala.");
assertPreviewDatabase(url, process.env);

export const db = drizzle(neon(url), { schema });
