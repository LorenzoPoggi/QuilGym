import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { consumeRateLimit } from "./rate-limit";

/** Solo confía en la IP que el edge de Vercel fija; no interpreta headers de proxy en local. */
export async function allowInvalidMercadoPagoWebhook(request: Request, secret: string) {
  if (process.env.VERCEL !== "1") return true;
  const raw = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  // Vercel sobrescribe x-forwarded-for. Si falta o no es una IP válida, no
  // confiamos el valor ni dejamos las solicitudes inválidas sin límite: usamos
  // un bucket común de contingencia.
  const identity = raw && isIP(raw)
    ? createHmac("sha256", secret).update(raw).digest("hex").slice(0, 32)
    : "missing-or-invalid-ip";
  return consumeRateLimit(`mp-webhook-invalid:${identity}`, 20, 60_000);
}
