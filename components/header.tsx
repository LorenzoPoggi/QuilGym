import Link from "next/link";
import { Zap } from "lucide-react";
import { commerce, formatArs } from "@/lib/commerce";
import { CartPill } from "./cart-buttons";
import { SearchIcon, UserIcon } from "./icons";

/** En /buscar la página tiene su propio buscador: `showSearch={false}` evita dos inputs superpuestos. */
export function Header({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <>
      <div className="shipping-banner"><span><Zap aria-hidden="true"/>{commerce.freeShippingFromArs ? `ENVÍO GRATIS DESDE ${formatArs(commerce.freeShippingFromArs)} A TODO EL PAÍS` : `ENVÍOS A TODO EL PAÍS · RETIRO EN ${commerce.pickupLocation.toUpperCase()}`}</span></div>
      <header className={`site-header ${showSearch ? "" : "site-header--no-search"}`}>
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
          <a className="account-link" href="#footer"><UserIcon/><span>Hola<br/><strong>Ingresar</strong></span></a>
          <CartPill/>
        </div>
      </header>
    </>
  );
}
