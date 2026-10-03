"use server";

import { and, eq, sql } from "drizzle-orm";
import { findPurchasableVariant, getCart, getOrCreateCartId, readCartId, touchCart } from "./cart";
import type { CartActionResult } from "./cart-types";
import { db } from "./db";
import { cartItems, carts, coupons, productVariants } from "./db/schema";
import { evaluateCoupon, normalizeCouponCode } from "./pricing";

const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const isQuantity = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1000;

async function failure(error: string, cartId?: string | null): Promise<CartActionResult> {
  return { ok: false, error, cart: await getCart(cartId) };
}

export async function addToCart(variantId: number, quantity = 1): Promise<CartActionResult> {
  if (!isId(variantId) || !isQuantity(quantity) || quantity === 0) return failure("No pudimos agregar el producto.");

  const variant = await findPurchasableVariant(variantId);
  if (!variant) return failure("Este producto ya no está disponible.");
  if (variant.maxQuantity === 0) return failure(`${variant.name} no tiene stock por el momento.`);

  const cartId = await getOrCreateCartId();
  const [existing] = await db.select({ quantity: cartItems.quantity }).from(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId))).limit(1);
  const current = existing?.quantity ?? 0;
  if (current >= variant.maxQuantity) return failure(`Ya tenés la cantidad máxima disponible de ${variant.name}.`, cartId);

  const next = Math.min(current + quantity, variant.maxQuantity);
  await db.insert(cartItems)
    .values({ cartId, variantId, quantity: next, seenPriceArs: variant.priceArs })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.variantId],
      set: { quantity: sql`least(${cartItems.quantity} + ${quantity}, ${variant.maxQuantity})`, seenPriceArs: variant.priceArs, updatedAt: new Date() },
    });
  await touchCart(cartId);

  const message = next - current < quantity
    ? `Agregamos ${next - current} de ${variant.name}: es el máximo disponible.`
    : `Agregaste ${variant.name} al carrito.`;
  return { ok: true, message, cart: await getCart(cartId) };
}

export async function updateCartQuantity(variantId: number, quantity: number): Promise<CartActionResult> {
  const cartId = await readCartId();
  if (!cartId || !isId(variantId) || !isQuantity(quantity)) return failure("No pudimos actualizar el carrito.", cartId);
  if (quantity === 0) return removeFromCart(variantId);

  const variant = await findPurchasableVariant(variantId);
  if (!variant || variant.maxQuantity === 0) return failure("Este producto ya no tiene stock.", cartId);

  const next = Math.min(quantity, variant.maxQuantity);
  await db.update(cartItems).set({ quantity: next, seenPriceArs: variant.priceArs }).where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)));
  await touchCart(cartId);

  return next < quantity
    ? { ok: false, error: `Solo hay ${next} ${next === 1 ? "unidad disponible" : "unidades disponibles"} de ${variant.name}.`, cart: await getCart(cartId) }
    : { ok: true, cart: await getCart(cartId) };
}

export async function removeFromCart(variantId: number): Promise<CartActionResult> {
  const cartId = await readCartId();
  if (!cartId || !isId(variantId)) return failure("No pudimos quitar el producto.", cartId);

  await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)));
  await touchCart(cartId);
  return { ok: true, message: "Quitamos el producto del carrito.", cart: await getCart(cartId) };
}

export async function applyCoupon(rawCode: string): Promise<CartActionResult> {
  const cartId = await readCartId();
  const code = typeof rawCode === "string" ? normalizeCouponCode(rawCode) : "";
  if (!code || code.length > 40 || !/^[A-Z0-9_-]+$/.test(code)) return failure("Ingresá un código válido.", cartId);
  if (!cartId) return failure("Agregá productos antes de aplicar un cupón.", cartId);

  const cart = await getCart(cartId);
  if (cart.subtotalArs === 0) return failure("Agregá productos antes de aplicar un cupón.", cartId);

  const [rule] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
  const evaluation = evaluateCoupon(rule, cart.subtotalArs);
  if (!evaluation.ok) return { ok: false, error: evaluation.reason, cart };

  await db.update(carts).set({ couponCode: code, updatedAt: new Date() }).where(eq(carts.id, cartId));
  return { ok: true, message: `Aplicamos el cupón ${code}.`, cart: await getCart(cartId) };
}

/** El cliente confirma que vio los precios actuales. */
export async function acknowledgeCartChanges(): Promise<CartActionResult> {
  const cartId = await readCartId();
  if (!cartId) return failure("No hay un carrito activo.", cartId);

  await db.update(cartItems)
    .set({ seenPriceArs: sql`${productVariants.priceArs}` })
    .from(productVariants)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, productVariants.id)));
  return { ok: true, cart: await getCart(cartId) };
}

export async function removeCoupon(): Promise<CartActionResult> {
  const cartId = await readCartId();
  if (!cartId) return failure("No hay un carrito activo.", cartId);

  await db.update(carts).set({ couponCode: null, updatedAt: new Date() }).where(eq(carts.id, cartId));
  return { ok: true, message: "Quitamos el cupón.", cart: await getCart(cartId) };
}
