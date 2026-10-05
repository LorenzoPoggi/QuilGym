export const quilgymMapsUrl = "https://www.google.com/maps?cid=1791416799115149607";
export type GoogleReview = { id: string; author: string; authorUrl: string | null; rating: number; text: string; original: string | null; date: string; url: string };
export type ReviewsData = { rating: number | null; count: number | null; reviews: GoogleReview[]; source: "google" | "unavailable" };
export const unavailableReviews: ReviewsData = { rating: null, count: null, reviews: [], source: "unavailable" };
