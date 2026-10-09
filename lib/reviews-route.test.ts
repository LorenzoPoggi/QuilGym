import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reviews: vi.fn(), limit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./google-reviews", () => ({ getGoogleReviews: mocks.reviews }));
vi.mock("./rate-limit", () => ({ consumeRateLimit: mocks.limit }));

import { GET } from "../app/api/reviews/route";

describe("GET /api/reviews", () => {
  beforeEach(() => {
    mocks.reviews.mockReset().mockResolvedValue({ source: "none", reviews: [] });
    mocks.limit.mockReset().mockResolvedValue(true);
  });

  it("aplica un límite diario global antes de consultar al proveedor", async () => {
    mocks.limit.mockResolvedValue(false);
    const response = await GET();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("86400");
    expect(mocks.limit).toHaveBeenCalledWith("reviews:global:day", 300, 86_400_000);
    expect(mocks.reviews).not.toHaveBeenCalled();
  });

  it("sirve reseñas debajo del límite", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ source: "none", reviews: [] });
    expect(mocks.reviews).toHaveBeenCalledOnce();
  });

  it("falla cerrado si no se puede consultar el contador", async () => {
    mocks.limit.mockRejectedValue(new Error("database unavailable"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(mocks.reviews).not.toHaveBeenCalled();
  });
});
