"use server";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getAdminUser } from "./admin-auth";
import { coupons, courierPositions, orderEmails, orderItems, orders, payments, productVariants, shipments, shipmentTracking } from "./db/schema";
import { withOrderTransaction, type OrderTransaction } from "./db/transaction";
import { transitionOrder } from "./order-service";
import { canTransition } from "./order-state";
import { deliverOrderEmails } from "./order-email";
import { allowedShipmentStatuses, isPaidOnClosedOrder, isShipmentStatus, orderCode, shipmentStatusLabels, TRACKING_PATTERN } from "./admin-orders-types";
import { db } from "./db";
import { tableExists } from "./db/table-exists";
import { CarrierError, getCarrier } from "./carriers";
import { parcelForOrder } from "./shipping-parcel";
import { consumeRateLimit } from "./rate-limit";
import { applyShipmentStatus } from "./shipment-status";
import { trackingTablesReady } from "./tracking";
import { COURIER_REPORT_MIN_INTERVAL_MS, etaWindowFromChoice, safeExternalHttpsUrl } from "./tracking-core";
import { isValidCoordinates } from "./geo";
import { InvoiceActionError, parseManualInvoice, prepareInvoice, queueInvoice, registerManualInvoice, retryFailedInvoice } from "./invoicing";

export type AdminOrderActionResult = { ok: true; message: string } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const denied: AdminOrderActionResult = { ok: false, error: "No tenés permisos de administrador. Ingresá con Google usando la cuenta autorizada." };
class AdminOrderError extends Error {}

/** Autoriza en el servidor, bloquea la orden y revalida el panel y la confirmación pública. */
async function run(id: unknown, work: (order: typeof orders.$inferSelect, tx: OrderTransaction, admin: { email: string }) => Promise<string>): Promise<AdminOrderActionResult> {
  const admin = await getAdminUser();
  if (!admin) return denied;
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Pedido inválido." };
  try {
    const message = await withOrderTransaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
      if (!order) throw new AdminOrderError("No encontramos el pedido.");
      return work(order, tx, admin);
    });
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath(`/checkout/confirmacion/${id}`);
    after(() => deliverOrderEmails(id));
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AdminOrderError || error instanceof InvoiceActionError) return { ok: false, error: error.message };
    console.error("[Admin pedidos] No se pudo actualizar el pedido", { order: id.slice(0, 8), name: error instanceof Error ? error.name : "UnknownError" });
    return { ok: false, error: "No pudimos guardar el cambio. Reintentá en unos instantes." };
  }
}

/** Transferencia o efectivo: el negocio verifica el cobro fuera del sitio. Mercado Pago solo lo concilia el webhook. */
export async function confirmOrderPayment(id: string) {
  return run(id, async (order, tx) => {
    if (order.paymentMethod === "mercadopago") throw new AdminOrderError("Los pagos de Mercado Pago se confirman solos al conciliar con el proveedor.");
    if (order.status === "approved") return "El pago ya estaba confirmado.";
    if (!canTransition(order.status, "approved")) throw new AdminOrderError("Solo se puede confirmar el pago de un pedido pendiente.");
    await transitionOrder(tx, order, "approved");
    return "Pago confirmado.";
  });
}

export async function cancelAdminOrder(id: string) {
  return run(id, async (order, tx) => {
    if (order.status === "cancelled") return "El pedido ya estaba cancelado.";
    if (!canTransition(order.status, "cancelled")) throw new AdminOrderError("Solo se puede cancelar un pedido pendiente. Si ya está pagado, registrá el reembolso.");
    await transitionOrder(tx, order, "cancelled");
    return "Pedido cancelado. Se liberaron el stock y el cupón reservados.";
  });
}

/** Solo registra el reembolso: no devuelve dinero ni llama a Mercado Pago. */
export async function markOrderRefunded(id: string) {
  return run(id, async (order, tx) => {
    if (order.status === "refunded") return "El reembolso ya estaba registrado.";
    if (!canTransition(order.status, "refunded")) throw new AdminOrderError("Solo se puede registrar el reembolso de un pedido pagado.");
    await transitionOrder(tx, order, "refunded");
    return "Reembolso registrado. Recordá devolver el dinero desde Mercado Pago o por el medio original.";
  });
}

/**
 * Recupera un pago aprobado sobre un pedido cancelado o rechazado (§8.4): vuelve a reservar stock y cupón
 * y deja el pedido pagado. Si no hay stock suficiente, el pago se resuelve reembolsándolo desde Mercado Pago.
 */
