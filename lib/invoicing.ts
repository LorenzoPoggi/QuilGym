import "server-only";
import { and, asc, eq, lt, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { invoices, orderEmails, orderItems, orders, type Invoice } from "./db/schema";
import type { OrderTransaction } from "./db/transaction";
import { readInvoicingConfig, type TaxId, type VoucherType } from "./invoicing-config";
import { invoiceProviderFor, type InvoiceDraft } from "./invoicing-providers";

type Executor = { execute: (query: SQL) => PromiseLike<unknown> };
type Order = typeof orders.$inferSelect;
const MAX_ATTEMPTS = 5;
let tableSeen = false;

/** La tabla llega con la migración 0008; sin ella la facturación queda apagada y el resto del checkout sigue igual. */
export async function invoicesAvailable(executor: Executor = db) {
  if (tableSeen) return true;
  try {
    const result = await executor.execute(sql`select to_regclass('public.invoices') is not null as "exists"`) as { rows?: { exists: boolean }[] } | { exists: boolean }[];
    const rows = Array.isArray(result) ? result : result.rows ?? [];
    tableSeen = rows[0]?.exists === true;
    return tableSeen;
  } catch { return false; }
}

export function invoicingConfig() { return readInvoicingConfig(process.env); }

/** Guarda el DNI/CUIT informado en el checkout (dentro de la transacción del pedido). Sin tabla, no hace nada. */
export async function saveCheckoutReceiver(tx: OrderTransaction, order: Pick<Order, "id" | "name" | "totalArs" | "isDemo">, receiver: TaxId) {
  if (order.isDemo || !await invoicesAvailable(tx)) return false;
  const config = invoicingConfig();
  try {
    await tx.transaction(async (savepoint) => { await savepoint.insert(invoices).values({ orderId: order.id, status: "pending", provider: config.provider, voucherType: config.voucherType, pointOfSale: config.pointOfSale,
      amountArs: order.totalArs, receiverDocType: receiver.type, receiverDocNumber: receiver.number, receiverName: order.name.slice(0, 120) }).onConflictDoNothing(); });
    return true;
  } catch (error) {
    console.error("[Facturación] No se pudo guardar el DNI/CUIT del pedido", { order: order.id.slice(0, 8), name: error instanceof Error ? error.name : "UnknownError" });
    return false;
  }
}

/**
 * Punto de enganche de la emisión: se llama en la misma transacción que deja el pedido pagado (conciliación de
 * Mercado Pago, confirmación de efectivo/transferencia o reactivación). Solo crea o habilita la fila: la llamada
 * al proveedor ocurre fuera de la transacción (`processPendingInvoices`, junto con la outbox de emails).
 */
export async function queueInvoice(tx: OrderTransaction, order: Pick<Order, "id" | "name" | "totalArs" | "isDemo">) {
  if (order.isDemo || !await invoicesAvailable(tx)) return;
  // Savepoint: un problema con la factura nunca revierte la conciliación del pago.
  try { await tx.transaction(async (savepoint) => queueInvoiceRow(savepoint as unknown as OrderTransaction, order)); }
  catch (error) { console.error("[Facturación] No se pudo poner la factura en cola", { order: order.id.slice(0, 8), name: error instanceof Error ? error.name : "UnknownError" }); }
}

async function queueInvoiceRow(tx: OrderTransaction, order: Pick<Order, "id" | "name" | "totalArs" | "isDemo">) {
  const config = invoicingConfig();
  const status = config.provider === "manual" ? "manual" : "pending";
  const [existing] = await tx.select().from(invoices).where(eq(invoices.orderId, order.id)).for("update");
  if (!existing) {
    await tx.insert(invoices).values({ orderId: order.id, status, provider: config.provider, voucherType: config.voucherType, pointOfSale: config.pointOfSale,
      amountArs: order.totalArs, receiverDocType: "CF", receiverName: order.name.slice(0, 120) }).onConflictDoNothing();
  } else if ((existing.status === "pending" || existing.status === "manual") && (existing.status !== status || existing.provider !== config.provider)) {
    // La fila pudo nacer en el checkout (DNI/CUIT informado): al aprobarse toma el modo vigente (manual o API).
    await tx.update(invoices).set({ status, provider: config.provider }).where(eq(invoices.id, existing.id));
  }
}

export async function getOrderInvoice(orderId: string) {
  if (!await invoicesAvailable()) return { available: false as const, invoice: null };
  const [invoice] = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
  return { available: true as const, invoice: invoice ?? null };
}

const paymentLabel = (order: Order) => order.paymentMethod === "cash" ? "Efectivo" : order.paymentMethod === "transfer" ? "Transferencia bancaria"
  : order.paymentChoice === "credit_card" ? "Tarjeta de crédito" : order.paymentChoice === "debit_card" ? "Tarjeta de débito" : "Mercado Pago";

/** Datos para facturar un pedido: los usa el proveedor con API y el panel en modo manual. */
export async function invoiceDraftFor(order: Order, invoice: Pick<Invoice, "receiverDocType" | "receiverDocNumber" | "receiverName" | "voucherType" | "pointOfSale">, paidAt: Date) {
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id));
  const items = lines.map((line) => ({ code: line.sku, description: [line.name, line.variantLabel].filter(Boolean).join(" · "), quantity: line.quantity, unitPriceArs: line.unitPriceArs }));
  if (order.shippingArs > 0) items.push({ code: "ENVIO", description: "Envío a domicilio", quantity: 1, unitPriceArs: order.shippingArs });
  const address = order.address ? `${order.address.street} ${order.address.number}${order.address.apartment ? ` ${order.address.apartment}` : ""}, ${order.address.city}, ${order.address.province}` : null;
  return {
    orderId: order.id, date: paidAt, voucherType: (invoice.voucherType ?? "C") as VoucherType, pointOfSale: invoice.pointOfSale ?? 0,
    receiver: { docType: invoice.receiverDocType as InvoiceDraft["receiver"]["docType"], docNumber: invoice.receiverDocNumber, name: invoice.receiverDocType === "CF" ? "Consumidor final" : invoice.receiverName ?? order.name, email: order.email, address },
    items, discountArs: order.discountArs, totalArs: order.totalArs, paymentLabel: paymentLabel(order),
  } satisfies InvoiceDraft;
}

