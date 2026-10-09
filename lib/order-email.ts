import "server-only";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import { orderEmails, orders, shipments } from "./db/schema";
import { formatArs } from "./commerce";
import { orderPageUrl } from "./checkout-config";
import { orderStatusLabels, type OrderStatus } from "./checkout-types";

/** Outbox persistente: se reintenta con el mismo Idempotency-Key; nunca envía pedidos demo. */
export async function deliverOrderEmails(orderId?: string) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
  const rows = await db.select({ event: orderEmails, order: orders, shipment: shipments }).from(orderEmails)
    .innerJoin(orders, eq(orderEmails.orderId, orders.id)).leftJoin(shipments, eq(shipments.orderId, orders.id))
    .where(and(isNull(orderEmails.sentAt), eq(orders.isDemo, false), lt(orderEmails.attempts, 10), orderId ? eq(orders.id, orderId) : undefined)).limit(20);
  for (const { event, order, shipment } of rows) {
    // Resend retiene idempotencia 24 h: después se requiere revisión operativa, no reenviar a ciegas.
    if (event.attempts > 0 && Date.now() - event.createdAt.getTime() > 23 * 60 * 60_000) continue;
    await db.update(orderEmails).set({ attempts: event.attempts + 1 }).where(eq(orderEmails.id, event.id));
    const status = event.event === "created" ? "Pedido recibido" : event.event === "ready_for_pickup" ? "Tu pedido está listo para retirar"
      : event.event === "shipped" ? "Despachamos tu pedido" : orderStatusLabels[event.event as OrderStatus] ?? "Actualización de tu pedido";
    const link = orderPageUrl(order.id);
    const pickup = order.pickupDetails ? `${order.pickupDetails.address} (${order.pickupDetails.hours})` : "el local";
    const detail = event.event === "ready_for_pickup" ? `Podés retirarlo en ${pickup}.${order.status === "pending" && order.paymentMethod === "cash" ? " Lo abonás en efectivo al retirarlo." : ""}`
      : event.event === "shipped" ? `${shipment?.label ? `${shipment.label}. ` : ""}${shipment?.trackingCode ? `Código de seguimiento: ${shipment.trackingCode}.` : "Te avisamos cuando tengamos el código de seguimiento."}`
      : `${order.delivery === "pickup" ? "Retiro en el local: esperá nuestro aviso antes de acercarte." : "Te avisaremos cuando el pedido se despache."}\nSi el pago está pendiente, el pedido todavía no está aprobado.`;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `order-email-${event.id}` },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [order.email], subject: `QuilGym · ${status}`,
          text: `Hola ${order.name}.\n${status}.\nPedido: ${order.id}\nTotal: ${formatArs(order.totalArs)}.\n${detail}${link ? `\nVer tu pedido: ${link}` : ""}` }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) await db.update(orderEmails).set({ sentAt: new Date() }).where(eq(orderEmails.id, event.id));
    } catch { /* Se conserva en la outbox sin registrar PII ni credenciales. */ }
  }
}
