import Image from "next/image";
import Link from "next/link";
import homeReference from "@/design-reference/01-home.png";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ArrowIcon, CardIcon, CheckIcon, ShieldIcon, SparkIcon, TruckIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { getBrands, getFeaturedProducts, getProductsByCategory } from "@/lib/catalog";
import { ReferenceCrop } from "@/components/reference-crop";

const objectives = [
  { title: "Masa muscular", text: "Proteínas y ganadores de peso", tone: "orange", icon: "⚭", href: "/productos?categoria=proteinas" },
  { title: "Rendimiento", text: "Creatina y soporte diario", tone: "blue", icon: "◉", href: "/productos?categoria=creatinas" },
  { title: "Energía", text: "Pre-entrenos para tu rutina", tone: "cyan", icon: "ϟ", href: "/productos?categoria=pre-entrenos" },
  { title: "Recuperación", text: "Aminoácidos y descanso", tone: "amber", icon: "◌", href: "/productos?categoria=aminoacidos" },
  { title: "Definición", text: "Opciones para acompañar tu plan", tone: "teal", icon: "♙", href: "/productos?categoria=colageno" },
  { title: "Bienestar", text: "Omega, vitaminas y minerales", tone: "red", icon: "♡", href: "/productos?categoria=vitaminas-y-minerales" },
];

const benefits = [
  { icon: TruckIcon, title: "Envíos nacionales", text: "Seguimiento de punta a punta" },
  { icon: ShieldIcon, title: "Pago seguro", text: "Datos siempre protegidos" },
  { icon: CardIcon, title: "Todos los medios de pago", text: "Tarjeta, Mercado Pago o transferencia" },
  { icon: CheckIcon, title: "100% originales", text: "Trazabilidad garantizada" },
  { icon: SparkIcon, title: "Asesoramiento", text: "Te ayudamos a elegir bien" },
];

const brandTones = ["peach", "yellow", "pink", "blue", "green", "gray"];

const articles = [
  { tag: "GUÍA DE INICIO", title: "Creatina: qué es y cómo incorporarla a tu rutina", crop: { x: 71, y: 4520, width: 421, height: 154 } },
  { tag: "NUTRICIÓN", title: "Proteína en polvo: claves para comparar opciones", crop: { x: 508, y: 4520, width: 421, height: 154 } },
  { tag: "ENTRENAMIENTO", title: "Pre-entreno: ingredientes y momentos de uso", crop: { x: 946, y: 4520, width: 421, height: 154 } },
];

