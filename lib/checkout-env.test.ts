import { describe, expect, it } from "vitest";
import { parseCheckoutEnv, readPaymentNotificationUrl } from "./checkout-env";

const mp = {
  MP_ACCESS_TOKEN: "TEST-access-token",
  NEXT_PUBLIC_MP_PUBLIC_KEY: "TEST-public-key",
  MP_WEBHOOK_SECRET: "webhook-secret-with-at-least-thirty-two-chars",
};

describe("URL de notificaciones de Mercado Pago", () => {
  it("usa el webhook público normal fuera de Preview", () => {
    expect(readPaymentNotificationUrl({ NEXT_PUBLIC_SITE_URL: "https://quilgym.vercel.app" }))
      .toBe("https://quilgym.vercel.app/api/payments/mercadopago/webhook");
  });

  it("en Preview usa el despliegue exacto y el bypass codificado, sin incluirlo en el retorno", () => {
    const env = { ...mp, VERCEL_ENV: "preview", VERCEL_URL: "quilgym-abc.vercel.app", VERCEL_AUTOMATION_BYPASS_SECRET: "test-secret+with/slash" };
    const url = new URL(readPaymentNotificationUrl(env)!);
    expect(url.origin).toBe("https://quilgym-abc.vercel.app");
    expect(url.pathname).toBe("/api/payments/mercadopago/webhook");
    expect(url.searchParams.get("x-vercel-protection-bypass")).toBe("test-secret+with/slash");
    expect(parseCheckoutEnv(env).config.payments.mercadopago).toBe(true);
  });

  it("deshabilita el pago en Preview si falta el bypass o la URL exacta", () => {
    const env = { ...mp, VERCEL_ENV: "preview", VERCEL_URL: "quilgym-abc.vercel.app" };
    expect(readPaymentNotificationUrl(env)).toBeNull();
    expect(parseCheckoutEnv(env).config.payments.mercadopago).toBe(false);
    expect(parseCheckoutEnv(env).issues.join(" ")).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(readPaymentNotificationUrl({ ...env, VERCEL_URL: "quilgym.vercel.app.evil.example", VERCEL_AUTOMATION_BYPASS_SECRET: "test" })).toBeNull();
  });
});
