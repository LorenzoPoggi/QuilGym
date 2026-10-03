import { describe, expect, it } from "vitest";
import { evaluateCoupon, maxQuantityFor, normalizeCouponCode, type CouponRule } from "./pricing";

const base: CouponRule = {
  code: "ENTRENA10",
  description: null,
  kind: "percent",
  value: 10,
  minSubtotalArs: null,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  redemptions: 0,
  isActive: true,
};
const now = new Date("2026-10-03T12:00:00Z");

describe("evaluateCoupon", () => {
  it("aplica un porcentaje redondeado", () => {
    expect(evaluateCoupon(base, 75_995, now)).toEqual({ ok: true, discountArs: 7_600 });
  });

  it("nunca descuenta más que el subtotal", () => {
    expect(evaluateCoupon({ ...base, kind: "fixed", value: 50_000 }, 30_000, now)).toEqual({ ok: true, discountArs: 30_000 });
  });

  it("rechaza cupones inexistentes o inactivos", () => {
    expect(evaluateCoupon(undefined, 10_000, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, isActive: false }, 10_000, now).ok).toBe(false);
  });

  it("respeta la vigencia", () => {
    expect(evaluateCoupon({ ...base, startsAt: new Date("2026-10-04") }, 10_000, now).ok).toBe(false);
    expect(evaluateCoupon({ ...base, endsAt: new Date("2026-10-01") }, 10_000, now).ok).toBe(false);
  });

  it("respeta el mínimo de compra y el límite de usos", () => {
    expect(evaluateCoupon({ ...base, minSubtotalArs: 50_000 }, 49_999, now)).toMatchObject({ ok: false });
    expect(evaluateCoupon({ ...base, minSubtotalArs: 50_000 }, 50_000, now)).toMatchObject({ ok: true });
    expect(evaluateCoupon({ ...base, maxRedemptions: 5, redemptions: 5 }, 10_000, now).ok).toBe(false);
  });
});

describe("maxQuantityFor", () => {
  it("usa el tope cuando no se controla inventario", () => {
    expect(maxQuantityFor(null, 10)).toBe(10);
  });

  it("limita al stock disponible y nunca devuelve negativos", () => {
    expect(maxQuantityFor(3, 10)).toBe(3);
    expect(maxQuantityFor(25, 10)).toBe(10);
    expect(maxQuantityFor(-2, 10)).toBe(0);
  });
});

describe("normalizeCouponCode", () => {
  it("normaliza mayúsculas y espacios", () => {
    expect(normalizeCouponCode("  entrena 10 ")).toBe("ENTRENA10");
  });
});
