/**
 * Opciones de entrega que se cotizan en el checkout y su revalidación al crear el pedido.
 *
 * - Retiro: como antes.
 * - Dirección: entrega propia (si la dirección geocodificada está dentro del radio), transportista con API
 *   (si está configurado y responde) o, si no, la tarifa fija de `SHIPPING_RATES_JSON`.
 *
 * Cada opción lleva su propia cotización firmada (HMAC con el id del carrito, 15 min) con la opción, el precio,
 * la huella de la dirección y, para la entrega propia, el punto y la distancia calculados por el servidor.
 * Sin `server-only`: las dependencias con red o base se inyectan para poder probarlo.
 */
import { addressFingerprint } from "./checkout-security";
import { evaluateLocalDelivery, withinLocalRadius, type LocalEligibility } from "./delivery-options";
import { LOCAL_DELIVERY_ESTIMATE, LOCAL_DELIVERY_LABEL, LOCAL_DELIVERY_NOTE, LOCAL_DELIVERY_OPTION_ID } from "./delivery-labels";
import { normalizePostalCode, POSTAL_CODE_PATTERN, quoteDelivery } from "./checkout-validation";
import type { GeocodeResult } from "./geo";
import type { Carrier } from "./carriers/types";
import type { Parcel } from "./shipping-defaults";
import { STORE_COORDINATES, type Coordinates } from "./store-location";
import type { CheckoutConfig, CheckoutInput, CheckoutQuote, CheckoutQuoteRequest, DeliveryMethod } from "./checkout-types";

export const QUOTE_TTL_MS = 15 * 60_000;

/** Contenido firmado de una cotización. El cliente lo ve en base64, pero no puede alterarlo sin invalidar la firma. */
export type SignedDeliveryQuote = {
  expires: number; demo: boolean; fingerprint: string; shippingArs: number; totalArs: number;
  delivery: DeliveryMethod; postalCode: string; optionId: string; label: string; estimate: string;
  /** Huella de la dirección (vacía en retiro). */
  address: string;
  carrier?: string; serviceId?: string;
  point?: Coordinates; distanceM?: number;
};

export type DeliveryQuoteDeps = {
  geocode: (address: { street: string; streetNumber: string; city: string; province: string }) => Promise<GeocodeResult>;
  /** true si la migración 0010 está aplicada (la entrega propia necesita `order_delivery` y el valor `local`). */
  deliveryTablesReady: () => Promise<boolean>;
  carrier: Carrier | null;
  parcel: () => Promise<Parcel>;
  sign: (payload: SignedDeliveryQuote) => string;
  now?: () => number;
};

type Address = Extract<CheckoutQuoteRequest, { delivery: "address" }>["address"];
type BuildResult = { ok: true; options: CheckoutQuote[]; notice?: string } | { ok: false; error: string; notice?: string };

const field = (value: unknown, min: number, max: number) => typeof value === "string" && value.trim().length >= min && value.trim().length <= max && !/[\u0000-\u001f]/.test(value) ? value.trim() : null;

/** Valida el pedido de cotización que llega del navegador con los mismos límites que `validateCheckout`. */
export function parseQuoteRequest(raw: unknown): CheckoutQuoteRequest | null {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  if (input.delivery === "pickup") return { delivery: "pickup" };
  if (input.delivery !== "address") return null;
  const address = input.address && typeof input.address === "object" ? input.address as Record<string, unknown> : {};
  const street = field(address.street, 2, 160); const streetNumber = field(address.streetNumber, 1, 12);
  const city = field(address.city, 2, 100); const province = field(address.province, 2, 100);
  const postalCode = typeof address.postalCode === "string" && address.postalCode.length <= 12 ? normalizePostalCode(address.postalCode) : "";
  if (!street || !streetNumber || !city || !province || !POSTAL_CODE_PATTERN.test(postalCode)) return null;
  const hint = input.hint && typeof input.hint === "object" ? input.hint as Record<string, unknown> : null;
  const lat = Number(hint?.lat); const lng = Number(hint?.lng);
  const validHint = hint && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  return { delivery: "address", address: { street, streetNumber, postalCode, city, province }, hint: validHint };
}

