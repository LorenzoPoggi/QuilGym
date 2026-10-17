import "server-only";
import { cookies } from "next/headers";
import { decodeOrdersCookie, encodeOrdersCookie, ORDERS_COOKIE, ORDERS_COOKIE_MAX_AGE, ordersCookieSecret, rememberOrderIds } from "./order-cookie";

/** Pedidos de invitado recordados en este navegador (vacío sin secreto o con la firma alterada). */
export async function readRememberedOrders() {
  return decodeOrdersCookie((await cookies()).get(ORDERS_COOKIE)?.value, ordersCookieSecret(process.env));
}

/** Se llama desde la Server Action que crea el pedido. Nunca hace fallar la compra. */
export async function rememberOrder(orderId: string) {
  const secret = ordersCookieSecret(process.env);
  if (!secret) return;
  try {
    const store = await cookies();
    const ids = rememberOrderIds(decodeOrdersCookie(store.get(ORDERS_COOKIE)?.value, secret), orderId);
    store.set(ORDERS_COOKIE, encodeOrdersCookie(ids, secret), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ORDERS_COOKIE_MAX_AGE,
    });
  } catch (error) {
    console.warn("[Pedidos] No se pudo recordar el pedido en el navegador", { reason: error instanceof Error ? error.name : "error" });
  }
}
