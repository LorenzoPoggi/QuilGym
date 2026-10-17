import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { categories, orderItems, products, productVariants, variantShipping } from "./db/schema";
import { tableExists } from "./db/table-exists";
import { combineParcels, defaultParcelFor, type Parcel } from "./shipping-defaults";

type Line = { variantId: number; quantity: number; category: { slug: string } | null };

/**
 * Bulto del pedido para cotizar con el transportista: peso y medidas reales de `variant_shipping` (migración 0010)
 * cuando existen, y el default de la categoría para lo que falte. Sin la migración usa solo los defaults.
 */
export async function parcelForLines(lines: Line[]): Promise<Parcel> {
  const rows = lines.length && await tableExists(db, "variant_shipping")
    ? await db.select().from(variantShipping).where(inArray(variantShipping.variantId, lines.map((line) => line.variantId))).catch(() => [])
    : [];
  const byVariant = new Map(rows.map((row) => [row.variantId, row]));
  return combineParcels(lines.map((line) => {
    const fallback = defaultParcelFor(line.category?.slug);
    const own = byVariant.get(line.variantId);
    return { quantity: line.quantity, parcel: {
      weightGrams: own?.weightGrams ?? fallback.weightGrams, lengthCm: own?.lengthCm ?? fallback.lengthCm,
      widthCm: own?.widthCm ?? fallback.widthCm, heightCm: own?.heightCm ?? fallback.heightCm,
    } };
  }));
}

/** Bulto de un pedido ya creado (para dar de alta el envío): usa la categoría actual de cada producto vendido. */
export async function parcelForOrder(orderId: string): Promise<Parcel> {
  const rows = await db.select({ variantId: orderItems.variantId, quantity: orderItems.quantity, slug: categories.slug })
    .from(orderItems).innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId)).innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(orderItems.orderId, orderId));
  return parcelForLines(rows.map((row) => ({ variantId: row.variantId, quantity: row.quantity, category: { slug: row.slug } })));
}
