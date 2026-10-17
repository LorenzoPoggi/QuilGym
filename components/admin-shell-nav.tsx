"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Boxes, ExternalLink, LogOut, Menu, ReceiptText, Settings, Store, TicketPercent, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AdminNav } from "./admin-orders-nav";

const tabs = [
  { href: "/admin/productos", label: "Productos", Icon: Boxes },
  { href: "/admin/pedidos", label: "Pedidos", Icon: ReceiptText },
  { href: "/admin/cupones", label: "Cupones", Icon: TicketPercent },
  { href: "/admin/metricas", label: "Métricas", Icon: BarChart3 },
  { href: "/", label: "Tienda", Icon: Store },
];

/** Estructura del panel: barra lateral en desktop; hasta 950px, barra superior compacta con «Menú»
 *  y navegación inferior fija con los cinco accesos. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function key(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } }
    function outside(event: PointerEvent) { if (!menu.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  async function signOut() {
    setSigningOut(true);
    try { await authClient.signOut(); router.push("/"); router.refresh(); } finally { setSigningOut(false); }
  }
  return <div className="admin-shell">
    <aside className="admin-sidebar" ref={menu}>
      <div className="admin-sidebar-top">
        <Link className="admin-wordmark" href="/admin">QUILGYM <span>ADMIN</span></Link>
        <button ref={toggle} type="button" className="admin-menu-toggle" aria-expanded={open} aria-controls="admin-account-menu" onClick={() => setOpen(!open)}>{open ? <X size={18} aria-hidden="true"/> : <Menu size={18} aria-hidden="true"/>}Menú</button>
      </div>
      <AdminNav/>
      <div className={`admin-sidebar-bottom${open ? " is-open" : ""}`} id="admin-account-menu">
        <Link href="/" onClick={() => setOpen(false)}><ExternalLink size={17} aria-hidden="true"/> Ver tienda</Link>
        <Link href="/cuenta/configuracion" onClick={() => setOpen(false)}><Settings size={17} aria-hidden="true"/> Configuración</Link>
        <button type="button" onClick={() => void signOut()} disabled={signingOut}><LogOut size={17} aria-hidden="true"/> {signingOut ? "Saliendo…" : "Salir"}</button>
        <p>Catálogo, stock, pedidos, cupones y métricas de ventas.</p>
      </div>
    </aside>
    <main className="admin-main">{children}</main>
    <nav className="admin-tabbar" aria-label="Accesos del panel">
      {tabs.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={href !== "/" && pathname.startsWith(href) ? "page" : undefined}><Icon size={21} aria-hidden="true"/><span>{label}</span></Link>)}
    </nav>
  </div>;
}
