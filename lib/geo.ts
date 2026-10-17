/**
 * Geocodificación de direcciones argentinas con la API Georef del Estado (apis.datos.gob.ar/georef), gratuita y
 * sin clave, y distancia por haversine. Sin `server-only` para poder probarla, pero solo la llama el servidor:
 * la elegibilidad de la entrega propia nunca depende de coordenadas que mande el navegador.
 *
 * Formato verificado con consultas reales (17/10/2026):
 * - `/localidades?nombre=Bernal&provincia=06` → `{ localidades: [{ id, nombre, departamento: { id, nombre } }] }`.
 * - `/direcciones?direccion=San Martin 492&provincia=06&departamento=06658` →
 *   `{ direcciones: [{ nomenclatura, ubicacion: { lat, lon }, departamento, localidad_censal }] }`.
 * Una misma calle puede repetirse dentro del partido (en Quilmes hay varias «San Martín»): por eso se devuelven
 * todos los candidatos y la decisión queda en `lib/delivery-options.ts`.
 */
import type { Coordinates } from "./store-location";

export const GEOREF_BASE_URL = "https://apis.datos.gob.ar/georef/api";
const DEFAULT_TIMEOUT_MS = 4_000;
const CACHE_TTL_MS = 24 * 60 * 60_000;
const CACHE_MAX_ENTRIES = 200;

export type AddressToGeocode = { street: string; streetNumber: string; city: string; province: string };
export type GeocodeCandidate = Coordinates & { label: string };
export type GeocodeResult =
  | { status: "ok"; candidates: GeocodeCandidate[] }
  | { status: "not_found" }
  | { status: "error" };

type FetchLike = (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

const EARTH_RADIUS_M = 6_371_008.8;

/** Distancia en metros entre dos puntos (fórmula de haversine sobre la esfera media). */
export function distanceMeters(a: Coordinates, b: Coordinates) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const isValidCoordinates = (value: unknown): value is Coordinates => {
  const point = value as Partial<Coordinates> | null;
  return !!point && typeof point.lat === "number" && typeof point.lng === "number"
    && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
};

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Georef acepta el nombre o el id de provincia. Los alias más comunes de Buenos Aires y CABA van por id. */
export function georefProvince(province: string) {
  const value = plain(province).replace(/^(pcia|prov|provincia)( de)? /, "");
  if (["buenos aires", "bs as", "bsas", "ba", "pba", "gba", "bs as provincia"].includes(value)) return "06";
  if (["caba", "capital federal", "capital", "ciudad autonoma de buenos aires", "ciudad de buenos aires", "cdad autonoma de buenos aires"].includes(value)) return "02";
  return province.trim().slice(0, 60);
}

/** Calle y altura en el formato que entiende Georef («San Martin 492»). La altura conserva solo dígitos. */
export function georefStreet(street: string, streetNumber: string) {
  const number = streetNumber.replace(/\D/g, "").slice(0, 6);
  return `${street.trim().replace(/\s+/g, " ").slice(0, 120)} ${number}`.trim();
}

/** Caché LRU en memoria por dirección normalizada: evita repetir consultas al recalcular la cotización. */
class LruCache<V> {
  private entries = new Map<string, { value: V; expires: number }>();
  constructor(private max: number, private ttl: number) {}
  get(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expires < Date.now()) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: V) {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: Date.now() + this.ttl });
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value!);
  }
  clear() { this.entries.clear(); }
}

const cache = new LruCache<GeocodeResult>(CACHE_MAX_ENTRIES, CACHE_TTL_MS);
export function clearGeocodeCache() { cache.clear(); }

const record = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const list = (value: unknown) => Array.isArray(value) ? value : [];

/**
 * Geocodifica calle + altura dentro de la localidad indicada. Primero resuelve la localidad a su partido
 * (`/localidades`), porque el nombre que escribe el cliente («Bernal», «Quilmes Oeste») no siempre es la
 * localidad censal de Georef; después busca la dirección en hasta 3 partidos. Timeout total de 4 s.
 * Un error de red o de la API devuelve `error` (no se cachea); una dirección inexistente, `not_found`.
 */
export async function geocodeAddress(address: AddressToGeocode, options: { fetch?: FetchLike; timeoutMs?: number; baseUrl?: string } = {}): Promise<GeocodeResult> {
  const direccion = georefStreet(address.street, address.streetNumber);
  const province = georefProvince(address.province);
  const city = address.city.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!/\d/.test(direccion) || direccion.length < 3 || !province || !city) return { status: "not_found" };
  const key = `${plain(direccion)}|${plain(province)}|${plain(city)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const base = options.baseUrl ?? GEOREF_BASE_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const get = async (path: string, params: Record<string, string>) => {
    const response = await doFetch(`${base}${path}?${new URLSearchParams(params)}`, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("georef_http");
    return record(await response.json());
  };
  try {
    const localities = list((await get("/localidades", { nombre: city, provincia: province, max: "5", campos: "id,nombre,departamento.id" })).localidades);
    const departments = [...new Set(localities.map((item) => record(record(item).departamento).id).filter((id): id is string => typeof id === "string" && /^\d{2,8}$/.test(id)))].slice(0, 3);
    if (!departments.length) {
      const result: GeocodeResult = { status: "not_found" };
      cache.set(key, result);
      return result;
    }
    const responses = await Promise.all(departments.map((departamento) => get("/direcciones", { direccion, provincia: province, departamento, max: "5", campos: "nomenclatura,ubicacion" })));
    const seen = new Set<string>();
    const candidates: GeocodeCandidate[] = [];
    for (const item of responses.flatMap((response) => list(response.direcciones))) {
      const entry = record(item);
      const location = record(entry.ubicacion);
      const point = { lat: Number(location.lat), lng: Number(location.lon) };
      if (location.lat === null || location.lon === null || !isValidCoordinates(point)) continue;
      const id = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      candidates.push({ ...point, label: typeof entry.nomenclatura === "string" ? entry.nomenclatura.slice(0, 160) : direccion });
    }
    const result: GeocodeResult = candidates.length ? { status: "ok", candidates } : { status: "not_found" };
    cache.set(key, result);
    return result;
  } catch {
    return { status: "error" };
  } finally {
    clearTimeout(timer);
  }
}
