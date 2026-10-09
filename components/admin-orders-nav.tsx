"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ReceiptText } from "lucide-react";

const links = [{ href: "/admin/productos", label: "Productos", Icon: Boxes }, { href: "/admin/pedidos", label: "Pedidos", Icon: ReceiptText }];

export function AdminNav() {
  const pathname = usePathname() ?? "";
  return <nav aria-label="Administración" className="admin-nav">{links.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}><Icon size={19} aria-hidden="true"/> {label}</Link>)}</nav>;
}
