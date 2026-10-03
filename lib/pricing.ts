/** Reglas de precio puras: sin acceso a base ni a cookies, para poder testearlas. */
import { formatArs } from "./commerce";

export type CouponRule = {
  code: string;
  description: string | null;
  kind: "percent" | "fixed";
  value: number;
  minSubtotalArs: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxRedemptions: number | null;
  redemptions: number;
  isActive: boolean;
};

export type CouponEvaluation = { ok: true; discountArs: number } | { ok: false; reason: string };

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function evaluateCoupon(coupon: CouponRule | undefined, subtotalArs: number, now = new Date()): CouponEvaluation {
  if (!coupon || !coupon.isActive) return { ok: false, reason: "El cupón no existe o ya no está disponible." };
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, reason: "El cupón todavía no está vigente." };
  if (coupon.endsAt && now > coupon.endsAt) return { ok: false, reason: "El cupón está vencido." };
  if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) return { ok: false, reason: "El cupón alcanzó su límite de usos." };
  if (coupon.minSubtotalArs !== null && subtotalArs < coupon.minSubtotalArs) return { ok: false, reason: `El cupón requiere una compra mínima de ${formatArs(coupon.minSubtotalArs)}.` };

  const raw = coupon.kind === "percent" ? Math.round((subtotalArs * coupon.value) / 100) : coupon.value;
  return { ok: true, discountArs: Math.min(raw, subtotalArs) };
}

/** Cantidad permitida para una línea según stock (null = sin control) y tope por línea. */
export function maxQuantityFor(stock: number | null, cap: number) {
  return stock === null ? cap : Math.max(0, Math.min(stock, cap));
}
