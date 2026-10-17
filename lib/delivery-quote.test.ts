import { describe, expect, it, vi } from "vitest";
import { buildDeliveryOptions, parseQuoteRequest, verifyDeliveryQuote, type DeliveryQuoteDeps, type SignedDeliveryQuote } from "./delivery-quote";
import { addressFingerprint } from "./checkout-security";
import { LOCAL_DELIVERY_LABEL, LOCAL_DELIVERY_NOTE } from "./delivery-labels";
import type { Carrier } from "./carriers/types";
import type { CheckoutConfig, CheckoutInput, CheckoutQuoteRequest } from "./checkout-types";
import { STORE_COORDINATES } from "./store-location";

const config: CheckoutConfig = {
  demo: false, pickup: { address: "San Martín 492", hours: "Lunes a viernes de 7 a 17" },
  shippingRates: [{ id: "pais", label: "Envío nacional", postalCodes: ["*"], priceArs: 4500, estimate: "3 a 5 días hábiles" }],
  payments: { mercadopago: true, transfer: false, cash: true },
  localDelivery: { radiusKm: 5, cash: false }, store: STORE_COORDINATES, carrier: null,
};
const address = { street: "Rivadavia", streetNumber: "500", postalCode: "B1878ABC", city: "Quilmes", province: "Buenos Aires" };
const request: CheckoutQuoteRequest = { delivery: "address", address, hint: null };
const cart = { totalArs: 20_000, fingerprint: "huella-del-carrito" };
const near = { lat: -34.71922054165, lng: -58.2516852994957, label: "13 RIVADAVIA 500, Quilmes" };
const far = { lat: -34.7189648275492, lng: -58.2966073572146 + -0.06, label: "lejos" };

/** La «firma» del test es el JSON en claro: alcanza para inspeccionar qué se firma. */
function deps(overrides: Partial<DeliveryQuoteDeps> = {}): DeliveryQuoteDeps {
  return {
    geocode: vi.fn(async () => ({ status: "ok" as const, candidates: [near] })),
    deliveryTablesReady: vi.fn(async () => true),
    carrier: null,
    parcel: vi.fn(async () => ({ weightGrams: 1000, lengthCm: 20, widthCm: 20, heightCm: 20 })),
    sign: (payload) => JSON.stringify(payload),
    now: () => 1_000_000,
    ...overrides,
  };
}
const signed = (token: string) => JSON.parse(token) as SignedDeliveryQuote;

