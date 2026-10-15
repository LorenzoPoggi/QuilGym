import { desc } from "drizzle-orm";
import { requireAdminUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { coupons } from "@/lib/db/schema";
import { AdminCouponsManager } from "@/components/admin-coupons";
import "../../styles/admin-coupons.css";

export const metadata = { title: "Cupones | Administración QuilGym" };

export default async function AdminCouponsPage() {
  await requireAdminUser();
  const rows = await db.select({
    id: coupons.id, code: coupons.code, kind: coupons.kind, value: coupons.value, minSubtotalArs: coupons.minSubtotalArs,
    startsAt: coupons.startsAt, endsAt: coupons.endsAt, maxRedemptions: coupons.maxRedemptions, redemptions: coupons.redemptions, isActive: coupons.isActive,
  }).from(coupons).orderBy(desc(coupons.createdAt));
  return <div className="admin-content">
    <header className="admin-page-head"><div><p className="admin-eyebrow">PROMOCIONES</p><h1>Cupones</h1><p>Creá códigos de descuento para tus clientes. Se aplican en el carrito y el descuento lo calcula la tienda automáticamente.</p></div></header>
    <AdminCouponsManager rows={rows}/>
  </div>;
}
