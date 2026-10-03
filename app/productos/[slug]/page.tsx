import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { ProductImage } from "@/components/product-image";
import { TrustStrip } from "@/components/trust-strip";
import { BagIcon, CheckIcon } from "@/components/icons";
import { getAllProducts, getProduct, getProductsByCategory } from "@/lib/catalog";
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
  const hasVariants = product.variants.length > 1;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.variants[0].sku,
    category: product.category.name,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand.name } } : {}),
    ...(product.description ? { description: product.description } : {}),
    offers: { "@type": "Offer", priceCurrency: "ARS", price: product.priceArs, availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };

  return <><Header/><main className="product-page"><div className="container">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}/>
    <p className="breadcrumb"><Link href="/">Inicio</Link> / <Link href={`/productos?categoria=${product.category.slug}`}>{product.category.name}</Link>{product.brand ? <> / <Link href={`/productos?categoria=${product.category.slug}&marca=${product.brand.slug}`}>{product.brand.name}</Link></> : null} / {product.name}</p>
    <section className="product-hero">
      <div className="product-gallery product-gallery--single"><ProductImage product={product} className="product-main-image" sizes="(max-width: 1100px) 100vw, 50vw" priority/></div>
      <div className="product-buybox">
        <div className="buybox-brand">{product.brand?.name ?? product.category.name}</div>
        <h1>{product.name}</h1>
        <p className="buybox-price">{formatArs(product.priceArs)} {product.compareAtPriceArs ? <del>{formatArs(product.compareAtPriceArs)}</del> : null}</p>
        {commerce.interestFreeInstallments > 1 ? <strong className="payment-copy">{commerce.interestFreeInstallments} cuotas sin interés de {formatArs(product.priceArs / commerce.interestFreeInstallments)}</strong> : null}
        {commerce.transferDiscountPercent > 0 ? <p className="transfer-price">{formatArs(transferPrice(product.priceArs))} con transferencia bancaria</p> : null}
        <p className={`stock ${product.inStock ? "" : "stock--out"}`}><span/> {product.inStock ? "En stock" : "Sin stock por el momento"}</p>
        {hasVariants ? <div className="option-group"><span>Variante</span><div>{product.variants.map((variant) => <button type="button" disabled={!variant.inStock} key={variant.id}>{variant.label ?? variant.sku} · {variant.inStock ? formatArs(variant.priceArs) : "Sin stock"}</button>)}</div></div> : null}
        <div className="buy-actions buy-actions--single"><div><button type="button" className="button button--dark" disabled={!product.inStock}><BagIcon/> {product.inStock ? "Agregar al carrito" : "Sin stock"}</button></div></div>
        <div className="shipping-calculator"><strong>Entrega</strong><p><CheckIcon/> Envíos a todo el país.</p><p><CheckIcon/> Retiro en nuestro local de {commerce.pickupLocation}.</p></div>
      </div>
    </section>
    <TrustStrip/>
    <section className="product-info-section">
      <div className="section-heading"><div><h2>Información del producto</h2><p>{product.description ?? "Consultá el rótulo del envase para ver ingredientes, porción recomendada, información nutricional y advertencias."}</p></div></div>
      <p className="compare-disclaimer">ⓘ La información nutricional puede variar por lote. Los suplementos no reemplazan una alimentación variada; ante dudas, consultá a un profesional de la salud.</p>
    </section>
    {related.length > 0 ? <section className="similar-products"><div className="section-heading"><div><h2>Más {product.category.name.toLowerCase()}</h2><p>Otras opciones de la misma categoría para comparar.</p></div></div><div className="product-grid">{related.map((item) => <ProductCard product={item} key={item.slug}/>)}</div></section> : null}
  </div></main><Footer/></>;
}
