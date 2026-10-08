import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import { validateCheckout, quoteDelivery } from "./checkout-validation";
import { readQuote, signQuote, checkoutFingerprint, verifyMercadoPagoSignature } from "./checkout-security";
import { canTransition } from "./order-state";
import { parseCheckoutEnv, readOrderAccessSecret } from "./checkout-env";
import { orderAccessToken, verifyOrderAccess } from "./order-access";
import type { CheckoutConfig, CheckoutInput } from "./checkout-types";
vi.mock("server-only", () => ({}));
import { getCheckoutConfig } from "./checkout-config";

const valid: CheckoutInput = { checkoutKey: randomUUID(), quoteToken: "quote", name: "Cliente de prueba", email: "prueba@example.com", phone: "1144444444", delivery: "pickup", payment: "cash", paymentChoice: "cash", street: "", streetNumber: "", apartment: "", postalCode: "", city: "", province: "", notes: "", accepted: true };
const config: CheckoutConfig = { demo: false, pickup: { address: "Local", hours: "A coordinar" }, shippingRates: [{ id: "quilmes", label: "Estándar", postalCodes: ["1878"], priceArs: 5000, estimate: "A coordinar" }], payments: { cash: true, transfer: true, mercadopago: true } };

afterEach(() => vi.unstubAllEnvs());
describe("validación compartida", () => {
  it("acepta retiro sin dirección", () => expect(validateCheckout(valid).ok).toBe(true));
  it("rechaza efectivo con envío y dirección incompleta", () => {
    const result = validateCheckout({ ...valid, delivery: "shipping" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields).toHaveProperty("payment");
  });
  it("rechaza email inválido y consentimiento ausente", () => expect(validateCheckout({ ...valid, email: "wrong", accepted: false }).ok).toBe(false));
  it("no copia precios arbitrarios del cliente", () => {
    const result = validateCheckout({ ...valid, totalArs: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toHaveProperty("totalArs");
  });
  it("normaliza email y valida límites", () => {
    const result = validateCheckout({ ...valid, email: " Test@Example.COM " });
    if (result.ok) expect(result.value.email).toBe("test@example.com");
    expect(validateCheckout({ ...valid, name: "x".repeat(121) }).ok).toBe(false);
  });
});
describe("cotización", () => {
  it("retiro vale cero, envío usa tarifa y acepta CPA", () => {
    expect(quoteDelivery(config, "pickup", "").shippingArs).toBe(0);
    expect(quoteDelivery(config, "shipping", "B1878ABC").shippingArs).toBe(5000);
  });
  it("no inventa envío gratis fuera de cobertura", () => expect(() => quoteDelivery(config, "shipping", "5000")).toThrow("tarifa"));
  it("detecta firma manipulada y otro carrito", () => {
    const id = randomUUID(); const token = signQuote(id, { total: 500 });
    expect(readQuote(id, token)).toEqual({ total: 500 });
    expect(readQuote(randomUUID(), token)).toBeNull();
    expect(readQuote(id, `e30.${token.split(".")[1]}`)).toBeNull();
  });
  it("detecta cambios de cantidad, precio y cupón", () => {
    const lines = [{ variantId: 1, quantity: 2, unitPriceArs: 100 }];
    expect(checkoutFingerprint(lines, 0, null)).not.toBe(checkoutFingerprint([{ ...lines[0], quantity: 3 }], 0, null));
    expect(checkoutFingerprint(lines, 0, null)).not.toBe(checkoutFingerprint(lines, 20, "TEST"));
  });
});
describe("webhooks y estados", () => {
  it("valida HMAC y rechaza firma falsa, vieja o de otro pago", () => {
    const now = Date.now(); const ts = String(Math.floor(now / 1000));
    const digest = createHmac("sha256", "test-secret").update(`id:123;request-id:request;ts:${ts};`).digest("hex");
    const signature = `ts=${ts},v1=${digest}`;
    expect(verifyMercadoPagoSignature(signature, "request", "123", "test-secret", now)).toBe(true);
    expect(verifyMercadoPagoSignature(signature, "request", "456", "test-secret", now)).toBe(false);
    expect(verifyMercadoPagoSignature(signature, "request", "123", "wrong", now)).toBe(false);
    expect(verifyMercadoPagoSignature(signature, "request", "123", "test-secret", now + 600_000)).toBe(false);
  });
  it("un evento pendiente no revierte un aprobado", () => {
    expect(canTransition("approved", "pending")).toBe(false);
    expect(canTransition("approved", "refunded")).toBe(true);
    expect(canTransition("refunded", "approved")).toBe(false);
  });
});
describe("aislamiento del simulador", () => {
  it("solo funciona en desarrollo y se puede desactivar", () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CHECKOUT_DEMO_MODE", "true");
    expect(getCheckoutConfig().demo).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(getCheckoutConfig().demo).toBe(false);
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CHECKOUT_DEMO_MODE", "false");
    expect(getCheckoutConfig().demo).toBe(false);
  });
});
describe("diagnóstico de configuración", () => {
  const base = { NODE_ENV: "production" };
  it("sin variables no habilita nada y explica qué falta", () => {
    const report = parseCheckoutEnv(base);
    expect(report.config.payments).toEqual({ mercadopago: false, transfer: false, cash: false });
    expect(report.config.pickup).toBeNull();
    expect(report.issues).toEqual([]);
    expect(report.warnings.length).toBeGreaterThan(0);
  });
  it("detalla cada tarifa inválida sin descartar las válidas", () => {
    const report = parseCheckoutEnv({ ...base, SHIPPING_RATES_JSON: JSON.stringify([
      { id: "quilmes", label: "Quilmes", postalCodes: ["1878"], priceArs: 3000, estimate: "24 h" },
      { id: "caba", label: "CABA", postalCodes: ["1000"], priceArs: 4500.5 },
    ]) });
    expect(report.config.shippingRates.map((rate) => rate.id)).toEqual(["quilmes"]);
    expect(report.issues.join(" ")).toMatch(/SHIPPING_RATES_JSON\[1\].*estimate.*priceArs/);
    expect(parseCheckoutEnv({ ...base, SHIPPING_RATES_JSON: "{no" }).issues[0]).toMatch(/JSON válido/);
  });
  it("Mercado Pago exige https y no mezcla sandbox con producción", () => {
    const mp = { MP_ACCESS_TOKEN: "TEST-token", NEXT_PUBLIC_MP_PUBLIC_KEY: "TEST-key", MP_WEBHOOK_SECRET: "secret" };
    expect(parseCheckoutEnv({ ...base, ...mp, NEXT_PUBLIC_SITE_URL: "https://quilgym.com.ar" }).config.payments.mercadopago).toBe(true);
    expect(parseCheckoutEnv({ ...base, ...mp, NEXT_PUBLIC_SITE_URL: "http://quilgym.com.ar" }).config.payments.mercadopago).toBe(false);
    const mixed = parseCheckoutEnv({ ...base, ...mp, NEXT_PUBLIC_MP_PUBLIC_KEY: "APP_USR-key", NEXT_PUBLIC_SITE_URL: "https://quilgym.com.ar" });
    expect(mixed.config.payments.mercadopago).toBe(false);
    expect(mixed.issues.join(" ")).toMatch(/mezclan/);
    expect(parseCheckoutEnv({ ...base, MP_ACCESS_TOKEN: "TEST-token" }).issues.join(" ")).toMatch(/incompleto/);
  });
  it("efectivo requiere retiro y el TTL se valida", () => {
    expect(parseCheckoutEnv({ ...base, CASH_PICKUP_ENABLED: "true" }).issues.join(" ")).toMatch(/requiere PICKUP_ADDRESS/);
    expect(parseCheckoutEnv({ ...base, CASH_PICKUP_ENABLED: "true", PICKUP_ADDRESS: "Calle 1", PICKUP_HOURS: "9 a 18" }).config.payments.cash).toBe(true);
    expect(parseCheckoutEnv({ ...base, PICKUP_ADDRESS: "Calle 1", PICKUP_HOURS: "9 a 18" }).config.payments.cash).toBe(true);
    expect(parseCheckoutEnv({ ...base, CASH_PICKUP_ENABLED: "false", PICKUP_ADDRESS: "Calle 1", PICKUP_HOURS: "9 a 18" }).config.payments.cash).toBe(false);
    expect(parseCheckoutEnv({ ...base, PENDING_ORDER_TTL_HOURS: "0" }).pendingOrderTtlHours).toBe(72);
    expect(parseCheckoutEnv({ ...base, PENDING_ORDER_TTL_HOURS: "48" }).pendingOrderTtlHours).toBe(48);
  });
});
describe("link firmado al pedido", () => {
  const secret = "s".repeat(32);
  it("valida solo el token de ese pedido con ese secreto", () => {
    const id = randomUUID();
    const token = orderAccessToken(id, secret)!;
    expect(verifyOrderAccess(id, token, secret)).toBe(true);
    expect(verifyOrderAccess(randomUUID(), token, secret)).toBe(false);
    expect(verifyOrderAccess(id, token, "x".repeat(32))).toBe(false);
    expect(verifyOrderAccess(id, `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`, secret)).toBe(false);
    expect(verifyOrderAccess(id, null, secret)).toBe(false);
  });
  it("sin secreto no hay tokens", () => {
    const id = randomUUID();
    expect(orderAccessToken(id, null)).toBeNull();
    expect(verifyOrderAccess(id, orderAccessToken(id, secret), null)).toBe(false);
    expect(parseCheckoutEnv({ NODE_ENV: "production", ORDER_ACCESS_SECRET: "corto" }).orderAccessEnabled).toBe(false);
  });
  it("usa el secreto webhook como respaldo para autorizar el retorno de Mercado Pago", () => {
    const report = parseCheckoutEnv({ NODE_ENV: "production", MP_WEBHOOK_SECRET: secret });
    expect(report.orderAccessEnabled).toBe(true);
    expect(readOrderAccessSecret({ MP_WEBHOOK_SECRET: secret })).toBe(secret);
  });
});