export async function reactivatePaidOrder(id: string) {
  return run(id, async (order, tx) => {
    if (order.status === "approved") return "El pedido ya estaba pagado.";
    const [payment] = await tx.select().from(payments).where(eq(payments.orderId, order.id)).for("update");
    if (!isPaidOnClosedOrder(order.status, payment?.status)) throw new AdminOrderError("Solo se reactiva un pedido cancelado o rechazado con un pago aprobado registrado.");
    if (order.resourcesReleasedAt && !order.isDemo) {
      const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.variantId));
      const reserved = lines.filter((line) => line.stockReserved);
      const variants = reserved.length ? await tx.select().from(productVariants).where(inArray(productVariants.id, reserved.map((line) => line.variantId))).orderBy(asc(productVariants.id)).for("update") : [];
      for (const line of reserved) {
        const variant = variants.find((row) => row.id === line.variantId);
        if (!variant || variant.stock === null || variant.stock < line.quantity) throw new AdminOrderError(`No hay stock controlado suficiente de ${line.name} para reactivar el pedido. Reembolsá el pago desde Mercado Pago o ajustá el stock.`);
      }
      const [coupon] = order.couponCode ? await tx.select().from(coupons).where(eq(coupons.code, order.couponCode)).for("update") : [];
      if (order.couponCode && (!coupon || (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions))) {
        throw new AdminOrderError("El cupón del pedido ya no tiene cupo para reactivarlo. Revisá el caso y gestioná el reembolso.");
      }
      for (const line of reserved) await tx.update(productVariants).set({ stock: sql`${productVariants.stock} - ${line.quantity}` }).where(sql`${productVariants.id} = ${line.variantId} and ${productVariants.stock} is not null`);
      if (coupon) await tx.update(coupons).set({ redemptions: sql`${coupons.redemptions} + 1` }).where(eq(coupons.id, coupon.id));
    }
    await tx.update(orders).set({ status: "approved", resourcesReleasedAt: null }).where(eq(orders.id, order.id));
    if (!order.isDemo) await tx.insert(orderEmails).values({ orderId: order.id, event: "approved" }).onConflictDoNothing();
    await queueInvoice(tx, order);
    return "Pedido reactivado como pagado. Se volvió a reservar el stock.";
  });
}

export async function updateOrderShipment(id: string, input: { status: unknown; trackingCode: unknown }) {
  return run(id, async (order, tx) => {
    const status = input?.status;
    const trackingCode = typeof input?.trackingCode === "string" ? input.trackingCode.trim() : "";
    if (!isShipmentStatus(status)) throw new AdminOrderError("Elegí un estado de envío válido.");
    if (order.delivery !== "shipping" && trackingCode) throw new AdminOrderError("El código de seguimiento solo aplica a envíos con transportista.");
    if (!TRACKING_PATTERN.test(trackingCode)) throw new AdminOrderError("El código de seguimiento admite hasta 80 letras, números, espacios y . _ / # -");
    const allowed = allowedShipmentStatuses(order);
    if (!allowed.length) throw new AdminOrderError("Este pedido no admite cambios de envío en su estado actual.");
    if (!allowed.includes(status)) throw new AdminOrderError(`«${shipmentStatusLabels[status]}» no corresponde a este pedido.`);
    const [shipment] = await tx.select().from(shipments).where(eq(shipments.orderId, order.id)).for("update");
    if (!shipment) throw new AdminOrderError("El pedido no tiene un envío asociado.");
    if (shipment.status === status && (shipment.trackingCode ?? "") === trackingCode) return "No había cambios para guardar.";
    // Encola el aviso una vez por evento (índice único): corregir el tracking después no reenvía el email.
    await applyShipmentStatus(tx, order, shipment, status, { trackingCode: trackingCode || null });
    return "Envío actualizado.";
  });
}

/**
 * Da de alta el envío en el transportista configurado (SHIPPING_CARRIER), guarda la referencia y el seguimiento
 * y pasa el envío a «Enviado». La llamada al proveedor ocurre fuera de la transacción; un candado de 1 minuto por
 * pedido evita altas duplicadas por doble clic. Requiere la migración 0010 (`shipment_tracking`).
 */
