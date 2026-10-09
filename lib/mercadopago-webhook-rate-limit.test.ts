import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeRateLimit } = vi.hoisted(() => ({ consumeRateLimit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./rate-limit", () => ({ consumeRateLimit }));

import { allowInvalidMercadoPagoWebhook } from "./mercadopago-webhook-rate-limit";

describe("límite de firmas inválidas del webhook", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("VERCEL", "1"); });

  it("usa la primera IP edge validada y persiste solo una identidad HMAC", async () => {
    consumeRateLimit.mockResolvedValue(true);
    const request = new Request("https://example.test/webhook", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
    await expect(allowInvalidMercadoPagoWebhook(request, "webhook-secret")).resolves.toBe(true);
    expect(consumeRateLimit).toHaveBeenCalledOnce();
    const [key, max, window] = consumeRateLimit.mock.calls[0];
    expect(key).toMatch(/^mp-webhook-invalid:[a-f0-9]{32}$/);
    expect(key).not.toContain("203.0.113.7");
    expect([max, window]).toEqual([20, 60_000]);
  });

  it("usa un bucket común en vez de confiar una IP malformada y no limita en local", async () => {
    consumeRateLimit.mockResolvedValue(true);
    const malformed = new Request("https://example.test/webhook", { headers: { "x-forwarded-for": "attacker, 203.0.113.7" } });
    await expect(allowInvalidMercadoPagoWebhook(malformed, "webhook-secret")).resolves.toBe(true);
    expect(consumeRateLimit).toHaveBeenCalledWith("mp-webhook-invalid:missing-or-invalid-ip", 20, 60_000);
    consumeRateLimit.mockClear();
    const missing = new Request("https://example.test/webhook");
    await expect(allowInvalidMercadoPagoWebhook(missing, "webhook-secret")).resolves.toBe(true);
    expect(consumeRateLimit).toHaveBeenCalledWith("mp-webhook-invalid:missing-or-invalid-ip", 20, 60_000);
    consumeRateLimit.mockClear();
    vi.stubEnv("VERCEL", "");
    const validIp = new Request("https://example.test/webhook", { headers: { "x-forwarded-for": "203.0.113.7" } });
    await expect(allowInvalidMercadoPagoWebhook(validIp, "webhook-secret")).resolves.toBe(true);
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it("propaga el umbral y los errores del contador compartido", async () => {
    consumeRateLimit.mockResolvedValue(false);
    const request = new Request("https://example.test/webhook", { headers: { "x-forwarded-for": "203.0.113.7" } });
    await expect(allowInvalidMercadoPagoWebhook(request, "webhook-secret")).resolves.toBe(false);
    consumeRateLimit.mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(allowInvalidMercadoPagoWebhook(request, "webhook-secret")).rejects.toThrow("DB unavailable");
  });
});
