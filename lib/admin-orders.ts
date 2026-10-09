import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { orderEmails, orderItems, orders, payments, shipments } from "./db/schema";
import { ADMIN_ORDERS_PAGE_SIZE, type AdminOrderFilters } from "./admin-orders-types";

const dayStart = (date: string) => new Date(`${date}T00:00:00-03:00`);
const nextDay = (date: string) => new Date(dayStart(date).getTime() + 24 * 60 * 60_000);
/** Pago aprobado en el proveedor sobre un pedido cancelado o rechazado: dinero cobrado sin pedido vigente. */
const paidOnClosed = and(eq(payments.status, "approved"), inArray(orders.status, ["cancelled", "rejected"]));

export function adminOrderConditions(filters: AdminOrderFilters) {
  const conditions: (SQL | undefined)[] = [];
  if (filters.status !== "all") conditions.push(eq(orders.status, filters.status));
  if (filters.choice === "transfer" || filters.choice === "cash") conditions.push(eq(orders.paymentMethod, filters.choice));
  else if (filters.choice !== "all") conditions.push(and(eq(orders.paymentMethod, "mercadopago"), eq(orders.paymentChoice, filters.choice)));
  if (filters.kind !== "all") conditions.push(eq(orders.isDemo, filters.kind === "demo"));
  if (filters.from) conditions.push(gte(orders.createdAt, dayStart(filters.from)));
  if (filters.to) conditions.push(lt(orders.createdAt, nextDay(filters.to)));
  if (filters.alerts) conditions.push(paidOnClosed);
  if (filters.q) {
    const term = filters.q.replace(/[\\%_]/g, (char) => `\\${char}`);
    const id = filters.q.replace(/^qg-/i, "").toLowerCase();
    conditions.push(or(ilike(orders.email, `%${term}%`), ilike(orders.name, `%${term}%`), ilike(orders.phone, `%${term}%`),
      /^[0-9a-f-]{4,36}$/.test(id) ? sql`${orders.id}::text like ${`${id}%`}` : undefined));
  }
  return and(...conditions);
}

export async function listAdminOrders(filters: AdminOrderFilters) {
  const where = adminOrderConditions(filters);
  const [rows, [{ total }], summary] = await Promise.all([
    db.select({
      id: orders.id, createdAt: orders.createdAt, status: orders.status, isDemo: orders.isDemo, name: orders.name, email: orders.email,
      paymentMethod: orders.paymentMethod, paymentChoice: orders.paymentChoice, delivery: orders.delivery, totalArs: orders.totalArs,
      paymentStatus: payments.status, providerId: payments.providerId, shipmentStatus: shipments.status, trackingCode: shipments.trackingCode,
      units: sql<number>`(select coalesce(sum(${orderItems.quantity}), 0)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id})`,
    }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id)).leftJoin(shipments, eq(shipments.orderId, orders.id))
      .where(where).orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(ADMIN_ORDERS_PAGE_SIZE).offset((filters.page - 1) * ADMIN_ORDERS_PAGE_SIZE),
    db.select({ total: count() }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id)).where(where),
    adminOrderSummary(),
  ]);
  return { rows, total: Number(total), pages: Math.max(1, Math.ceil(Number(total) / ADMIN_ORDERS_PAGE_SIZE)), summary };
}

/** Contadores reales de pedidos no demo para la cabecera; no son métricas de ventas. */
export async function adminOrderSummary() {
  const [row] = await db.select({
    awaitingPayment: sql<number>`count(*) filter (where ${orders.status} = 'pending' and ${orders.paymentMethod} in ('transfer', 'cash'))::int`,
    toPrepare: sql<number>`count(*) filter (where (${orders.status} = 'approved' or (${orders.status} = 'pending' and ${orders.paymentMethod} = 'cash')) and coalesce(${shipments.status}, 'pending') in ('pending', 'preparing'))::int`,
    alerts: sql<number>`count(*) filter (where ${payments.status} = 'approved' and ${orders.status} in ('cancelled', 'rejected'))::int`,
  }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id)).leftJoin(shipments, eq(shipments.orderId, orders.id))
    .where(eq(orders.isDemo, false));
  return { awaitingPayment: Number(row?.awaitingPayment ?? 0), toPrepare: Number(row?.toPrepare ?? 0), alerts: Number(row?.alerts ?? 0) };
}

export async function getAdminOrder(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const [items, payment, shipment, emails] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    db.select().from(payments).where(eq(payments.orderId, id)).limit(1),
    db.select().from(shipments).where(eq(shipments.orderId, id)).limit(1),
    db.select().from(orderEmails).where(eq(orderEmails.orderId, id)).orderBy(asc(orderEmails.createdAt)),
  ]);
  return { order, items, payment: payment[0] ?? null, shipment: shipment[0] ?? null, emails };
}

export type AdminOrderList = Awaited<ReturnType<typeof listAdminOrders>>;
export type AdminOrderDetail = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;
