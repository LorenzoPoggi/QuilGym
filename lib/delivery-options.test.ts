import { describe, expect, it } from "vitest";
import { evaluateLocalDelivery, withinLocalRadius } from "./delivery-options";
import { formatDistance } from "./delivery-labels";
import { STORE_COORDINATES } from "./store-location";

const store = STORE_COORDINATES;
const near = { lat: -34.72134490109449, lng: -58.26038756341317, label: "52 SAN MARTIN 492" };
const alsoNear = { lat: -34.709364029041716, lng: -58.28121707337517, label: "140 SAN MARTIN 492" };
const far = { lat: -34.75858112469113, lng: -58.29707383678911, label: "828 SAN MARTIN 492" };

describe("elegibilidad de la entrega propia", () => {
  it("es elegible si todos los candidatos están dentro del radio, con la distancia del más lejano", () => {
    const verdict = evaluateLocalDelivery([near, alsoNear], store, 5);
    expect(verdict.eligible).toBe(true);
    if (verdict.eligible) {
      expect(verdict.point).toEqual({ lat: alsoNear.lat, lng: alsoNear.lng });
      expect(verdict.distanceMeters).toBeGreaterThan(2_000);
      expect(verdict.distanceMeters).toBeLessThan(5_000);
    }
  });

  it("no es elegible fuera del radio e informa la distancia mínima", () => {
    expect(evaluateLocalDelivery([far], store, 5)).toMatchObject({ eligible: false, reason: "out_of_range" });
    expect(evaluateLocalDelivery([far], store, 6).eligible).toBe(true);
  });

  it("con calles homónimas dentro y fuera del radio no la ofrece sin una pista", () => {
    expect(evaluateLocalDelivery([near, far], store, 5)).toEqual({ eligible: false, reason: "ambiguous" });
  });

  it("la ubicación del navegador solo elige entre candidatos del servidor", () => {
    const verdict = evaluateLocalDelivery([near, far], store, 5, { lat: -34.7215, lng: -58.2610 });
    expect(verdict).toMatchObject({ eligible: true, point: { lat: near.lat, lng: near.lng } });
    // Una pista cerca del candidato lejano no lo vuelve elegible.
    expect(evaluateLocalDelivery([near, far], store, 5, { lat: far.lat, lng: far.lng })).toEqual({ eligible: false, reason: "ambiguous" });
    // Una pista lejos de todo no cambia nada, y una pista sola nunca alcanza.
    expect(evaluateLocalDelivery([near, far], store, 5, { lat: -34.6, lng: -58.4 })).toEqual({ eligible: false, reason: "ambiguous" });
    expect(evaluateLocalDelivery([], store, 5, { lat: store.lat, lng: store.lng })).toEqual({ eligible: false, reason: "not_found" });
  });

  it("revalida coordenadas firmadas con el radio vigente", () => {
    expect(withinLocalRadius({ lat: near.lat, lng: near.lng }, store, 5)).toBeLessThan(50);
    expect(withinLocalRadius({ lat: far.lat, lng: far.lng }, store, 5)).toBeNull();
    expect(withinLocalRadius({ lat: "x", lng: 1 }, store, 5)).toBeNull();
    expect(withinLocalRadius(undefined, store, 5)).toBeNull();
  });

  it("formatea la distancia en metros o kilómetros", () => {
    expect(formatDistance(30)).toBe("50 m");
    expect(formatDistance(420)).toBe("400 m");
    expect(formatDistance(2_436)).toBe("2,4 km");
    expect(formatDistance(Number.NaN)).toBe("");
  });
});
