import { notFound } from "next/navigation";
import { getAdminOrder } from "@/lib/admin-orders";
import { orderCode } from "@/lib/admin-orders-types";
import { AdminOrderDetailView } from "@/components/admin-orders-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Pedido ${orderCode(id)} | Administración QuilGym`, robots: { index: false, follow: false } };
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAdminOrder(id);
  if (!detail) notFound();
  return <AdminOrderDetailView detail={detail}/>;
}
