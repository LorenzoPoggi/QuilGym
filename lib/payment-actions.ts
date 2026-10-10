"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { findOwnedOrder } from "./order-service";
import { paymentSetup, reconcileProviderPayment, submitProviderPayment } from "./mercadopago";
import { deliverOrderEmails } from "./order-email";
import { consumeRateLimit } from "./rate-limit";

export async function preparePayment(id: string, accessToken?: string | null) {
  let stage = "order_lookup";
  try {
    const order = await findOwnedOrder(id, accessToken);
    if (!order) return { ok: false as const, error: "Pedido no disponible." };
    stage = "rate_limit";
    if (!await consumeRateLimit(`payment:prepare:${order.id}`, 12, 10 * 60_000)) return { ok: false as const, error: "Abriste Mercado Pago muchas veces para este pedido. Esperá unos minutos y reintentá." };
    stage = "payment_setup";
    return { ok: true as const, data: await paymentSetup(order) };
  } catch (error) {
    const value = error && typeof error === "object" ? error as { name?: unknown; code?: unknown; status?: unknown } : {};
    console.error("[Checkout] No se pudo preparar el pago", {
      stage,
      name: typeof value.name === "string" ? value.name : "UnknownError",
      code: typeof value.code === "string" || typeof value.code === "number" ? value.code : undefined,
      status: typeof value.status === "number" ? value.status : undefined,
    });
    return { ok: false as const, error: "No pudimos abrir el pago. Reintentá en unos instantes." };
  }
}

export async function payOrder(id: string, raw: unknown, accessToken?: string | null) {
  const order = await findOwnedOrder(id, accessToken);
  if (!order) return { ok: false, error: "Pedido no disponible." };
  try {
    if (!await consumeRateLimit(`payment:submit:${order.id}`, 10, 10 * 60_000)) return { ok: false, error: "Hubo muchos intentos de pago para este pedido. Esperá unos minutos y reintentá." };
    await submitProviderPayment(order, raw);
    revalidatePath(`/checkout/confirmacion/${id}`);
    after(() => deliverOrderEmails(id));
    return { ok: true };
  } catch { return { ok: false, error: "No pudimos completar el pago. Reintentá con este mismo pedido; no crees otro mientras se verifica." }; }
}

/** El retorno del navegador no confirma nada: se consulta el pago con el token privado. */
export async function verifyReturnedPayment(id: string, paymentId: string, accessToken?: string | null) {
  if (!/^\d{1,30}$/.test(paymentId)) return { ok: false as const, error: "Identificador de pago inválido." };
  const order = await findOwnedOrder(id, accessToken);
  if (!order || order.isDemo || order.paymentMethod !== "mercadopago") return { ok: false as const, error: "Pedido no disponible." };
  try {
    if (!await consumeRateLimit(`payment:return:${order.id}`, 8, 10 * 60_000)) {
      return { ok: false as const, error: "Estamos verificando el pago. Esperá unos minutos y actualizá el estado." };
    }
    const verifiedOrderId = await reconcileProviderPayment(paymentId);
    if (verifiedOrderId !== order.id) return { ok: false as const, error: "El pago no corresponde a este pedido." };
    revalidatePath(`/checkout/confirmacion/${order.id}`);
    after(() => deliverOrderEmails(order.id));
    return { ok: true as const };
  } catch (error) {
    console.error("[Mercado Pago] No se pudo verificar el pago de retorno", { order: order.id.slice(0, 8), error: error instanceof Error ? error.message : "Error desconocido" });
    return { ok: false as const, error: "No pudimos verificar este pago todavía. No vuelvas a pagarlo; actualizá el estado en unos minutos." };
  }
}
