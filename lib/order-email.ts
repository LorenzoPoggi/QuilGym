import "server-only";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import { orderEmails, orders } from "./db/schema";
import { formatArs } from "./commerce";
import { orderStatusLabels, type OrderStatus } from "./checkout-types";

/** Outbox persistente: se reintenta con el mismo Idempotency-Key; nunca envía pedidos demo. */
export async function deliverOrderEmails(orderId?: string) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
  const rows = await db.select({ event: orderEmails, order: orders }).from(orderEmails)
    .innerJoin(orders, eq(orderEmails.orderId, orders.id))
    .where(and(isNull(orderEmails.sentAt), eq(orders.isDemo, false), lt(orderEmails.attempts, 10), orderId ? eq(orders.id, orderId) : undefined)).limit(20);
  for (const { event, order } of rows) {
    // Resend retiene idempotencia 24 h: después se requiere revisión operativa, no reenviar a ciegas.
    if (event.attempts > 0 && Date.now() - event.createdAt.getTime() > 23 * 60 * 60_000) continue;
    await db.update(orderEmails).set({ attempts: event.attempts + 1 }).where(eq(orderEmails.id, event.id));
    const status = event.event === "created" ? "Pedido recibido" : orderStatusLabels[event.event as OrderStatus];
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `order-email-${event.id}` },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [order.email], subject: `QuilGym · ${status}`,
          text: `Hola ${order.name}.\n${status}.\nPedido: ${order.id}\nTotal: ${formatArs(order.totalArs)}.\n${order.delivery === "pickup" ? "Retiro en el local: esperá nuestro aviso antes de acercarte." : "Te avisaremos cuando el pedido se despache."}\nSi el pago está pendiente, el pedido todavía no está aprobado.` }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) await db.update(orderEmails).set({ sentAt: new Date() }).where(eq(orderEmails.id, event.id));
    } catch { /* Se conserva en la outbox sin registrar PII ni credenciales. */ }
  }
}
