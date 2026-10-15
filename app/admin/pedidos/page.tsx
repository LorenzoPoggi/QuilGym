import { listAdminOrders } from "@/lib/admin-orders";
import { parseAdminOrderFilters } from "@/lib/admin-orders-types";
import { AdminOrdersView } from "@/components/admin-orders-list";

export const metadata = { title: "Pedidos | Administración QuilGym", robots: { index: false, follow: false } };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseAdminOrderFilters(await searchParams);
  return <AdminOrdersView data={await listAdminOrders(filters)} filters={filters}/>;
}