describe("opciones de entrega para una dirección", () => {
  it("ofrece la entrega propia ($0, costo a convenir) y la tarifa fija, cada una con su firma", async () => {
    const result = await buildDeliveryOptions(config, request, cart, deps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [local, rate] = result.options;
    expect(local).toMatchObject({ delivery: "local", optionId: "local", label: LOCAL_DELIVERY_LABEL, shippingArs: 0, totalArs: 20_000, note: LOCAL_DELIVERY_NOTE });
    expect(local.distanceMeters).toBeGreaterThan(500);
    expect(local.distanceMeters).toBeLessThan(5_000);
    expect(signed(local.token)).toMatchObject({ delivery: "local", optionId: "local", shippingArs: 0, totalArs: 20_000, postalCode: "B1878ABC",
      address: addressFingerprint(address), point: { lat: near.lat, lng: near.lng }, fingerprint: "huella-del-carrito", expires: 1_000_000 + 15 * 60_000 });
    expect(rate).toMatchObject({ delivery: "shipping", optionId: "rate:pais", shippingArs: 4500, totalArs: 24_500 });
  });

  it("no ofrece la entrega propia lejos del local, sin migración, apagada o si Georef falla", async () => {
    const farDeps = deps({ geocode: vi.fn(async () => ({ status: "ok" as const, candidates: [far] })) });
    const onlyRate = (result: Awaited<ReturnType<typeof buildDeliveryOptions>>) => result.ok && result.options.map((option) => option.optionId);
    expect(onlyRate(await buildDeliveryOptions(config, request, cart, farDeps))).toEqual(["rate:pais"]);
    const noTables = deps({ deliveryTablesReady: vi.fn(async () => false) });
    expect(onlyRate(await buildDeliveryOptions(config, request, cart, noTables))).toEqual(["rate:pais"]);
    expect(noTables.geocode).not.toHaveBeenCalled();
    expect(onlyRate(await buildDeliveryOptions({ ...config, localDelivery: null }, request, cart, deps()))).toEqual(["rate:pais"]);
    expect(onlyRate(await buildDeliveryOptions(config, request, cart, deps({ geocode: vi.fn(async () => ({ status: "error" as const })) })))).toEqual(["rate:pais"]);
  });

  it("explica por qué no la ofrece si la calle es ambigua", async () => {
    const ambiguous = deps({ geocode: vi.fn(async () => ({ status: "ok" as const, candidates: [near, far] })) });
    const result = await buildDeliveryOptions(config, request, cart, ambiguous);
    expect(result).toMatchObject({ ok: true, notice: expect.stringContaining("Usar mi ubicación") });
    const hinted = await buildDeliveryOptions(config, { ...request, hint: { lat: near.lat, lng: near.lng } }, cart, ambiguous);
    expect(hinted.ok && hinted.options[0].delivery).toBe("local");
  });

  it("usa la tarifa del transportista y cae a la fija si falla", async () => {
    const carrier: Carrier = { code: "correo_argentino", label: "Correo Argentino", createShipment: vi.fn(), tracking: vi.fn(),
      quote: vi.fn(async () => [{ serviceId: "D:CP", label: "Correo Argentino a domicilio", priceArs: 6100, estimate: "2 a 4 días hábiles" }]) };
    const withCarrier = await buildDeliveryOptions({ ...config, carrier: { code: "correo_argentino", label: "Correo Argentino" } }, request, cart, deps({ carrier }));
    expect(withCarrier.ok && withCarrier.options.map((option) => [option.optionId, option.shippingArs])).toEqual([["local", 0], ["carrier:D:CP", 6100]]);
    expect(withCarrier.ok && signed(withCarrier.options[1].token)).toMatchObject({ carrier: "correo_argentino", serviceId: "D:CP" });
    const broken: Carrier = { ...carrier, quote: vi.fn(async () => { throw new Error("caído"); }) };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fallback = await buildDeliveryOptions(config, request, cart, deps({ carrier: broken }));
    expect(fallback.ok && fallback.options.map((option) => option.optionId)).toEqual(["local", "rate:pais"]);
    warn.mockRestore();
  });

  it("sin ninguna opción devuelve un error explicado", async () => {
    const result = await buildDeliveryOptions({ ...config, shippingRates: [], localDelivery: null }, request, cart, deps());
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("WhatsApp") });
  });

  it("cotiza el retiro como antes", async () => {
    const result = await buildDeliveryOptions(config, { delivery: "pickup" }, cart, deps());
    expect(result.ok && result.options).toEqual([expect.objectContaining({ delivery: "pickup", optionId: "pickup", shippingArs: 0, estimate: "Lunes a viernes de 7 a 17" })]);
  });
});

describe("pedido de cotización del navegador", () => {
  it("valida la dirección y descarta pistas inválidas", () => {
    expect(parseQuoteRequest({ delivery: "pickup" })).toEqual({ delivery: "pickup" });
    expect(parseQuoteRequest({ delivery: "address", address, hint: { lat: -34.7, lng: -58.2 } })).toEqual({ delivery: "address", address, hint: { lat: -34.7, lng: -58.2 } });
    expect(parseQuoteRequest({ delivery: "address", address: { ...address, postalCode: "b 1878abc" }, hint: { lat: 200, lng: 0 } })).toEqual({ delivery: "address", address, hint: null });
    expect(parseQuoteRequest({ delivery: "address", address: { ...address, postalCode: "12" } })).toBeNull();
    expect(parseQuoteRequest({ delivery: "local", address })).toBeNull();
    expect(parseQuoteRequest(null)).toBeNull();
  });
});

