"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import catalogReference from "@/design-reference/02-catalogo.png";
import type { StoreProduct } from "@/lib/store-data";
import { ArrowIcon, SearchIcon } from "./icons";
import { ReferenceCrop } from "./reference-crop";

const recent = ["whey protein", "creatina", "shaker"];
const popular = ["Creatina monohidrato", "Proteína sin TACC", "Pre-entreno", "Combos para masa muscular"];

export function PredictiveSearch({ products, initialQuery = "" }: { products: StoreProduct[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const matches = useMemo(() => deferredQuery.length < 2 ? [] : products.filter((product) => `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(deferredQuery)), [deferredQuery, products]);
  const isEmpty = deferredQuery.length > 1 && matches.length === 0;

  return (
    <div className="search-experience">
      <div className="search-page-input"><SearchIcon/><label className="sr-only" htmlFor="predictive-search">Buscar</label><input id="predictive-search" value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Buscá proteínas, creatinas, marcas..."/><kbd>ESC</kbd></div>
      <section className="search-panel" aria-live="polite">
        {deferredQuery.length < 2 ? <><div className="search-panel-heading"><div><h2>Empezá a buscar</h2><p>Encontrá suplementos, categorías, marcas y contenido útil.</p></div><span>INICIAL</span></div><div className="search-initial-grid"><div><h3>BÚSQUEDAS RECIENTES</h3>{recent.map((item) => <button type="button" onClick={() => setQuery(item)} key={item}>↶ <span>{item}</span> ×</button>)}</div><div><h3>LO MÁS BUSCADO</h3>{popular.map((item, index) => <button type="button" onClick={() => setQuery(item)} key={item}><b>{index + 1}</b><span>{item}</span></button>)}</div></div></> : isEmpty ? <div className="empty-search"><div className="search-panel-heading"><div><h2>No encontramos “{query}”</h2><p>Revisá la escritura o probá con una búsqueda más amplia.</p></div><span>VACÍO</span></div><div className="empty-icon"><SearchIcon/>×</div><p>No hay coincidencias exactas. ¿Quisiste decir <button type="button" onClick={() => setQuery("creatina")}>creatina</button>?</p><div>{["Creatina", "Monohidrato", "Más vendidos"].map((item) => <button type="button" className="suggestion-chip" onClick={() => setQuery(item)} key={item}>{item}</button>)}</div></div> : <><div className="search-panel-heading"><div><h2>Resultados para “{query}”</h2><p>{matches.length} productos, 3 categorías, 3 marcas y 6 contenidos</p></div><span>RESULTADOS</span></div><div className="search-results-grid"><div><h3>PRODUCTOS</h3>{matches.slice(0, 3).map((product) => <Link href={`/productos/${product.slug}`} className="search-product" key={product.slug}><ReferenceCrop source={catalogReference} crop={{ x: product.cropX, y: 493, width: 214, height: 159 }} alt=""/><span><b>{product.brand}</b><strong>{product.name}</strong><small>{product.detail}</small></span><em>{product.price}</em></Link>)}<Link className="search-all" href="/productos">Ver todos los productos para “{query}” <ArrowIcon/></Link></div><div className="search-side-results"><h3>CATEGORÍAS</h3>{["Creatinas", "Creatina monohidrato", "Creatina micronizada"].map((item) => <Link href="/productos" key={item}><SearchIcon/>{item}<ArrowIcon/></Link>)}<h3>MARCAS</h3>{["Star Nutrition", "ENA Sport", "Gold Nutrition"].map((item) => <Link href="/productos" key={item}>◌ {item}<ArrowIcon/></Link>)}<h3>ARTÍCULOS</h3><Link href="/#articulos">▣ Creatina: qué es y cómo incorporarla<ArrowIcon/></Link></div></div></>}
      </section>
      <p className="search-help">ESC para cerrar · ↑↓ para navegar · ENTER para elegir</p>
    </div>
  );
}
