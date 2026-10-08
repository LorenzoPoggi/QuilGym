"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { findOwnedOrder } from "./order-service";
import { paymentSetup, submitProviderPayment } from "./mercadopago";
import { deliverOrderEmails } from "./order-email";

export async function preparePayment(id: string, accessToken?: string | null) {
  let stage = "order_lookup";
  try {
    const order = await findOwnedOrder(id, accessToken);
    if (!order) return { ok: false as const, error: "Pedido no disponible." };
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
    await submitProviderPayment(order, raw);
    revalidatePath(`/checkout/confirmacion/${id}`);
    after(() => deliverOrderEmails(id));
    return { ok: true };
  } catch { return { ok: false, error: "No pudimos completar el pago. Reintentá con este mismo pedido; no crees otro mientras se verifica." }; }
}
