"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { findOwnedOrder } from "./order-service";
import { cardPaymentSetup, paymentSetup, reconcileProviderPayment, submitProviderPayment, type CardPaymentResult } from "./mercadopago";
import { CardPaymentError, isCardChoice, MercadoPagoApiError } from "./mercadopago-card";
import { deliverOrderEmails } from "./order-email";
import { consumeRateLimit } from "./rate-limit";

/** Checkout Pro (preferencia + redirección). Las tarjetas usan `prepareCardPayment`. */
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

/** Datos públicos para el Card Payment Brick: clave pública, monto fijado por el servidor y tope de cuotas. */
export async function prepareCardPayment(id: string, accessToken?: string | null) {
  try {
    const order = await findOwnedOrder(id, accessToken);
    if (!order || !isCardChoice(order.paymentChoice)) return { ok: false as const, error: "Pedido no disponible." };
    if (!await consumeRateLimit(`payment:prepare:${order.id}`, 20, 10 * 60_000)) return { ok: false as const, error: "Recargaste el pago muchas veces. Esperá unos minutos y reintentá." };
    return { ok: true as const, data: await cardPaymentSetup(order) };
  } catch (error) {
    console.error("[Checkout] No se pudo preparar el pago con tarjeta", { name: error instanceof Error ? error.name : "UnknownError" });
    return { ok: false as const, error: "El formulario de pago no está disponible. Recargá para reintentar con este pedido." };
  }
}

export type PayOrderResult = ({ ok: true } & CardPaymentResult) | { ok: false; error: string };

/**
 * Envía el pago del Card Payment Brick. `formData` y `additionalData` pasan por una lista permitida en el
 * servidor; el monto, el email y la referencia salen del pedido. Devuelve el resultado para que el comprador
 * vea enseguida si se aprobó, quedó en revisión o fue rechazado (y pueda reintentar con otra tarjeta).
 */
export async function payOrder(id: string, submission: { formData: unknown; additionalData?: unknown }, accessToken?: string | null): Promise<PayOrderResult> {
  const order = await findOwnedOrder(id, accessToken);
  if (!order) return { ok: false, error: "Pedido no disponible." };
  try {
    if (!await consumeRateLimit(`payment:submit:${order.id}`, 10, 10 * 60_000)) return { ok: false, error: "Hubo muchos intentos de pago para este pedido. Esperá unos minutos y reintentá." };
    const result = await submitProviderPayment(order, submission?.formData, submission?.additionalData);
    revalidatePath(`/checkout/confirmacion/${id}`);
    after(() => deliverOrderEmails(id));
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof CardPaymentError) return { ok: false, error: error.message };
    if (error instanceof MercadoPagoApiError && error.status === 401) {
      return { ok: false, error: "Mercado Pago rechazó la credencial privada de este entorno. El pedido no se cobró; revisá el Access Token de Mercado Pago configurado en Preview." };
    }
    if (error instanceof MercadoPagoApiError && error.status >= 400 && error.status < 500) {
      return { ok: false, error: "Mercado Pago no aceptó los datos de la tarjeta. Revisalos o probá con otra tarjeta; no se cobró nada." };
    }
    console.error("[Mercado Pago] No se pudo completar el pago con tarjeta", { order: order.id.slice(0, 8), name: error instanceof Error ? error.name : "UnknownError" });
    return { ok: false, error: "No pudimos confirmar el pago. Antes de reintentar, tocá «Actualizar estado»: si el pago se registró, lo vas a ver en este pedido." };
  }
}

/** El retorno del navegador (o el fin del desafío 3DS) no confirma nada: se consulta el pago con el token privado. */
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