const localNotices: Partial<Record<Extract<LocalEligibility, { eligible: false }>["reason"], string>> = {
  ambiguous: "Encontramos más de una calle con ese nombre en la zona. Si estás cerca de Quilmes, tocá «Usar mi ubicación» y volvé a calcular para ver si llegamos con la entrega propia.",
  not_found: "No pudimos ubicar la dirección en el mapa, así que no podemos ofrecer la entrega propia. Revisá calle, número y localidad.",
  unavailable: undefined,
};

/** Arma las opciones de una dirección o del retiro. `subtotalArs` es el total del carrito recalculado en el servidor. */
export async function buildDeliveryOptions(config: CheckoutConfig, request: CheckoutQuoteRequest, cart: { totalArs: number; fingerprint: string }, deps: DeliveryQuoteDeps): Promise<BuildResult> {
  const now = deps.now ?? Date.now;
  const base = { expires: now() + QUOTE_TTL_MS, demo: config.demo, fingerprint: cart.fingerprint };
  const option = (payload: Omit<SignedDeliveryQuote, "expires" | "demo" | "fingerprint" | "totalArs">, extra: Partial<CheckoutQuote> = {}): CheckoutQuote => {
    const totalArs = cart.totalArs + payload.shippingArs;
    const token = deps.sign({ ...base, ...payload, totalArs });
    return { token, shippingArs: payload.shippingArs, totalArs, label: payload.label, estimate: payload.estimate, optionId: payload.optionId, delivery: payload.delivery, ...extra };
  };

  if (request.delivery === "pickup") {
    if (!config.pickup) return { ok: false, error: "El retiro todavía no está disponible." };
    const pickup = quoteDelivery(config, "pickup", "");
    return { ok: true, options: [option({ delivery: "pickup", postalCode: "", optionId: "pickup", label: pickup.label, estimate: pickup.estimate, shippingArs: 0, address: "" })] };
  }

  const address: Address = request.address;
  const fingerprint = addressFingerprint(address);
  const options: CheckoutQuote[] = [];
  let notice: string | undefined;

  // 1) Entrega propia: el servidor geocodifica y decide; la ubicación del navegador solo desempata candidatos.
  if (config.localDelivery && await deps.deliveryTablesReady().catch(() => false)) {
    const geocoded = await deps.geocode(address).catch((): GeocodeResult => ({ status: "error" }));
    const store = config.store ?? STORE_COORDINATES;
    const verdict: LocalEligibility = geocoded.status === "ok"
      ? evaluateLocalDelivery(geocoded.candidates, store, config.localDelivery.radiusKm, request.hint)
      : { eligible: false, reason: geocoded.status === "not_found" ? "not_found" : "unavailable" };
    if (verdict.eligible) {
      options.push(option({ delivery: "local", postalCode: address.postalCode, optionId: LOCAL_DELIVERY_OPTION_ID, label: LOCAL_DELIVERY_LABEL, estimate: LOCAL_DELIVERY_ESTIMATE,
        shippingArs: 0, address: fingerprint, point: verdict.point, distanceM: verdict.distanceMeters }, { distanceMeters: verdict.distanceMeters, note: LOCAL_DELIVERY_NOTE }));
    } else if (verdict.reason !== "out_of_range") notice = localNotices[verdict.reason];
  }

  // 2) Transportista con API; si falla o no devuelve tarifas, 3) tarifa fija.
  let carrierQuoted = false;
  if (deps.carrier) {
    try {
      const rates = await deps.carrier.quote({ destinationPostalCode: address.postalCode, parcel: await deps.parcel(), declaredValueArs: cart.totalArs });
      for (const rate of rates.slice(0, 3)) {
        options.push(option({ delivery: "shipping", postalCode: address.postalCode, optionId: `carrier:${rate.serviceId}`, label: rate.label, estimate: rate.estimate,
          shippingArs: rate.priceArs, address: fingerprint, carrier: deps.carrier.code, serviceId: rate.serviceId }));
        carrierQuoted = true;
      }
    } catch (error) {
      console.warn("[Envíos] El transportista no cotizó; se usa la tarifa fija", { carrier: deps.carrier.code, reason: error instanceof Error ? error.name : "error" });
    }
  }
  if (!carrierQuoted && config.shippingRates.length) {
    try {
      const rate = quoteDelivery(config, "shipping", address.postalCode);
      options.push(option({ delivery: "shipping", postalCode: address.postalCode, optionId: `rate:${rate.rateId}`, label: rate.label, estimate: rate.estimate, shippingArs: rate.shippingArs, address: fingerprint }));
    } catch (error) {
      if (!options.length) return { ok: false, error: error instanceof Error ? error.message : "No pudimos cotizar el envío.", notice };
    }
  }
  if (!options.length) return { ok: false, error: "Todavía no tenemos una forma de entrega para esa dirección. Consultanos por WhatsApp.", notice };
  return { ok: true, options, notice };
}

