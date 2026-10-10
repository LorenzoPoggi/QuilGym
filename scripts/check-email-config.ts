/**
 * Diagnóstico de los emails (Resend) sin mostrar secretos.
 *   npm run email:check                          → lee .env.local (si existe) y el entorno
 *   npm run email:check -- --strict              → sale con código 1 si hay errores
 *   npm run email:check -- --send-test=vos@x.com → envía UN email de prueba a esa dirección (lo decidís vos)
 * Con --dns consulta los registros públicos del dominio del remitente (DKIM, SPF/MX de «send» y DMARC).
 */
import { existsSync } from "node:fs";
import { resolveCname, resolveMx, resolveTxt } from "node:dns/promises";
import { randomUUID } from "node:crypto";
import { readEmailConfig, sendWithResend, isEmailAddress } from "../lib/email-config";
import { orderEmailContent } from "../lib/email-templates";
import { readSiteUrl } from "../lib/checkout-env";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const sendTo = args.find((arg) => arg.startsWith("--send-test="))?.split("=")[1]?.trim();
const checkDns = args.includes("--dns");

const env = { ...process.env };
const config = readEmailConfig(env);
const present = (key: string) => (env[key]?.trim() ? "✓ cargada" : "· falta");

console.log("\nQuilGym · configuración de emails (Resend)\n");
console.log(`  RESEND_API_KEY   ${present("RESEND_API_KEY")}${env.RESEND_API_KEY?.trim() ? ` (prefijo ${env.RESEND_API_KEY.trim().startsWith("re_") ? "re_ ✓" : "inesperado"})` : ""}`);
console.log(`  EMAIL_FROM       ${config.fromAddress ? `${config.fromAddress} (dominio ${config.fromDomain})` : present("EMAIL_FROM")}`);
console.log(`  EMAIL_REPLY_TO   ${config.replyTo ?? present("EMAIL_REPLY_TO")}`);
console.log(`  Enlaces en emails ${readSiteUrl(env) ?? "sin URL https (los emails no incluyen el link al pedido)"}`);
console.log(`\n  Estado: ${config.enabled ? "HABILITADO" : "deshabilitado"}`);
if (config.issues.length) { console.log("\nErrores:"); for (const issue of config.issues) console.log(`  ✗ ${issue}`); }
if (config.warnings.length) { console.log("\nPendientes:"); for (const warning of config.warnings) console.log(`  · ${warning}`); }

async function dns(domain: string) {
  console.log(`
DNS públicos de ${domain} (solo lectura; compará con la pestaña «Records» del dominio en Resend):`);
  const txt = async (name: string) => (await resolveTxt(name).catch(() => [])).map((parts) => parts.join(""));
  const cname = async (name: string) => await resolveCname(name).catch(() => [] as string[]);
  const dkim = [...await txt(`resend._domainkey.${domain}`), ...await cname(`resend._domainkey.${domain}`)];
  const spfSend = (await txt(`send.${domain}`)).filter((value) => value.startsWith("v=spf1"));
  const mxSend = await resolveMx(`send.${domain}`).catch(() => []);
  const dmarc = (await txt(`_dmarc.${domain}`)).filter((value) => value.startsWith("v=DMARC1"));
  const spfRoot = (await txt(domain)).filter((value) => value.startsWith("v=spf1"));
  console.log(`  DKIM  resend._domainkey.${domain}  ${dkim.length ? "✓ publicado" : "· no encontrado"}`);
  console.log(`  SPF   send.${domain}  ${spfSend.length ? `✓ ${spfSend[0]}` : "· no encontrado (TXT)"}`);
  console.log(`  MX    send.${domain}  ${mxSend.length ? `✓ ${mxSend.map((record) => record.exchange).join(", ")}` : "· no encontrado"}`);
  console.log(`  DMARC _dmarc.${domain}  ${dmarc.length ? `✓ ${dmarc[0]}` : "· no encontrado (recomendado: v=DMARC1; p=none; rua=mailto:...)"}`);
  if (spfRoot.length > 1) console.log("  ✗ El dominio raíz tiene más de un registro SPF: unificalos en uno solo.");
}

async function main() {
  if (checkDns && config.fromDomain) await dns(config.fromDomain);
  if (sendTo) {
    if (!isEmailAddress(sendTo.toLowerCase())) { console.log("\n✗ --send-test necesita un email válido."); process.exit(1); }
    if (!config.enabled) { console.log("\n✗ No se envía: la configuración no está habilitada."); process.exit(1); }
    const site = readSiteUrl(env);
    const content = orderEmailContent("approved", {
      order: { id: "00000000-prueba-0000-0000-000000000000", name: "Prueba QuilGym", status: "approved", paymentMethod: "mercadopago", paymentChoice: "credit_card", delivery: "pickup", totalArs: 12345, pickupDetails: { address: "Dirección de prueba", hours: "Horario de prueba" }, address: null },
      link: site, siteUrl: site, lines: [{ name: "Producto de prueba", quantity: 1, totalArs: 12345 }],
    });
    const result = await sendWithResend(env, { to: sendTo, ...content, subject: `[Prueba] ${content.subject}`, tag: "config_test" }, `config-test-${randomUUID()}`);
    console.log(result.ok ? `\n✓ Email de prueba aceptado por Resend. Revisá la bandeja (y spam) de ${sendTo}.` : `\n✗ Resend no aceptó el envío (${result.reason}). Revisá la clave, el dominio verificado y EMAIL_FROM.`);
    if (!result.ok) process.exit(1);
  }
  console.log("\nGuía: dominio verificado en Resend → DNS (DKIM, SPF y MX de send.<dominio>, DMARC) → API key con permiso «Sending access» → variables en Vercel.\n");
  if (strict && (config.issues.length || !config.enabled)) process.exit(1);
}
void main();
