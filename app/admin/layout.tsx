import Link from "next/link";
import { Boxes, ExternalLink } from "lucide-react";
import { requireAdminUser } from "@/lib/admin-auth";
import "../styles/admin.css";

export const metadata = { title: "Administración | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="admin-wordmark" href="/admin/productos">QUILGYM <span>ADMIN</span></Link>
      <nav aria-label="Administración"><Link href="/admin/productos"><Boxes size={19}/> Productos</Link></nav>
      <div className="admin-sidebar-bottom"><Link href="/"><ExternalLink size={17}/> Ver tienda</Link><p>Catálogo y stock. Ventas y métricas llegarán en una próxima etapa.</p></div>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}
