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

describe("entrega propia, local y transportista", () => {
  it("la entrega propia arranca apagada y con radio de 5 km al habilitarla", () => {
    const off = parseCheckoutEnv({ NODE_ENV: "production" });
    expect(off.config.localDelivery).toBeNull();
    expect(off.config.store).toEqual({ lat: -34.7212393, lng: -58.2603596 });
    expect(parseCheckoutEnv({ NODE_ENV: "production", LOCAL_DELIVERY_ENABLED: "true" }).config.localDelivery).toEqual({ radiusKm: 5, cash: false });
    expect(parseCheckoutEnv({ NODE_ENV: "production", LOCAL_DELIVERY_ENABLED: "true", LOCAL_DELIVERY_RADIUS_KM: "3,5", LOCAL_DELIVERY_CASH: "true" }).config.localDelivery).toEqual({ radiusKm: 3.5, cash: true });
  });

  it("un radio o coordenadas inválidas se informan sin inventar valores", () => {
    const badRadius = parseCheckoutEnv({ NODE_ENV: "production", LOCAL_DELIVERY_ENABLED: "true", LOCAL_DELIVERY_RADIUS_KM: "-2" });
    expect(badRadius.config.localDelivery).toBeNull();
    expect(badRadius.issues.join(" ")).toContain("LOCAL_DELIVERY_RADIUS_KM");
    const badStore = parseCheckoutEnv({ NODE_ENV: "production", STORE_LAT: "40.7", STORE_LNG: "-74" });
    expect(badStore.config.store).toEqual({ lat: -34.7212393, lng: -58.2603596 });
    expect(badStore.issues.join(" ")).toContain("STORE_LAT");
    expect(parseCheckoutEnv({ NODE_ENV: "production", STORE_LAT: "-34.70", STORE_LNG: "-58.27" }).config.store).toEqual({ lat: -34.7, lng: -58.27 });
  });

  it("en la simulación local la entrega propia queda habilitada", () => {
    expect(parseCheckoutEnv({ NODE_ENV: "development" }).config).toMatchObject({ demo: true, localDelivery: { radiusKm: 5, cash: false } });
  });

  it("Correo Argentino exige todas sus credenciales y nunca expone secretos en la config pública", () => {
    const partial = parseCheckoutEnv({ NODE_ENV: "production", SHIPPING_CARRIER: "correo_argentino", CORREO_AR_USER: "u" });
    expect(partial.config.carrier).toBeNull();
    expect(partial.issues.join(" ")).toContain("CORREO_AR_PASSWORD");
    const complete = parseCheckoutEnv({ NODE_ENV: "production", SHIPPING_CARRIER: "correo_argentino", CORREO_AR_USER: "u", CORREO_AR_PASSWORD: "clave-secreta", CORREO_AR_CUSTOMER_ID: "1", CORREO_AR_ORIGIN_POSTAL_CODE: "1878" });
    expect(complete.config.carrier).toEqual({ code: "correo_argentino", label: "Correo Argentino" });
    expect(JSON.stringify(complete.config)).not.toContain("clave-secreta");
    expect(parseCheckoutEnv({ NODE_ENV: "production", SHIPPING_CARRIER: "andreani" }).issues.join(" ")).toContain("SHIPPING_CARRIER");
  });
});
