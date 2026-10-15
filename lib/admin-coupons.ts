/**
 * Reglas puras de los cupones del panel: validación, estado y descripción en lenguaje común.
 * Sin acceso a la base para poder probarlas; las Server Actions están en `admin-coupon-actions.ts`.
 */
import { formatArs } from "./commerce";

export type CouponKind = "percent" | "fixed";
export type AdminCouponInput = {
  id?: number;
  code: string;
  kind: CouponKind;
  value: number;
  minSubtotalArs: number | null;
  /** Fechas del calendario en formato AAAA-MM-DD (hora de Argentina). */
  startsOn: string | null;
  endsOn: string | null;
  maxRedemptions: number | null;
};
export type CouponFieldErrors = Partial<Record<keyof AdminCouponInput | "form", string>>;
export type CouponStatus = "active" | "scheduled" | "expired" | "exhausted" | "paused";
export type CouponRow = {
  id: number; code: string; kind: CouponKind; value: number; minSubtotalArs: number | null;
  startsAt: Date | null; endsAt: Date | null; maxRedemptions: number | null; redemptions: number; isActive: boolean;
};

export const MAX_PERCENT = 90;
export const couponCodePattern = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Mayúsculas, sin espacios ni acentos: así lo escribe el cliente en el carrito. */
export const normalizeCouponCode = (raw: string) => raw.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "").toUpperCase();

/** Argentina no tiene horario de verano: el día empieza a las 00:00 -03:00 y termina a las 23:59:59.999 -03:00. */
export const startOfArgentinaDay = (date: string) => new Date(`${date}T00:00:00.000-03:00`);
export const endOfArgentinaDay = (date: string) => new Date(`${date}T23:59:59.999-03:00`);
export const toArgentinaDate = (date: Date) => new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);

const validDate = (value: string) => datePattern.test(value) && !Number.isNaN(startOfArgentinaDay(value).getTime()) && toArgentinaDate(startOfArgentinaDay(value)) === value;
const positiveInt = (value: number | null) => value === null || (Number.isSafeInteger(value) && value > 0);

export function validateCouponInput(input: AdminCouponInput): CouponFieldErrors {
  const errors: CouponFieldErrors = {};
  const code = normalizeCouponCode(input.code ?? "");
  if (!code) errors.code = "Escribí el código que va a usar el cliente.";
  else if (!couponCodePattern.test(code)) errors.code = "Usá de 3 a 24 letras o números, sin espacios (podés usar - o _).";
  if (input.kind !== "percent" && input.kind !== "fixed") errors.kind = "Elegí si es un porcentaje o un monto fijo.";
  if (!Number.isSafeInteger(input.value) || input.value <= 0) errors.value = input.kind === "percent" ? "Escribí un porcentaje entre 1 y 90." : "Escribí un monto mayor a $0.";
  else if (input.kind === "percent" && input.value > MAX_PERCENT) errors.value = `El descuento máximo es ${MAX_PERCENT}%.`;
  else if (input.kind === "fixed" && input.value > 10_000_000) errors.value = "El monto es demasiado alto.";
  if (!positiveInt(input.minSubtotalArs)) errors.minSubtotalArs = "La compra mínima tiene que ser un monto mayor a $0, o dejala vacía.";
  else if (input.kind === "fixed" && !errors.value && input.minSubtotalArs !== null && input.value >= input.minSubtotalArs)
    errors.minSubtotalArs = "La compra mínima tiene que ser mayor al descuento; si no, el pedido podría quedar en $0.";
  if (input.startsOn !== null && !validDate(input.startsOn)) errors.startsOn = "Elegí una fecha válida.";
  if (input.endsOn !== null && !validDate(input.endsOn)) errors.endsOn = "Elegí una fecha válida.";
  if (!errors.startsOn && !errors.endsOn && input.startsOn && input.endsOn && input.endsOn < input.startsOn) errors.endsOn = "La fecha de fin tiene que ser igual o posterior a la de inicio.";
  if (!positiveInt(input.maxRedemptions)) errors.maxRedemptions = "El límite de usos tiene que ser un número mayor a 0, o dejalo vacío.";
  else if (input.maxRedemptions !== null && input.maxRedemptions > 1_000_000) errors.maxRedemptions = "El límite de usos es demasiado alto.";
  return errors;
}

export function couponStatus(row: CouponRow, now = new Date()): CouponStatus {
  if (!row.isActive) return "paused";
  if (row.endsAt && now > row.endsAt) return "expired";
  if (row.maxRedemptions !== null && row.redemptions >= row.maxRedemptions) return "exhausted";
  if (row.startsAt && now < row.startsAt) return "scheduled";
  return "active";
}

export const couponStatusLabels: Record<CouponStatus, string> = {
  active: "Activo", scheduled: "Programado", expired: "Vencido", exhausted: "Agotado", paused: "Pausado",
};

const shortDate = (date: string) => { const [, month, day] = date.split("-"); return `${Number(day)}/${Number(month)}`; };

/** Lo que ve el cliente en el carrito: solo el beneficio, sin datos internos de usos. */
export function customerCouponText(input: Pick<AdminCouponInput, "kind" | "value" | "minSubtotalArs">) {
  const discount = input.kind === "percent" ? `${input.value}% de descuento` : `${formatArs(input.value)} de descuento`;
  return discount + (input.minSubtotalArs ? ` en compras desde ${formatArs(input.minSubtotalArs)}` : " en cualquier compra");
}

/** Frase que ve el dueño antes de guardar, p. ej. «15% de descuento en compras desde $50.000, válido hasta el 31/12, máximo 100 usos». */
export function describeCoupon(input: Pick<AdminCouponInput, "kind" | "value" | "minSubtotalArs" | "startsOn" | "endsOn" | "maxRedemptions">) {
  if (!Number.isSafeInteger(input.value) || input.value <= 0) return "Completá el descuento para ver cómo queda.";
  const parts = [customerCouponText(input)];
  if (input.startsOn && input.endsOn) parts.push(`válido del ${shortDate(input.startsOn)} al ${shortDate(input.endsOn)}`);
  else if (input.startsOn) parts.push(`válido desde el ${shortDate(input.startsOn)}`);
  else if (input.endsOn) parts.push(`válido hasta el ${shortDate(input.endsOn)}`);
  else parts.push("sin fecha de vencimiento");
  parts.push(input.maxRedemptions ? `máximo ${input.maxRedemptions} ${input.maxRedemptions === 1 ? "uso" : "usos"}` : "sin límite de usos");
  return parts.join(", ");
}

/** Valores que se guardan en la tabla `coupons`. */
export function couponValues(input: AdminCouponInput) {
  return {
    code: normalizeCouponCode(input.code), kind: input.kind, value: input.value, minSubtotalArs: input.minSubtotalArs,
    startsAt: input.startsOn ? startOfArgentinaDay(input.startsOn) : null,
    endsAt: input.endsOn ? endOfArgentinaDay(input.endsOn) : null,
    maxRedemptions: input.maxRedemptions,
    description: customerCouponText(input),
  };
}
