/* Emails de cuenta (recuperar contraseña y verificar email) vía la API HTTP de Resend. Sin variables, la función queda oculta. */
import { createHash } from "node:crypto";
import { readEmailConfig, sendWithResend } from "./email-config";
import { authEmailTemplate, type AuthEmailKind } from "./email-templates";
import { readSiteUrl } from "./checkout-env";

type Env = Record<string, string | undefined>;
export type { AuthEmailKind };

export function authEmailConfigured(env: Env) { return readEmailConfig(env).enabled; }

export function authEmailContent(kind: AuthEmailKind, name: string | null | undefined, url: string, env: Env = {}) {
  return authEmailTemplate(kind, name, url, readSiteUrl(env));
}

/** Envía un email de cuenta. Nunca registra destinatarios, enlaces ni claves; ante un error solo informa el status. */
export async function sendAuthEmail(env: Env, kind: AuthEmailKind, to: string, name: string | null | undefined, url: string, token: string) {
  if (!authEmailConfigured(env)) return false;
  const { subject, html, text } = authEmailContent(kind, name, url, env);
  const result = await sendWithResend(env, { to, subject, html, text, tag: `auth_${kind}` },
    `auth-${kind}-${createHash("sha256").update(token).digest("hex").slice(0, 32)}`);
  if (!result.ok) console.warn(`[cuentas] No se pudo enviar ${kind}: ${result.reason}.`);
  return result.ok;
}
