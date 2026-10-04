import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, ClipboardList, CreditCard, Dumbbell, Flame, Gauge, HeartPulse, LayoutGrid, MessagesSquare, RefreshCw, ShieldCheck, Store, Truck, Wallet, Zap } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { getBrands, getCategories, getFeaturedProducts, getProductsByCategory } from "@/lib/catalog";
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

const guides = [
  { slug: "creatinas", title: "Creatina: presentaciones y formatos para comparar", text: "Distintos tamaños, versiones clásicas o saborizadas y varias marcas. Compará porciones por envase y precio." },
  { slug: "proteinas", title: "Proteína en polvo: claves para elegir una opción", text: "Whey, blends y alternativas vegetales. En cada ficha está el rótulo para comparar proteína por porción." },
  { slug: "pre-entrenos", title: "Pre-entrenos: qué ingredientes vas a encontrar", text: "Fórmulas con cafeína, óxido nítrico y otros componentes. Leé el rótulo y consultá a un profesional si tenés dudas." },
];

const brandTones = ["peach", "yellow", "pink", "blue", "green", "gray"];

function SectionHeading({ eyebrow, title, copy, link, href = "/productos" }: { eyebrow: string; title: string; copy: string; link?: string; href?: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{copy}</p></div>{link ? <Link href={href}>{link} <ArrowRight aria-hidden="true"/></Link> : null}</div>;
}

export default async function Home() {
  const [featured, combos, brands, categories, ...guideProducts] = await Promise.all([
    getFeaturedProducts(4), getProductsByCategory("combos", 4), getBrands(), getCategories(),
    ...guides.map((guide) => getProductsByCategory(guide.slug, 4)),
  ]);
  // Para las guías, una foto real de la categoría que no repita los destacados.
  const featuredSlugs = new Set(featured.map((product) => product.slug));
  const guideCards = guides.map((guide, index) => {
    const options = guideProducts[index];
    const product = options.find((item) => item.imageUrl && !featuredSlugs.has(item.slug)) ?? options[0];
    const category = categories.find((item) => item.slug === guide.slug);
    return { ...guide, product, category };
  });

  return (
    <>
      <Header />
      <main className="home-page">
        <section className="hero section-pad">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="chip">ORIGINALES · ENTREGA RÁPIDA</span>
              <h1>Suplementos para llevar tu entrenamiento más lejos</h1>
              <p>Encontrá proteínas, creatinas y esenciales de marcas confiables. Elegí según tu objetivo y comprá con asesoramiento real.</p>
              <div className="hero-actions"><a className="button button--outline" href="#objetivos">Comprar por objetivo <ArrowRight aria-hidden="true"/></a><a className="button button--outline" href="#productos">Ver productos</a></div>
              <ul className="hero-meta">
                <li><ShieldCheck aria-hidden="true"/>Compra protegida</li>
                <li><Truck aria-hidden="true"/>Envíos a todo el país</li>
                <li><Store aria-hidden="true"/>Retiro en {commerce.pickupLocation}</li>
              </ul>
            </div>
            <Image src="/assets/hero/hero-productos.webp" alt="Mutant Mass, Platinum Whey Protein, Creatine Monohydrate y PUMP V8 de Star Nutrition sobre pedestales" width={2200} height={1600} sizes="(max-width: 1100px) 100vw, 55vw" className="hero-art" priority />
          </div>
        </section>

        <section className="benefits-section"><div className="container benefits-grid">{benefits.map(({ icon: Icon, title, text }) => <div className="benefit" key={title}><span><Icon aria-hidden="true"/></span><div><strong>{title}</strong><small>{text}</small></div></div>)}</div></section>

        <section id="objetivos" className="section-pad container">
          <SectionHeading eyebrow="ENCONTRÁ TU CAMINO" title="Elegí tu objetivo" copy="Navegá por una selección pensada para acompañar tu tipo de entrenamiento y tus preferencias." link="Ver todo el catálogo" />
          <div className="objectives-grid">{objectives.map(({ icon: Icon, ...item }) => <Link className={`objective objective--${item.tone}`} href={item.href} key={item.title}><span className="objective-icon"><Icon aria-hidden="true"/></span><div><h3>{item.title}</h3><p>{item.text}</p></div><ArrowUpRight className="objective-arrow" aria-hidden="true"/></Link>)}</div>
        </section>

        <section id="productos" className="section-pad section-soft">
          <div className="container">
            <SectionHeading eyebrow="SELECCIÓN QUILGYM" title="Destacados" copy="Una selección de básicos para empezar. Precios y stock actualizados." link="Ver todos los productos" />
            <div className="product-grid">{featured.map((product, index) => <ProductCard key={product.slug} product={product} priority={index < 2} />)}</div>
            <div className="advisor-banner">
              <div className="advisor-icon"><ClipboardList aria-hidden="true"/></div>
              <div><p className="eyebrow">TE ORIENTAMOS EN 3 MINUTOS</p><h3>¿No sabés qué suplemento elegir?</h3><p>Respondé preguntas simples sobre tu objetivo, alimentación y rutina. Te mostramos categorías para explorar, sin vueltas.</p></div>
              <div className="advisor-cta"><Link className="button button--outline" href="/asesor">Encontrá mis suplementos <ArrowRight aria-hidden="true"/></Link><small>Sin registro · orientación informativa</small></div>
            </div>
          </div>
        </section>

        <section id="combos" className="section-pad container">
          <SectionHeading eyebrow="COMBOS QUILGYM" title="Combos por objetivo" copy="Selecciones armadas para simplificar tu compra. En cada ficha ves qué productos incluye." link="Explorar combos" href="/productos?categoria=combos" />
          <div className="product-grid">{combos.map((product) => <ProductCard key={product.slug} product={product} compact />)}</div>
          <div id="marcas" className="brands-block"><SectionHeading eyebrow="SELECCIÓN CONFIABLE" title="Marcas disponibles" copy="Trabajamos con marcas reconocidas y productos con trazabilidad." /><div className="brands-grid">{brands.slice(0, 6).map((brand, index) => <Link className={`brand-card brand-card--${brandTones[index % brandTones.length]}`} href={`/productos?marca=${brand.slug}`} key={brand.slug}><strong>{brand.name}</strong><span>{brand.count} {brand.count === 1 ? "producto" : "productos"}</span></Link>)}</div></div>
        </section>

        <section id="como-comprar" className="section-pad section-soft">
          <div className="container">
            <SectionHeading eyebrow="SIMPLE Y CLARO" title="Cómo comprar" copy="Del catálogo a tu casa en tres pasos. El precio y el stock se confirman al armar el pedido." />
            <div className="steps-grid">
              <article className="steps-intro"><strong>3 pasos</strong><p>Para comprar suplementos originales, con envío o retiro en {commerce.pickupLocation}.</p><Link href="/productos">Empezar a comprar <ArrowRight aria-hidden="true"/></Link></article>
              {steps.map(({ icon: Icon, ...step }, index) => <article className="step-card" key={step.title}><span className="step-tag"><Icon aria-hidden="true"/> PASO {index + 1}</span><h3>{step.title}</h3><p>{step.text}</p><Link href={step.href}>{step.link} <ArrowRight aria-hidden="true"/></Link></article>)}
            </div>
          </div>
        </section>

        <section id="guias" className="section-pad container">
          <SectionHeading eyebrow="ELEGÍ CON CRITERIO" title="Guías por categoría" copy="Lo básico de cada categoría para comparar opciones. Sin promesas mágicas ni atajos." link="Ver todo el catálogo" />
          <div className="guides-grid">{guideCards.map((guide) => <Link className="guide-card" href={`/productos?categoria=${guide.slug}`} key={guide.slug}>
            <div className="guide-media">{guide.product ? <ProductImage product={guide.product} decorative sizes="(max-width: 768px) 100vw, 33vw" /> : null}</div>
            <div><p className="eyebrow"><span>{guide.category?.name.toUpperCase() ?? guide.slug.toUpperCase()}</span>{guide.category ? <small>{guide.category.count} {guide.category.count === 1 ? "producto" : "productos"}</small> : null}</p><h3>{guide.title}</h3><p>{guide.text}</p><span className="guide-link">Ver {guide.category?.name.toLowerCase() ?? "productos"} <ArrowRight aria-hidden="true"/></span></div>
          </Link>)}</div>
        </section>
      </main>
      <Footer />
    </>
  );
}
