import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consumeRateLimit: vi.fn(), sendWithResend: vi.fn(), business: { contactEmail: null as string | null } }));
vi.mock("./rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock("./email-config", async (original) => ({ ...(await original<typeof import("./email-config")>()), sendWithResend: mocks.sendWithResend }));
vi.mock("./commerce", async (original) => {
  const actual = await original<typeof import("./commerce")>();
  return { ...actual, commerce: { ...actual.commerce, business: new Proxy(actual.commerce.business, { get: (target, key) => key === "contactEmail" ? mocks.business.contactEmail : target[key as keyof typeof target] }) } };
});

import { parseWithdrawal, withdrawalCode, withdrawalSummary } from "./withdrawal";
import { submitWithdrawal } from "./withdrawal-actions";

const valid = { name: "Ana Pérez", email: "Ana@Example.com", phone: "", orderCode: "qg-1a2b3c4d", purchaseDate: "2026-10-05", details: "", confirm: "on" };

describe("Botón de arrepentimiento (Res. SCI 424/2020)", () => {
  beforeEach(() => {
    mocks.consumeRateLimit.mockReset().mockResolvedValue(true);
    mocks.sendWithResend.mockReset().mockResolvedValue({ ok: true });
    mocks.business.contactEmail = null;
    vi.unstubAllEnvs();
  });

  it("valida sin pedir cuenta: nombre, email y confirmación; el resto es opcional", () => {
    expect(parseWithdrawal(valid)).toEqual({ ok: true, value: { name: "Ana Pérez", email: "ana@example.com", phone: "", orderCode: "QG-1A2B3C4D", purchaseDate: "2026-10-05", details: "" } });
    const invalid = parseWithdrawal({ name: "A", email: "no", orderCode: "ZZZ", purchaseDate: "ayer" });
    expect(invalid.ok).toBe(false);
    expect(!invalid.ok && Object.keys(invalid.fields).sort()).toEqual(["confirm", "email", "name", "orderCode", "purchaseDate"]);
  });

  it("genera un código de trámite legible con la fecha de Argentina", () => {
    const code = withdrawalCode(new Date("2026-10-10T02:00:00Z"));
    expect(code).toMatch(/^ARR-20261009-[2-9A-HJ-NP-Z]{6}$/);
    expect(withdrawalCode()).not.toBe(withdrawalCode());
    const parsed = parseWithdrawal(valid);
    if (!parsed.ok) throw new Error("válido");
    expect(withdrawalSummary(code, parsed.value)).toContain("Fecha de compra o recepción: 05/10/2026");
  });

  it("sin email del negocio o sin Resend: devuelve el código y el WhatsApp prellenado, sin enviar emails", async () => {
    const result = await submitWithdrawal(valid);
    expect(result).toMatchObject({ ok: true, channel: "whatsapp", confirmationSent: false });
    expect(result.ok && decodeURIComponent(result.whatsappUrl)).toContain(result.ok ? result.code : "");
    expect(mocks.sendWithResend).not.toHaveBeenCalled();
  });

  it("con Resend y email del negocio: avisa al negocio (Reply-To del cliente) y manda la constancia", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "QuilGym <pedidos@quilgym.test>");
    mocks.business.contactEmail = "hola@quilgym.test";
    const result = await submitWithdrawal(valid);
    expect(result).toMatchObject({ ok: true, channel: "email", confirmationSent: true });
    expect(mocks.sendWithResend).toHaveBeenCalledTimes(2);
    expect(mocks.sendWithResend.mock.calls[0][1]).toMatchObject({ to: "hola@quilgym.test", replyTo: "ana@example.com" });
    expect(mocks.sendWithResend.mock.calls[1][1]).toMatchObject({ to: "ana@example.com" });
  });

  it("si falla el aviso al negocio, el trámite sigue por WhatsApp; un error del contador no bloquea el derecho", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "QuilGym <pedidos@quilgym.test>");
    mocks.business.contactEmail = "hola@quilgym.test";
    mocks.sendWithResend.mockResolvedValueOnce({ ok: false, reason: "http_500" });
    mocks.consumeRateLimit.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await submitWithdrawal(valid)).toMatchObject({ ok: true, channel: "whatsapp" });
  });
});
