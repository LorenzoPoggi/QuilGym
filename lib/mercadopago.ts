import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { orders, payments } from "./db/schema";
import { withOrderTransaction } from "./db/transaction";
import { getCheckoutConfig, orderPageUrl, siteUrl } from "./checkout-config";
import { providerStatus } from "./order-state";
import { transitionOrder } from "./order-service";

type ProviderPayment = { id: number; external_reference: string; transaction_amount: number; currency_id: string;
  status: string; date_last_updated: string; transaction_details?: { external_resource_url?: string } };

async function request<T>(path: string, body?: object, key?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.mercadopago.com${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...(key ? { "X-Idempotency-Key": key } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store", signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error("[Mercado Pago] No se pudo conectar con la API", { method: body ? "POST" : "GET", path, name });
    throw new Error("No pudimos comunicarnos con Mercado Pago. Reintentá con el mismo pedido.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    const causes = Array.isArray(payload.cause)
      ? payload.cause.slice(0, 3).map((cause) => {
        const item = cause && typeof cause === "object" ? cause as Record<string, unknown> : {};
        return { code: item.code };
      })
      : undefined;
    console.error("[Mercado Pago] La API rechazó la solicitud", {
      method: body ? "POST" : "GET", path, status: response.status,
      error: payload.error, causes,
    });
    throw new Error("No pudimos comunicarnos con Mercado Pago. Reintentá con el mismo pedido.");
  }
  return response.json() as Promise<T>;
}

export function safePaymentUrl(raw: string | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const allowed = ["mercadopago.com", "mercadopago.com.ar", "mercadolibre.com", "mercadolibre.com.ar"];
    return url.protocol === "https:" && allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch { return null; }
}

export async function paymentSetup(order: typeof orders.$inferSelect) {
  let stage = "eligibility";
  try {
    if (order.isDemo || order.paymentMethod !== "mercadopago" || order.status !== "pending" || !getCheckoutConfig().payments.mercadopago) throw new Error("Pago no disponible.");
    stage = "payment_record";
    return await withOrderTransaction(async (tx) => {
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id)).for("update");
      if (!payment) throw new Error("Pago no disponible.");
      let preferenceId = payment.preferenceId;
      let initPoint: string | undefined;
      if (!preferenceId) {
        stage = "preference_create";
        // Incluye el link firmado: la vuelta desde la app de Mercado Pago puede abrir otro navegador sin la cookie.
        const returnUrl = orderPageUrl(order.id) ?? `${siteUrl()}/checkout/confirmacion/${order.id}`;
        const preference = await request<{ id: string; init_point: string }>("/checkout/preferences", {
          items: [{ id: order.id, title: "Pedido QuilGym", quantity: 1, unit_price: order.totalArs, currency_id: "ARS" }],
          payer: { email: order.email }, external_reference: order.id,
          ...(order.paymentChoice === "mercado_credito" ? { purpose: "onboarding_credits" } : {}),
          ...(order.paymentChoice === "mercadopago" ? { payment_methods: { excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "prepaid_card" }, { id: "ticket" }] } } : {}),
          notification_url: `${siteUrl()}/api/payments/mercadopago/webhook`,
          back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
          auto_return: "approved",
        }, payment.id);
        preferenceId = preference.id;
        initPoint = preference.init_point;
        stage = "preference_save";
        await tx.update(payments).set({ preferenceId }).where(eq(payments.id, payment.id));
      } else {
        stage = "preference_load";
        const preference = await request<{ init_point: string }>(`/checkout/preferences/${encodeURIComponent(preferenceId)}`);
        initPoint = preference.init_point;
      }
      stage = "payment_url";
      const safeInitPoint = safePaymentUrl(initPoint);
      if (!safeInitPoint) throw new Error("Mercado Pago no devolvió un enlace de pago seguro.");
      return { publicKey: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY!, preferenceId, initPoint: safeInitPoint, amount: order.totalArs, email: order.email };
    });
  } catch (error) {
    const value = error && typeof error === "object" ? error as { name?: unknown; code?: unknown; status?: unknown } : {};
    const knownReason = error instanceof Error && ["Pago no disponible.", "Mercado Pago no devolvió un enlace de pago seguro."].includes(error.message)
      ? error.message : undefined;
    console.error("[Mercado Pago] No se pudo configurar la preferencia", {
      stage,
      reason: knownReason,
      name: typeof value.name === "string" ? value.name : "UnknownError",
      code: typeof value.code === "string" || typeof value.code === "number" ? value.code : undefined,
      status: typeof value.status === "number" ? value.status : undefined,
    });
    throw error;
  }
}

