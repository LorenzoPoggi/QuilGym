"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCart, readCartId } from "./cart";
import { getCheckoutConfig } from "./checkout-config";
import { checkoutFingerprint, signQuote } from "./checkout-security";
import { normalizePostalCode, quoteDelivery, UUID_PATTERN, validateCheckout } from "./checkout-validation";
import { CheckoutError, createOrder, findOwnedOrder, transitionOrder } from "./order-service";
import { withOrderTransaction } from "./db/transaction";
import { orders } from "./db/schema";
import type { CheckoutQuote, CheckoutResult, DeliveryMethod, OrderStatus } from "./checkout-types";
import { deliverOrderEmails } from "./order-email";
import { currentUser } from "./auth";

export async function getCheckoutQuote(delivery: DeliveryMethod, rawPostalCode: string): Promise<{ ok: true; quote: CheckoutQuote } | { ok: false; error: string }> {
  if (!["pickup", "shipping"].includes(delivery) || typeof rawPostalCode !== "string" || rawPostalCode.length > 12) return { ok: false, error: "Revisá los datos de entrega." };
  try {
    const cartId = await readCartId();
    if (!cartId) return { ok: false, error: "Agregá productos al carrito." };
    const cart = await getCart(cartId);
    if (!cart.lines.length || cart.hasBlockingIssues || cart.hasPriceChanges) return { ok: false, error: "Revisá el stock y confirmá los precios en el carrito." };
    const config = getCheckoutConfig();
    const postalCode = delivery === "pickup" ? "" : normalizePostalCode(rawPostalCode);
    const shipping = quoteDelivery(config, delivery, postalCode);
    const totalArs = cart.totalArs + shipping.shippingArs;
    const token = signQuote(cartId, { expires: Date.now() + 15 * 60_000, delivery, postalCode, demo: config.demo,
      fingerprint: checkoutFingerprint(cart.lines, cart.discountArs, cart.coupon?.code ?? null), shippingArs: shipping.shippingArs, totalArs });
    return { ok: true, quote: { ...shipping, totalArs, token } };
  } catch (error) {
    return { ok: false, error: error instanceof Error && !('query' in error) && /tarifa|postal|retiro/.test(error.message) ? error.message : "No pudimos cotizar la entrega. Intentá nuevamente." };
  }
}

export async function submitCheckout(raw: unknown): Promise<CheckoutResult> {
  const parsed = validateCheckout(raw);
  if (!parsed.ok) return { ok: false, error: "Revisá los campos marcados.", fields: parsed.fields };
  const cartId = await readCartId();
  if (!cartId) return { ok: false, error: "Tu sesión de carrito venció." };
  try {
    const user = await currentUser();
    const orderId = await createOrder(parsed.value, cartId, user?.id);
    revalidatePath("/carrito");
    after(() => deliverOrderEmails(orderId));
    return { ok: true, orderId };
  } catch (error) {
    return { ok: false, error: error instanceof CheckoutError ? error.message : "No pudimos guardar el pedido. Podés reintentar sin duplicarlo." };
  }
}

/** Simulador autorizado por cookie o cuenta, por orden y por entorno; inalcanzable en producción. */
export async function simulatePayment(id: string, status: OrderStatus): Promise<{ ok: boolean; error?: string }> {
  if (!getCheckoutConfig().demo || !UUID_PATTERN.test(id) || !["pending", "approved", "rejected", "cancelled", "refunded"].includes(status)) return { ok: false, error: "Simulación no disponible." };
  const owned = await findOwnedOrder(id);
  if (!owned?.isDemo) return { ok: false, error: "Pedido de prueba no disponible." };
  const ok = await withOrderTransaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, owned.id)).for("update");
    return order?.isDemo ? transitionOrder(tx, order, status) : false;
  });
  revalidatePath(`/checkout/confirmacion/${id}`);
  return { ok, ...(ok ? {} : { error: "Ese cambio no corresponde al estado actual del pedido." }) };
}
