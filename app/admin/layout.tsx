import { requireAdminUser } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin-shell-nav";
import "../styles/admin.css";
import "../styles/admin-orders.css";
import "../styles/admin-ui.css";

export const metadata = { title: "Administración | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();
  return <AdminShell>{children}</AdminShell>;
}
