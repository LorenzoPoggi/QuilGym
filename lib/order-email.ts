import "server-only";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import { invoices, orderEmails, orderItems, orders, shipments, shipmentTracking } from "./db/schema";
import { tableExists } from "./db/table-exists";
import { orderPageUrl, orderTrackingUrl, siteUrl } from "./checkout-config";
import { readEmailConfig, sendWithResend } from "./email-config";
import { orderEmailContent, type OrderEmailEvent } from "./email-templates";
import { invoicesAvailable, processPendingInvoices } from "./invoicing";

const KNOWN_EVENTS = new Set<OrderEmailEvent>(["created", "approved", "payment_rejected", "rejected", "cancelled", "expired", "refunded", "ready_for_pickup", "shipped", "out_for_delivery", "delivered", "invoice_issued"]);

/**
 * Outbox persistente de avisos al cliente. Antes de enviar intenta emitir las facturas pendientes (proveedor con
 * API), así el cron diario y cada aprobación también reintentan la facturación. Se reintenta con el mismo
 * Idempotency-Key; nunca envía pedidos demo y nunca registra emails, nombres ni enlaces.
 */
export async function deliverOrderEmails(orderId?: string) {
  try { await processPendingInvoices(orderId); }
  catch (error) { console.error("[Facturación] Falló el procesamiento de facturas", { name: error instanceof Error ? error.name : "UnknownError" }); }
  if (!readEmailConfig(process.env).enabled) return;
  const rows = await db.select({ event: orderEmails, order: orders, shipment: shipments }).from(orderEmails)
    .innerJoin(orders, eq(orderEmails.orderId, orders.id)).leftJoin(shipments, eq(shipments.orderId, orders.id))
    .where(and(isNull(orderEmails.sentAt), eq(orders.isDemo, false), lt(orderEmails.attempts, 10), orderId ? eq(orders.id, orderId) : undefined)).limit(20);
  const site = siteUrl();
  const invoicesReady = rows.some(({ event }) => event.event === "invoice_issued") && await invoicesAvailable();
  for (const { event, order, shipment } of rows) {
    // Resend retiene idempotencia 24 h: después se requiere revisión operativa, no reenviar a ciegas.
    if (event.attempts > 0 && Date.now() - event.createdAt.getTime() > 23 * 60 * 60_000) continue;
    const kind = KNOWN_EVENTS.has(event.event as OrderEmailEvent) ? event.event as OrderEmailEvent : null;
    if (!kind) continue;
    await db.update(orderEmails).set({ attempts: event.attempts + 1 }).where(eq(orderEmails.id, event.id));
    const withLines = kind === "created" || kind === "approved";
    const lines = withLines ? (await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id)))
      .map((line) => ({ name: [line.name, line.variantLabel].filter(Boolean).join(" · "), quantity: line.quantity, totalArs: line.quantity * line.unitPriceArs })) : undefined;
    const [invoice] = kind === "invoice_issued" && invoicesReady ? await db.select().from(invoices).where(eq(invoices.orderId, order.id)).limit(1) : [];
    if (kind === "invoice_issued" && invoice?.status !== "issued") continue;
    // Ventana de llegada y transportista (migración 0010) para «En camino» / «En distribución».
    const [tracking] = kind === "out_for_delivery" && shipment && await tableExists(db, "shipment_tracking")
      ? await db.select({ carrier: shipmentTracking.carrier, etaFrom: shipmentTracking.etaFrom, etaTo: shipmentTracking.etaTo }).from(shipmentTracking).where(eq(shipmentTracking.shipmentId, shipment.id)).limit(1)
      : [];
    const content = orderEmailContent(kind, { order, link: orderPageUrl(order.id), trackingLink: orderTrackingUrl(order.id), siteUrl: site, shipment, tracking: tracking ?? null, lines, invoice });
    const pdf = invoice?.pdfUrl?.startsWith("https://") ? invoice.pdfUrl : null;
    const result = await sendWithResend(process.env, {
      to: order.email, ...content, tag: `order_${kind}`,
      // Resend descarga el PDF desde la URL (la del proveedor es temporal: se adjunta al emitir).
      ...(pdf ? { attachments: [{ filename: `factura-QG-${order.id.slice(0, 8).toUpperCase()}.pdf`, path: pdf }] } : {}),
    }, `order-email-${event.id}`);
    if (result.ok) await db.update(orderEmails).set({ sentAt: new Date() }).where(eq(orderEmails.id, event.id));
    else console.warn("[Emails] No se pudo enviar un aviso de pedido", { order: order.id.slice(0, 8), event: kind, reason: result.reason });
  }
}
