/* Emails de cuenta (recuperar contraseña y verificar email) vía la API HTTP de Resend. Sin variables, la función queda oculta. */
import { createHash } from "node:crypto";

type Env = Record<string, string | undefined>;
export type AuthEmailKind = "reset-password" | "verify-email";

export function authEmailConfigured(env: Env) { return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim()); }

const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0]?.slice(0, 40) || "";
export function authEmailContent(kind: AuthEmailKind, name: string | null | undefined, url: string) {
  const hello = firstName(name) ? `Hola ${firstName(name)}.` : "Hola.";
  if (kind === "reset-password") return { subject: "QuilGym · Restablecer tu contraseña",
    text: `${hello}\nRecibimos un pedido para restablecer la contraseña de tu cuenta QuilGym.\nElegí una nueva desde este enlace (vence en 1 hora y se puede usar una sola vez):\n${url}\n\nSi no lo pediste, ignorá este email: tu contraseña no cambia.` };
  return { subject: "QuilGym · Confirmá tu email",
    text: `${hello}\nGracias por crear tu cuenta en QuilGym.\nConfirmá tu email desde este enlace (vence en 1 hora):\n${url}\n\nSi no creaste la cuenta, ignorá este email.` };
}

/** Envía un email de cuenta. Nunca registra destinatarios, enlaces ni claves; ante un error solo informa el status. */
export async function sendAuthEmail(env: Env, kind: AuthEmailKind, to: string, name: string | null | undefined, url: string, token: string) {
  if (!authEmailConfigured(env)) return false;
  const { subject, text } = authEmailContent(kind, name, url);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json",
        "Idempotency-Key": `auth-${kind}-${createHash("sha256").update(token).digest("hex").slice(0, 32)}` },
      body: JSON.stringify({ from: env.EMAIL_FROM!.trim(), to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) console.warn(`[cuentas] Resend respondió ${response.status} al enviar ${kind}.`);
    return response.ok;
  } catch (error) {
    console.warn(`[cuentas] No se pudo enviar ${kind}: ${error instanceof Error ? error.name : "error"}.`);
    return false;
  }
}
