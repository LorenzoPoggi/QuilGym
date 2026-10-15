"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAdminUser } from "./admin-auth";
import { couponValues, normalizeCouponCode, validateCouponInput, type AdminCouponInput, type CouponFieldErrors } from "./admin-coupons";
import { db } from "./db";
import { coupons } from "./db/schema";

export type CouponActionResult = { ok: true; id: number } | { ok: false; error: string; fields?: CouponFieldErrors };

const unauthorized: CouponActionResult = { ok: false, error: "No tenés permisos de administrador. Ingresá con Google usando la cuenta autorizada." };
const isUniqueViolation = (error: unknown) => {
  const value = error as { code?: string; cause?: { code?: string }; message?: string };
  return value?.code === "23505" || value?.cause?.code === "23505" || /duplicate key|unique/i.test(value?.message ?? "");
};
const duplicate: CouponActionResult = { ok: false, error: "Ya existe un cupón con ese código.", fields: { code: "Ya existe un cupón con ese código." } };

/** Crea o edita un cupón. Un cupón ya usado conserva su código: los pedidos y carritos lo referencian por texto. */
export async function saveAdminCoupon(input: AdminCouponInput): Promise<CouponActionResult> {
  if (!await getAdminUser()) return unauthorized;
  const fields = validateCouponInput(input);
  if (Object.keys(fields).length) return { ok: false, error: fields.form ?? "Revisá los campos marcados.", fields };
  const values = couponValues(input);
  try {
    const [taken] = await db.select({ id: coupons.id }).from(coupons)
      .where(input.id ? and(eq(coupons.code, values.code), ne(coupons.id, input.id)) : eq(coupons.code, values.code)).limit(1);
    if (taken) return duplicate;
    let id = input.id;
    if (id) {
      const [current] = await db.select({ code: coupons.code, redemptions: coupons.redemptions }).from(coupons).where(eq(coupons.id, id)).limit(1);
      if (!current) return { ok: false, error: "No encontramos el cupón." };
      if (current.redemptions > 0 && current.code !== values.code)
        return { ok: false, error: "Este cupón ya se usó: no se puede cambiar el código.", fields: { code: "Ya se usó: creá un cupón nuevo si necesitás otro código." } };
      await db.update(coupons).set({ ...values, updatedAt: new Date() }).where(eq(coupons.id, id));
    } else {
      id = (await db.insert(coupons).values({ ...values, isActive: true }).returning({ id: coupons.id }))[0].id;
    }
    revalidatePath("/admin/cupones");
    return { ok: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) return duplicate;
    return { ok: false, error: "No pudimos guardar el cupón. Intentá nuevamente." };
  }
}

/** Pausar no borra el cupón ni su historial: deja de aplicarse en carritos nuevos y en los que ya lo tenían. */
export async function setAdminCouponActive(id: number, active: boolean): Promise<CouponActionResult> {
  if (!await getAdminUser()) return unauthorized;
  if (!Number.isSafeInteger(id) || id < 1) return { ok: false, error: "Cupón inválido." };
  try {
    const [updated] = await db.update(coupons).set({ isActive: active, updatedAt: new Date() }).where(eq(coupons.id, id)).returning({ id: coupons.id });
    if (!updated) return { ok: false, error: "No encontramos el cupón." };
    revalidatePath("/admin/cupones");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "No pudimos actualizar el cupón. Intentá nuevamente." };
  }
}

export async function checkCouponCode(code: string, excludeId?: number) {
  if (!await getAdminUser()) return { available: false };
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { available: false };
  const [taken] = await db.select({ id: coupons.id }).from(coupons)
    .where(excludeId ? and(eq(coupons.code, normalized), ne(coupons.id, excludeId)) : eq(coupons.code, normalized)).limit(1);
  return { available: !taken };
}
