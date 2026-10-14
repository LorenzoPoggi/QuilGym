import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { categories, orderItemCosts, orderItems, orders, paymentFees, productCosts, products, productVariants } from "./db/schema";
import { tableExists } from "./db/table-exists";
import type { MetricsOrder, MetricsRange } from "./admin-metrics-core";

export type MetricsData = {
  current: MetricsOrder[]; previous: MetricsOrder[];
  /** false = falta aplicar la migración 0009: no hay costos ni comisiones guardadas. */
  ready: boolean;
  variantsWithoutCost: number;
};

/** Pedidos pagados (no demo) del período actual y del anterior, con costos y comisiones si existen. Solo lectura. */
export async function getMetricsData(range: MetricsRange): Promise<MetricsData> {
  const [hasItemCosts, hasProductCosts, hasFees] = await Promise.all([
    tableExists(db, "order_item_costs"), tableExists(db, "product_costs"), tableExists(db, "payment_fees"),
  ]);
  const rows = await db.select({
    id: orders.id, createdAt: orders.createdAt, subtotalArs: orders.subtotalArs, discountArs: orders.discountArs, shippingArs: orders.shippingArs,
    totalArs: orders.totalArs, paymentMethod: orders.paymentMethod, paymentChoice: orders.paymentChoice,
  }).from(orders).where(and(eq(orders.status, "approved"), eq(orders.isDemo, false), gte(orders.createdAt, range.prevStart), lt(orders.createdAt, range.end)));

  const ids = rows.map((row) => row.id);
  const items = ids.length ? await db.select({
    id: orderItems.id, orderId: orderItems.orderId, variantId: orderItems.variantId, slug: orderItems.slug, name: orderItems.name,
    quantity: orderItems.quantity, unitPriceArs: orderItems.unitPriceArs, category: categories.name,
  }).from(orderItems).leftJoin(products, eq(products.slug, orderItems.slug)).leftJoin(categories, eq(categories.id, products.categoryId))
    .where(inArray(orderItems.orderId, ids)) : [];

  const saleCosts = hasItemCosts && items.length
    ? new Map((await db.select().from(orderItemCosts).where(inArray(orderItemCosts.orderItemId, items.map((item) => item.id)))).map((row) => [row.orderItemId, row.unitCostArs]))
    : new Map<number, number>();
  const currentCosts = hasProductCosts && items.length
    ? new Map((await db.select().from(productCosts).where(inArray(productCosts.variantId, [...new Set(items.map((item) => item.variantId))]))).map((row) => [row.variantId, row.costArs]))
    : new Map<number, number>();
  const fees = hasFees && ids.length
    ? new Map((await db.select({ orderId: paymentFees.orderId, feeArs: paymentFees.feeArs }).from(paymentFees).where(inArray(paymentFees.orderId, ids))).map((row) => [row.orderId, row.feeArs]))
    : new Map<string, number>();

  const itemsByOrder = new Map<string, MetricsOrder["items"]>();
  for (const item of items) {
    const sale = saleCosts.get(item.id);
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({
      slug: item.slug, name: item.name, category: item.category ?? "Sin categoría", quantity: item.quantity, unitPriceArs: item.unitPriceArs,
      unitCostArs: sale ?? currentCosts.get(item.variantId) ?? null, costFromSale: sale !== undefined,
    });
    itemsByOrder.set(item.orderId, list);
  }
  const all: MetricsOrder[] = rows.map((row) => ({ ...row, feeArs: fees.get(row.id) ?? null, items: itemsByOrder.get(row.id) ?? [] }));

  let variantsWithoutCost = 0;
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(hasProductCosts
      ? and(eq(products.status, "active"), sql`not exists (select 1 from product_costs pc where pc.variant_id = ${productVariants.id})`)
      : eq(products.status, "active"));
  variantsWithoutCost = countRow?.count ?? 0;

  return {
    current: all.filter((order) => order.createdAt >= range.start),
    previous: all.filter((order) => order.createdAt < range.prevEnd),
    ready: hasItemCosts && hasProductCosts && hasFees,
    variantsWithoutCost,
  };
}

export type CostRow = { variantId: number; productId: number; product: string; variant: string | null; sku: string; priceArs: number; costArs: number | null; status: string };

/** Variantes del catálogo con su costo cargado (o null) para la pantalla de costos. */
export async function getCostRows(): Promise<{ rows: CostRow[]; ready: boolean }> {
  const ready = await tableExists(db, "product_costs");
  const base = db.select({
    variantId: productVariants.id, productId: products.id, product: products.name, variant: productVariants.label, sku: productVariants.sku,
    priceArs: productVariants.priceArs, status: products.status,
    costArs: ready ? sql<number | null>`(select pc.cost_ars from product_costs pc where pc.variant_id = ${productVariants.id})` : sql<null>`null`,
  }).from(productVariants).innerJoin(products, eq(products.id, productVariants.productId));
  const rows = await base.orderBy(products.name, productVariants.position);
  return { rows: rows.filter((row) => row.status !== "archived"), ready };
}
