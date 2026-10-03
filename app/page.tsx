import homeReference from "@/design-reference/01-home.png";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ArrowIcon, CardIcon, CheckIcon, ShieldIcon, SparkIcon, TruckIcon } from "@/components/icons";
import { ProductCard, type Product } from "@/components/product-card";
import { ReferenceCrop } from "@/components/reference-crop";

const products: Product[] = [
  { brand: "STAR NUTRITION", name: "Proteína STAR 2 lb", detail: "24 g de proteína por porción · sabor chocolate", price: "$39.920", oldPrice: "$43.900", badge: "-10%", stock: "En stock", cropX: 361 },
  { brand: "STAR NUTRITION", name: "Creatina STAR 300 g", detail: "Creatina monohidrato micronizada · 60 porciones", price: "$31.680", oldPrice: "$35.200", badge: "-10%", stock: "En stock", cropX: 361 },
  { brand: "GOLD NUTRITION", name: "Creatina GOLD", detail: "100% creatina monohidrato · 50 porciones", price: "$29.890", oldPrice: "$33.100", badge: "NUEVO", stock: "Últimas unidades", cropX: 621 },
  { brand: "MUTANT", name: "Mutant Mass", detail: "Ganador de peso · 52 g de proteína por servicio", price: "$69.700", oldPrice: "$75.000", badge: "MÁS VENDIDO", stock: "En stock", cropX: 1143 },
];

const combos: Product[] = [
  { brand: "COMBO ENERGÍA", name: "Pre-entreno STAR + Shaker", detail: "Energía y foco para entrenar", price: "$48.700", oldPrice: "$53.000", badge: "-8%", stock: "En stock", cropX: 881 },
  { brand: "COMBO RECUPERACIÓN", name: "ZMA + Omega 3", detail: "Una dupla para tu recuperación", price: "$35.900", oldPrice: "$42.000", badge: "-15%", stock: "Últimas unidades", cropX: 621 },
  { brand: "COMBO FUERZA", name: "Creatina STAR + Shaker", detail: "La base para sumar rendimiento", price: "$40.900", oldPrice: "$46.500", badge: "-12%", stock: "En stock", cropX: 361 },
  { brand: "COMBO BIENESTAR", name: "Omega 3 + Shaker QG", detail: "Esenciales para todos los días", price: "$30.900", oldPrice: "$35.300", badge: "-13%", stock: "En stock", cropX: 1143 },
];

const objectives = [
  { title: "Masa muscular", text: "Proteínas y ganadores de peso", tone: "orange", icon: "⚭" },
  { title: "Rendimiento", text: "Creatina y soporte diario", tone: "blue", icon: "◉" },
  { title: "Energía", text: "Pre-entrenos para tu rutina", tone: "cyan", icon: "ϟ" },
  { title: "Recuperación", text: "Aminoácidos y descanso", tone: "amber", icon: "◌" },
  { title: "Definición", text: "Opciones para acompañar tu plan", tone: "teal", icon: "♙" },
  { title: "Bienestar", text: "Omega, vitaminas y minerales", tone: "red", icon: "♡" },
];

const benefits = [
  { icon: TruckIcon, title: "Envíos nacionales", text: "Seguimiento de punta a punta" },
  { icon: ShieldIcon, title: "Pago seguro", text: "Datos siempre protegidos" },
  { icon: CardIcon, title: "3 cuotas sin interés", text: "Con tarjetas seleccionadas" },
  { icon: CheckIcon, title: "100% originales", text: "Trazabilidad garantizada" },
  { icon: SparkIcon, title: "Asesoramiento", text: "Te ayudamos a elegir bien" },
];

const brands = [
  ["STAR NUTRITION", "PROTEÍNA Y CREATINA", "peach"], ["GOLD", "NUTRICIÓN", "yellow"], ["MUTANT", "SPORTS NUTRITION", "pink"],
  ["ENA", "SPORT", "blue"], ["UNIVERSAL", "SINCE 1977", "green"], ["QG LAB", "ACCESORIOS", "gray"],
];

const articles = [
  { tag: "GUÍA DE INICIO", title: "Creatina: qué es y cómo incorporarla a tu rutina", crop: { x: 71, y: 4520, width: 421, height: 154 } },
  { tag: "NUTRICIÓN", title: "Proteína en polvo: claves para comparar opciones", crop: { x: 508, y: 4520, width: 421, height: 154 } },
  { tag: "ENTRENAMIENTO", title: "Pre-entreno: ingredientes y momentos de uso", crop: { x: 946, y: 4520, width: 421, height: 154 } },
];

