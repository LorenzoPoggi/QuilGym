import { isAuthorizedCron } from "@/lib/cron-auth";
import { expirePendingOrders } from "@/lib/order-expiry";
import { deliverOrderEmails } from "@/lib/order-email";

export const runtime = "nodejs";

/** Vence pedidos pendientes sin pago iniciado y envía los avisos de cancelación. Vercel Cron llama por GET. */
async function handler(request: Request) {
  if (!isAuthorizedCron(request)) return new Response(null, { status: 401 });
  const { cancelled } = await expirePendingOrders();
  if (cancelled) await deliverOrderEmails();
  return Response.json({ cancelled });
}

export { handler as GET, handler as POST };
