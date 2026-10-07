import "server-only";
import { quilgymMapsUrl, unavailableReviews, type GoogleReview, type ReviewsData } from "./review-types";

/** No persiste ni cachea contenido de Places. Todas las opiniones mantienen su atribución. */
export async function getGoogleReviews(): Promise<ReviewsData> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId || !/^[\w-]+$/.test(placeId)) return unavailableReviews;
  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=es`, {
      cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,rating,userRatingCount,reviews,googleMapsUri" },
    });
    if (!response.ok) {
      // Solo el status: la clave viaja en un header y nunca se loguea.
      console.warn(`[reseñas] Google Places respondió ${response.status} ${response.statusText}`.trim());
      return unavailableReviews;
    }
    const place = await response.json();
    if (place.id !== placeId) { console.warn("[reseñas] Google Places devolvió otro lugar que GOOGLE_PLACE_ID"); return unavailableReviews; }
    const safeUrl = (value: unknown) => {
      if (typeof value !== "string") return null;
      try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "google.com" || url.hostname.endsWith(".google.com") || url.hostname === "maps.app.goo.gl") ? url.href : null; } catch { return null; }
    };
    /** Avatar del autor: https y servido por Google (googleusercontent, ggpht o google.com). */
    const safePhoto = (value: unknown) => {
      if (typeof value !== "string") return null;
      try {
        const url = new URL(value.startsWith("//") ? `https:${value}` : value);
        const host = url.hostname;
        const google = [".googleusercontent.com", ".ggpht.com", ".google.com"].some((suffix) => host.endsWith(suffix)) || host === "google.com";
        return url.protocol === "https:" && google ? url.href : null;
      } catch { return null; }
    };
    const reviews: GoogleReview[] = [];
    for (const item of Array.isArray(place.reviews) ? place.reviews : []) {
      if (typeof item.name !== "string" || typeof item.authorAttribution?.displayName !== "string" || typeof item.rating !== "number" || item.rating < 1 || item.rating > 5) continue;
      const text = typeof item.text?.text === "string" ? item.text.text : "";
      const original = typeof item.originalText?.text === "string" ? item.originalText.text : null;
      reviews.push({ id: item.name, author: item.authorAttribution.displayName, authorUrl: safeUrl(item.authorAttribution.uri), photo: safePhoto(item.authorAttribution.photoUri), rating: item.rating, text,
        original: original && original !== text ? original : null,
        date: typeof item.publishTime === "string" && Number.isFinite(Date.parse(item.publishTime)) ? new Date(item.publishTime).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "",
        url: safeUrl(item.googleMapsUri) || quilgymMapsUrl });
    }
    return { source: "google", reviews, rating: typeof place.rating === "number" ? place.rating : null, count: Number.isSafeInteger(place.userRatingCount) ? place.userRatingCount : null };
  } catch (error) {
    console.warn(`[reseñas] No se pudo consultar Google Places: ${error instanceof Error ? error.name : "error desconocido"}`);
    return unavailableReviews;
  }
}
