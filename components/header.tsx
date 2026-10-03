import Link from "next/link";
import { commerce, formatArs } from "@/lib/commerce";
import { BagIcon, SearchIcon, UserIcon } from "./icons";

export function Header() {
  return (
    <>
      <div className="shipping-banner">{commerce.freeShippingFromArs ? `⚡ ENVÍO GRATIS DESDE ${formatArs(commerce.freeShippingFromArs)} A TODO EL PAÍS` : `⚡ ENVÍOS A TODO EL PAÍS · RETIRO EN ${commerce.pickupLocation.toUpperCase()}`}</div>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="wordmark" aria-label="QuilGym, inicio">QUILGYM</Link>
          <nav className="primary-nav" aria-label="Navegación principal">
            <Link href="/productos">Productos</Link>
            <Link href="/#objetivos">Objetivos</Link>
            <Link href="/#combos">Combos</Link>
          </nav>
          <form className="search" action="/buscar" role="search">
            <SearchIcon />
            <label className="sr-only" htmlFor="site-search">Buscar productos</label>
            <input id="site-search" name="q" placeholder="Buscá proteínas, creatinas, marcas..." />
            <kbd>⌘ K</kbd>
          </form>
          <a className="account-link" href="#footer"><UserIcon/><span>Hola<br/><strong>Ingresar</strong></span></a>
          <Link className="cart-pill" href="/carrito" aria-label="Carrito, cero pesos"><BagIcon/><strong>$0</strong></Link>
        </div>
      </header>
    </>
  );
}
