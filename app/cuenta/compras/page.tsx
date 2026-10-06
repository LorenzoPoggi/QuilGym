import { desc, eq, inArray } from "drizzle-orm";
import { AccountShell } from "@/components/account-shell";
import { AccountPurchases, type AccountPurchase } from "@/components/account-purchases";
import { requireAccountUser } from "@/lib/account-page";
import { getAllProducts } from "@/lib/catalog";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";

export const metadata = { title: "Mis compras | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const user = await requireAccountUser();
  const [purchases, catalog] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(100),
    getAllProducts(),
  ]);
  const lines = purchases.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, purchases.map((order) => order.id))) : [];
  const bySlug = new Map(catalog.map((product) => [product.slug, product]));
  const data: AccountPurchase[] = purchases.map((order) => ({
    id: order.id, createdAt: order.createdAt.toISOString(), status: order.status, isDemo: order.isDemo, totalArs: order.totalArs,
    items: lines.filter((line) => line.orderId === order.id).map((line) => ({ id: line.id, name: line.name, slug: line.slug, quantity: line.quantity, category: bySlug.get(line.slug)?.category.name ?? "Producto", imageUrl: bySlug.get(line.slug)?.imageUrl ?? null })),
  }));
  return <AccountShell user={user} active="/cuenta/compras"><h2 className="account-page-title">Compras</h2><p className="account-page-intro">Seguí el estado de cada pedido y consultá sus detalles. Las compras actuales pueden ser de prueba.</p><AccountPurchases purchases={data} today={new Date().toISOString()}/></AccountShell>;
}
