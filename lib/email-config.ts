/**
 * Configuración de Resend leída del entorno, sin `server-only`: la usan los emails de pedidos y de cuentas,
 * `npm run checkout:check` y `npm run email:check`. Nunca devuelve ni registra la API key.
 */
type Env = Record<string, string | undefined>;

export type EmailConfig = {
  /** Hay clave y remitente válido: se puede enviar. */
  enabled: boolean;
  /** Remitente tal como se envía a Resend («QuilGym <pedidos@dominio>»). */
  from: string | null;
  fromAddress: string | null;
  fromDomain: string | null;
  replyTo: string | null;
  issues: string[];
  warnings: string[];
};

const EMAIL = /^[^\s@<>()",;:]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
/** Dominios de casillas gratuitas: Resend no permite verificarlos como remitente. */
const FREE_MAILBOXES = new Set(["gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.ar", "outlook.com", "outlook.com.ar", "live.com", "live.com.ar", "yahoo.com", "yahoo.com.ar", "icloud.com", "proton.me", "protonmail.com"]);

export const isEmailAddress = (value: string) => value.length <= 254 && EMAIL.test(value);

/** Acepta `pedidos@dominio` o `Nombre <pedidos@dominio>`; el nombre no puede tener comillas ni saltos. */
export function parseSender(raw: string | undefined | null) {
  const value = raw?.trim();
  if (!value) return null;
  const named = value.match(/^([^<>"\r\n]{1,80}?)\s*<([^<>\s]+)>$/);
  const name = named ? named[1].trim() : null;
  const address = (named ? named[2] : value).toLowerCase();
  if (!isEmailAddress(address)) return null;
  return { name, address, domain: address.split("@")[1], formatted: name ? `${name} <${address}>` : address };
}

export function readEmailConfig(env: Env): EmailConfig {
  const issues: string[] = [];
  const warnings: string[] = [];
  const key = env.RESEND_API_KEY?.trim();
  const rawFrom = env.EMAIL_FROM?.trim();
  const sender = parseSender(rawFrom);
  if (!key && !rawFrom) warnings.push("Faltan RESEND_API_KEY y EMAIL_FROM: los emails de pedidos quedan en la outbox y la recuperación de contraseña está oculta.");
  else if (!key) warnings.push("Falta RESEND_API_KEY: no se envía ningún email.");
  else if (!rawFrom) warnings.push("Falta EMAIL_FROM (por ejemplo «QuilGym <pedidos@tu-dominio.com.ar>»): no se envía ningún email.");
  if (key && !key.startsWith("re_")) warnings.push("RESEND_API_KEY no tiene el prefijo re_ de las claves de Resend: revisá que sea la clave correcta.");
  if (rawFrom && !sender) issues.push("EMAIL_FROM no es válido: usá «pedidos@tu-dominio» o «QuilGym <pedidos@tu-dominio>».");
  if (sender && FREE_MAILBOXES.has(sender.domain)) issues.push(`EMAIL_FROM usa ${sender.domain}: Resend solo envía desde un dominio propio verificado (no Gmail/Hotmail/Outlook).`);
  if (sender?.domain === "resend.dev") warnings.push("EMAIL_FROM usa resend.dev: solo sirve para pruebas y únicamente llega al email dueño de la cuenta de Resend.");
  if (sender && !sender.name) warnings.push("EMAIL_FROM no tiene nombre visible: conviene «QuilGym <pedidos@tu-dominio>».");
  const rawReplyTo = env.EMAIL_REPLY_TO?.trim();
  const replyTo = rawReplyTo && isEmailAddress(rawReplyTo.toLowerCase()) ? rawReplyTo.toLowerCase() : null;
  if (rawReplyTo && !replyTo) issues.push("EMAIL_REPLY_TO no es un email válido.");
  if (!rawReplyTo && sender) warnings.push("Sin EMAIL_REPLY_TO: las respuestas de los clientes van al remitente. Configurá una casilla que alguien lea (puede ser Gmail).");
  const usable = Boolean(key && sender && !FREE_MAILBOXES.has(sender.domain));
  return { enabled: usable, from: usable ? sender!.formatted : null, fromAddress: sender?.address ?? null, fromDomain: sender?.domain ?? null, replyTo, issues, warnings };
}

export type ResendMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Categoría para filtrar en el panel de Resend (solo letras, números, guiones y guiones bajos). */
  tag: string;
  replyTo?: string | null;
  attachments?: { filename: string; path: string }[];
};

/** Cuerpo para POST https://api.resend.com/emails. El destinatario va solo en `to`; nunca en tags ni headers. */
export function resendPayload(config: Pick<EmailConfig, "from" | "replyTo">, message: ResendMessage) {
  const replyTo = message.replyTo ?? config.replyTo;
  return {
    from: config.from, to: [message.to], subject: message.subject, html: message.html, text: message.text,
    ...(replyTo ? { reply_to: replyTo } : {}),
    tags: [{ name: "category", value: message.tag.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) }],
    ...(message.attachments?.length ? { attachments: message.attachments } : {}),
  };
}

/** Envío con Idempotency-Key (Resend la respeta 24 h). Devuelve el status HTTP o el nombre del error de red; nunca datos del mensaje. */
export async function sendWithResend(env: Env, message: ResendMessage, idempotencyKey: string, fetchImpl: typeof fetch = fetch) {
  const config = readEmailConfig(env);
  if (!config.enabled) return { ok: false as const, reason: "not_configured" };
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.slice(0, 256) },
      body: JSON.stringify(resendPayload(config, message)),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? { ok: true as const } : { ok: false as const, reason: `http_${response.status}` };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.name : "network_error" };
  }
}