export type VerifiedDelivery = { shippingArs: number; label: string; estimate: string; optionId: string; point: Coordinates | null; distanceM: number | null; carrier: string | null; serviceId: string | null };

/**
 * Revalida en `createOrder` la cotización firmada contra el pedido y la configuración vigente. Lanza un Error con
 * un mensaje para el cliente si algo no coincide. No hace red: el precio del transportista vale por la firma.
 */
export function verifyDeliveryQuote(config: CheckoutConfig, input: CheckoutInput, quote: Record<string, unknown> | null, options: { localAvailable: boolean; now?: number }): VerifiedDelivery {
  const now = options.now ?? Date.now();
  const expired = "La cotización venció. Volvé a calcular la entrega.";
  if (!quote || typeof quote.expires !== "number" || quote.expires < now || quote.delivery !== input.delivery || quote.postalCode !== input.postalCode || quote.demo !== config.demo) throw new Error(expired);
  // Cotizaciones emitidas antes de este cambio (sin `optionId`): mismas reglas que antes.
  const optionId = typeof quote.optionId === "string" ? quote.optionId : null;
  if (input.delivery === "pickup") {
    const pickup = quoteDelivery(config, "pickup", "");
    return { ...pickup, optionId: "pickup", point: null, distanceM: null, carrier: null, serviceId: null };
  }
  const fingerprint = addressFingerprint(input);
  if (optionId && quote.address !== fingerprint) throw new Error("Cambiaste la dirección. Volvé a calcular la entrega.");
  if (input.delivery === "local") {
    if (!config.localDelivery || !options.localAvailable) throw new Error("La entrega en Quilmes no está disponible en este momento. Elegí otra forma de entrega.");
    const distance = withinLocalRadius(quote.point, config.store ?? STORE_COORDINATES, config.localDelivery.radiusKm);
    if (optionId !== LOCAL_DELIVERY_OPTION_ID || distance === null || quote.shippingArs !== 0) throw new Error("La dirección quedó fuera de la zona de entrega propia. Volvé a calcular la entrega.");
    const point = quote.point as Coordinates;
    return { shippingArs: 0, label: LOCAL_DELIVERY_LABEL, estimate: LOCAL_DELIVERY_ESTIMATE, optionId, point: { lat: point.lat, lng: point.lng }, distanceM: distance, carrier: null, serviceId: null };
  }
  if (optionId?.startsWith("carrier:")) {
    if (!config.carrier || quote.carrier !== config.carrier.code || !Number.isSafeInteger(quote.shippingArs) || (quote.shippingArs as number) < 0
      || typeof quote.label !== "string" || typeof quote.estimate !== "string") throw new Error(expired);
    return { shippingArs: quote.shippingArs as number, label: quote.label.slice(0, 120), estimate: quote.estimate.slice(0, 120), optionId, point: null, distanceM: null, carrier: config.carrier.code, serviceId: typeof quote.serviceId === "string" ? quote.serviceId.slice(0, 40) : null };
  }
  // Tarifa fija: se recalcula con la configuración vigente.
  const rate = quoteDelivery(config, "shipping", input.postalCode);
  if (optionId && optionId !== `rate:${rate.rateId}`) throw new Error("Cambió la tarifa de envío. Volvé a calcular la entrega.");
  return { shippingArs: rate.shippingArs, label: rate.label, estimate: rate.estimate, optionId: optionId ?? `rate:${rate.rateId}`, point: null, distanceM: null, carrier: null, serviceId: null };
}
