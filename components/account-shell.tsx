import Link from "next/link";
import { History, Package, Settings, Star, UserRound } from "lucide-react";
import { Header } from "./header";
import { Footer } from "./footer";
import { AccountAvatar } from "./account-avatar";

const sections = [
  { href: "/cuenta", label: "Ver perfil", icon: UserRound },
  { href: "/cuenta/compras", label: "Compras", icon: Package },
  { href: "/cuenta/historial", label: "Historial", icon: History },
  { href: "/cuenta/favoritos", label: "Favoritos", icon: Star },
  { href: "/cuenta/configuracion", label: "Configuración", icon: Settings },
];

export function AccountShell({ user, active, showNavigation = true, children }: { user: { name: string; email: string; image?: string | null }; active?: string; showNavigation?: boolean; children: React.ReactNode }) {
  return <><Header/><main className={`container account-area${showNavigation ? "" : " account-area--overview"}`}>
    {showNavigation ? <div className="account-area-heading"><AccountAvatar name={user.name} image={user.image} size="large"/><div><p className="eyebrow">TU ESPACIO QUILGYM</p><h1>{user.name}</h1><p>{user.email}</p></div></div> : null}
    <div className={`account-area-layout ${showNavigation ? "" : "account-area-layout--overview"}`}>
      {showNavigation ? <nav className="account-side-nav" aria-label="Secciones de tu cuenta">
        {sections.map(({ href, label, icon: Icon }) => <Link href={href} aria-current={active === href ? "page" : undefined} key={href}><Icon aria-hidden="true"/>{label}</Link>)}
      </nav> : null}<div className="account-area-content">{children}</div>
    </div>
  </main><Footer/></>;
}
