/**
 * Diagnóstico local y de solo lectura para la operación de QuilGym.
 *
 *   npm run operations:check
 *   npm run operations:check -- --env=.env.preview.local
 *   npm run operations:check -- --strict
 *
 * No abre conexiones, no consulta Neon y nunca imprime valores secretos. El estado
 * en vivo de Vercel, Resend, Mercado Pago y Neon se comprueba con el runbook.
 */
import { existsSync, readFileSync } from "node:fs";

type CronDefinition = { path?: unknown; schedule?: unknown };

const envArgument = process.argv.find((argument) => argument.startsWith("--env="));
const envFile = envArgument?.slice("--env=".length) || ".env.local";
const strict = process.argv.includes("--strict");

if (existsSync(envFile)) process.loadEnvFile(envFile);

const requiredSecrets = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "CRON_SECRET",
  "ORDER_ACCESS_SECRET",
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET",
  "RESEND_API_KEY",
] as const;
const requiredConfig = [
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_MP_PUBLIC_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
] as const;
const expectedCrons = new Map([
  ["/api/internal/order-emails", "reintento de emails"],
  ["/api/internal/expire-orders", "vencimiento de pedidos"],
  ["/api/internal/expire-carts", "limpieza de carritos y límites"],
  ["/api/internal/sync-shipments", "sincronización de envíos"],
]);

const present = (key: string) => Boolean(process.env[key]?.trim());
const errors: string[] = [];
const warnings: string[] = [];

function databaseName() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(new URL(raw).pathname.replace(/^\//, "")) || null;
  } catch {
    errors.push("DATABASE_URL no es una URL válida.");
    return null;
  }
}

let crons: CronDefinition[] = [];
try {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: unknown };
  if (!Array.isArray(config.crons)) errors.push("vercel.json no contiene una lista de crons.");
  else crons = config.crons as CronDefinition[];
} catch {
  errors.push("No se pudo leer vercel.json.");
}

const configuredPaths = new Set<string>();
for (const cron of crons) {
  if (typeof cron.path !== "string" || typeof cron.schedule !== "string") {
    errors.push("Hay un cron sin path o schedule válido.");
    continue;
  }
  configuredPaths.add(cron.path);
  // En Hobby cada tarea puede ejecutarse como máximo una vez al día. Las cuatro
  // expresiones actuales deben mantener minuto y hora fijos y comodines diarios.
  if (!/^\d{1,2} \d{1,2} \* \* \*$/.test(cron.schedule)) {
    warnings.push(`${cron.path} no tiene una frecuencia diaria compatible con el esquema operativo actual.`);
  }
}
for (const path of expectedCrons.keys()) if (!configuredPaths.has(path)) errors.push(`Falta el cron ${path}.`);

for (const key of requiredSecrets) if (!present(key)) warnings.push(`Falta ${key}.`);
for (const key of requiredConfig) if (!present(key)) warnings.push(`Falta ${key}.`);

const db = databaseName();
const environmentLabel = db === "quilgym_preview" ? "Preview aislado" : db === "neondb" ? "Production" : db ? "base no reconocida" : "sin base";

console.log("\nQuilGym · preparación operativa\n");
console.log(`  Archivo de entorno  ${existsSync(envFile) ? envFile : "no encontrado (se usa process.env)"}`);
console.log(`  Base objetivo       ${db ?? "·"} (${environmentLabel})`);
console.log("  Acceso a datos      no se abrió ninguna conexión; diagnóstico estático");
console.log("\n  Variables requeridas:");
for (const key of [...requiredSecrets, ...requiredConfig]) console.log(`    ${present(key) ? "✓" : "·"} ${key}`);
console.log("\n  Crons declarados:");
for (const [path, purpose] of expectedCrons) {
  const cron = crons.find((candidate) => candidate.path === path);
  console.log(`    ${cron ? "✓" : "✗"} ${path.padEnd(38)} ${typeof cron?.schedule === "string" ? cron.schedule : "·"}  ${purpose}`);
}

if (errors.length) {
  console.log("\nErrores:");
  for (const error of errors) console.log(`  ✗ ${error}`);
}
if (warnings.length) {
  console.log("\nAdvertencias:");
  for (const warning of warnings) console.log(`  · ${warning}`);
}
console.log("\nEste comando no comprueba ejecuciones, backups ni proveedores. Seguí docs/operations-and-recovery.md para la revisión en vivo.\n");

if (errors.length || (strict && warnings.length)) process.exitCode = 1;
