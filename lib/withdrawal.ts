/**
 * Botón de arrepentimiento (Res. SCI 424/2020; Ley 24.240 art. 34). Reglas puras: validación del formulario,
 * código de trámite y textos. No requiere cuenta ni otro trámite previo.
 */
import { randomBytes } from "node:crypto";
import { isEmailAddress } from "./email-config";

export type WithdrawalRequest = { name: string; email: string; phone: string; orderCode: string; purchaseDate: string; details: string };
export type WithdrawalParse = { ok: true; value: WithdrawalRequest } | { ok: false; fields: Record<string, string> };

const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "";

export function parseWithdrawal(raw: Record<string, unknown>): WithdrawalParse {
  const fields: Record<string, string> = {};
  const name = clean(raw.name, 120);
  if (name.length < 2) fields.name = "Ingresá tu nombre y apellido.";
  const email = clean(raw.email, 254).toLowerCase();
  if (!isEmailAddress(email)) fields.email = "Ingresá un email válido: ahí te enviamos el código del trámite.";
  const phone = clean(raw.phone, 30);
  if (phone && !/^\+?[\d\s()-]{8,30}$/.test(phone)) fields.phone = "Ingresá un teléfono válido o dejalo vacío.";
  const orderCode = clean(raw.orderCode, 40).toUpperCase().replace(/\s/g, "");
  if (orderCode && !/^(QG-)?[0-9A-F]{8}([0-9A-F-]{28})?$/.test(orderCode)) fields.orderCode = "El número de pedido tiene el formato QG-XXXXXXXX. Si no lo tenés, dejalo vacío.";
  const purchaseDate = clean(raw.purchaseDate, 10);
  if (purchaseDate && (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || Number.isNaN(Date.parse(purchaseDate)))) fields.purchaseDate = "Ingresá una fecha válida o dejala vacía.";
  const details = clean(raw.details, 1000);
  if (raw.confirm !== true && raw.confirm !== "on") fields.confirm = "Confirmá que querés revocar la compra.";
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { name, email, phone, orderCode: orderCode && !orderCode.startsWith("QG-") ? `QG-${orderCode.slice(0, 8)}` : orderCode.slice(0, 11), purchaseDate, details } };
}

/** Código legible y difícil de adivinar: ARR-AAAAMMDD-XXXXXX (sin letras ambiguas). */
export function withdrawalCode(now = new Date()) {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(now).replaceAll("-", "");
  return `ARR-${date}-${suffix}`;
}

export function withdrawalSummary(code: string, request: WithdrawalRequest) {
  return [
    `Solicitud de revocación (Botón de arrepentimiento) · Código ${code}`,
    `Nombre: ${request.name}`,
    `Email: ${request.email}`,
    request.phone ? `Teléfono: ${request.phone}` : null,
    `Pedido: ${request.orderCode || "no informado"}`,
    request.purchaseDate ? `Fecha de compra o recepción: ${request.purchaseDate.split("-").reverse().join("/")}` : null,
    request.details ? `Detalle: ${request.details}` : null,
  ].filter(Boolean).join("\n");
}
