/**
 * Adaptador de la API MiCorreo de Correo Argentino.
 *
 * ⚠️ NINGÚN endpoint está confirmado contra la documentación oficial ni contra credenciales reales: no se
 * consultó la documentación durante esta etapa y todavía no hay usuario de prueba. Se implementó según el
 * esquema público conocido de MiCorreo y se cubre con tests de `fetch` simulado. Al recibir las credenciales
 * de test hay que validar cada punto marcado con TODO(correo) y ajustar este archivo (y solo este).
 *
 * - Autenticación: `POST /token` con Basic (usuario:contraseña) → JWT que se cachea en memoria hasta poco
 *   antes de vencer. TODO(correo): confirmar los nombres `token` y `expire` de la respuesta.
 * - Cotización: `POST /rates` con `customerId`, códigos postales de origen y destino, `deliveredType`
 *   («D» domicilio, «S» sucursal) y `dimensions` en gramos y centímetros. TODO(correo): confirmar el cuerpo
 *   y la respuesta `rates[]` (`productName`, `price`, `deliveryTimeMin`, `deliveryTimeMax`).
 * - Alta del envío: `POST /shipping/import`. TODO(correo): confirmar el cuerpo y si devuelve un número de
 *   seguimiento; hoy se asume que no (el número se genera al procesar el envío en MiCorreo) y la
 *   referencia es nuestro código de pedido (`extOrderId`).
 * - Seguimiento: TODO(correo): endpoint no confirmado; se asume `GET /shipping/tracking?shippingId=…`.
 * - Base de test: TODO(correo): confirmar `https://apitest.correoargentino.com.ar/micorreo/v1`.
 */
import type { Carrier, CarrierQuoteRequest, CarrierRate, CarrierShipment, CarrierShipmentRequest, CarrierTrackingEvent } from "./types";
import { CarrierError } from "./types";

export const CORREO_AR_BASE_URLS = {
  prod: "https://api.correoargentino.com.ar/micorreo/v1",
  test: "https://apitest.correoargentino.com.ar/micorreo/v1",
} as const;

export type CorreoArgentinoConfig = {
  user: string;
  password: string;
  customerId: string;
  originPostalCode: string;
  env: "test" | "prod";
  /** Remitente para el alta del envío. TODO(correo): confirmar qué datos exige `/shipping/import`. */
  sender?: { name: string; phone?: string; email?: string; address?: string } | null;
};

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
type Options = { fetch?: FetchLike; timeoutMs?: number; now?: () => number };

const record = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const list = (value: unknown) => Array.isArray(value) ? value : [];
const text = (value: unknown, max = 160) => typeof value === "string" ? value.trim().slice(0, max) : typeof value === "number" ? String(value) : "";

/** Caché del JWT por ambiente y usuario: el token se reutiliza entre cotizaciones. */
const tokens = new Map<string, { token: string; expires: number }>();
export function clearCorreoArgentinoTokens() { tokens.clear(); }

/** Códigos de provincia de una letra (ISO 3166-2:AR), que usan los transportistas argentinos. */
const provinceCodes: Record<string, string> = {
  "caba": "C", "capital federal": "C", "ciudad autonoma de buenos aires": "C", "buenos aires": "B", "bs as": "B", "pba": "B",
  "catamarca": "K", "chaco": "H", "chubut": "U", "cordoba": "X", "corrientes": "W", "entre rios": "E", "formosa": "P", "jujuy": "Y",
  "la pampa": "L", "la rioja": "F", "mendoza": "M", "misiones": "N", "neuquen": "Q", "rio negro": "R", "salta": "A", "san juan": "J",
  "san luis": "D", "santa cruz": "Z", "santa fe": "S", "santiago del estero": "G", "tierra del fuego": "V", "tucuman": "T",
};
export function provinceCode(province: string) {
  const value = province.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^(pcia|prov|provincia)\.?( de)? /, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  return provinceCodes[value] ?? null;
}

const postalDigits = (postalCode: string) => postalCode.toUpperCase().match(/\d{4}/)?.[0] ?? "";

function estimateLabel(min: unknown, max: unknown) {
  const low = Number(min); const high = Number(max);
  if (Number.isFinite(low) && Number.isFinite(high) && low > 0 && high >= low) return low === high ? `${low} días hábiles` : `${low} a ${high} días hábiles`;
  if (Number.isFinite(high) && high > 0) return `Hasta ${high} días hábiles`;
  return "Plazo informado por Correo Argentino";
}

