import Image from "next/image";
import { ComboShowcase } from "@/components/combo-showcase";
import { GoogleReviews } from "@/components/google-reviews";
import { HeroVideo } from "@/components/hero-video";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, ClipboardList, CreditCard, Dumbbell, Flame, Gauge, HeartPulse, LayoutGrid, MessagesSquare, Pause, Play, RefreshCw, ShieldCheck, Store, Truck, Wallet, Zap } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { withLogos } from "@/lib/brand-logos";
import { getBrands, getFeaturedProducts, getProductsByCategory } from "@/lib/catalog";
import { commerce } from "@/lib/commerce";

const objectives = [
  { title: "Masa muscular", text: "Proteínas y ganadores de peso", tone: "orange", icon: Dumbbell, href: "/productos?categoria=proteinas" },
  { title: "Rendimiento", text: "Creatina y soporte diario", tone: "blue", icon: Gauge, href: "/productos?categoria=creatinas" },
  { title: "Energía", text: "Pre-entrenos para tu rutina", tone: "cyan", icon: Zap, href: "/productos?categoria=pre-entrenos" },
  { title: "Recuperación", text: "Aminoácidos y descanso", tone: "amber", icon: RefreshCw, href: "/productos?categoria=aminoacidos" },
  { title: "Definición", text: "Opciones para acompañar tu plan", tone: "teal", icon: Flame, href: "/productos?categoria=colageno" },
  { title: "Bienestar", text: "Omega, vitaminas y minerales", tone: "red", icon: HeartPulse, href: "/productos?categoria=vitaminas-y-minerales" },
];

const benefits = [
  { icon: Truck, title: "Envíos nacionales", text: `A todo el país o retiro en ${commerce.pickupLocation}` },
  { icon: ShieldCheck, title: "Pago seguro", text: "Datos siempre protegidos" },
  { icon: CreditCard, title: "Todos los medios de pago", text: "Elegís cómo pagar al confirmar" },
  { icon: BadgeCheck, title: "100% originales", text: "Trazabilidad garantizada" },
  { icon: MessagesSquare, title: "Asesoramiento", text: "Te ayudamos a elegir bien" },
];

const steps = [
  { icon: LayoutGrid, title: "Elegí por objetivo o categoría", text: "Explorá el catálogo por categoría o marca. Si no sabés por dónde empezar, el asesor te orienta.", link: "Ir al catálogo", href: "/productos" },
  { icon: Wallet, title: "Pagás al confirmar el pedido", text: "En el checkout ves el total y los medios de pago disponibles antes de confirmar.", link: "Ver mi carrito", href: "/carrito" },
  { icon: Truck, title: `Envío o retiro en ${commerce.pickupLocation}`, text: `Recibilo con envío a todo el país o elegí retirarlo en ${commerce.pickupLocation}.`, link: "Ver productos", href: "/productos" },
];

