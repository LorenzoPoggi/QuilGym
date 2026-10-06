"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { BrandRef, CategoryRef, ProductSummary } from "@/lib/catalog-types";
import { formatArs } from "@/lib/commerce";
import { normalizeText } from "@/lib/slugify";
import { ArrowRight, ArrowUpRight, CircleDot, History, Search, SearchX, X } from "lucide-react";
import { ProductImage } from "./product-image";
import { useAccount } from "./account-provider";

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

function distance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}

/** "¿Quisiste decir…?": corrige cada palabra contra el vocabulario real del catálogo. */
function suggestCorrection(query: string, vocabulary: Map<string, string>, hasMatches: (value: string) => boolean) {
  const words = [...vocabulary.keys()];
  let changed = false;
  const corrected = query.split(/\s+/).map((token) => {
    if (token.length < 3 || words.some((word) => word.includes(token))) return vocabulary.get(token) ?? token;
    const limit = token.length <= 4 ? 1 : 2;
    let best: string | null = null;
    let bestDistance = limit + 1;
    for (const word of words) {
      if (Math.abs(word.length - token.length) > limit) continue;
      const value = distance(token, word);
      if (value < bestDistance) [best, bestDistance] = [word, value];
    }
    if (!best) return token;
    changed = true;
    return vocabulary.get(best)!;
  }).join(" ");
  return changed && hasMatches(normalizeText(corrected)) ? corrected : null;
}