export function createCorreoArgentinoCarrier(config: CorreoArgentinoConfig, options: Options = {}): Carrier {
  const base = CORREO_AR_BASE_URLS[config.env];
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 8_000;

  async function call(path: string, init: { method: string; headers: Record<string, string>; body?: unknown }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(`${base}${path}`, { method: init.method, headers: { accept: "application/json", ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: controller.signal });
      if (response.status === 401 || response.status === 403) throw new CarrierError("Correo Argentino rechazó las credenciales configuradas.", "auth");
      if (!response.ok) throw new CarrierError(`Correo Argentino respondió con un error (${response.status}).`, "http");
      return record(await response.json().catch(() => ({})));
    } catch (error) {
      if (error instanceof CarrierError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new CarrierError("Correo Argentino no respondió a tiempo.", "timeout");
      throw new CarrierError("No pudimos conectar con Correo Argentino.", "http");
    } finally { clearTimeout(timer); }
  }

  async function token(forceRefresh = false) {
    const key = `${config.env}:${config.user}`;
    const cached = tokens.get(key);
    if (!forceRefresh && cached && cached.expires > now()) return cached.token;
    const basic = Buffer.from(`${config.user}:${config.password}`).toString("base64");
    const body = await call("/token", { method: "POST", headers: { authorization: `Basic ${basic}` } });
    // TODO(correo): confirmar los nombres de campo. Se aceptan las variantes habituales.
    const value = text(body.token ?? body.access_token ?? body.jwt, 4096);
    if (!value) throw new CarrierError("Correo Argentino no devolvió un token de acceso.", "response");
    const expiresAt = Date.parse(text(body.expire ?? body.expires ?? body.expiresAt, 64));
    // Vence un minuto antes que el informado; sin fecha legible se reutiliza por 30 minutos.
    tokens.set(key, { token: value, expires: Number.isFinite(expiresAt) ? Math.min(expiresAt - 60_000, now() + 12 * 60 * 60_000) : now() + 30 * 60_000 });
    return value;
  }

  /** Reintenta una sola vez si el JWT cacheado venció del lado del proveedor. */
  async function authorized(path: string, method: string, body?: unknown) {
    try {
      return await call(path, { method, headers: { authorization: `Bearer ${await token()}` }, body });
    } catch (error) {
      if (!(error instanceof CarrierError) || error.reason !== "auth") throw error;
      return call(path, { method, headers: { authorization: `Bearer ${await token(true)}` }, body });
    }
  }

  return {
    code: "correo_argentino",
    label: "Correo Argentino",

    async quote(request: CarrierQuoteRequest): Promise<CarrierRate[]> {
      const destination = postalDigits(request.destinationPostalCode);
      if (!destination) return [];
      const body = await authorized("/rates", "POST", {
        customerId: config.customerId, postalCodeOrigin: postalDigits(config.originPostalCode), postalCodeDestination: destination,
        // Solo domicilio: el envío a sucursal exige elegir la sucursal, que todavía no tiene UI (Fase futura).
        deliveredType: "D",
        dimensions: { weight: Math.ceil(request.parcel.weightGrams), height: Math.ceil(request.parcel.heightCm), width: Math.ceil(request.parcel.widthCm), length: Math.ceil(request.parcel.lengthCm) },
      });
      return list(body.rates).flatMap((item): CarrierRate[] => {
        const rate = record(item);
        const price = Number(rate.price);
        if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return [];
        const delivered = text(rate.deliveredType, 4) || "D";
        if (delivered !== "D") return [];
        const product = text(rate.productType, 20) || "CP";
        return [{
          serviceId: `${delivered}:${product}`.replace(/[^A-Za-z0-9:_-]/g, ""),
          label: `Correo Argentino a domicilio${text(rate.productName, 60) ? ` · ${text(rate.productName, 60)}` : ""}`,
          priceArs: Math.ceil(price), estimate: estimateLabel(rate.deliveryTimeMin, rate.deliveryTimeMax),
        }];
      });
    },

    async createShipment(request: CarrierShipmentRequest): Promise<CarrierShipment> {
      const province = provinceCode(request.address.province);
      if (!province) throw new CarrierError("No reconocemos la provincia del pedido para Correo Argentino. Revisá la dirección.", "config");
      const [floor, ...rest] = request.address.apartment.split(/\s+/);
      const productType = request.serviceId?.split(":")[1] || "CP";
      const body = await authorized("/shipping/import", "POST", {
        customerId: config.customerId, extOrderId: request.orderId, orderNumber: request.orderCode,
        sender: { name: config.sender?.name ?? "QuilGym", phone: config.sender?.phone ?? "", email: config.sender?.email ?? "", originAddress: config.sender?.address ?? "", postalCode: postalDigits(config.originPostalCode) },
        recipient: { name: request.recipient.name.slice(0, 80), phone: request.recipient.phone.slice(0, 30), cellPhone: request.recipient.phone.slice(0, 30), email: request.recipient.email.slice(0, 120) },
        shipping: {
          deliveryType: "D", productType, agency: null,
          address: { streetName: request.address.street.slice(0, 80), streetNumber: request.address.streetNumber.slice(0, 10), floor: floor?.slice(0, 10) ?? "", apartment: rest.join(" ").slice(0, 10),
            city: request.address.city.slice(0, 60), provinceCode: province, postalCode: postalDigits(request.address.postalCode) },
          weight: Math.ceil(request.parcel.weightGrams), declaredValue: Math.max(0, Math.round(request.declaredValueArs)),
          height: Math.ceil(request.parcel.heightCm), length: Math.ceil(request.parcel.lengthCm), width: Math.ceil(request.parcel.widthCm),
        },
      });
      // TODO(correo): si la API devuelve un número de seguimiento, leerlo acá. Se aceptan nombres probables.
      const tracking = text(body.trackingNumber ?? body.tracking ?? body.shippingId, 40) || null;
      return { carrierShipmentId: tracking ?? request.orderCode, trackingCode: tracking, trackingUrl: null };
    },

    async tracking(reference: string): Promise<CarrierTrackingEvent[]> {
      if (!/^[A-Za-z0-9-]{4,40}$/.test(reference)) return [];
      // TODO(correo): endpoint y formato no confirmados.
      const body = await authorized(`/shipping/tracking?${new URLSearchParams({ shippingId: reference })}`, "GET");
      const events = list(body.events ?? body.tracking ?? record(list(body)[0]).events);
      return events.flatMap((item): CarrierTrackingEvent[] => {
        const event = record(item);
        const occurredAt = new Date(text(event.date ?? event.fecha, 40));
        const description = text(event.event ?? event.description ?? event.evento, 200);
        if (Number.isNaN(occurredAt.getTime()) || !description) return [];
        return [{ occurredAt, status: text(event.status ?? event.estado, 60) || description, description, location: text(event.branch ?? event.sucursal ?? event.location, 120) || null }];
      });
    },
  };
}
