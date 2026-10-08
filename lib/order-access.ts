import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Token que autoriza ver un pedido sin la cookie del carrito (link del email o vuelta desde
 * Mercado Pago en otro navegador). Sin secreto configurado devuelve null y solo vale la cookie.
 */
export function orderAccessToken(orderId: string, secret: string | null) {
  if (!secret) return null;
  return createHmac("sha256", secret).update(`order:${orderId}`).digest("base64url");
}

export function verifyOrderAccess(orderId: string, token: string | null | undefined, secret: string | null) {
  if (!secret || !token || !TOKEN_PATTERN.test(token)) return false;
  // Comparar la representación canónica: distintos últimos caracteres base64url
  // pueden decodificarse al mismo HMAC por los bits de relleno no utilizados.
  const expected = createHmac("sha256", secret).update(`order:${orderId}`).digest("base64url");
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
