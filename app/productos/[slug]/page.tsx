import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Info, Store, Truck } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { ComboGallery } from "@/components/combo-showcase";
import { RichText } from "@/components/rich-text";
import { TrustStrip } from "@/components/trust-strip";
import { ProductPurchase } from "@/components/cart-buttons";
import { FavoriteButton } from "@/components/account-controls";
import { getAllProducts, getProduct, getProductsByCategory } from "@/lib/catalog";
import { comboParts } from "@/lib/combo-contents";
import { commerce, formatArs, transferPrice } from "@/lib/commerce";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getAllProducts()).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return { title: "Producto no encontrado | QuilGym" };
  const description = `${product.name}${product.brand ? ` de ${product.brand.name}` : ""}. ${product.category.name} originales con envío o retiro en Quilmes.`;
  return { title: `${product.name} | QuilGym`, description, alternates: { canonical: `/productos/${product.slug}` } };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const related = await getProductsByCategory(product.category.slug, 4, product.slug);
  const categoryHref = `/productos?categoria=${product.category.slug}`;
  // Combos mapeados: la composición con las fotos de lo que incluye en lugar de la foto vieja del combo.
  const combo = comboParts(product.slug);
  const activeSlugs = combo ? new Set((await getAllProducts()).map((item) => item.slug)) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.variants[0].sku,
    category: product.category.name,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    ...(product.description ? { description: product.description.replace(/^(## |- )/gm, "").replace(/\s+/g, " ").trim() } : {}),
    offers: { "@type": "Offer", priceCurrency: "ARS", price: product.priceArs, availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };

  return <><Header/><main className="product-page"><div className="container">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}/>
    <p className="breadcrumb"><Link href="/">Inicio</Link> / <Link href={categoryHref}>{product.category.name}</Link>{product.brand ? <> / <Link href={`${categoryHref}&marca=${product.brand.slug}`}>{product.brand.name}</Link></> : null} / {product.name}</p>
    <section className="product-hero" id="galeria-producto">
      {combo && activeSlugs ? <ComboGallery name={product.name} parts={combo} activeSlugs={activeSlugs}/> : <ProductGallery product={product}/>}
      <div className="product-buybox">
        <div className="buybox-brand">{product.brand?.name ?? product.category.name}</div>
        <div className="product-title-row"><h1>{product.name}</h1><FavoriteButton productId={product.id} name={product.name}/></div>
        <p className="buybox-price">{formatArs(product.priceArs)} {product.compareAtPriceArs ? <del>{formatArs(product.compareAtPriceArs)}</del> : null}</p>
        {commerce.interestFreeInstallments > 1 ? <strong className="payment-copy">{commerce.interestFreeInstallments} cuotas sin interés de {formatArs(product.priceArs / commerce.interestFreeInstallments)}</strong> : null}
        {commerce.transferDiscountPercent > 0 ? <p className="transfer-price">{formatArs(transferPrice(product.priceArs))} con transferencia bancaria</p> : null}
        <p className={`stock ${product.inStock ? "" : "stock--out"}`}><span/> {product.inStock ? "En stock" : "Sin stock por el momento"}</p>
        <ProductPurchase product={product}/>
        <div className="shipping-calculator"><strong>Entrega</strong><p><Truck aria-hidden="true"/> Envíos a todo el país.</p><p><Store aria-hidden="true"/> Retiro en nuestro local de {commerce.pickupLocation}.</p></div>
      </div>
    </section>
    <TrustStrip/>
    <section className="product-info-section">
      <div className="section-heading"><div><h2>Información del producto</h2><p>Información clara para entender el producto y decidir según tu rutina.</p></div></div>
      <div>
        {product.description ? <RichText source={product.description} className="product-description"/> : <p className="product-description">Consultá el rótulo del envase para ver ingredientes, porción recomendada, información nutricional y advertencias.</p>}
      </div>
      <p className="compare-disclaimer"><Info aria-hidden="true"/><span>La información nutricional puede variar por lote: ante cualquier diferencia, vale lo que dice el envase que recibís. Los suplementos no reemplazan una alimentación variada; ante dudas, consultá a un profesional de la salud.</span></p>
    </section>
    {related.length > 0 ? <section className="similar-products"><div className="section-heading"><div><h2>Más {product.category.name.toLowerCase()}</h2><p>Otras opciones de la misma categoría para comparar.</p></div><Link href={categoryHref}>Ver todas<ArrowRight aria-hidden="true"/></Link></div><div className="product-grid">{related.map((item) => <ProductCard product={item} key={item.slug}/>)}</div></section> : null}
  </div></main><Footer/></>;
}
