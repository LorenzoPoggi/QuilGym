import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ORDER_ACCESS_TOKEN_TTL_SECONDS, orderAccessToken, verifyOrderAccess } from "./order-access";

describe("acceso firmado a pedidos", () => {
  const secret = "s".repeat(32);
  const nowMs = Date.UTC(2026, 9, 19, 18, 0, 0);

  it("emite un token versionado que vence en el instante indicado", () => {
    const id = randomUUID();
    const token = orderAccessToken(id, secret, { nowMs, ttlSeconds: 60 })!;

    expect(token).toMatch(/^v1\./);
    expect(verifyOrderAccess(id, token, secret, { nowMs: nowMs + 59_000 })).toBe(true);
    expect(verifyOrderAccess(id, token, secret, { nowMs: nowMs + 60_000 })).toBe(false);
  });

  it("rechaza otro pedido, secreto, firma alterada y fechas no válidas", () => {
    const id = randomUUID();
    const token = orderAccessToken(id, secret, { nowMs, ttlSeconds: 60 })!;
    const parts = token.split(".");
    const mac = parts.at(-1)!;
    const altered = [...parts.slice(0, -1), `${mac.slice(0, -1)}${mac.endsWith("A") ? "B" : "A"}`].join(".");

    expect(verifyOrderAccess(randomUUID(), token, secret, { nowMs })).toBe(false);
    expect(verifyOrderAccess(id, token, "x".repeat(32), { nowMs })).toBe(false);
    expect(verifyOrderAccess(id, altered, secret, { nowMs })).toBe(false);
    expect(verifyOrderAccess(id, token, secret, { nowMs: nowMs - 301_000 })).toBe(false);
    expect(verifyOrderAccess(id, "v1.01.02.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", secret, { nowMs })).toBe(false);
  });

  it("limita la vigencia máxima a 90 días", () => {
    expect(() => orderAccessToken(randomUUID(), secret, {
      nowMs,
      ttlSeconds: ORDER_ACCESS_TOKEN_TTL_SECONDS + 1,
    })).toThrow(RangeError);
  });

  it("acepta temporalmente los tokens anteriores para no romper links enviados", () => {
    const id = randomUUID();
    const legacy = createHmac("sha256", secret).update(`order:${id}`).digest("base64url");

    expect(verifyOrderAccess(id, legacy, secret, { nowMs })).toBe(true);
    expect(verifyOrderAccess(randomUUID(), legacy, secret, { nowMs })).toBe(false);
  });
});
