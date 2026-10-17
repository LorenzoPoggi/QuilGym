import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearGeocodeCache, distanceMeters, geocodeAddress, georefProvince, georefStreet } from "./geo";
import { STORE_COORDINATES } from "./store-location";

const json = (body: unknown, ok = true) => ({ ok, json: async () => body });
const address = { street: "San Martín", streetNumber: "492", city: "Bernal", province: "Buenos Aires" };

/** Respuestas con el formato real de Georef (verificado el 17/10/2026). */
function georefFetch(direcciones: unknown[]) {
  return vi.fn(async (url: string) => {
    if (url.includes("/localidades?")) return json({ cantidad: 1, localidades: [{ id: "0665801001", nombre: "Bernal", departamento: { id: "06658", nombre: "Quilmes" } }] });
    return json({ cantidad: direcciones.length, direcciones });
  });
}

describe("distanceMeters", () => {
  it("es cero para el mismo punto y simétrica", () => {
    expect(distanceMeters(STORE_COORDINATES, STORE_COORDINATES)).toBe(0);
    const other = { lat: -34.7586, lng: -58.2971 };
    expect(distanceMeters(STORE_COORDINATES, other)).toBeCloseTo(distanceMeters(other, STORE_COORDINATES), 6);
  });
  it("mide distancias conocidas con error menor al 1 %", () => {
    // Un grado de latitud ≈ 111,2 km.
    expect(distanceMeters({ lat: -34, lng: -58 }, { lat: -35, lng: -58 })).toBeGreaterThan(110_500);
    expect(distanceMeters({ lat: -34, lng: -58 }, { lat: -35, lng: -58 })).toBeLessThan(111_800);
    // Quilmes centro → otra «San Martín 492» del partido (≈ 5,3 km).
    const meters = distanceMeters(STORE_COORDINATES, { lat: -34.75858112469113, lng: -58.29707383678911 });
    expect(meters).toBeGreaterThan(5_000);
    expect(meters).toBeLessThan(5_600);
  });
});

describe("normalización para Georef", () => {
  it("convierte los alias de Buenos Aires y CABA en el id de provincia", () => {
    expect(georefProvince("Buenos Aires")).toBe("06");
    expect(georefProvince("Bs. As.")).toBe("06");
    expect(georefProvince("Provincia de Buenos Aires")).toBe("06");
    expect(georefProvince("CABA")).toBe("02");
    expect(georefProvince("Córdoba")).toBe("Córdoba");
  });
  it("deja solo dígitos en la altura", () => expect(georefStreet("  San   Martín ", "492 bis")).toBe("San Martín 492"));
});

describe("geocodeAddress", () => {
  beforeEach(() => clearGeocodeCache());

  it("resuelve la localidad a su partido y devuelve todos los candidatos con coordenadas", async () => {
    const fetch = georefFetch([
      { nomenclatura: "52 SAN MARTIN 492, Quilmes, Buenos Aires", ubicacion: { lat: -34.72134490109449, lon: -58.26038756341317 } },
      { nomenclatura: "828 SAN MARTIN 492, Quilmes, Buenos Aires", ubicacion: { lat: -34.75858112469113, lon: -58.29707383678911 } },
      { nomenclatura: "Sin ubicación", ubicacion: { lat: null, lon: null } },
    ]);
    const result = await geocodeAddress(address, { fetch });
    expect(result).toEqual({ status: "ok", candidates: [
      { lat: -34.72134490109449, lng: -58.26038756341317, label: "52 SAN MARTIN 492, Quilmes, Buenos Aires" },
      { lat: -34.75858112469113, lng: -58.29707383678911, label: "828 SAN MARTIN 492, Quilmes, Buenos Aires" },
    ] });
    const urls = fetch.mock.calls.map(([url]) => new URL(url));
    expect(urls[0].pathname).toBe("/georef/api/localidades");
    expect(urls[0].searchParams.get("nombre")).toBe("Bernal");
    expect(urls[0].searchParams.get("provincia")).toBe("06");
    expect(urls[1].searchParams.get("direccion")).toBe("San Martín 492");
    expect(urls[1].searchParams.get("departamento")).toBe("06658");
  });

  it("cachea por dirección normalizada", async () => {
    const fetch = georefFetch([{ nomenclatura: "X", ubicacion: { lat: -34.72, lon: -58.26 } }]);
    await geocodeAddress(address, { fetch });
    await geocodeAddress({ ...address, street: "san martin", city: " BERNAL " }, { fetch });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("informa not_found si la localidad o la calle no existen", async () => {
    expect(await geocodeAddress(address, { fetch: georefFetch([]) })).toEqual({ status: "not_found" });
    clearGeocodeCache();
    const noLocality = vi.fn(async () => json({ cantidad: 0, localidades: [] }));
    expect(await geocodeAddress(address, { fetch: noLocality })).toEqual({ status: "not_found" });
    expect(noLocality).toHaveBeenCalledTimes(1);
    expect(await geocodeAddress({ ...address, streetNumber: "s/n" }, { fetch: noLocality })).toEqual({ status: "not_found" });
  });

  it("ante errores de red o HTTP devuelve error y no lo cachea", async () => {
    const failing = vi.fn(async () => json({ errores: [] }, false));
    expect(await geocodeAddress(address, { fetch: failing })).toEqual({ status: "error" });
    const thrown = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect(await geocodeAddress(address, { fetch: thrown })).toEqual({ status: "error" });
    const ok = georefFetch([{ nomenclatura: "X", ubicacion: { lat: -34.72, lon: -58.26 } }]);
    expect((await geocodeAddress(address, { fetch: ok })).status).toBe("ok");
  });

  it("corta a los 4 s (timeout configurable)", async () => {
    const hanging = vi.fn((_url: string, init?: { signal?: AbortSignal }) => new Promise<never>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }));
    expect(await geocodeAddress(address, { fetch: hanging, timeoutMs: 20 })).toEqual({ status: "error" });
  });
});