/**
 * Emite las facturas pendientes de pedidos pagados con el proveedor con API. Reclama cada fila con un UPDATE
 * condicional (`pending` → `processing`) para que dos ejecuciones no emitan dos veces. Una respuesta incierta
 * (timeout) deja la fila en `failed` con el aviso de revisar el proveedor: nunca reintenta sola en ese caso.
 */
export async function processPendingInvoices(orderId?: string, fetchImpl: typeof fetch = fetch) {
  const config = invoicingConfig();
  if (config.provider === "manual" || !await invoicesAvailable()) return { issued: 0, failed: 0 };
  const provider = invoiceProviderFor(config, fetchImpl);
  const rows = await db.select({ invoice: invoices, order: orders }).from(invoices).innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(and(eq(invoices.status, "pending"), eq(orders.status, "approved"), eq(orders.isDemo, false), lt(invoices.attempts, MAX_ATTEMPTS), orderId ? eq(orders.id, orderId) : undefined))
    .orderBy(asc(invoices.createdAt)).limit(10);
  let issued = 0, failed = 0;
  for (const { invoice, order } of rows) {
    const [claimed] = await db.update(invoices).set({ status: "processing", attempts: sql`${invoices.attempts} + 1`, provider: provider.id, error: null })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "pending"))).returning();
    if (!claimed) continue;
    const draft = await invoiceDraftFor(order, { ...claimed, voucherType: claimed.voucherType ?? config.voucherType, pointOfSale: claimed.pointOfSale ?? config.pointOfSale }, new Date());
    const result = await provider.issue(draft);
    if (result.ok) {
      await db.update(invoices).set({ status: "issued", voucherType: result.voucherType, pointOfSale: result.pointOfSale, number: result.number, cae: result.cae,
        caeDueDate: result.caeDueDate, issuedAt: result.issuedAt, pdfUrl: result.pdfUrl, error: null }).where(eq(invoices.id, invoice.id));
      await db.insert(orderEmails).values({ orderId: order.id, event: "invoice_issued" }).onConflictDoNothing();
      issued += 1;
    } else {
      await db.update(invoices).set({ status: "failed", error: result.error.slice(0, 1000) }).where(eq(invoices.id, invoice.id));
      console.error("[Facturación] No se pudo emitir", { order: order.id.slice(0, 8), provider: provider.id, uncertain: result.uncertain });
      failed += 1;
    }
  }
  return { issued, failed };
}

export type ManualInvoiceInput = { voucherType: VoucherType; pointOfSale: number; number: number; cae: string; caeDueDate: string; issuedAt: string; pdfUrl: string | null };

