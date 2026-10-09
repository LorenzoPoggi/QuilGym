import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyMercadoPagoSignature } from "@/lib/checkout-security";
import { allowInvalidMercadoPagoWebhook } from "@/lib/mercadopago-webhook-rate-limit";
import { reconcileProviderPayment } from "@/lib/mercadopago";
import { deliverOrderEmails } from "@/lib/order-email";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !process.env.MP_ACCESS_TOKEN) return Response.json({ error: "Servicio no configurado" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("data.id") ?? "";
  if (!verifyMercadoPagoSignature(request.headers.get("x-signature"), request.headers.get("x-request-id"), id, secret)) {
    try {
      if (!await allowInvalidMercadoPagoWebhook(request, secret)) return Response.json({ error: "Demasiados intentos" }, { status: 429 });
    } catch { return Response.json({ error: "No se pudo validar la solicitud" }, { status: 503 }); }
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }
  try {
    const orderId = await reconcileProviderPayment(id);
    if (orderId) {
      revalidatePath(`/checkout/confirmacion/${orderId}`);
      after(() => deliverOrderEmails(orderId));
    }
    return Response.json({ received: true });
  } catch { return Response.json({ error: "No se pudo verificar el pago" }, { status: 503 }); }
}
