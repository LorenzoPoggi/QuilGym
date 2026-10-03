import type { Metadata } from "next";
import { CartPanel } from "@/components/cart-drawer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getFeaturedProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Tu carrito | QuilGym", robots: { index: false } };

export default async function CartPage() {
  const featured = await getFeaturedProducts(3);
  return <div className="cart-page"><div className="cart-underlay" inert><Header/><main className="section-pad container"><p className="eyebrow">SELECCIÓN QUILGYM</p><h1>Destacados</h1><div className="product-grid">{featured.map((product) => <ProductCard product={product} priority key={product.slug}/>)}</div></main></div><div className="cart-overlay"/><aside className="cart-drawer" aria-labelledby="cart-heading"><CartPanel closeHref="/productos"/></aside></div>;
}
