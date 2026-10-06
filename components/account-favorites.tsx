"use client";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog-types";
import { ProductCard } from "./product-card";

export function AccountFavorites({ products }: { products: ProductSummary[] }) {
  const [category, setCategory] = useState("");
  const categories = [...new Map(products.map((product) => [product.category.slug, product.category])).values()];
  const visible = category ? products.filter((product) => product.category.slug === category) : products;
  return <>
    <div className="favorite-filters" role="group" aria-label="Filtrar favoritos por categoría"><button type="button" aria-pressed={!category} onClick={() => setCategory("")}>Todos ({products.length})</button>{categories.map((item) => <button type="button" aria-pressed={category === item.slug} onClick={() => setCategory(item.slug)} key={item.slug}>{item.name} ({products.filter((product) => product.category.slug === item.slug).length})</button>)}</div>
    {visible.length ? <div className="product-grid">{visible.map((product) => <ProductCard product={product} key={product.id}/>)}</div> : <div className="account-empty"><Star aria-hidden="true"/><h3>{products.length ? "No hay favoritos en esta categoría" : "Todavía no guardaste productos"}</h3><p>Tocá la estrella de cualquier producto para encontrarlo después.</p><Link className="button button--dark" href="/productos">Explorar productos</Link></div>}
  </>;
}
