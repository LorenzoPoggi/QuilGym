"use server";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getAdminUser } from "./admin-auth";
import { coupons, orderEmails, orderItems, orders, payments, productVariants, shipments } from "./db/schema";
import { withOrderTransaction, type OrderTransaction } from "./db/transaction";
import { transitionOrder } from "./order-service";
import { canTransition } from "./order-state";
import { deliverOrderEmails } from "./order-email";
import { allowedShipmentStatuses, isPaidOnClosedOrder, isShipmentStatus, shipmentStatusLabels, TRACKING_PATTERN } from "./admin-orders-types";

export type AdminOrderActionResult = { ok: true; message: string } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const denied: AdminOrderActionResult = { ok: false, error: "No tenés permisos de administrador. Ingresá con Google usando la cuenta autorizada." };
class AdminOrderError extends Error {}

/** Autoriza en el servidor, bloquea la orden y revalida el panel y la confirmación pública. */
async function run(id: unknown, work: (order: typeof orders.$inferSelect, tx: OrderTransaction) => Promise<string>): Promise<AdminOrderActionResult> {
  if (!await getAdminUser()) return denied;
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Pedido inválido." };
  try {
    const message = await withOrderTransaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
      if (!order) throw new AdminOrderError("No encontramos el pedido.");
      return work(order, tx);
    });
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath(`/checkout/confirmacion/${id}`);
    after(() => deliverOrderEmails(id));
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AdminOrderError) return { ok: false, error: error.message };
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
    return "Pedido reactivado como pagado. Se volvió a reservar el stock.";
  });
}

export async function updateOrderShipment(id: string, input: { status: unknown; trackingCode: unknown }) {
  return run(id, async (order, tx) => {
    const status = input?.status;
    const trackingCode = typeof input?.trackingCode === "string" ? input.trackingCode.trim() : "";
    if (!isShipmentStatus(status)) throw new AdminOrderError("Elegí un estado de envío válido.");
    if (!TRACKING_PATTERN.test(trackingCode)) throw new AdminOrderError("El código de seguimiento admite hasta 80 letras, números, espacios y . _ / # -");
    const allowed = allowedShipmentStatuses(order);
    if (!allowed.length) throw new AdminOrderError("Este pedido no admite cambios de envío en su estado actual.");
    if (!allowed.includes(status)) throw new AdminOrderError(`«${shipmentStatusLabels[status]}» no corresponde a este pedido.`);
    const [shipment] = await tx.select().from(shipments).where(eq(shipments.orderId, order.id)).for("update");
    if (!shipment) throw new AdminOrderError("El pedido no tiene un envío asociado.");
    if (shipment.status === status && (shipment.trackingCode ?? "") === trackingCode) return "No había cambios para guardar.";
    await tx.update(shipments).set({ status, trackingCode: trackingCode || null }).where(eq(shipments.id, shipment.id));
    // Un aviso por evento (índice único): corregir el tracking después no reenvía el email.
    if (!order.isDemo && (status === "ready_for_pickup" || status === "shipped")) await tx.insert(orderEmails).values({ orderId: order.id, event: status }).onConflictDoNothing();
    return "Envío actualizado.";
  });
}
