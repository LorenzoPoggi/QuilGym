import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { cartItems, carts, coupons, orderEmails, orderItems, orders, payments, products, productVariants, shipments } from "./db/schema";
import { withOrderTransaction, type OrderTransaction } from "./db/transaction";
import { readCartId } from "./cart";
import { evaluateCoupon } from "./pricing";
import { MAX_QUANTITY_PER_LINE } from "./cart-types";
import { bankDetails, getCheckoutConfig, orderAccessSecret } from "./checkout-config";
import { verifyOrderAccess } from "./order-access";
import { checkoutFingerprint, readQuote } from "./checkout-security";
import { quoteDelivery, UUID_PATTERN } from "./checkout-validation";
import { canTransition } from "./order-state";
import type { CheckoutInput, OrderStatus } from "./checkout-types";
import { currentUser } from "./auth";

export class CheckoutError extends Error {}

/** Autoriza por carrito, cuenta que creó el pedido o link firmado (`?t=`). */
export async function findOwnedOrder(id: string, accessToken?: string | null) {
  if (!UUID_PATTERN.test(id)) return null;
  if (verifyOrderAccess(id, accessToken, orderAccessSecret())) {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return order ?? null;
  }
  const [cartId, user] = await Promise.all([readCartId(), currentUser()]);
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  // Los pedidos de cuenta requieren su sesión. Al cerrar sesión, la cookie del carrito
  // no debe seguir dando acceso a sus datos personales. Los pedidos de invitado conservan su flujo.
  const ownsAccountOrder = user && order.userId === user.id;
  const ownsGuestOrder = !order.userId && cartId && order.cartId === cartId;
  if (!ownsAccountOrder && !ownsGuestOrder) return null;
  return order ?? null;
}

export async function orderDetails(id: string, accessToken?: string | null) {
  const order = await findOwnedOrder(id, accessToken);
  if (!order) return null;
  const [items, payment, shipment] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    db.select().from(payments).where(eq(payments.orderId, id)).limit(1),
    db.select().from(shipments).where(eq(shipments.orderId, id)).limit(1),
  ]);
  return { order, items, payment: payment[0], shipment: shipment[0] };
}