function SectionHeading({ eyebrow, title, copy, link, href = "/productos" }: { eyebrow: string; title: string; copy: string; link?: string; href?: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{copy}</p></div>{link ? <Link href={href}>{link} <ArrowRight aria-hidden="true"/></Link> : null}</div>;
}

export default async function Home() {
  const [desktopFeatured, proteins, creatines, accessories, preWorkouts, brands] = await Promise.all([
    getFeaturedProducts(12),
    getProductsByCategory("proteinas", 2),
    getProductsByCategory("creatinas", 2),
    getProductsByCategory("accesorios", 30),
    getProductsByCategory("pre-entrenos", 1),
    getBrands(),
  ]);
  const shaker = accessories.find((product) => /shaker/i.test(product.name)) ?? accessories[0];
  const mobileFeatured = [
    ...proteins.slice(0, 2),
    ...creatines.slice(0, 2),
    ...(shaker ? [shaker] : []),
    ...preWorkouts.slice(0, 1),
  ];
  const desktopFeaturedSlugs = new Set(desktopFeatured.map((product) => product.slug));
  const mobileFeaturedSlugs = new Set(mobileFeatured.map((product) => product.slug));
  const logoBrands = withLogos(brands);
  const featured = [...new Map([...desktopFeatured, ...mobileFeatured].map((product) => [product.slug, product])).values()];

  return (
    <div className="home-page-shell">
      <Header overlayOnHero />
      <main className="home-page">
        <section className="hero" aria-labelledby="hero-title">
          <HeroVideo/>
          <div className="container hero-content">
            <span className="chip">ORIGINALES · ENTREGA RÁPIDA</span>
            <h1 id="hero-title">Entrená en serio. Suplementate bien.</h1>
            <p>Proteínas, creatinas y esenciales de marcas originales. Elegí según tu objetivo y comprá con asesoramiento real.</p>
            <div className="hero-actions"><Link className="button button--light" href="/productos">Ver productos <ArrowRight aria-hidden="true"/></Link><a className="button button--ghost" href="#objetivos">Comprar por objetivo</a></div>
            <ul className="hero-meta">
              <li><ShieldCheck aria-hidden="true"/>Compra protegida</li>
              <li><Truck aria-hidden="true"/>Envíos a todo el país</li>
              <li><Store aria-hidden="true"/>Retiro en {commerce.pickupLocation}</li>
            </ul>
          </div>
          {logoBrands.length > 0 ? <nav id="marcas" className="hero-brands" aria-label="Marcas disponibles">
            <div className="container hero-brands-inner">
              {/* WCAG 2.2.2: control para frenar la cinta también en pantallas táctiles, sin JS. */}
              <label className="brand-pause"><input type="checkbox" className="sr-only" aria-label="Pausar la cinta de marcas"/><Pause aria-hidden="true"/><Play aria-hidden="true"/></label>
              {/* Cuatro pasadas para que cada mitad supere el ancho del contenedor; solo la primera es accesible. */}
              <div className="brand-marquee"><ul className="brand-track">{[0, 1, 2, 3].flatMap((copy) => logoBrands.map(({ slug, name, count, logo }) => <li className={copy ? "brand-copy" : undefined} aria-hidden={copy ? true : undefined} key={`${copy}-${slug}`}><Link className="brand-logo" href={`/productos?marca=${slug}`} aria-label={`Ver ${count} ${count === 1 ? "producto" : "productos"} de ${name}`} tabIndex={copy ? -1 : undefined}><Image src={logo.src} alt="" width={logo.width} height={logo.height} sizes="160px" style={{ aspectRatio: `${logo.width} / ${logo.height}` }}/></Link></li>))}</ul></div>
            </div>
          </nav> : null}
        </section>

        <section className="benefits-section"><div className="container benefits-grid">{benefits.map(({ icon: Icon, title, text }) => <div className="benefit" key={title}><span><Icon aria-hidden="true"/></span><div><strong>{title}</strong><small>{text}</small></div></div>)}</div></section>

        <section id="objetivos" className="section-pad container">
          <SectionHeading eyebrow="ENCONTRÁ TU CAMINO" title="Elegí tu objetivo" copy="Navegá por una selección pensada para acompañar tu tipo de entrenamiento y tus preferencias." link="Ver todo el catálogo" />
          <div className="objectives-grid">{objectives.map(({ icon: Icon, ...item }) => <Link className={`objective objective--${item.tone}`} href={item.href} key={item.title}><span className="objective-icon"><Icon aria-hidden="true"/></span><div><h3>{item.title}</h3><p>{item.text}</p></div><ArrowUpRight className="objective-arrow" aria-hidden="true"/></Link>)}</div>
        </section>

        <section id="productos" className="section-pad section-soft">
          <div className="container">
            <SectionHeading eyebrow="SELECCIÓN QUILGYM" title="Destacados" copy="Una selección de básicos para empezar. Precios y stock actualizados." link="Ver todos los productos" />
            <div className="product-grid">{featured.map((product, index) => <ProductCard key={product.slug} product={product} priority={index < 2} className={desktopFeaturedSlugs.has(product.slug) ? (mobileFeaturedSlugs.has(product.slug) ? "" : "featured-product--desktop-only") : "featured-product--mobile-only"} />)}</div>
            <div className="advisor-banner">
              <div className="advisor-icon"><ClipboardList aria-hidden="true"/></div>
              <div><p className="eyebrow">TE ORIENTAMOS EN 3 MINUTOS</p><h3>¿No sabés qué suplemento elegir?</h3><p>Respondé preguntas simples sobre tu objetivo, alimentación y rutina. Te mostramos categorías para explorar, sin vueltas.</p></div>
              <div className="advisor-cta"><Link className="button button--outline" href="/asesor">Encontrá mis suplementos <ArrowRight aria-hidden="true"/></Link><small>Sin registro · orientación informativa</small></div>
            </div>
          </div>
        </section>

        <ComboShowcase limit={4}/>

        <section id="como-comprar" className="section-pad section-soft">
          <div className="container">
            <SectionHeading eyebrow="SIMPLE Y CLARO" title="Cómo comprar" copy="Del catálogo a tu casa en tres pasos. El precio y el stock se confirman al armar el pedido." />
            <div className="steps-grid">
              <article className="steps-intro"><strong>3 pasos</strong><p>Para comprar suplementos originales, con envío o retiro en {commerce.pickupLocation}.</p><Link href="/productos">Empezar a comprar <ArrowRight aria-hidden="true"/></Link></article>
              {steps.map(({ icon: Icon, ...step }, index) => <article className="step-card" key={step.title}><span className="step-tag"><Icon aria-hidden="true"/> PASO {index + 1}</span><h3>{step.title}</h3><p>{step.text}</p><Link href={step.href}>{step.link} <ArrowRight aria-hidden="true"/></Link></article>)}
            </div>
          </div>
        </section>

        <GoogleReviews/>
      </main>
      <Footer />
    </div>
  );
}
