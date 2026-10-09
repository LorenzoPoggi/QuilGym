import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireAdminUser } from "@/lib/admin-auth";
import { AdminNav } from "@/components/admin-orders-nav";
import "../styles/admin.css";
import "../styles/admin-orders.css";

export const metadata = { title: "Administración | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="admin-wordmark" href="/admin/productos">QUILGYM <span>ADMIN</span></Link>
      <AdminNav/>
      <div className="admin-sidebar-bottom"><Link href="/"><ExternalLink size={17}/> Ver tienda</Link><p>Catálogo, stock y pedidos. Las métricas de ventas llegarán en una próxima etapa.</p></div>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}
