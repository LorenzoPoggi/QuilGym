import Link from "next/link";
import { ArrowIcon } from "./icons";

const groups = [
  { title: "Comprar", links: ["Todos los productos", "Proteínas", "Creatinas", "Pre-entrenos", "Vitaminas y salud", "Accesorios"] },
  { title: "Por objetivo", links: ["Masa muscular", "Rendimiento", "Energía", "Recuperación", "Definición", "Bienestar"] },
  { title: "Ayuda", links: ["Preguntas frecuentes", "Envíos y entregas", "Cambios y devoluciones", "Medios de pago", "Seguimiento"] },
  { title: "QuilGym", links: ["Sobre nosotros", "Asesor", "Aprendé", "Contacto", "Trabajá con nosotros"] },
];

export function Footer() {
  return (
    <footer id="footer">
      <section className="newsletter">
        <div className="container newsletter-inner">
          <div><p className="eyebrow">NOVEDADES SIN RUIDO</p><h2>Recibí ofertas, lanzamientos y contenido útil</h2><p>Sumate a la comunidad. Te escribimos cuando hay algo que vale la pena.</p></div>
          <form><label className="sr-only" htmlFor="newsletter-email">Tu email</label><input id="newsletter-email" type="email" placeholder="Tu email" required/><button type="submit">Quiero recibir novedades <ArrowIcon/></button></form>
        </div>
      </section>
      <div className="footer-main">
        <div className="container footer-grid">
          <div className="footer-brand"><Link href="/" className="wordmark wordmark--light">QUILGYM</Link><p>Suplementos, accesorios e información para acompañar tu entrenamiento con claridad.</p><p>+54 9 11 5555-7845<br/>hola@quilgym.com.ar</p></div>
          {groups.map((group) => <div key={group.title}><h3>{group.title}</h3>{group.links.map((link) => <a key={link} href="#">{link}</a>)}</div>)}
        </div>
        <div className="container footer-bottom"><span>© 2026 QuilGym. Todos los derechos reservados.</span><span>Términos y condiciones · Privacidad · Defensa del consumidor</span></div>
      </div>
    </footer>
  );
}
