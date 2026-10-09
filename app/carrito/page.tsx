import type { Metadata } from "next";
import { CartPanel } from "@/components/cart-drawer";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProductCard } from "@/components/product-card";
import { getFeaturedProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Tu carrito | QuilGym", robots: { index: false } };

export default async function CartPage() {
  const featured = await getFeaturedProducts(3);
  return <><Header/><main className="cart-page section-pad"><div className="container">
    <div className="cart-page-heading"><p className="eyebrow">TU COMPRA</p><h1>Tu carrito</h1><p>Revisá los productos y cantidades antes de continuar.</p></div>
    <div className="cart-page-layout"><section className="cart-page-panel" aria-label="Productos del carrito"><div className="cart-drawer"><CartPanel closeHref="/productos" headingLevel="h2"/></div></section>
      <aside className="cart-page-aside"><p className="eyebrow">PARA COMPLETAR TU COMPRA</p><h2>También te puede interesar</h2><div className="product-grid">{featured.map((product) => <ProductCard product={product} key={product.slug}/>)}</div></aside>
    </div>
  </div></main><Footer/></>;
}
