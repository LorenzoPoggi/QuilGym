/**
 * Cookie `qg_orders`: los últimos 3 pedidos de invitado hechos desde este navegador, para el aviso de pedido en curso.
 * La cookie del carrito no sirve porque cambia después de cada compra. Va firmada con HMAC (no se puede agregar el
 * id de un pedido ajeno) y es HttpOnly. Las funciones puras no dependen de Next para poder probarlas.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const ORDERS_COOKIE = "qg_orders";
export const ORDERS_COOKIE_MAX = 3;
export const ORDERS_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Secreto de firma: el de los links de pedido (ORDER_ACCESS_SECRET o MP_WEBHOOK_SECRET) o, si falta, el de las
 * sesiones (BETTER_AUTH_SECRET). Sin ninguno de 32+ caracteres la cookie no se escribe ni se lee.
 */
export function ordersCookieSecret(env: Record<string, string | undefined>) {
  const candidates = [env.ORDER_ACCESS_SECRET, env.MP_WEBHOOK_SECRET, env.BETTER_AUTH_SECRET].map((value) => value?.trim());
  return candidates.find((value): value is string => !!value && value.length >= 32) ?? null;
}

const sign = (payload: string, secret: string) => createHmac("sha256", `qg_orders:${secret}`).update(payload).digest("base64url");

export function encodeOrdersCookie(ids: string[], secret: string) {
  const payload = Buffer.from(ids.filter((id) => UUID.test(id)).slice(0, ORDERS_COOKIE_MAX).join(",")).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Ids válidos de la cookie; una firma alterada o un formato raro devuelven una lista vacía. */
export function decodeOrdersCookie(value: string | undefined | null, secret: string | null): string[] {
  if (!value || !secret || value.length > 400) return [];
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return [];
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return [];
  return Buffer.from(payload, "base64url").toString("utf8").split(",").filter((id) => UUID.test(id)).slice(0, ORDERS_COOKIE_MAX);
}

/** Agrega el pedido al principio, sin repetir y con un máximo de 3. */
export function rememberOrderIds(current: string[], orderId: string) {
  return [orderId, ...current.filter((id) => id !== orderId)].slice(0, ORDERS_COOKIE_MAX);
}
