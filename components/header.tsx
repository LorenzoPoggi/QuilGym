import Link from "next/link";
import { Zap } from "lucide-react";
import { commerce, formatArs } from "@/lib/commerce";
import { CartPill } from "./cart-buttons";
import { SearchIcon } from "./icons";
import { AccountLink } from "./account-controls";
import { HeaderAutoHide } from "./header-auto-hide";

/** En /buscar la página tiene su propio buscador: `showSearch={false}` evita dos inputs superpuestos. */
export function Header({ showSearch = true, overlayOnHero = false }: { showSearch?: boolean; overlayOnHero?: boolean }) {
  const headerClass = ["site-header", overlayOnHero ? "site-header--hero" : ""].filter(Boolean).join(" ");
  const inner = (
    <div className="container header-inner">
      <Link href="/" className="wordmark" aria-label="QuilGym, inicio">QUILGYM</Link>
      <nav className="primary-nav" aria-label="Navegación principal">
        <Link href="/productos">Productos</Link>
        <Link href="/#objetivos">Objetivos</Link>
        <Link href="/#combos">Combos</Link>
      </nav>
      {showSearch ? <form className="search" action="/buscar" role="search">
        <SearchIcon />
        <label className="sr-only" htmlFor="site-search">Buscar productos</label>
        <input id="site-search" name="q" placeholder="Buscá proteínas, creatinas, marcas..." />
        <kbd>⌘ K</kbd>
      </form> : null}
      <AccountLink/>
      <CartPill/>
    </div>
  );

  return (
    <>
      <div className={`shipping-banner${overlayOnHero ? " shipping-banner--hero" : ""}`}><span><Zap aria-hidden="true"/>{commerce.freeShippingFromArs ? `ENVÍO GRATIS DESDE ${formatArs(commerce.freeShippingFromArs)} A TODO EL PAÍS` : `ENVÍOS A TODO EL PAÍS · RETIRO EN ${commerce.pickupLocation.toUpperCase()}`}</span></div>
      {/* Sin buscador no hay fila que colapsar en mobile. */}
      {showSearch ? <HeaderAutoHide className={headerClass}>{inner}</HeaderAutoHide> : <header className={`${headerClass} site-header--no-search`}>{inner}</header>}
    </>
  );
}
