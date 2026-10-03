import { timingSafeEqual } from "node:crypto";
import { deliverOrderEmails } from "@/lib/order-email";

/** Endpoint para el job de reintentos. No está habilitado hasta configurar CRON_SECRET. */
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : "";
  const supplied = request.headers.get("authorization") ?? "";
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) return new Response(null, { status: 401 });
  await deliverOrderEmails();
  return Response.json({ processed: true });
}
