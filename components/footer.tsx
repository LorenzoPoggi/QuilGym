import Link from "next/link";
import { Lock, Mail, Store, Truck } from "lucide-react";
import { commerce } from "@/lib/commerce";

const groups = [
  { title: "Comprar", links: [["Todos los productos", "/productos"], ["Proteínas", "/productos?categoria=proteinas"], ["Creatinas", "/productos?categoria=creatinas"], ["Pre-entrenos", "/productos?categoria=pre-entrenos"], ["Vitaminas y minerales", "/productos?categoria=vitaminas-y-minerales"], ["Accesorios", "/productos?categoria=accesorios"]] },
  { title: "Por objetivo", links: [["Masa muscular", "/productos?categoria=proteinas"], ["Rendimiento", "/productos?categoria=creatinas"], ["Energía", "/productos?categoria=pre-entrenos"], ["Recuperación", "/productos?categoria=aminoacidos"], ["Definición", "/productos?categoria=colageno"], ["Bienestar", "/productos?categoria=vitaminas-y-minerales"]] },
  { title: "Para elegir", links: [["Buscar productos", "/buscar"], ["Asesor", "/asesor"], ["Comparador", "/comparar"], ["Mi carrito", "/carrito"]] },
  { title: "QuilGym", links: [["Destacados", "/#productos"], ["Combos", "/productos?categoria=combos"], ["Marcas", "/#marcas"], ["Cómo comprar", "/#como-comprar"], ["Guías", "/#guias"]] },
];

const trust = [
  { icon: Lock, label: "Pago seguro" },
  { icon: Truck, label: "Envíos a todo el país" },
  { icon: Store, label: `Retiro en ${commerce.pickupLocation}` },
];

export function Footer() {
  return (
    <footer id="footer">
      <section className="newsletter">
        <div className="container newsletter-inner">
          <div><p className="eyebrow">NOVEDADES SIN RUIDO</p><h2>Recibí ofertas, lanzamientos y contenido útil</h2><p>Sumate a la comunidad. Te escribimos cuando hay algo que vale la pena.</p></div>
          {/* Todavía no hay backend de suscripción: el envío queda deshabilitado. */}
          <div className="newsletter-form">
            <form><Mail aria-hidden="true"/><label className="sr-only" htmlFor="newsletter-email">Tu email</label><input id="newsletter-email" type="email" placeholder="Tu email" autoComplete="email" aria-describedby="newsletter-note"/><button type="submit" disabled>Próximamente</button></form>
            <small id="newsletter-note">Estamos preparando el newsletter. Por ahora no guardamos tu email.</small>
          </div>
        </div>
      </section>
      <div className="footer-main">
        <div className="container footer-grid">
          <div className="footer-brand"><Link href="/" className="wordmark wordmark--light">QUILGYM</Link><p>Suplementos, accesorios e información para acompañar tu entrenamiento con claridad.</p></div>
          {groups.map((group) => <nav key={group.title} aria-label={group.title}><h3>{group.title}</h3>{group.links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}</nav>)}
        </div>
        <div className="container footer-trust">{trust.map(({ icon: Icon, label }) => <span key={label}><Icon aria-hidden="true"/>{label}</span>)}</div>
        <div className="container footer-bottom"><span>© 2026 QuilGym. Todos los derechos reservados.</span><span>Suplementos deportivos en {commerce.pickupLocation}, Buenos Aires.</span></div>
      </div>
    </footer>
  );
}