export function parseManualInvoice(raw: Record<string, unknown>): { ok: true; value: ManualInvoiceInput } | { ok: false; error: string } {
  const text = (key: string) => typeof raw[key] === "string" ? (raw[key] as string).trim() : "";
  const voucherType = text("voucherType");
  if (!["A", "B", "C"].includes(voucherType)) return { ok: false, error: "Elegí el tipo de factura (A, B o C)." };
  const pointOfSale = Number(text("pointOfSale"));
  if (!Number.isInteger(pointOfSale) || pointOfSale < 1 || pointOfSale > 99_999) return { ok: false, error: "El punto de venta es un número entre 1 y 99999." };
  const number = Number(text("number"));
  if (!Number.isInteger(number) || number < 1 || number > 99_999_999) return { ok: false, error: "El número de comprobante es un número entre 1 y 99999999." };
  const cae = text("cae").replace(/\s/g, "");
  if (!/^\d{14}$/.test(cae)) return { ok: false, error: "El CAE tiene 14 números." };
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const caeDueDate = text("caeDueDate");
  const issuedAt = text("issuedAt");
  if (!date.test(caeDueDate) || Number.isNaN(Date.parse(caeDueDate))) return { ok: false, error: "Ingresá el vencimiento del CAE." };
  if (!date.test(issuedAt) || Number.isNaN(Date.parse(issuedAt))) return { ok: false, error: "Ingresá la fecha del comprobante." };
  if (caeDueDate < issuedAt) return { ok: false, error: "El vencimiento del CAE no puede ser anterior a la fecha del comprobante." };
  const rawPdf = text("pdfUrl");
  let pdfUrl: string | null = null;
  if (rawPdf) {
    try { const url = new URL(rawPdf); if (url.protocol !== "https:") throw new Error(); pdfUrl = url.href; }
    catch { return { ok: false, error: "El enlace al PDF debe empezar con https://" }; }
  }
  return { ok: true, value: { voucherType: voucherType as VoucherType, pointOfSale, number, cae, caeDueDate, issuedAt, pdfUrl } };
}

export class InvoiceActionError extends Error {}

/** Registro manual (Comprobantes en línea). Bloquea la fila del pedido y avisa al cliente una sola vez. */
export async function registerManualInvoice(tx: OrderTransaction, order: Order, input: ManualInvoiceInput, adminEmail: string) {
  if (!await invoicesAvailable(tx)) throw new InvoiceActionError("Falta aplicar la migración 0008 (tabla invoices) en esta base.");
  if (order.isDemo) throw new InvoiceActionError("Los pedidos de prueba no se facturan.");
  if (order.status !== "approved" && order.status !== "refunded") throw new InvoiceActionError("Solo se factura un pedido pagado.");
  const [existing] = await tx.select().from(invoices).where(eq(invoices.orderId, order.id)).for("update");
  if (existing?.status === "issued") throw new InvoiceActionError("Este pedido ya tiene una factura registrada.");
  if (existing?.status === "processing") throw new InvoiceActionError("El proveedor está emitiendo esta factura. Revisalo antes de registrar otra.");
  const values = { status: "issued", provider: "manual", voucherType: input.voucherType, pointOfSale: input.pointOfSale, number: input.number, cae: input.cae,
    caeDueDate: input.caeDueDate, issuedAt: new Date(`${input.issuedAt}T12:00:00-03:00`), pdfUrl: input.pdfUrl, error: null, registeredBy: adminEmail.slice(0, 254) };
  try {
    if (existing) await tx.update(invoices).set(values).where(eq(invoices.id, existing.id));
    else await tx.insert(invoices).values({ ...values, orderId: order.id, amountArs: order.totalArs, receiverDocType: "CF", receiverName: order.name.slice(0, 120) });
  } catch (error) {
    if (String((error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code) === "23505") throw new InvoiceActionError("Ese número de comprobante ya está registrado en otro pedido.");
    throw error;
  }
  await tx.insert(orderEmails).values({ orderId: order.id, event: "invoice_issued" }).onConflictDoNothing();
}

/** Vuelve a poner en cola una factura fallida (solo después de revisar que el proveedor no la emitió). */
export async function retryFailedInvoice(tx: OrderTransaction, order: Order) {
  if (!await invoicesAvailable(tx)) throw new InvoiceActionError("Falta aplicar la migración 0008 (tabla invoices) en esta base.");
  const config = invoicingConfig();
  if (config.provider === "manual") throw new InvoiceActionError("La emisión automática no está configurada: registrá la factura a mano.");
  const [existing] = await tx.select().from(invoices).where(eq(invoices.orderId, order.id)).for("update");
  if (existing?.status !== "failed") throw new InvoiceActionError("Solo se reintenta una factura fallida.");
  await tx.update(invoices).set({ status: "pending", attempts: 0, error: null }).where(eq(invoices.id, existing.id));
}

/** Crea la factura de un pedido pagado antes de existir la tabla o la configuración. */
export async function prepareInvoice(tx: OrderTransaction, order: Order) {
  if (!await invoicesAvailable(tx)) throw new InvoiceActionError("Falta aplicar la migración 0008 (tabla invoices) en esta base.");
  if (order.isDemo || order.status !== "approved") throw new InvoiceActionError("Solo se factura un pedido pagado.");
  await queueInvoiceRow(tx, order);
}
