"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCart, readCartId } from "./cart";
import { getCheckoutConfig } from "./checkout-config";
import { checkoutFingerprint, signQuote } from "./checkout-security";
import { UUID_PATTERN, validateCheckout } from "./checkout-validation";
import { buildDeliveryOptions, parseQuoteRequest } from "./delivery-quote";
import { geocodeAddress } from "./geo";
import { getCarrier } from "./carriers";
import { parcelForLines } from "./shipping-parcel";
import { tableExists } from "./db/table-exists";
import { db } from "./db";
import { CheckoutError, createOrder, findOwnedOrder, transitionOrder } from "./order-service";
import { withOrderTransaction } from "./db/transaction";
import { orders } from "./db/schema";
import type { CheckoutQuoteResponse, CheckoutResult, OrderStatus } from "./checkout-types";
import { deliverOrderEmails } from "./order-email";
import { currentUser } from "./auth";
import { consumeRateLimit } from "./rate-limit";
import { rememberOrder } from "./order-cookie-server";
import { linkOrderToVisit } from "./analytics";
import { paymentSetup } from "./mercadopago";

/**
 * Cotiza el retiro o todas las opciones para una dirección (entrega propia, transportista o tarifa fija).
 * El navegador manda la dirección y, como mucho, una pista de ubicación: precio, distancia y elegibilidad
 * los calcula el servidor, y cada opción vuelve con su propia cotización firmada.
 */
export async function getCheckoutQuote(rawRequest: unknown): Promise<CheckoutQuoteResponse> {
  const request = parseQuoteRequest(rawRequest);
  if (!request) return { ok: false, error: "Revisá los datos de entrega." };
  try {
    const cartId = await readCartId();
    if (!cartId) return { ok: false, error: "Agregá productos al carrito." };
    if (!await consumeRateLimit(`checkout:quote:${cartId}`, 30, 60_000)) return { ok: false, error: "Hiciste muchas consultas de envío. Esperá un minuto y volvé a intentar." };
    const cart = await getCart(cartId);
    if (!cart.lines.length || cart.hasBlockingIssues || cart.hasPriceChanges) return { ok: false, error: "Revisá el stock y confirmá los precios en el carrito." };
    const config = getCheckoutConfig();
    const result = await buildDeliveryOptions(config, request, { totalArs: cart.totalArs, fingerprint: checkoutFingerprint(cart.lines, cart.discountArs, cart.coupon?.code ?? null) }, {
      geocode: (address) => geocodeAddress(address),
      deliveryTablesReady: () => tableExists(db, "order_delivery"),
      carrier: request.delivery === "address" ? getCarrier() : null,
      parcel: () => parcelForLines(cart.lines.filter((line) => line.available)),
      sign: (payload) => signQuote(cartId, payload),
    });
    if (!result.ok) return result;
    return { ok: true, quote: result.options[0], options: result.options, ...(result.notice ? { notice: result.notice } : {}) };
  } catch (error) {
    return { ok: false, error: error instanceof Error && !('query' in error) && /tarifa|postal|retiro|entrega/.test(error.message) ? error.message : "No pudimos cotizar la entrega. Intentá nuevamente." };
  }
}

export async function submitCheckout(raw: unknown): Promise<CheckoutResult> {
  const parsed = validateCheckout(raw);
  if (!parsed.ok) return { ok: false, error: "Revisá los campos marcados.", fields: parsed.fields };
  const cartId = await readCartId();
  if (!cartId) return { ok: false, error: "Tu sesión de carrito venció." };
  try {
    if (!await consumeRateLimit(`checkout:submit:${cartId}`, 10, 10 * 60_000)) return { ok: false, error: "Recibimos muchos intentos para este carrito. Esperá unos minutos antes de reintentar." };
    const user = await currentUser();
    const orderId = await createOrder(parsed.value, cartId, user?.id);
    // Invitados: el aviso de pedido en curso los encuentra por esta cookie firmada (las cuentas, por la sesión).
    if (!user) await rememberOrder(orderId);
    await linkOrderToVisit(orderId);
    after(() => deliverOrderEmails(orderId));
    // Mercado Pago y Crédito: la preferencia se crea acá para redirigir sin pasar por el checkout ya vacío.
    // Si falla, el pedido queda creado y la confirmación ofrece «Ir a pagar».
    const redirectUrl = ["mercadopago", "mercado_credito"].includes(parsed.value.paymentChoice) ? await checkoutProUrl(orderId) : null;
    return { ok: true, orderId, ...(redirectUrl ? { redirectUrl } : {}) };
  } catch (error) {
    return { ok: false, error: error instanceof CheckoutError ? error.message : "No pudimos guardar el pedido. Podés reintentar sin duplicarlo." };
  }
}

async function checkoutProUrl(orderId: string): Promise<string | null> {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order || order.isDemo || order.status !== "pending") return null;
    if (!await consumeRateLimit(`payment:prepare:${order.id}`, 12, 10 * 60_000)) return null;
    const setup = await paymentSetup(order);
    return setup.initPoint ?? null;
  } catch (error) {
    console.error("[Checkout] No se pudo crear la preferencia al confirmar", { name: error instanceof Error ? error.name : "UnknownError" });
    return null;
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
