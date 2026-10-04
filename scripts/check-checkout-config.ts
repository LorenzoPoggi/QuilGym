/**
 * Diagnóstico de la configuración del checkout: qué medios quedan habilitados y qué falta.
 *   npm run checkout:check            → lee .env.local (si existe) y el entorno
 *   npm run checkout:check -- --strict → sale con código 1 si hay errores (para CI o antes de un deploy)
 * Nunca imprime valores secretos.
 */
import { existsSync } from "node:fs";
import { parseCheckoutEnv } from "../lib/checkout-env";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const strict = process.argv.includes("--strict");

// Se evalúa como producción: el simulador de `npm run dev` no cuenta como configuración real.
const report = parseCheckoutEnv({ ...process.env, NODE_ENV: "production" });
const { config } = report;
const present = (key: string) => (process.env[key]?.trim() ? "✓" : "·");
const status = (enabled: boolean) => (enabled ? "HABILITADO   " : "deshabilitado");

console.log("\nQuilGym · configuración del checkout\n");
const rows: [string, boolean, string][] = [
  ["Retiro en el local", Boolean(config.pickup), `PICKUP_ADDRESS ${present("PICKUP_ADDRESS")}  PICKUP_HOURS ${present("PICKUP_HOURS")}`],
  ["Envío a domicilio", config.shippingRates.length > 0, `SHIPPING_RATES_JSON ${present("SHIPPING_RATES_JSON")}  (${config.shippingRates.length} tarifa/s válida/s)`],
  ["Mercado Pago", config.payments.mercadopago, `MP_ACCESS_TOKEN ${present("MP_ACCESS_TOKEN")}  NEXT_PUBLIC_MP_PUBLIC_KEY ${present("NEXT_PUBLIC_MP_PUBLIC_KEY")}  MP_WEBHOOK_SECRET ${present("MP_WEBHOOK_SECRET")}  NEXT_PUBLIC_SITE_URL ${present("NEXT_PUBLIC_SITE_URL")}`],
  ["Transferencia", config.payments.transfer, `TRANSFER_ACCOUNT ${present("TRANSFER_ACCOUNT")}  TRANSFER_HOLDER ${present("TRANSFER_HOLDER")}  TRANSFER_TAX_ID ${present("TRANSFER_TAX_ID")}`],
  ["Efectivo al retirar", config.payments.cash, `CASH_PICKUP_ENABLED ${present("CASH_PICKUP_ENABLED")} (requiere retiro)`],
  ["Emails (Resend)", report.emailsEnabled, `RESEND_API_KEY ${present("RESEND_API_KEY")}  EMAIL_FROM ${present("EMAIL_FROM")}`],
  ["Crons", report.cronEnabled, `CRON_SECRET ${present("CRON_SECRET")}`],
  ["Link firmado al pedido", report.orderAccessEnabled, `ORDER_ACCESS_SECRET ${present("ORDER_ACCESS_SECRET")}`],
];
for (const [label, enabled, detail] of rows) console.log(`  ${status(enabled)}  ${label.padEnd(24)} ${detail}`);
console.log(`\n  Vencimiento de pedidos pendientes: ${report.pendingOrderTtlHours} h`);
if (config.shippingRates.length) {
  console.log("\n  Tarifas de envío:");
  for (const rate of config.shippingRates) console.log(`    · ${rate.label} — $${rate.priceArs.toLocaleString("es-AR")} — CP ${rate.postalCodes.join(", ")} — ${rate.estimate}`);
}
if (!config.payments.mercadopago && !config.payments.transfer && !config.payments.cash) {
  console.log("\n  Sin medios de pago habilitados: el checkout real no puede confirmar pedidos.");
}
if (report.issues.length) {
  console.log("\nErrores (configuración presente pero inválida):");
  for (const issue of report.issues) console.log(`  ✗ ${issue}`);
}
if (report.warnings.length) {
  console.log("\nPendientes:");
  for (const warning of report.warnings) console.log(`  · ${warning}`);
}
console.log("\nRecordá: las variables NEXT_PUBLIC_* se fijan en el build; en Vercel hay que redeployar al cambiarlas.");
console.log("En `npm run dev` el simulador está activo salvo que CHECKOUT_DEMO_MODE=false.\n");
if (strict && report.issues.length) process.exit(1);
