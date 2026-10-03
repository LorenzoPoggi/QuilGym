import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { emptyCart, MAX_QUANTITY_PER_LINE, type Cart, type CartLine } from "./cart-types";
import { commerce, formatArs } from "./commerce";
import { db } from "./db";
import { brands, cartItems, carts, categories, coupons, products, productVariants } from "./db/schema";
import { getPrimaryImages } from "./catalog";
import { evaluateCoupon, maxQuantityFor } from "./pricing";

const CART_COOKIE = "qg_cart";
const CART_MAX_AGE = 60 * 60 * 24 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readCartId() {
  const value = (await cookies()).get(CART_COOKIE)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
}

/** Devuelve el carrito de la cookie o crea uno nuevo. Solo usar desde Server Actions/Route Handlers. */
export async function getOrCreateCartId() {
  const current = await readCartId();
  if (current) {
    const existing = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, current)).limit(1);
    if (existing.length) return current;
  }
  const [created] = await db.insert(carts).values({}).returning({ id: carts.id });
  (await cookies()).set(CART_COOKIE, created.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_MAX_AGE,
  });
  return created.id;
}

export async function touchCart(cartId: string) {
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
}

/** Variante comprable con su stock y precio actuales, o null si no existe o no está publicada. */
export async function findPurchasableVariant(variantId: number) {
  const [row] = await db
    .select({ id: productVariants.id, priceArs: productVariants.priceArs, stock: productVariants.stock, name: products.name })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(productVariants.id, variantId), eq(products.status, "active")))
    .limit(1);
  return row ? { ...row, maxQuantity: maxQuantityFor(row.stock, MAX_QUANTITY_PER_LINE) } : null;
}

/**
 * Lee el carrito y recalcula todo con precios, stock y cupones vigentes.
 * Ajusta cantidades que superan el stock y devuelve avisos de cambios.
 */
export async function getCart(cartId?: string | null): Promise<Cart> {
  const id = cartId === undefined ? await readCartId() : cartId;
  if (!id) return emptyCart;

  const [cart] = await db.select().from(carts).where(eq(carts.id, id)).limit(1);
  if (!cart) return emptyCart;

  const rows = await db
    .select({
      itemId: cartItems.id,
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      seenPriceArs: cartItems.seenPriceArs,
      priceArs: productVariants.priceArs,
      stock: productVariants.stock,
      variantLabel: productVariants.label,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      status: products.status,
      brandSlug: brands.slug,
      brandName: brands.name,
      categorySlug: categories.slug,
      categoryName: categories.name,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(eq(cartItems.cartId, id))
    .orderBy(asc(cartItems.createdAt), asc(cartItems.id));

  const primaryImages = await getPrimaryImages(rows.map((row) => row.productId));
  const notices: string[] = [];
  const fixes: Promise<unknown>[] = [];
  let hasBlockingIssues = false;
  let hasPriceChanges = false;

  const lines: CartLine[] = rows.map((row) => {
    const maxQuantity = row.status === "active" ? maxQuantityFor(row.stock, MAX_QUANTITY_PER_LINE) : 0;
    const available = maxQuantity > 0;
    let quantity = row.quantity;

    if (!available) {
      hasBlockingIssues = true;
      notices.push(`${row.name} se quedó sin stock. Quitalo para continuar.`);
    } else if (quantity > maxQuantity) {
      quantity = maxQuantity;
      notices.push(`Ajustamos ${row.name} a ${maxQuantity} ${maxQuantity === 1 ? "unidad" : "unidades"} por stock disponible.`);
      fixes.push(db.update(cartItems).set({ quantity }).where(eq(cartItems.id, row.itemId)));
    }

    // El aviso se mantiene hasta que el cliente lo confirma (acknowledgeCartChanges).
    if (available && row.seenPriceArs !== row.priceArs) {
      hasPriceChanges = true;
      notices.push(`El precio de ${row.name} cambió de ${formatArs(row.seenPriceArs)} a ${formatArs(row.priceArs)}.`);
    }

    return {
      variantId: row.variantId,
      slug: row.slug,
      name: row.name,
      variantLabel: row.variantLabel,
      brand: row.brandSlug && row.brandName ? { slug: row.brandSlug, name: row.brandName } : null,
      category: { slug: row.categorySlug, name: row.categoryName },
      imageUrl: primaryImages.get(row.productId) ?? null,
      unitPriceArs: row.priceArs,
      quantity,
      lineTotalArs: available ? row.priceArs * quantity : 0,
      maxQuantity,
      available,
    };
  });

  const subtotalArs = lines.reduce((sum, line) => sum + line.lineTotalArs, 0);
  let coupon: Cart["coupon"] = null;

  if (cart.couponCode) {
    const [rule] = await db.select().from(coupons).where(eq(coupons.code, cart.couponCode)).limit(1);
    const evaluation = evaluateCoupon(rule, subtotalArs);
    if (evaluation.ok) {
      coupon = { code: cart.couponCode, description: rule.description, discountArs: evaluation.discountArs };
    } else if (subtotalArs > 0) {
      // Se conserva: puede volver a aplicar (p. ej. al superar el mínimo) o el cliente lo quita.
      notices.push(`El cupón ${cart.couponCode} no se aplica: ${evaluation.reason}`);
    }
  }

  await Promise.all(fixes);

  const discountArs = coupon?.discountArs ?? 0;
  const totalArs = subtotalArs - discountArs;
  const threshold = commerce.freeShippingFromArs;

  return {
    lines,
    itemCount: lines.reduce((sum, line) => sum + (line.available ? line.quantity : 0), 0),
    subtotalArs,
    coupon,
    discountArs,
    totalArs,
    freeShippingRemainingArs: threshold ? Math.max(0, threshold - totalArs) : null,
    notices,
    hasBlockingIssues,
    hasPriceChanges,
  };
}