export async function createCarrierShipment(id: string): Promise<AdminOrderActionResult> {
  const admin = await getAdminUser();
  if (!admin) return denied;
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Pedido inválido." };
  const carrier = getCarrier();
  if (!carrier) return { ok: false, error: "No hay un transportista configurado (SHIPPING_CARRIER y sus credenciales)." };
  if (!await tableExists(db, "shipment_tracking")) return { ok: false, error: "Falta aplicar la migración 0010 para guardar el seguimiento del envío." };
  const [row] = await db.select({ order: orders, shipment: shipments, tracking: shipmentTracking }).from(orders)
    .innerJoin(shipments, eq(shipments.orderId, orders.id)).leftJoin(shipmentTracking, eq(shipmentTracking.shipmentId, shipments.id))
    .where(eq(orders.id, id)).limit(1);
  if (!row) return { ok: false, error: "No encontramos el pedido o su envío." };
  const { order, shipment, tracking } = row;
  if (order.delivery !== "shipping" || !order.address) return { ok: false, error: "Solo los envíos a domicilio se generan con el transportista." };
  if (order.status !== "approved") return { ok: false, error: "Generá el envío cuando el pedido esté pagado." };
  if (tracking?.carrierShipmentId) return { ok: true, message: "El envío ya estaba generado." };
  if (order.isDemo && carrier.code !== "mock") return { ok: false, error: "Los pedidos de prueba no se dan de alta en el transportista real." };
  if (!await consumeRateLimit(`admin:carrier-shipment:${order.id}`, 1, 60_000)) return { ok: false, error: "Ya se está generando este envío. Esperá un minuto y recargá la página." };
  let created;
  try {
    created = await carrier.createShipment({
      orderId: order.id, orderCode: orderCode(order.id), serviceId: tracking?.serviceId ?? null,
      recipient: { name: order.name, email: order.email, phone: order.phone },
      address: { street: order.address.street, streetNumber: order.address.number, apartment: order.address.apartment, postalCode: order.address.postalCode, city: order.address.city, province: order.address.province },
      parcel: await parcelForOrder(order.id), declaredValueArs: order.subtotalArs - order.discountArs,
    });
  } catch (error) {
    console.warn("[Envíos] No se pudo dar de alta el envío", { order: order.id.slice(0, 8), carrier: carrier.code, reason: error instanceof CarrierError ? error.reason : "error" });
    return { ok: false, error: error instanceof CarrierError ? error.message : `No pudimos generar el envío en ${carrier.label}. Reintentá en unos minutos.` };
  }
  return run(id, async (locked, tx) => {
    const [current] = await tx.select().from(shipments).where(eq(shipments.id, shipment.id)).for("update");
    if (!current) throw new AdminOrderError("El pedido no tiene un envío asociado.");
    const values = { carrier: carrier.code, carrierShipmentId: created.carrierShipmentId, trackingUrl: safeExternalHttpsUrl(created.trackingUrl) };
    await tx.insert(shipmentTracking).values({ shipmentId: current.id, ...values }).onConflictDoUpdate({ target: shipmentTracking.shipmentId, set: values });
    const trackingCode = created.trackingCode && TRACKING_PATTERN.test(created.trackingCode) ? created.trackingCode : current.trackingCode;
    await applyShipmentStatus(tx, locked, current, "shipped", { trackingCode }, `Despachamos tu pedido con ${carrier.label}`);
    return created.trackingCode ? `Envío generado en ${carrier.label}. Seguimiento: ${created.trackingCode}.` : `Envío generado en ${carrier.label} (referencia ${created.carrierShipmentId}). Cargá el código de seguimiento cuando lo tengas.`;
  });
}

/**
 * Entrega propia: «Salir a entregar». Guarda la ventana de llegada que eligió el dueño, pasa el envío a «En camino»
 * y lo registra en la línea de tiempo. Respeta las mismas reglas de estado que el formulario de envío.
 */
export async function startLocalDelivery(id: string, choice: unknown) {
  const window = etaWindowFromChoice(choice);
  if (!window) return await getAdminUser() ? { ok: false as const, error: "Elegí una ventana de llegada válida (hasta 7 días)." } : denied;
  if (!await trackingTablesReady()) return await getAdminUser() ? { ok: false as const, error: "Falta aplicar la migración 0010 para el reparto en vivo." } : denied;
  return run(id, async (order, tx) => {
    if (order.delivery !== "local") throw new AdminOrderError("El reparto en vivo es solo para la entrega propia.");
    if (!allowedShipmentStatuses(order).includes("out_for_delivery")) throw new AdminOrderError("Este pedido todavía no puede salir a entregarse.");
    const [shipment] = await tx.select().from(shipments).where(eq(shipments.orderId, order.id)).for("update");
    if (!shipment) throw new AdminOrderError("El pedido no tiene un envío asociado.");
    if (shipment.status === "delivered") throw new AdminOrderError("El pedido ya figura como entregado.");
    const eta = { etaFrom: window.from, etaTo: window.to };
    await tx.insert(shipmentTracking).values({ shipmentId: shipment.id, carrier: "own", ...eta }).onConflictDoUpdate({ target: shipmentTracking.shipmentId, set: eta });
    await applyShipmentStatus(tx, order, shipment, "out_for_delivery");
    return "Saliste a entregar. Dejá abierta la vista de reparto para compartir tu ubicación.";
  });
}

