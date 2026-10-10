"use server";

import { createHash } from "node:crypto";
import { commerce, whatsappUrl } from "./commerce";
import { readEmailConfig, sendWithResend } from "./email-config";
import { renderEmail } from "./email-templates";
import { readSiteUrl } from "./checkout-env";
import { consumeRateLimit } from "./rate-limit";
import { parseWithdrawal, withdrawalCode, withdrawalSummary } from "./withdrawal";

export type WithdrawalResult =
  | { ok: true; code: string; channel: "email" | "whatsapp"; whatsappUrl: string; confirmationSent: boolean }
  | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Registra un pedido de revocación sin cuenta ni trámite previo. Genera el código en el momento; si Resend y el
 * email del negocio están configurados, avisa al negocio y manda la constancia al consumidor. Si no, el trámite se
 * completa enviando el mensaje prellenado por WhatsApp. No guarda datos en la base ni los registra en logs.
 */
export async function submitWithdrawal(raw: Record<string, unknown>): Promise<WithdrawalResult> {
  const parsed = parseWithdrawal(raw && typeof raw === "object" ? raw : {});
  if (!parsed.ok) return { ok: false, error: "Revisá los campos marcados.", fields: parsed.fields };
  const request = parsed.value;
  try {
    const key = createHash("sha256").update(request.email).digest("hex").slice(0, 32);
    if (!await consumeRateLimit(`withdrawal:${key}`, 5, 60 * 60_000)) return { ok: false, error: "Recibimos varios pedidos desde este email. Esperá un rato o escribinos por WhatsApp." };
  } catch { /* Sin el contador no se bloquea un derecho del consumidor. */ }
  const code = withdrawalCode();
  const summary = withdrawalSummary(code, request);
  const whatsapp = whatsappUrl(`Hola, quiero revocar mi compra (Botón de arrepentimiento).\n${summary}`);
  const business = commerce.business.contactEmail;
  const site = readSiteUrl(process.env);
  if (!business || !readEmailConfig(process.env).enabled) return { ok: true, code, channel: "whatsapp", whatsappUrl: whatsapp, confirmationSent: false };

  const toBusiness = renderEmail({
    subject: `Arrepentimiento ${code}${request.orderCode ? ` · pedido ${request.orderCode}` : ""}`, preheader: `Pedido de revocación de ${request.name}`,
    heading: "Nuevo pedido de revocación", paragraphs: ["Un cliente usó el Botón de arrepentimiento. Respondé este email para coordinar la devolución (la respuesta va al cliente)."],
    details: summary.split("\n").slice(1).map((line) => { const [label, ...rest] = line.split(": "); return [label, rest.join(": ")] as [string, string]; }),
  }, site);
  const sentToBusiness = await sendWithResend(process.env, { to: business, ...toBusiness, tag: "withdrawal_business", replyTo: request.email }, `withdrawal-business-${code}`);
  if (!sentToBusiness.ok) {
    console.warn("[Arrepentimiento] No se pudo avisar al negocio por email", { reason: sentToBusiness.reason });
    return { ok: true, code, channel: "whatsapp", whatsappUrl: whatsapp, confirmationSent: false };
  }
  const toCustomer = renderEmail({
    subject: `Recibimos tu pedido de arrepentimiento · ${code}`, preheader: "Guardá este código de trámite.",
    heading: "Recibimos tu pedido de arrepentimiento",
    paragraphs: [`Hola, ${request.name.split(/\s+/)[0]}.`, `Tu código de trámite es ${code}. Te vamos a escribir para coordinar la devolución del producto; el reintegro se hace por el mismo medio de pago.`],
    details: [["Código", code], ["Pedido", request.orderCode || "No informado"]],
    footnote: "Si no hiciste este pedido, respondé este email.",
  }, site);
  const confirmation = await sendWithResend(process.env, { to: request.email, ...toCustomer, tag: "withdrawal_customer" }, `withdrawal-customer-${code}`);
  return { ok: true, code, channel: "email", whatsappUrl: whatsapp, confirmationSent: confirmation.ok };
}
