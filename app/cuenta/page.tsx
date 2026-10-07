import Link from "next/link";
import { History, Package, Settings, Star } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { requireAccountUser } from "@/lib/account-page";

export const metadata = { title: "Mi cuenta | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireAccountUser();
  const sections = [
    { href: "/cuenta/compras", title: "Compras", copy: "Consultá tus pedidos y su estado.", icon: Package },
    { href: "/cuenta/historial", title: "Historial", copy: "Volvé a tus búsquedas recientes.", icon: History },
    { href: "/cuenta/favoritos", title: "Favoritos", copy: "Encontrá los suplementos que guardaste.", icon: Star },
    { href: "/cuenta/configuracion", title: "Configuración", copy: "Actualizá tu nombre, avatar y preferencias.", icon: Settings },
  ];
  const firstName = user.name.trim().split(/\s+/)[0];
  return <AccountShell user={user} active="/cuenta" showNavigation={false}><h1 className="account-page-title">Hola, {firstName}</h1><p className="account-page-intro">Este es tu perfil: desde acá podés seguir tus compras y elegir tus próximos productos.</p><div className="account-summary-grid">{sections.map(({ href, title, copy, icon: Icon }) => <Link href={href} key={href}><Icon aria-hidden="true"/><strong>{title}</strong><small>{copy}</small></Link>)}</div></AccountShell>;
}
