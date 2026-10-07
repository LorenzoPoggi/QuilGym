import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getGoogleReviews } from "./google-reviews";
import { quilgymMapsUrl, unavailableReviews } from "./review-types";

const key = "clave-de-prueba-que-no-debe-loguearse";
const placeId = "ChIJ_lugar-de-prueba";
const review = (photoUri: unknown, extra: Record<string, unknown> = {}) => ({
  name: `places/${placeId}/reviews/1`, rating: 5, publishTime: "2026-10-04T15:00:00Z",
  text: { text: "Muy buena atención" }, authorAttribution: { displayName: "Ana", uri: "https://www.google.com/maps/contrib/1", photoUri },
  googleMapsUri: "https://www.google.com/maps/reviews/1", ...extra,
});
const place = (reviews: unknown[]) => ({ id: placeId, rating: 4.6, userRatingCount: 120, reviews });
const respond = (body: unknown, init: ResponseInit = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200, ...init }));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_API_KEY", key);
  vi.stubEnv("GOOGLE_PLACE_ID", placeId);
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("reseñas de Google Places", () => {
  it("sin variables no consulta a Google", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    const fetchMock = respond(place([]));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getGoogleReviews()).toEqual(unavailableReviews);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("incluye el avatar del autor solo si es https y de un host de Google", async () => {
    vi.stubGlobal("fetch", respond(place([
      review("//lh3.googleusercontent.com/a/avatar=s128"),
      review("https://evil.example/avatar.png", { name: "r2" }),
      review("http://lh3.googleusercontent.com/a/avatar", { name: "r3" }),
      review("https://lh5.ggpht.com/avatar", { name: "r4" }),
      review(undefined, { name: "r5" }),
    ])));
    const data = await getGoogleReviews();
    expect(data.source).toBe("google");
    expect(data.reviews.map((item) => item.photo)).toEqual([
      "https://lh3.googleusercontent.com/a/avatar=s128", null, null, "https://lh5.ggpht.com/avatar", null,
    ]);
    expect(data.reviews[0]).toMatchObject({ author: "Ana", rating: 5, text: "Muy buena atención", original: null, url: "https://www.google.com/maps/reviews/1" });
  });

  it("marca el original solo cuando difiere del texto traducido", async () => {
    vi.stubGlobal("fetch", respond(place([
      review(null, { originalText: { text: "Great service" } }),
      review(null, { name: "r2", originalText: { text: "Muy buena atención" }, googleMapsUri: "https://evil.example" }),
    ])));
    const [translated, same] = (await getGoogleReviews()).reviews;
    expect(translated.original).toBe("Great service");
    expect(same.original).toBeNull();
    expect(same.url).toBe(quilgymMapsUrl);
  });

  it("avisa el status cuando falla, sin loguear la clave", async () => {
    vi.stubGlobal("fetch", respond({ error: "denied" }, { status: 403, statusText: "Forbidden" }));
    expect(await getGoogleReviews()).toEqual(unavailableReviews);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("403");
    expect(JSON.stringify(warn.mock.calls)).not.toContain(key);
  });

  it("descarta otro lugar y errores de red sin exponer la clave", async () => {
    vi.stubGlobal("fetch", respond({ ...place([review(null)]), id: "otro" }));
    expect(await getGoogleReviews()).toEqual(unavailableReviews);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError(`fetch failed ${key}`); }));
    expect(await getGoogleReviews()).toEqual(unavailableReviews);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(key);
  });
});