function SectionHeading({ eyebrow, title, copy, link, href = "/productos" }: { eyebrow: string; title: string; copy: string; link?: string; href?: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{copy}</p></div>{link ? <Link href={href}>{link} <ArrowIcon/></Link> : null}</div>;
}

export default async function Home() {
  const [featured, combos, brands] = await Promise.all([getFeaturedProducts(4), getProductsByCategory("combos", 4), getBrands()]);

  return (
    <>
      <Header />
      <main>
        <section className="hero section-pad">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="chip">ORIGINALES · ENTREGA RÁPIDA</span>
              <h1>Suplementos para llevar tu entrenamiento más lejos</h1>
              <p>Encontrá proteínas, creatinas y esenciales de marcas confiables. Elegí según tu objetivo y comprá con asesoramiento real.</p>
              <div className="hero-actions"><a className="button button--dark" href="#objetivos">Comprar por objetivo <ArrowIcon/></a><a className="button button--outline" href="#productos">Ver productos</a></div>
              <div className="hero-meta"><span>◉ Compra protegida</span><span>★ 4,9 en 1.240 reseñas</span></div>
            </div>
            <Image src="/assets/hero/hero-productos.webp" alt="Mutant Mass, Platinum Whey Protein, Creatine Monohydrate y PUMP V8 de Star Nutrition sobre pedestales" width={2200} height={1600} sizes="(max-width: 1100px) 100vw, 55vw" className="hero-art" priority />
          </div>
        </section>

        <section className="benefits-section"><div className="container benefits-grid">{benefits.map(({ icon: Icon, title, text }) => <div className="benefit" key={title}><span><Icon/></span><div><strong>{title}</strong><small>{text}</small></div></div>)}</div></section>

        <section id="objetivos" className="section-pad container">
          <SectionHeading eyebrow="ENCONTRÁ TU CAMINO" title="Elegí tu objetivo" copy="Navegá por una selección pensada para acompañar tu tipo de entrenamiento y tus preferencias." link="Ver todos los productos" />
          <div className="objectives-grid">{objectives.map((item) => <Link className={`objective objective--${item.tone}`} href={item.href} key={item.title}><span className="objective-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><ArrowIcon/></Link>)}</div>
        </section>

        <section id="productos" className="section-pad section-soft">
          <div className="container">
            <SectionHeading eyebrow="SELECCIÓN QUILGYM" title="Destacados" copy="Una selección de básicos para empezar. Precios y stock actualizados." link="Ver todos los productos" />
            <div className="product-grid">{featured.map((product, index) => <ProductCard key={product.slug} product={product} priority={index < 2} />)}</div>
            <div className="advisor-banner"><div className="advisor-icon"><SparkIcon/></div><div><p className="eyebrow">TE ORIENTAMOS EN 3 MINUTOS</p><h3>¿No sabés qué suplemento elegir?</h3><p>Respondé preguntas simples sobre tu objetivo, alimentación y rutina.</p></div><Link className="button button--light" href="/asesor">Encontrá mis suplementos <ArrowIcon/></Link></div>
          </div>
        </section>

        <section id="combos" className="section-pad container">
          <SectionHeading eyebrow="MÁS POR MENOS" title="Combos por objetivo y ahorro" copy="Armamos selecciones prácticas para simplificar tu compra. Cada combo muestra claramente qué incluye y cuánto ahorrás." link="Explorar combos" href="/productos?categoria=combos" />
          <div className="product-grid">{combos.map((product) => <ProductCard key={product.slug} product={product} compact />)}</div>
          <div className="brands-block"><SectionHeading eyebrow="SELECCIÓN CONFIABLE" title="Marcas disponibles" copy="Trabajamos con marcas reconocidas y productos con trazabilidad." link="" /><div className="brands-grid">{brands.slice(0, 6).map((brand, index) => <Link className={`brand-card brand-card--${brandTones[index % brandTones.length]}`} href={`/productos?marca=${brand.slug}`} key={brand.slug}><strong>{brand.name}</strong><span>{brand.count} {brand.count === 1 ? "producto" : "productos"}</span></Link>)}</div></div>
        </section>

        <section className="section-pad section-soft reviews-section"><div className="container"><SectionHeading eyebrow="EXPERIENCIAS REALES" title="Reseñas verificadas" copy="Opiniones de personas que compraron en QuilGym. Publicamos la experiencia completa, sin editar el sentido." link="" /><div className="reviews-grid"><article className="rating-card"><strong>4,9</strong><span>★★★★★</span><p>Promedio general de 1.240 reseñas verificadas</p><div className="rating-bars"><i/><i/><i/><i/></div></article>{["Llegó antes de lo esperado y todo perfectamente sellado. La creatina tenía lote y vencimiento bien visibles.", "Me ayudaron por WhatsApp a comparar opciones sin apurarme. Elegí el combo que mejor encajaba con mi rutina.", "La web es clara, pude pagar en cuotas y el seguimiento del envío funcionó perfecto. Volvería a comprar."].map((quote, index) => <article className="review-card" key={quote}><span className="verified"><CheckIcon/> COMPRA VERIFICADA</span><p>“{quote}”</p><strong>{["Martina R.", "Nicolás P.", "Sofía L."][index]}</strong><small>Quilmes, Buenos Aires</small></article>)}</div></div></section>

        <section id="articulos" className="section-pad container"><SectionHeading eyebrow="APRENDÉ CON QUILGYM" title="Información para elegir mejor" copy="Contenido claro sobre suplementos, hábitos y entrenamiento. Sin promesas mágicas ni atajos." link="Ver todos los artículos" /><div className="articles-grid">{articles.map((article) => <article className="article-card" key={article.title}><ReferenceCrop source={homeReference} crop={article.crop} alt="" /><div><p className="eyebrow">{article.tag}</p><h3>{article.title}</h3><p>Una explicación simple sobre formatos, porciones y constancia.</p></div></article>)}</div></section>

        <section className="section-pad community"><div className="container"><SectionHeading eyebrow="ENTRENAMOS JUNTOS" title="Comunidad QuilGym" copy="Ideas, rutinas y hábitos compartidos por nuestra comunidad. Seguinos en Instagram para ver novedades y contenido diario." link="@quilgym.ar" /><div className="community-grid">{Array.from({ length: 6 }, (_, index) => <div className="community-tile" key={index}><span>FOTO {index + 1}</span><small>♡ {19 + index * 7}</small></div>)}</div></div></section>
      </main>
      <Footer />
    </>
  );
}