/** Toda la operación se confirma o revierte junta; no hay llamadas a proveedores dentro de ella. */
export async function createOrder(input: CheckoutInput, cartId: string, userId?: string) {
  const config = getCheckoutConfig();
  return withOrderTransaction(async (tx) => {
    const [cart] = await tx.select().from(carts).where(eq(carts.id, cartId)).for("update");
    if (!cart) throw new CheckoutError("El carrito ya no está disponible.");
    const [existing] = await tx.select().from(orders).where(and(eq(orders.cartId, cartId), eq(orders.checkoutKey, input.checkoutKey)));
    if (existing) return existing.id;
    if (!config.payments[input.payment]) throw new CheckoutError("Este medio de pago todavía no está disponible.");
    const delivery = quoteDelivery(config, input.delivery, input.postalCode);
    const quote = readQuote(cartId, input.quoteToken);
    if (!quote || typeof quote.expires !== "number" || quote.expires < Date.now() || quote.delivery !== input.delivery || quote.postalCode !== input.postalCode || quote.demo !== config.demo) {
      throw new CheckoutError("La cotización venció. Volvé a calcular la entrega.");
    }
    const lines = await tx.select().from(cartItems).where(eq(cartItems.cartId, cartId)).orderBy(asc(cartItems.variantId)).for("update");
    if (!lines.length) throw new CheckoutError("Tu carrito está vacío.");
    const variants = await tx.select().from(productVariants).where(inArray(productVariants.id, lines.map((line) => line.variantId))).orderBy(asc(productVariants.id)).for("update");
    const productRows = await tx.select().from(products).where(inArray(products.id, variants.map((v) => v.productId))).orderBy(asc(products.id)).for("share");
    const snapshots = lines.map((line) => {
      const variant = variants.find((v) => v.id === line.variantId);
      const product = productRows.find((p) => p.id === variant?.productId);
      if (!variant || !product || product.status !== "active") throw new CheckoutError("Un producto ya no está disponible. Revisá tu carrito.");
      if (line.quantity > MAX_QUANTITY_PER_LINE || (variant.stock !== null && variant.stock < line.quantity)) throw new CheckoutError(`No hay stock suficiente de ${product.name}. Revisá tu carrito.`);
      if (line.seenPriceArs !== variant.priceArs) throw new CheckoutError("Cambió un precio. Confirmá los nuevos precios en el carrito.");
      return { variantId: variant.id, sku: variant.sku, name: product.name, slug: product.slug, variantLabel: variant.label,
        quantity: line.quantity, unitPriceArs: variant.priceArs, stockReserved: !config.demo && variant.stock !== null };
    });
    const subtotalArs = snapshots.reduce((sum, line) => sum + line.unitPriceArs * line.quantity, 0);
    let discountArs = 0;
    if (cart.couponCode) {
      const [coupon] = await tx.select().from(coupons).where(eq(coupons.code, cart.couponCode)).for("update");
      const evaluated = evaluateCoupon(coupon, subtotalArs);
      if (!evaluated.ok) throw new CheckoutError(evaluated.reason);
      discountArs = evaluated.discountArs;
      if (!config.demo) await tx.update(coupons).set({ redemptions: sql`${coupons.redemptions} + 1` }).where(eq(coupons.id, coupon.id));
    }
    const totalArs = subtotalArs - discountArs + delivery.shippingArs;
    if (totalArs <= 0 || !Number.isSafeInteger(totalArs)) throw new CheckoutError("No se puede procesar el importe de este pedido.");
    if (quote.fingerprint !== checkoutFingerprint(snapshots, discountArs, cart.couponCode) || quote.shippingArs !== delivery.shippingArs || quote.totalArs !== totalArs) {
      throw new CheckoutError("El importe cambió. Actualizá la cotización antes de confirmar.");
    }
    const [order] = await tx.insert(orders).values({
      cartId, userId, checkoutKey: input.checkoutKey, isDemo: config.demo, paymentMethod: input.payment,
      name: input.name, email: input.email, phone: input.phone, delivery: input.delivery,
      address: input.delivery === "shipping" ? { street: input.street, number: input.streetNumber, apartment: input.apartment, postalCode: input.postalCode, city: input.city, province: input.province } : null,
      notes: input.notes, pickupDetails: input.delivery === "pickup" ? config.pickup : null,
      bankDetails: input.payment === "transfer" && !config.demo ? bankDetails() : null,
      subtotalArs, discountArs, shippingArs: delivery.shippingArs, totalArs,
      couponCode: cart.couponCode, consentAt: new Date(),
    }).returning();
    await tx.insert(orderItems).values(snapshots.map((line) => ({ ...line, orderId: order.id })));
    for (const line of snapshots) if (line.stockReserved) {
      await tx.update(productVariants).set({ stock: sql`${productVariants.stock} - ${line.quantity}` }).where(eq(productVariants.id, line.variantId));
    }
    await tx.insert(payments).values({ orderId: order.id });
    await tx.insert(shipments).values({ orderId: order.id, label: delivery.label, estimate: delivery.estimate });
    if (!config.demo) await tx.insert(orderEmails).values({ orderId: order.id, event: "created" });
    await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
    await tx.update(carts).set({ couponCode: null, updatedAt: new Date() }).where(eq(carts.id, cartId));
    return order.id;
  });
}

/** Bloquea la orden: duplicados/reintentos no liberan stock ni cupones dos veces. */
export async function transitionOrder(tx: OrderTransaction, order: typeof orders.$inferSelect, status: OrderStatus) {
  if (!canTransition(order.status, status)) return false;
  if (status === order.status) return true;
  // Reembolsar dinero no implica que la mercadería haya vuelto al inventario.
  const release = ["rejected", "cancelled"].includes(status) && !order.resourcesReleasedAt;
  if (release && !order.isDemo) {
    const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.variantId));
    for (const line of lines) if (line.stockReserved) await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${line.quantity}` }).where(eq(productVariants.id, line.variantId));
    if (order.couponCode) await tx.update(coupons).set({ redemptions: sql`greatest(0, ${coupons.redemptions} - 1)` }).where(eq(coupons.code, order.couponCode));
  }
  await tx.update(orders).set({ status, ...(release ? { resourcesReleasedAt: new Date() } : {}) }).where(eq(orders.id, order.id));
  await tx.update(payments).set({ status }).where(eq(payments.orderId, order.id));
  if (!order.isDemo) await tx.insert(orderEmails).values({ orderId: order.id, event: status }).onConflictDoNothing();
  return true;
}