/** Lista permitida: descarta cualquier monto, referencia o dato de tarjeta crudo enviado por el navegador. */
export async function submitProviderPayment(order: typeof orders.$inferSelect, raw: unknown) {
  if (order.isDemo || order.paymentMethod !== "mercadopago" || !["debit_card", "credit_card"].includes(order.paymentChoice) || order.status !== "pending" || !getCheckoutConfig().payments.mercadopago) throw new Error("Pago no disponible.");
  if (!raw || typeof raw !== "object") throw new Error("Datos de pago inválidos.");
  const value = raw as Record<string, unknown>;
  const method = typeof value.payment_method_id === "string" && /^[\w-]{1,60}$/.test(value.payment_method_id) ? value.payment_method_id : null;
  if (!method) throw new Error("Elegí un medio de pago válido.");
  const token = typeof value.token === "string" && /^[a-zA-Z0-9_-]{1,256}$/.test(value.token) ? value.token : undefined;
  if (!token && !["rapipago", "pagofacil"].includes(method)) throw new Error("La tarjeta debe ser tokenizada por Mercado Pago.");
  const rawPayer = value.payer && typeof value.payer === "object" ? value.payer as Record<string, unknown> : {};
  const rawId = rawPayer.identification && typeof rawPayer.identification === "object" ? rawPayer.identification as Record<string, unknown> : {};
  const identification = typeof rawId.type === "string" && /^[a-zA-Z]{2,10}$/.test(rawId.type) && typeof rawId.number === "string" && /^[\w.-]{3,30}$/.test(rawId.number)
    ? { type: rawId.type, number: rawId.number } : undefined;
  const installments = Number.isInteger(value.installments) && Number(value.installments) > 0 && Number(value.installments) <= 48 ? value.installments : 1;
  const [payment] = await db.select().from(payments).where(eq(payments.orderId, order.id));
  if (!payment) throw new Error("Pedido no disponible.");
  if (payment.providerId) return reconcileProviderPayment(payment.providerId);
  const result = await request<ProviderPayment>("/v1/payments", {
    transaction_amount: order.totalArs, description: "Pedido QuilGym", external_reference: order.id,
    notification_url: `${siteUrl()}/api/payments/mercadopago/webhook`,
    payment_method_id: method, token, installments,
    issuer_id: typeof value.issuer_id === "string" && /^\d{1,20}$/.test(value.issuer_id) ? value.issuer_id : undefined,
    payer: { email: order.email, first_name: order.name.split(" ")[0], last_name: order.name.split(" ").slice(1).join(" ") || order.name, identification },
  }, payment.id);
  // La conciliación bloquea la orden y verifica ID/importe antes de guardar el vínculo.
  return reconcileProviderPayment(String(result.id));
}

export async function reconcileProviderPayment(id: string) {
  if (!/^\d{1,30}$/.test(id) || !process.env.MP_ACCESS_TOKEN) throw new Error("Pago inválido.");
  const payment = await request<ProviderPayment>(`/v1/payments/${id}`);
  const updated = new Date(payment.date_last_updated);
  if (String(payment.id) !== id || !Number.isFinite(updated.getTime())) throw new Error("Respuesta de pago inválida.");
  return withOrderTransaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.external_reference)).for("update");
    if (!order) return null;
    if (order.isDemo || order.paymentMethod !== "mercadopago" || payment.currency_id !== "ARS" || payment.transaction_amount !== order.totalArs) throw new Error("El pago no coincide con el pedido.");
    const [stored] = await tx.select().from(payments).where(eq(payments.orderId, order.id)).for("update");
    const status = providerStatus(payment.status);
    if (stored.providerId && stored.providerId !== id) {
      // Checkout Pro permite reintentar con otro pago: un intento fallido se reemplaza; uno fallido tardío se ignora.
      if (status === "rejected" || status === "cancelled") return order.id;
      if (stored.status === "approved" || stored.status === "refunded") {
        console.error("[Mercado Pago] Segundo pago sobre un pedido ya cobrado", { order: order.id.slice(0, 8), payment: id, stored: stored.providerId });
        throw new Error("El pedido ya tiene otro pago asociado.");
      }
    } else if (stored.providerUpdatedAt && stored.providerUpdatedAt >= updated) return order.id;
    const record = { providerId: id, providerUpdatedAt: updated, ticketUrl: safePaymentUrl(payment.transaction_details?.external_resource_url) };
    if (await transitionOrder(tx, order, status)) await tx.update(payments).set(record).where(eq(payments.id, stored.id));
    else {
      // El pedido ya cerró (p. ej., cancelado por vencimiento): se registra el estado real del proveedor para que el
      // panel muestre «Pago aprobado sobre pedido cancelado» en vez de perder el cobro.
      await tx.update(payments).set({ ...record, status }).where(eq(payments.id, stored.id));
      if (status === "approved") console.error("[Mercado Pago] Pago aprobado sobre un pedido cerrado", { order: order.id.slice(0, 8), status: order.status, payment: id });
    }
    return order.id;
  });
}