export function PredictiveSearch({ products, initialQuery = "" }: { products: ProductSummary[]; initialQuery?: string }) {
  const { user, loading } = useAccount();
  const [query, setQuery] = useState(initialQuery);
  const [accountHistory, setAccountHistory] = useState<{ id: number; query: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRaw = useSyncExternalStore(subscribeHistory, readHistoryRaw, () => "[]");
  const guestHistory = useMemo(() => parseHistory(historyRaw), [historyRaw]);
  const history = user ? accountHistory.map((item) => item.query) : guestHistory;
  const deferredQuery = useDeferredValue(normalizeText(query.trim()));

  const index = useMemo(() => products.map((product) => ({ product, text: normalizeText(`${product.name} ${product.brand?.name ?? ""} ${product.category.name}`) })), [products]);
  const allCategories: CategoryRef[] = useMemo(() => unique(products.map((product) => product.category)), [products]);
  const matches = useMemo(() => {
    if (deferredQuery.length < 2) return [];
    const tokens = deferredQuery.split(/\s+/);
    return index.filter(({ text }) => tokens.every((token) => text.includes(token))).map(({ product }) => product).sort((a, b) => Number(b.inStock) - Number(a.inStock));
  }, [deferredQuery, index]);

  const categories: CategoryRef[] = useMemo(() => unique(matches.map((product) => product.category)), [matches]);
  const brands: BrandRef[] = useMemo(() => unique(matches.flatMap((product) => product.brand ? [product.brand] : [])), [matches]);
  const isEmpty = deferredQuery.length > 1 && matches.length === 0;
  const trimmed = query.trim();

  const correction = useMemo(() => {
    if (!isEmpty) return null;
    const vocabulary = new Map<string, string>();
    for (const { product } of index) {
      for (const word of `${product.name} ${product.brand?.name ?? ""} ${product.category.name}`.toLowerCase().split(/[^\p{L}]+/u)) {
        if (word.length >= 3 && !vocabulary.has(normalizeText(word))) vocabulary.set(normalizeText(word), word);
      }
    }
    return suggestCorrection(deferredQuery, vocabulary, (value) => index.some(({ text }) => value.split(/\s+/).every((token) => text.includes(token))));
  }, [isEmpty, deferredQuery, index]);

  // Mantiene la URL compartible sin volver a renderizar en el servidor.
  useEffect(() => {
    const url = deferredQuery.length > 1 ? `/buscar?q=${encodeURIComponent(query.trim())}` : "/buscar";
    window.history.replaceState(window.history.state, "", url);
  }, [deferredQuery, query]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const initial = initialQuery.trim();
      if (initial.length >= 2) writeHistory([initial, ...guestHistory.filter((item) => normalizeText(item) !== normalizeText(initial))].slice(0, 5));
      return;
    }
    const controller = new AbortController();
    const initial = initialQuery.trim();
    async function load() {
      try {
        const response = await fetch("/api/account/history", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        let data = await response.json();
        if (initial.length >= 2) {
          const saved = await fetch("/api/account/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: initial }), signal: controller.signal });
          if (saved.ok) data = await saved.json();
        }
        if (!controller.signal.aborted) setAccountHistory(data.items);
      } catch { /* La búsqueda funciona aunque el historial no esté disponible. */ }
    }
    void load();
    return () => controller.abort();
  // El historial inicial se carga una vez por usuario y URL de entrada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, initialQuery]);

  function remember() {
    if (trimmed.length < 2) return;
    if (user) void fetch("/api/account/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: trimmed }) })
      .then((response) => response.ok ? response.json() : null).then((data) => { if (data) setAccountHistory(data.items); }).catch(() => {});
    else writeHistory([trimmed, ...history.filter((item) => normalizeText(item) !== normalizeText(trimmed))].slice(0, 5));
  }

  function forget(item: string) {
    if (user) {
      const id = accountHistory.find((entry) => entry.query === item)?.id;
      if (id) void fetch("/api/account/history", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
        .then((response) => response.ok ? response.json() : null).then((data) => { if (data) setAccountHistory(data.items); }).catch(() => {});
    } else writeHistory(history.filter((entry) => entry !== item));
  }

  function clear() {
    setQuery("");
    inputRef.current?.focus();
  }

  const productCount = `${matches.length} ${matches.length === 1 ? "producto" : "productos"}`;

  return (
    <div className="search-experience">
      <div className="search-page-input"><Search aria-hidden="true"/><label className="sr-only" htmlFor="predictive-search">Buscar</label><input ref={inputRef} id="predictive-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} autoFocus autoComplete="off" enterKeyHint="search" placeholder="Buscá proteínas, creatinas, marcas..."/>{query ? <button type="button" className="search-clear" onClick={clear} aria-label="Borrar búsqueda"><X aria-hidden="true"/></button> : null}<kbd>ESC</kbd></div>
      <section className="search-panel" aria-live="polite">
        {deferredQuery.length < 2 ? <><div className="search-panel-heading"><div><h2>Empezá a buscar</h2><p>Encontrá suplementos por nombre, marca o categoría.</p></div><span>INICIAL</span></div><div className="search-initial-grid">
          {history.length > 0 ? <div><h3>BÚSQUEDAS RECIENTES</h3>{history.map((item) => <div className="search-history-item" key={item}><button type="button" onClick={() => setQuery(item)}><History aria-hidden="true"/><span>{item}</span></button><button type="button" onClick={() => forget(item)} aria-label={`Borrar ${item} del historial`}><X aria-hidden="true"/></button></div>)}</div> : <div className="search-side-results"><h3>CATEGORÍAS</h3>{allCategories.map((item) => <Link href={`/productos?categoria=${item.slug}`} key={item.slug}><Search aria-hidden="true"/>{item.name}<ArrowUpRight aria-hidden="true"/></Link>)}</div>}
          <div><h3>SUGERENCIAS</h3>{suggestions.map((item, position) => <button type="button" className="search-suggestion" onClick={() => setQuery(item)} key={item}><b>{position + 1}</b><span>{item}</span></button>)}</div>
        </div></> : isEmpty ? <div className="empty-search"><div className="search-panel-heading"><div><h2>No encontramos “{trimmed}”</h2><p>Revisá la escritura o probá con una búsqueda más amplia.</p></div><span>VACÍO</span></div><div className="empty-icon"><SearchX aria-hidden="true"/></div>{correction ? <p>No hay coincidencias exactas. ¿Quisiste decir <button type="button" onClick={() => setQuery(correction)}>{correction}</button>?</p> : <p>Probá con alguna de estas categorías:</p>}<div>{suggestions.map((item) => <button type="button" className="suggestion-chip" onClick={() => setQuery(item)} key={item}>{item}</button>)}</div></div> : <><div className="search-panel-heading"><div><h2>Resultados para “{trimmed}”</h2><p>{productCount} · {categories.length} {categories.length === 1 ? "categoría" : "categorías"} · {brands.length} {brands.length === 1 ? "marca" : "marcas"}</p></div><span>RESULTADOS</span></div><div className="search-results-grid"><div><h3>PRODUCTOS</h3>{matches.slice(0, 4).map((product) => <Link href={`/productos/${product.slug}`} className="search-product" onClick={remember} key={product.slug}><ProductImage product={product} sizes="72px" decorative/><span><b>{product.brand?.name ?? product.category.name}</b><strong>{product.name}</strong><small>{product.category.name} · {product.inStock ? "En stock" : "Sin stock"}</small></span><em>{formatArs(product.priceArs)}</em></Link>)}<Link className="search-all" href={`/productos?q=${encodeURIComponent(trimmed)}`} onClick={remember}>{matches.length === 1 ? `Ver 1 producto para “${trimmed}”` : `Ver los ${productCount} para “${trimmed}”`}<ArrowRight aria-hidden="true"/></Link></div><div className="search-side-results"><h3>CATEGORÍAS</h3>{categories.map((item) => <Link href={`/productos?categoria=${item.slug}`} key={item.slug}><Search aria-hidden="true"/>{item.name}<ArrowUpRight aria-hidden="true"/></Link>)}{brands.length > 0 ? <><h3>MARCAS</h3>{brands.slice(0, 5).map((item) => <Link href={`/productos?marca=${item.slug}`} key={item.slug}><CircleDot aria-hidden="true"/>{item.name}<ArrowUpRight aria-hidden="true"/></Link>)}</> : null}</div></div></>}
      </section>
    </div>
  );
}
