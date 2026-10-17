import { describe, expect, it } from "vitest";
import { decodeOrdersCookie, encodeOrdersCookie, ordersCookieSecret, rememberOrderIds } from "./order-cookie";
import { activeOrderMessage } from "./active-order-core";

const secret = "s".repeat(40);
const ids = ["0f3a9c2e-1111-4a2b-9c3d-123456789abc", "1f3a9c2e-1111-4a2b-9c3d-123456789abc", "2f3a9c2e-1111-4a2b-9c3d-123456789abc", "3f3a9c2e-1111-4a2b-9c3d-123456789abc"];

describe("cookie qg_orders", () => {
  it("firma y lee hasta 3 pedidos", () => {
    const value = encodeOrdersCookie(ids, secret);
    expect(decodeOrdersCookie(value, secret)).toEqual(ids.slice(0, 3));
  });
  it("rechaza firmas alteradas, otro secreto y formatos raros", () => {
    const value = encodeOrdersCookie(ids.slice(0, 1), secret);
    const [payload, signature] = value.split(".");
    const forged = `${Buffer.from(ids[3]).toString("base64url")}.${signature}`;
    expect(decodeOrdersCookie(forged, secret)).toEqual([]);
    expect(decodeOrdersCookie(value, "x".repeat(40))).toEqual([]);
    expect(decodeOrdersCookie(`${payload}.${signature}.extra`, secret)).toEqual([]);
    expect(decodeOrdersCookie(value, null)).toEqual([]);
    expect(decodeOrdersCookie(undefined, secret)).toEqual([]);
    expect(decodeOrdersCookie(encodeOrdersCookie(["no-es-un-uuid"], secret), secret)).toEqual([]);
  });
  it("agrega el pedido nuevo primero, sin repetir", () => {
    expect(rememberOrderIds([ids[0], ids[1], ids[2]], ids[3])).toEqual([ids[3], ids[0], ids[1]]);
    expect(rememberOrderIds([ids[0], ids[1]], ids[1])).toEqual([ids[1], ids[0]]);
  });
  it("usa el secreto de los links de pedido o el de sesiones, nunca uno corto", () => {
    expect(ordersCookieSecret({ ORDER_ACCESS_SECRET: "a".repeat(32), BETTER_AUTH_SECRET: "b".repeat(32) })).toBe("a".repeat(32));
    expect(ordersCookieSecret({ ORDER_ACCESS_SECRET: "corto", BETTER_AUTH_SECRET: "b".repeat(32) })).toBe("b".repeat(32));
    expect(ordersCookieSecret({})).toBeNull();
  });
});

describe("texto del aviso de pedido en curso", () => {
  const base = { id: ids[0], delivery: "local" as const, orderStatus: "approved" as const, paymentMethod: "mercadopago" as const, token: "tok+en", now: new Date("2026-10-17T15:10:00-03:00") };
  it("en camino con ventana de llegada", () => {
    expect(activeOrderMessage({ ...base, shipmentStatus: "out_for_delivery", etaFrom: new Date("2026-10-17T15:00:00-03:00"), etaTo: new Date("2026-10-17T20:00:00-03:00") })).toEqual({
      id: ids[0], code: "QG-0F3A9C2E", status: "out_for_delivery", title: "Tu pedido QG-0F3A9C2E está en camino",
      detail: "llega hoy entre las 15:00 y las 20:00", href: `/pedido/${ids[0]}?t=tok%2Ben`,
    });
  });
  it("sin ventana usa el paso en curso; listo para retirar no muestra horario", () => {
    expect(activeOrderMessage({ ...base, shipmentStatus: "preparing", etaFrom: null, etaTo: null, token: null })).toMatchObject({
      title: "Tu pedido QG-0F3A9C2E está en preparación", detail: "Armamos y controlamos tu pedido.", href: `/pedido/${ids[0]}` });
    expect(activeOrderMessage({ ...base, delivery: "pickup", shipmentStatus: "ready_for_pickup", etaFrom: new Date(), etaTo: new Date(Date.now() + 1000) }).title).toBe("Tu pedido QG-0F3A9C2E está listo para retirar");
  });
});
