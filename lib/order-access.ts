import { createHmac, timingSafeEqual } from "node:crypto";

const LEGACY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const VERSIONED_TOKEN_PATTERN = /^v1\.([0-9a-z]{1,10})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{43})$/;

export const ORDER_ACCESS_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

type TokenOptions = {
  nowMs?: number;
  ttlSeconds?: number;
};

type VerificationOptions = {
  nowMs?: number;
};

function signature(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function sameSignature(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

/**
 * Token que autoriza ver un pedido sin la cookie del carrito (link del email o vuelta desde
 * Mercado Pago en otro navegador). Los tokens nuevos vencen a los 90 días. Sin secreto
 * configurado devuelve null y solo vale la cookie.
 */
export function orderAccessToken(orderId: string, secret: string | null, options: TokenOptions = {}) {
  if (!secret) return null;
  const ttlSeconds = options.ttlSeconds ?? ORDER_ACCESS_TOKEN_TTL_SECONDS;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > ORDER_ACCESS_TOKEN_TTL_SECONDS) {
    throw new RangeError(`El token del pedido debe durar entre 1 y ${ORDER_ACCESS_TOKEN_TTL_SECONDS} segundos.`);
  }

  const issuedAt = Math.floor((options.nowMs ?? Date.now()) / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const issuedAtEncoded = issuedAt.toString(36);
  const expiresAtEncoded = expiresAt.toString(36);
  const mac = signature(secret, `order:v1:${orderId}:${issuedAtEncoded}:${expiresAtEncoded}`);
  return `v1.${issuedAtEncoded}.${expiresAtEncoded}.${mac}`;
}

export function verifyOrderAccess(
  orderId: string,
  token: string | null | undefined,
  secret: string | null,
  options: VerificationOptions = {},
) {
  if (!secret || !token) return false;

  const versioned = VERSIONED_TOKEN_PATTERN.exec(token);
  if (versioned) {
    const [, issuedAtEncoded, expiresAtEncoded, actual] = versioned;
    const issuedAt = Number.parseInt(issuedAtEncoded, 36);
    const expiresAt = Number.parseInt(expiresAtEncoded, 36);
    const now = Math.floor((options.nowMs ?? Date.now()) / 1000);

    // Exigir la codificación canónica evita representaciones alternativas del mismo instante.
    if (
      !Number.isSafeInteger(issuedAt) ||
      !Number.isSafeInteger(expiresAt) ||
      issuedAt.toString(36) !== issuedAtEncoded ||
      expiresAt.toString(36) !== expiresAtEncoded ||
      issuedAt > now + MAX_CLOCK_SKEW_SECONDS ||
      expiresAt <= now ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt > ORDER_ACCESS_TOKEN_TTL_SECONDS
    ) return false;

    const expected = signature(secret, `order:v1:${orderId}:${issuedAtEncoded}:${expiresAtEncoded}`);
    return sameSignature(actual, expected);
  }

  // Compatibilidad transitoria: no romper emails y retornos de Mercado Pago emitidos antes de
  // incorporar el vencimiento. Una futura rotación coordinada del secreto retirará estos links.
  if (!LEGACY_TOKEN_PATTERN.test(token)) return false;
  const expected = signature(secret, `order:${orderId}`);
  return sameSignature(token, expected);
}
