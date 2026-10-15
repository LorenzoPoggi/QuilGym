import { describe, expect, it } from "vitest";
import { couponStatus, couponValues, customerCouponText, describeCoupon, endOfArgentinaDay, normalizeCouponCode, startOfArgentinaDay, toArgentinaDate, validateCouponInput, type AdminCouponInput, type CouponRow } from "./admin-coupons";
import { evaluateCoupon } from "./pricing";

const input = (overrides: Partial<AdminCouponInput> = {}): AdminCouponInput => ({
  code: "BIENVENIDA15", kind: "percent", value: 15, minSubtotalArs: 50_000, startsOn: null, endsOn: "2026-12-31", maxRedemptions: 100, ...overrides,
});
const row = (overrides: Partial<CouponRow> = {}): CouponRow => ({
  id: 1, code: "BIENVENIDA15", kind: "percent", value: 15, minSubtotalArs: null, startsAt: null, endsAt: null, maxRedemptions: null, redemptions: 0, isActive: true, ...overrides,
});

describe("validación de cupones", () => {
  it("acepta un cupón completo y uno mínimo", () => {
    expect(validateCouponInput(input())).toEqual({});
    expect(validateCouponInput(input({ minSubtotalArs: null, endsOn: null, maxRedemptions: null }))).toEqual({});
  });
  it("normaliza el código a mayúsculas sin espacios ni acentos", () => {
    expect(normalizeCouponCode(" verano  más ")).toBe("VERANOMAS");
    expect(validateCouponInput(input({ code: "ab" })).code).toBeTruthy();
    expect(validateCouponInput(input({ code: "" })).code).toBeTruthy();
    expect(validateCouponInput(input({ code: "HOT$ALE" })).code).toBeTruthy();
  });
  it("limita porcentajes y montos", () => {
    expect(validateCouponInput(input({ value: 0 })).value).toBeTruthy();
    expect(validateCouponInput(input({ value: 91 })).value).toBeTruthy();
    expect(validateCouponInput(input({ value: 90 })).value).toBeUndefined();
    expect(validateCouponInput(input({ kind: "fixed", value: 5000, minSubtotalArs: 20_000 }))).toEqual({});
  });
  it("exige que un monto fijo sea menor a la compra mínima", () => {
    expect(validateCouponInput(input({ kind: "fixed", value: 20_000, minSubtotalArs: 20_000 })).minSubtotalArs).toBeTruthy();
  });
  it("valida fechas y su orden", () => {
    expect(validateCouponInput(input({ startsOn: "2026-02-30" })).startsOn).toBeTruthy();
    expect(validateCouponInput(input({ startsOn: "2026-12-31", endsOn: "2026-12-01" })).endsOn).toBeTruthy();
    expect(validateCouponInput(input({ startsOn: "2026-12-01", endsOn: "2026-12-01" }))).toEqual({});
  });
  it("valida el límite de usos", () => {
    expect(validateCouponInput(input({ maxRedemptions: 0 })).maxRedemptions).toBeTruthy();
    expect(validateCouponInput(input({ maxRedemptions: 1.5 })).maxRedemptions).toBeTruthy();
  });
});

describe("fechas en hora de Argentina", () => {
  it("el día va de 00:00 a 23:59:59 en -03:00", () => {
    expect(startOfArgentinaDay("2026-12-31").toISOString()).toBe("2026-12-31T03:00:00.000Z");
    expect(endOfArgentinaDay("2026-12-31").toISOString()).toBe("2027-01-01T02:59:59.999Z");
    expect(toArgentinaDate(endOfArgentinaDay("2026-12-31"))).toBe("2026-12-31");
  });
  it("guarda valores listos para la tabla", () => {
    const values = couponValues(input({ code: "bienvenida15", startsOn: "2026-11-01" }));
    expect(values).toMatchObject({ code: "BIENVENIDA15", kind: "percent", value: 15, maxRedemptions: 100, description: "15% de descuento en compras desde $ 50.000".replace("$ ", "$") });
    expect(values.startsAt?.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("textos", () => {
  it("describe el cupón en lenguaje común", () => {
    const text = describeCoupon(input());
    expect(text).toContain("15% de descuento en compras desde");
    expect(text).toContain("válido hasta el 31/12");
    expect(text).toContain("máximo 100 usos");
    expect(describeCoupon(input({ kind: "fixed", value: 5000, minSubtotalArs: null, endsOn: null, maxRedemptions: null }))).toContain("en cualquier compra, sin fecha de vencimiento, sin límite de usos");
  });
  it("al cliente solo le muestra el beneficio", () => {
    expect(customerCouponText(input())).not.toContain("usos");
  });
});

describe("estado del cupón", () => {
  const now = new Date("2026-10-13T15:00:00Z");
  it("distingue activo, programado, vencido, agotado y pausado", () => {
    expect(couponStatus(row(), now)).toBe("active");
    expect(couponStatus(row({ startsAt: new Date("2026-11-01T03:00:00Z") }), now)).toBe("scheduled");
    expect(couponStatus(row({ endsAt: new Date("2026-10-01T03:00:00Z") }), now)).toBe("expired");
    expect(couponStatus(row({ maxRedemptions: 5, redemptions: 5 }), now)).toBe("exhausted");
    expect(couponStatus(row({ isActive: false, endsAt: new Date("2026-10-01T03:00:00Z") }), now)).toBe("paused");
  });
  it("el carrito no aplica cupones pausados, vencidos ni agotados", () => {
    const rule = (overrides: Partial<CouponRow> = {}) => ({ ...row(overrides), description: null });
    expect(evaluateCoupon(rule(), 100_000, now)).toMatchObject({ ok: true, discountArs: 15_000 });
    expect(evaluateCoupon(rule({ isActive: false }), 100_000, now).ok).toBe(false);
    expect(evaluateCoupon(rule({ endsAt: new Date("2026-10-01T03:00:00Z") }), 100_000, now).ok).toBe(false);
    expect(evaluateCoupon(rule({ maxRedemptions: 3, redemptions: 3 }), 100_000, now).ok).toBe(false);
  });
});
