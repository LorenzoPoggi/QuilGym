import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), expire: vi.fn() }));
vi.mock("@/lib/cron-auth", () => ({ isAuthorizedCron: mocks.authorized }));
vi.mock("@/lib/abandoned-cart-expiry", () => ({ expireAbandonedCarts: mocks.expire }));

import { GET } from "../app/api/internal/expire-carts/route";

describe("GET /api/internal/expire-carts", () => {
  beforeEach(() => {
    mocks.authorized.mockReset().mockReturnValue(true);
    mocks.expire.mockReset().mockResolvedValue({ deleted: 2, cutoff: new Date("2026-08-10T12:00:00.000Z") });
  });

  it("exige el secreto de cron antes de limpiar datos", async () => {
    mocks.authorized.mockReturnValue(false);
    const response = await GET(new Request("https://quilgym.test/api/internal/expire-carts"));
    expect(response.status).toBe(401);
    expect(mocks.expire).not.toHaveBeenCalled();
  });

  it("responde con el conteo cuando la tarea autorizada termina", async () => {
    const response = await GET(new Request("https://quilgym.test/api/internal/expire-carts", { headers: { Authorization: "Bearer test" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: 2, cutoff: "2026-08-10T12:00:00.000Z" });
    expect(mocks.expire).toHaveBeenCalledOnce();
  });

  it("devuelve un error controlado si falla la limpieza", async () => {
    mocks.expire.mockRejectedValue(new Error("database unavailable"));
    const response = await GET(new Request("https://quilgym.test/api/internal/expire-carts"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "No se pudieron limpiar los carritos vencidos." });
  });
});