/** Entrega propia: «Entregado». Borra la posición; con efectivo pendiente exige confirmar antes el cobro. */
export async function markLocalDelivered(id: string) {
  return run(id, async (order, tx) => {
    if (order.delivery !== "local") throw new AdminOrderError("Esta acción es solo para la entrega propia.");
    if (!allowedShipmentStatuses(order).includes("delivered")) {
      throw new AdminOrderError(order.paymentMethod === "cash" && order.status === "pending" ? "Confirmá primero el cobro en efectivo y después marcá el pedido como entregado." : "Este pedido no se puede marcar como entregado.");
    }
    const [shipment] = await tx.select().from(shipments).where(eq(shipments.orderId, order.id)).for("update");
    if (!shipment) throw new AdminOrderError("El pedido no tiene un envío asociado.");
    if (shipment.status === "delivered") return "El pedido ya figuraba como entregado.";
    await applyShipmentStatus(tx, order, shipment, "delivered");
    return "Pedido entregado. Dejamos de compartir tu ubicación.";
  });
}

export type CourierReportResult = { ok: true } | { ok: false; error: string; stop?: boolean; throttled?: boolean };

/**
 * Última posición del repartidor (entrega propia «En camino»). Solo el admin, como máximo una cada 10 s por pedido,
 * con coordenadas válidas. No pasa por `run`: no revalida páginas ni encola emails en cada lectura del GPS.
 */
export async function reportCourierPosition(id: string, input: { lat: unknown; lng: unknown; accuracy?: unknown }): Promise<CourierReportResult> {
  if (!await getAdminUser()) return { ok: false, error: "No tenés permisos de administrador.", stop: true };
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Pedido inválido.", stop: true };
  const point = { lat: Number(input?.lat), lng: Number(input?.lng) };
  if (!isValidCoordinates(point)) return { ok: false, error: "La ubicación recibida no es válida." };
  const accuracy = Number(input?.accuracy);
  const accuracyM = Number.isFinite(accuracy) && accuracy >= 0 ? Math.min(Math.round(accuracy), 100_000) : null;
  if (!await tableExists(db, "courier_positions")) return { ok: false, error: "Falta aplicar la migración 0010.", stop: true };
  const [row] = await db.select({ delivery: orders.delivery, shipmentId: shipments.id, status: shipments.status }).from(orders)
    .innerJoin(shipments, eq(shipments.orderId, orders.id)).where(eq(orders.id, id)).limit(1);
  if (!row || row.delivery !== "local" || row.status !== "out_for_delivery") return { ok: false, error: "El pedido no está en reparto.", stop: true };
  if (!await consumeRateLimit(`courier:position:${id}`, 1, COURIER_REPORT_MIN_INTERVAL_MS)) return { ok: false, error: "Esperá unos segundos.", throttled: true };
  const values = { lat: point.lat, lng: point.lng, accuracyM, updatedAt: new Date() };
  await db.insert(courierPositions).values({ shipmentId: row.shipmentId, ...values }).onConflictDoUpdate({ target: courierPositions.shipmentId, set: values });
  return { ok: true };
}

/** Registra una factura emitida en «Comprobantes en línea» (número, CAE y vencimiento) y avisa al cliente. */
export async function registerOrderInvoice(id: string, input: Record<string, unknown>) {
  const parsed = parseManualInvoice(input && typeof input === "object" ? input : {});
  if (!parsed.ok) return await getAdminUser() ? { ok: false as const, error: parsed.error } : denied;
  return run(id, async (order, tx, admin) => {
    await registerManualInvoice(tx, order, parsed.value, admin.email);
    return "Factura registrada. Le avisamos al cliente por email.";
  });
}

/** Vuelve a intentar con el proveedor una factura fallida, después de revisar que no se haya emitido. */
export async function retryOrderInvoice(id: string) {
  return run(id, async (order, tx) => {
    await retryFailedInvoice(tx, order);
    return "Factura en cola: se emite en unos segundos.";
  });
}

/** Crea la factura de un pedido pagado antes de habilitar la facturación. */
export async function prepareOrderInvoice(id: string) {
  return run(id, async (order, tx) => {
    await prepareInvoice(tx, order);
    return "Factura preparada.";
  });
}
