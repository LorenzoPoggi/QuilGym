import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearCorreoArgentinoTokens, CORREO_AR_BASE_URLS, createCorreoArgentinoCarrier, provinceCode } from "./correo-argentino";
import { CarrierError } from "./types";
import { getCarrier } from ".";

// Todo con fetch simulado: los endpoints de MiCorreo no están confirmados (ver TODO(correo) en el adaptador).
const config = { user: "usuario-test", password: "clave-test", customerId: "0001234567", originPostalCode: "B1878ABC", env: "test" as const };
const parcel = { weightGrams: 1_250, lengthCm: 25, widthCm: 15, heightCm: 15.2 };
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function fakeFetch(handlers: Record<string, (init: { method: string; headers: Record<string, string>; body?: string }) => ReturnType<typeof reply>>) {
  return vi.fn(async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
    const path = url.replace(CORREO_AR_BASE_URLS.test, "").split("?")[0];
    const handler = handlers[path];
    if (!handler) throw new Error(`sin handler para ${path}`);
    return handler(init);
  });
}

const token = () => reply(200, { token: "jwt-1", expire: new Date(Date.now() + 3_600_000).toISOString() });

describe("Correo Argentino (MiCorreo)", () => {
  beforeEach(() => clearCorreoArgentinoTokens());

  it("obtiene el JWT con Basic y lo reutiliza entre cotizaciones", async () => {
    const fetch = fakeFetch({
      "/token": token,
      "/rates": () => reply(200, { rates: [{ deliveredType: "D", productType: "CP", productName: "Clásico", price: 5321.4, deliveryTimeMin: "2", deliveryTimeMax: "5" }] }),
    });
    const carrier = createCorreoArgentinoCarrier(config, { fetch });
    const first = await carrier.quote({ destinationPostalCode: "C1425ABC", parcel, declaredValueArs: 50_000 });
    await carrier.quote({ destinationPostalCode: "5000", parcel, declaredValueArs: 50_000 });
    expect(first).toEqual([{ serviceId: "D:CP", label: "Correo Argentino a domicilio · Clásico", priceArs: 5322, estimate: "2 a 5 días hábiles" }]);
    const tokenCalls = fetch.mock.calls.filter(([url]) => url.endsWith("/token"));
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0][1].headers.authorization).toBe(`Basic ${Buffer.from("usuario-test:clave-test").toString("base64")}`);
    const rateCall = fetch.mock.calls.find(([url]) => url.endsWith("/rates"))!;
    expect(rateCall[1].headers.authorization).toBe("Bearer jwt-1");
    expect(JSON.parse(rateCall[1].body!)).toEqual({ customerId: "0001234567", postalCodeOrigin: "1878", postalCodeDestination: "1425", deliveredType: "D",
      dimensions: { weight: 1250, height: 16, width: 15, length: 25 } });
  });

  it("ignora tarifas inválidas o de sucursal", async () => {
    const fetch = fakeFetch({ "/token": token, "/rates": () => reply(200, { rates: [
      { deliveredType: "S", productType: "CP", price: 3000 },
      { deliveredType: "D", productType: "CP", price: "no" },
      { deliveredType: "D", productType: "EP", price: -1 },
      { deliveredType: "D", productType: "EP", productName: "Expreso", price: 9000 },
    ] }) });
    const rates = await createCorreoArgentinoCarrier(config, { fetch }).quote({ destinationPostalCode: "1878", parcel, declaredValueArs: 1 });
    expect(rates).toEqual([{ serviceId: "D:EP", label: "Correo Argentino a domicilio · Expreso", priceArs: 9000, estimate: "Plazo informado por Correo Argentino" }]);
  });

  it("renueva el token una vez si el proveedor lo rechaza", async () => {
    let issued = 0;
    const fetch = fakeFetch({
      "/token": () => reply(200, { token: `jwt-${++issued}` }),
      "/rates": (init) => init.headers.authorization === "Bearer jwt-1" ? reply(401, {}) : reply(200, { rates: [] }),
    });
    expect(await createCorreoArgentinoCarrier(config, { fetch }).quote({ destinationPostalCode: "1878", parcel, declaredValueArs: 1 })).toEqual([]);
    expect(issued).toBe(2);
  });

  it("traduce errores sin exponer credenciales ni cuerpos", async () => {
    const auth = createCorreoArgentinoCarrier(config, { fetch: fakeFetch({ "/token": () => reply(401, { message: "secreto" }) }) });
    await expect(auth.quote({ destinationPostalCode: "1878", parcel, declaredValueArs: 1 })).rejects.toMatchObject({ reason: "auth" });
    const server = createCorreoArgentinoCarrier(config, { fetch: fakeFetch({ "/token": token, "/rates": () => reply(500, {}) }) });
    const error = await server.quote({ destinationPostalCode: "1878", parcel, declaredValueArs: 1 }).catch((caught) => caught);
    expect(error).toBeInstanceOf(CarrierError);
    expect(error.message).not.toContain("clave-test");
    clearCorreoArgentinoTokens();
    const noToken = createCorreoArgentinoCarrier(config, { fetch: fakeFetch({ "/token": () => reply(200, {}) }) });
    await expect(noToken.quote({ destinationPostalCode: "1878", parcel, declaredValueArs: 1 })).rejects.toMatchObject({ reason: "response" });
  });

  it("corta por timeout", async () => {
    const fetch = vi.fn((_url: string, init: { signal?: AbortSignal }) => new Promise<never>((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    await expect(createCorreoArgentinoCarrier(config, { fetch, timeoutMs: 20 }).quote({ destinationPostalCode: "1878", parcel, declaredValueArs: 1 })).rejects.toMatchObject({ reason: "timeout" });
  });

  it("da de alta el envío con la dirección, el peso y el código del pedido", async () => {
    const fetch = fakeFetch({ "/token": token, "/shipping/import": () => reply(200, { createdAt: "2026-10-17T10:00:00Z" }) });
    const created = await createCorreoArgentinoCarrier(config, { fetch }).createShipment({
      orderId: "00000000-0000-4000-8000-000000000001", orderCode: "QG-00000000", serviceId: "D:CP",
      recipient: { name: "Cliente", email: "cliente@example.com", phone: "1144444444" },
      address: { street: "Rivadavia", streetNumber: "500", apartment: "3 B", postalCode: "B1878ABC", city: "Quilmes", province: "Buenos Aires" },
      parcel, declaredValueArs: 25_000,
    });
    // Sin número de seguimiento en la respuesta, la referencia es nuestro código de pedido.
    expect(created).toEqual({ carrierShipmentId: "QG-00000000", trackingCode: null, trackingUrl: null });
    const body = JSON.parse(fetch.mock.calls.find(([url]) => url.endsWith("/shipping/import"))![1].body!);
    expect(body).toMatchObject({ customerId: "0001234567", extOrderId: "00000000-0000-4000-8000-000000000001", orderNumber: "QG-00000000",
      shipping: { deliveryType: "D", productType: "CP", weight: 1250, declaredValue: 25000, address: { streetName: "Rivadavia", streetNumber: "500", floor: "3", apartment: "B", provinceCode: "B", postalCode: "1878" } } });
  });

  it("exige una provincia reconocible para el alta", async () => {
    const carrier = createCorreoArgentinoCarrier(config, { fetch: fakeFetch({ "/token": token }) });
    await expect(carrier.createShipment({ orderId: "x", orderCode: "QG-1", serviceId: null, recipient: { name: "a", email: "b", phone: "c" },
      address: { street: "a", streetNumber: "1", apartment: "", postalCode: "1878", city: "Quilmes", province: "Narnia" }, parcel, declaredValueArs: 1 })).rejects.toMatchObject({ reason: "config" });
    expect(provinceCode("Pcia. de Córdoba")).toBe("X");
    expect(provinceCode("CABA")).toBe("C");
  });

  it("lee eventos de seguimiento con formato defensivo", async () => {
    const fetch = fakeFetch({ "/token": token, "/shipping/tracking": () => reply(200, { events: [
      { date: "2026-10-17T09:00:00-03:00", event: "En distribución", branch: "CDD Quilmes" },
      { date: "fecha rota", event: "Ignorado" },
    ] }) });
    const events = await createCorreoArgentinoCarrier(config, { fetch }).tracking("QG-00000000");
    expect(events).toEqual([{ occurredAt: new Date("2026-10-17T09:00:00-03:00"), status: "En distribución", description: "En distribución", location: "CDD Quilmes" }]);
    expect(await createCorreoArgentinoCarrier(config, { fetch }).tracking("bad ref!")).toEqual([]);
  });
});

describe("selección del transportista", () => {
  const complete = { SHIPPING_CARRIER: "correo_argentino", CORREO_AR_USER: "u", CORREO_AR_PASSWORD: "p", CORREO_AR_CUSTOMER_ID: "1", CORREO_AR_ORIGIN_POSTAL_CODE: "1878" };
  it("sin variables no hay transportista (tarifa fija)", () => expect(getCarrier({})).toBeNull());
  it("con credenciales completas usa Correo Argentino", () => expect(getCarrier(complete)?.code).toBe("correo_argentino"));
  it("si falta una credencial queda apagado", () => expect(getCarrier({ ...complete, CORREO_AR_PASSWORD: "" })).toBeNull());
  it("el simulado nunca funciona en producción", () => {
    expect(getCarrier({ SHIPPING_CARRIER: "mock", NODE_ENV: "development" })?.code).toBe("mock");
    expect(getCarrier({ SHIPPING_CARRIER: "mock", NODE_ENV: "production" })).toBeNull();
  });
});
