import type { Metadata } from "next";
import { CartDrawer } from "@/components/cart-drawer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { storeProducts } from "@/lib/store-data";

export const metadata: Metadata = { title: "Tu carrito | QuilGym" };

export default function CartPage() {
  return <div className="cart-page"><div className="cart-underlay"><Header/><main className="section-pad container"><p className="eyebrow">FAVORITOS DE LA COMUNIDAD</p><h1>Más vendidos</h1><div className="product-grid">{storeProducts.slice(0,3).map((product) => <ProductCard product={product} priority key={product.slug}/>)}</div></main></div><div className="cart-overlay"/><CartDrawer initialProducts={[storeProducts[2],storeProducts[0]]}/></div>;
}
