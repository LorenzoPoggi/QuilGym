"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, ReceiptText, TicketPercent } from "lucide-react";

const links = [{ href: "/admin/productos", label: "Productos", Icon: Boxes }, { href: "/admin/pedidos", label: "Pedidos", Icon: ReceiptText }, { href: "/admin/cupones", label: "Cupones", Icon: TicketPercent }, { href: "/admin/metricas", label: "Métricas", Icon: BarChart3 }];

export function AdminNav() {
  const pathname = usePathname() ?? "";
  return <nav aria-label="Administración" className="admin-nav">{links.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}><Icon size={19} aria-hidden="true"/> {label}</Link>)}</nav>;
}
