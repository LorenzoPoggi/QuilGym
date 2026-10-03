"use client";

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { BrandRef, CategoryRef, ProductSummary } from "@/lib/catalog-types";
import { formatArs } from "@/lib/commerce";
import { normalizeText } from "@/lib/slugify";
import { ArrowIcon, SearchIcon } from "./icons";
import { ProductImage } from "./product-image";

const HISTORY_KEY = "quilgym:recent-searches";
const suggestions = ["Creatina", "Proteína", "Pre-entreno", "Combos", "Shaker"];

const HISTORY_EVENT = "quilgym:history";

function readHistoryRaw() {
  try {
    return localStorage.getItem(HISTORY_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseHistory(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function writeHistory(items: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    // Sin almacenamiento disponible: el historial es opcional.
  }
}

function subscribeHistory(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(HISTORY_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(HISTORY_EVENT, callback);
  };
}

function unique<T extends { slug: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.slug, item])).values()];
}

export function PredictiveSearch({ products, initialQuery = "" }: { products: ProductSummary[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const historyRaw = useSyncExternalStore(subscribeHistory, readHistoryRaw, () => "[]");
  const history = useMemo(() => parseHistory(historyRaw), [historyRaw]);
  const deferredQuery = useDeferredValue(normalizeText(query.trim()));

  const index = useMemo(() => products.map((product) => ({ product, text: normalizeText(`${product.name} ${product.brand?.name ?? ""} ${product.category.name}`) })), [products]);
  const matches = useMemo(() => {
    if (deferredQuery.length < 2) return [];
    const tokens = deferredQuery.split(/\s+/);
    return index.filter(({ text }) => tokens.every((token) => text.includes(token))).map(({ product }) => product).sort((a, b) => Number(b.inStock) - Number(a.inStock));
  }, [deferredQuery, index]);

  const categories: CategoryRef[] = useMemo(() => unique(matches.map((product) => product.category)), [matches]);
  const brands: BrandRef[] = useMemo(() => unique(matches.flatMap((product) => product.brand ? [product.brand] : [])), [matches]);
  const isEmpty = deferredQuery.length > 1 && matches.length === 0;
  const trimmed = query.trim();

  // Mantiene la URL compartible sin volver a renderizar en el servidor.
  useEffect(() => {
    const url = deferredQuery.length > 1 ? `/buscar?q=${encodeURIComponent(query.trim())}` : "/buscar";
    window.history.replaceState(window.history.state, "", url);
  }, [deferredQuery, query]);

  function remember() {
    if (trimmed.length < 2) return;
    writeHistory([trimmed, ...history.filter((item) => normalizeText(item) !== normalizeText(trimmed))].slice(0, 5));
  }

  function forget(item: string) {
    writeHistory(history.filter((entry) => entry !== item));
  }

  return (
    <div className="search-experience">
      <div className="search-page-input"><SearchIcon/><label className="sr-only" htmlFor="predictive-search">Buscar</label><input id="predictive-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} autoFocus autoComplete="off" placeholder="Buscá proteínas, creatinas, marcas..."/><kbd>ESC</kbd></div>
      <section className="search-panel" aria-live="polite">
        {deferredQuery.length < 2 ? <><div className="search-panel-heading"><div><h2>Empezá a buscar</h2><p>Encontrá suplementos por nombre, marca o categoría.</p></div><span>INICIAL</span></div><div className="search-initial-grid">
          {history.length > 0 ? <div><h3>BÚSQUEDAS RECIENTES</h3>{history.map((item) => <div className="search-history-item" key={item}><button type="button" onClick={() => setQuery(item)}>↶ <span>{item}</span></button><button type="button" onClick={() => forget(item)} aria-label={`Borrar ${item} del historial`}>×</button></div>)}</div> : null}
          <div><h3>SUGERENCIAS</h3>{suggestions.map((item, position) => <button type="button" onClick={() => setQuery(item)} key={item}><b>{position + 1}</b><span>{item}</span></button>)}</div>
        </div></> : isEmpty ? <div className="empty-search"><div className="search-panel-heading"><div><h2>No encontramos “{trimmed}”</h2><p>Revisá la escritura o probá con una búsqueda más amplia.</p></div><span>VACÍO</span></div><div className="empty-icon"><SearchIcon/>×</div><p>Probá con alguna de estas categorías:</p><div>{suggestions.map((item) => <button type="button" className="suggestion-chip" onClick={() => setQuery(item)} key={item}>{item}</button>)}</div></div> : <><div className="search-panel-heading"><div><h2>Resultados para “{trimmed}”</h2><p>{matches.length} {matches.length === 1 ? "producto" : "productos"} · {categories.length} {categories.length === 1 ? "categoría" : "categorías"} · {brands.length} {brands.length === 1 ? "marca" : "marcas"}</p></div><span>RESULTADOS</span></div><div className="search-results-grid"><div><h3>PRODUCTOS</h3>{matches.slice(0, 6).map((product) => <Link href={`/productos/${product.slug}`} className="search-product" onClick={remember} key={product.slug}><ProductImage product={product} sizes="72px" decorative/><span><b>{product.brand?.name ?? product.category.name}</b><strong>{product.name}</strong><small>{product.inStock ? product.category.name : "Sin stock"}</small></span><em>{formatArs(product.priceArs)}</em></Link>)}<Link className="search-all" href={`/productos?q=${encodeURIComponent(trimmed)}`} onClick={remember}>Ver {matches.length > 6 ? `los ${matches.length} productos` : "en el catálogo"} <ArrowIcon/></Link></div><div className="search-side-results"><h3>CATEGORÍAS</h3>{categories.map((item) => <Link href={`/productos?categoria=${item.slug}`} key={item.slug}><SearchIcon/>{item.name}<ArrowIcon/></Link>)}{brands.length > 0 ? <><h3>MARCAS</h3>{brands.slice(0, 5).map((item) => <Link href={`/productos?marca=${item.slug}`} key={item.slug}>◌ {item.name}<ArrowIcon/></Link>)}</> : null}</div></div></>}
      </section>
      <p className="search-help">ESC para borrar la búsqueda</p>
    </div>
  );
}
