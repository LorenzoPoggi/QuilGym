/**
 * Reglas puras de la entrega propia (≤ radio del local) y de las opciones de entrega que se cotizan.
 * Sin `server-only`: las usan el servidor (cotización y `createOrder`) y los tests.
 */
import { distanceMeters, isValidCoordinates, type GeocodeCandidate } from "./geo";
import type { Coordinates } from "./store-location";
import { HINT_MATCH_RADIUS_M } from "./delivery-labels";

export type LocalEligibility =
  | { eligible: true; point: Coordinates; distanceMeters: number }
  | { eligible: false; reason: "not_found" | "out_of_range" | "ambiguous" | "unavailable"; distanceMeters?: number };

/**
 * Decide si una dirección geocodificada entra en el radio. Criterio conservador:
 * - Todos los candidatos dentro del radio → elegible, con la distancia del más lejano.
 * - Ninguno dentro → fuera de rango.
 * - Mezcla (la misma calle existe en dos zonas del partido): solo es elegible si la ubicación que sugirió el
 *   navegador está a ≤ 1,5 km de un candidato que entra en el radio. Si no, «ambiguous»: no se ofrece.
 * La pista del navegador nunca reemplaza a la geocodificación: solo elige entre candidatos del servidor.
 */
export function evaluateLocalDelivery(candidates: GeocodeCandidate[], store: Coordinates, radiusKm: number, hint?: Coordinates | null): LocalEligibility {
  const valid = candidates.filter(isValidCoordinates);
  if (!valid.length) return { eligible: false, reason: "not_found" };
  const radius = radiusKm * 1000;
  const measured = valid.map((point) => ({ point: { lat: point.lat, lng: point.lng }, distance: Math.round(distanceMeters(store, point)) }));
  const near = measured.filter((item) => item.distance <= radius);
  if (near.length === measured.length) {
    const farthest = near.reduce((a, b) => (b.distance > a.distance ? b : a));
    return { eligible: true, point: farthest.point, distanceMeters: farthest.distance };
  }
  if (!near.length) return { eligible: false, reason: "out_of_range", distanceMeters: Math.min(...measured.map((item) => item.distance)) };
  if (hint && isValidCoordinates(hint)) {
    const match = near
      .map((item) => ({ ...item, fromHint: distanceMeters(hint, item.point) }))
      .filter((item) => item.fromHint <= HINT_MATCH_RADIUS_M)
      .sort((a, b) => a.fromHint - b.fromHint)[0];
    // Si la pista también está cerca de un candidato lejano, la dirección sigue siendo ambigua.
    const farMatch = measured.some((item) => item.distance > radius && distanceMeters(hint, item.point) <= HINT_MATCH_RADIUS_M);
    if (match && !farMatch) return { eligible: true, point: match.point, distanceMeters: match.distance };
  }
  return { eligible: false, reason: "ambiguous" };
}

/** Revalida en `createOrder` las coordenadas firmadas contra la configuración vigente. */
export function withinLocalRadius(point: unknown, store: Coordinates, radiusKm: number) {
  if (!isValidCoordinates(point)) return null;
  const distance = Math.round(distanceMeters(store, point));
  return distance <= radiusKm * 1000 ? distance : null;
}