function SectionHeading({ eyebrow, title, copy, link }: { eyebrow: string; title: string; copy: string; link?: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{copy}</p></div>{link ? <a href="#">{link} <ArrowIcon/></a> : null}</div>;
}

export default function Home() {
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
            <ReferenceCrop source={homeReference} crop={{ x: 702, y: 145, width: 665, height: 485 }} alt="Selección de suplementos QuilGym sobre pedestales" className="hero-art" priority />
          </div>
        </section>

        <section className="benefits-section"><div className="container benefits-grid">{benefits.map(({ icon: Icon, title, text }) => <div className="benefit" key={title}><span><Icon/></span><div><strong>{title}</strong><small>{text}</small></div></div>)}</div></section>

        <section id="objetivos" className="section-pad container">
          <SectionHeading eyebrow="ENCONTRÁ TU CAMINO" title="Elegí tu objetivo" copy="Navegá por una selección pensada para acompañar tu tipo de entrenamiento y tus preferencias." link="Ver todos los objetivos" />
          <div className="objectives-grid">{objectives.map((item) => <a className={`objective objective--${item.tone}`} href="#productos" key={item.title}><span className="objective-icon">{item.icon}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><ArrowIcon/></a>)}</div>
        </section>

        <section id="productos" className="section-pad section-soft">
          <div className="container">
            <SectionHeading eyebrow="FAVORITOS DE LA COMUNIDAD" title="Más vendidos" copy="Productos elegidos una y otra vez por quienes entrenan. Stock actualizado y compra segura." link="Ver todos los productos" />
            <div className="product-grid">{products.map((product) => <ProductCard key={product.name} product={product} />)}</div>
            <div className="advisor-banner"><div className="advisor-icon"><SparkIcon/></div><div><p className="eyebrow">TE ORIENTAMOS EN 3 MINUTOS</p><h3>¿No sabés qué suplemento elegir?</h3><p>Respondé preguntas simples sobre tu objetivo, alimentación y rutina.</p></div><a className="button button--light" href="#">Encontrá mis suplementos <ArrowIcon/></a></div>
          </div>
        </section>

        <section id="combos" className="section-pad container">
          <SectionHeading eyebrow="MÁS POR MENOS" title="Combos por objetivo y ahorro" copy="Armamos selecciones prácticas para simplificar tu compra. Cada combo muestra claramente qué incluye y cuánto ahorrás." link="Explorar combos" />
          <div className="product-grid">{combos.map((product) => <ProductCard key={product.name} product={product} compact />)}</div>
          <div className="brands-block"><SectionHeading eyebrow="SELECCIÓN CONFIABLE" title="Marcas disponibles" copy="Trabajamos con marcas reconocidas y productos con trazabilidad." link="" /><div className="brands-grid">{brands.map(([name, category, tone]) => <a className={`brand-card brand-card--${tone}`} href="#productos" key={name}><strong>{name}</strong><span>{category}</span></a>)}</div></div>
        </section>

        <section className="section-pad section-soft reviews-section"><div className="container"><SectionHeading eyebrow="EXPERIENCIAS REALES" title="Reseñas verificadas" copy="Opiniones de personas que compraron en QuilGym. Publicamos la experiencia completa, sin editar el sentido." link="" /><div className="reviews-grid"><article className="rating-card"><strong>4,9</strong><span>★★★★★</span><p>Promedio general de 1.240 reseñas verificadas</p><div className="rating-bars"><i/><i/><i/><i/></div></article>{["Llegó antes de lo esperado y todo perfectamente sellado. La creatina tenía lote y vencimiento bien visibles.", "Me ayudaron por WhatsApp a comparar opciones sin apurarme. Elegí el combo que mejor encajaba con mi rutina.", "La web es clara, pude pagar en cuotas y el seguimiento del envío funcionó perfecto. Volvería a comprar."].map((quote, index) => <article className="review-card" key={quote}><span className="verified"><CheckIcon/> COMPRA VERIFICADA</span><p>“{quote}”</p><strong>{["Martina R.", "Nicolás P.", "Sofía L."][index]}</strong><small>Quilmes, Buenos Aires</small></article>)}</div></div></section>

        <section id="articulos" className="section-pad container"><SectionHeading eyebrow="APRENDÉ CON QUILGYM" title="Información para elegir mejor" copy="Contenido claro sobre suplementos, hábitos y entrenamiento. Sin promesas mágicas ni atajos." link="Ver todos los artículos" /><div className="articles-grid">{articles.map((article) => <article className="article-card" key={article.title}><ReferenceCrop source={homeReference} crop={article.crop} alt="" /><div><p className="eyebrow">{article.tag}</p><h3>{article.title}</h3><p>Una explicación simple sobre formatos, porciones y constancia.</p></div></article>)}</div></section>

        <section className="section-pad community"><div className="container"><SectionHeading eyebrow="ENTRENAMOS JUNTOS" title="Comunidad QuilGym" copy="Ideas, rutinas y hábitos compartidos por nuestra comunidad. Seguinos en Instagram para ver novedades y contenido diario." link="@quilgym.ar" /><div className="community-grid">{Array.from({ length: 6 }, (_, index) => <div className="community-tile" key={index}><span>FOTO {index + 1}</span><small>♡ {19 + index * 7}</small></div>)}</div></div></section>
      </main>
      <Footer />
    </>
  );
}
