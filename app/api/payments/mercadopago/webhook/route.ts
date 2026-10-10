import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyMercadoPagoSignature } from "@/lib/checkout-security";
import { allowInvalidMercadoPagoWebhook } from "@/lib/mercadopago-webhook-rate-limit";
import { reconcileProviderMerchantOrder, reconcileProviderPayment } from "@/lib/mercadopago";
import { deliverOrderEmails } from "@/lib/order-email";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !process.env.MP_ACCESS_TOKEN) return Response.json({ error: "Servicio no configurado" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const signedId = params.get("data.id") ?? "";
  const topic = params.get("topic") ?? params.get("type");
  const signed = verifyMercadoPagoSignature(request.headers.get("x-signature"), request.headers.get("x-request-id"), signedId, secret);
  const legacyMerchantOrder = !signed && topic === "merchant_order" && /^\d{1,30}$/.test(params.get("id") ?? "");
  if (!signed) {
    try {
      if (!await allowInvalidMercadoPagoWebhook(request, secret)) return Response.json({ error: "Demasiados intentos" }, { status: 429 });
    } catch { return Response.json({ error: "No se pudo validar la solicitud" }, { status: 503 }); }
    if (!legacyMerchantOrder) return Response.json({ error: "Firma inválida" }, { status: 401 });
  }
  try {
    const id = signed ? signedId : params.get("id")!;
    const orderId = topic === "merchant_order"
      ? await reconcileProviderMerchantOrder(id)
      : signed ? await reconcileProviderPayment(id) : null;
    if (orderId) {
      revalidatePath(`/checkout/confirmacion/${orderId}`);
      after(() => deliverOrderEmails(orderId));
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("[Mercado Pago] No se pudo conciliar la notificación", {
      topic: topic ?? "payment",
      error: error instanceof Error ? error.message : "Error desconocido",
    });
    return Response.json({ error: "No se pudo verificar el pago" }, { status: 503 });
  }
}
