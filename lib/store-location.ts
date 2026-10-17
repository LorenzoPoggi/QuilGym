/**
 * Ubicación del local de QuilGym (San Martín 492, Quilmes). Única fuente para el mapa del retiro, la distancia de
 * la entrega propia y el default de `STORE_LAT`/`STORE_LNG`. Pura y sin `server-only`: la usan cliente y servidor.
 *
 * Pendiente después del merge: `components/google-reviews.tsx` todavía repite estas coordenadas a mano.
 */
export const STORE_COORDINATES = { lat: -34.7212393, lng: -58.2603596 } as const;

export type Coordinates = { lat: number; lng: number };

/** Embed de Google Maps del local (sin clave), usado en el paso de retiro del checkout. */
export function storeMapEmbedUrl(point: Coordinates = STORE_COORDINATES) {
  return `https://maps.google.com/maps?q=${point.lat},${point.lng}&z=16&output=embed`;
}

/** Link de búsqueda de Google Maps a un punto o a una dirección escrita. */
export function googleMapsSearchUrl(query: Coordinates | string) {
  const value = typeof query === "string" ? query : `${query.lat},${query.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`;
}