describe("revalidación al crear el pedido", () => {
  const input = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({ checkoutKey: "k", quoteToken: "t", name: "N", email: "e@example.com", phone: "1144444444",
    delivery: "local", payment: "mercadopago", paymentChoice: "mercadopago", street: address.street, streetNumber: address.streetNumber, apartment: "", postalCode: address.postalCode,
    city: address.city, province: address.province, notes: "", accepted: true, ...overrides });
  const localQuote = (overrides: Record<string, unknown> = {}) => ({ expires: Date.now() + 60_000, demo: false, delivery: "local", postalCode: address.postalCode, optionId: "local",
    address: addressFingerprint(address), shippingArs: 0, totalArs: 20_000, point: { lat: near.lat, lng: near.lng }, ...overrides });

  it("acepta la entrega propia firmada y recalcula la distancia con el local vigente", () => {
    const verified = verifyDeliveryQuote(config, input(), localQuote(), { localAvailable: true });
    expect(verified).toMatchObject({ optionId: "local", shippingArs: 0, label: LOCAL_DELIVERY_LABEL, point: { lat: near.lat, lng: near.lng } });
    expect(verified.distanceM).toBeGreaterThan(500);
  });

  it("rechaza si cambió la dirección, el radio o falta la migración", () => {
    expect(() => verifyDeliveryQuote(config, input({ streetNumber: "900" }), localQuote(), { localAvailable: true })).toThrow("dirección");
    expect(() => verifyDeliveryQuote({ ...config, localDelivery: { radiusKm: 0.5, cash: false } }, input(), localQuote(), { localAvailable: true })).toThrow("fuera de la zona");
    expect(() => verifyDeliveryQuote(config, input(), localQuote({ point: { lat: far.lat, lng: far.lng } }), { localAvailable: true })).toThrow("fuera de la zona");
    expect(() => verifyDeliveryQuote(config, input(), localQuote(), { localAvailable: false })).toThrow("no está disponible");
    expect(() => verifyDeliveryQuote(config, input(), localQuote({ shippingArs: 100 }), { localAvailable: true })).toThrow();
    expect(() => verifyDeliveryQuote(config, input(), localQuote({ expires: Date.now() - 1 }), { localAvailable: true })).toThrow("venció");
    expect(() => verifyDeliveryQuote(config, input({ delivery: "shipping" }), localQuote(), { localAvailable: true })).toThrow("venció");
  });

  it("acepta el precio firmado del transportista solo con el mismo transportista configurado", () => {
    const quote = { ...localQuote(), delivery: "shipping", optionId: "carrier:D:CP", carrier: "correo_argentino", serviceId: "D:CP", shippingArs: 6100, label: "Correo Argentino a domicilio", estimate: "2 a 4 días" };
    const withCarrier = { ...config, carrier: { code: "correo_argentino" as const, label: "Correo Argentino" } };
    expect(verifyDeliveryQuote(withCarrier, input({ delivery: "shipping" }), quote, { localAvailable: true })).toMatchObject({ shippingArs: 6100, carrier: "correo_argentino", serviceId: "D:CP" });
    expect(() => verifyDeliveryQuote(config, input({ delivery: "shipping" }), quote, { localAvailable: true })).toThrow("venció");
  });

  it("recalcula la tarifa fija y acepta cotizaciones anteriores a este cambio", () => {
    const rateQuote = { ...localQuote(), delivery: "shipping", optionId: "rate:pais", shippingArs: 4500 };
    expect(verifyDeliveryQuote(config, input({ delivery: "shipping" }), rateQuote, { localAvailable: false })).toMatchObject({ shippingArs: 4500, optionId: "rate:pais" });
    expect(() => verifyDeliveryQuote(config, input({ delivery: "shipping" }), { ...rateQuote, optionId: "rate:otra" }, { localAvailable: false })).toThrow("tarifa");
    const legacy = { expires: Date.now() + 60_000, demo: false, delivery: "shipping", postalCode: address.postalCode, shippingArs: 4500, totalArs: 24_500 };
    expect(verifyDeliveryQuote(config, input({ delivery: "shipping" }), legacy, { localAvailable: false })).toMatchObject({ shippingArs: 4500 });
  });
});
