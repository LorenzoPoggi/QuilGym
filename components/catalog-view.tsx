"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowDownUp, ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { catalogHref } from "@/lib/catalog-params";
import { priceRanges, type CatalogQuery, type CatalogResult, type CatalogSort } from "@/lib/catalog-types";
import { CategoryIcon } from "./catalog-category-icon";
import { ProductCard } from "./product-card";
import { reducedMotion } from "@/lib/motion";

const VISIBLE_BRANDS = 6;

export function CatalogView({ result, query }: { result: CatalogResult; query: CatalogQuery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const tabsRef = useRef<HTMLElement>(null);
  const totalProducts = result.categories.reduce((sum, item) => sum + item.count, 0);

  // Degradé en el borde que todavía tiene pestañas ocultas (se escribe en el DOM para no re-renderizar en cada scroll).
  const measureTabs = useCallback(() => {
    const el = tabsRef.current;
    const wrap = el?.parentElement;
    if (!el || !wrap) return;
    const start = el.scrollLeft > 4;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    const state = start && end ? "both" : start ? "start" : end ? "end" : "";
    if (state) wrap.dataset.overflow = state; else delete wrap.dataset.overflow;
  }, []);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    // La pestaña activa queda a la vista sin mover la página.
    const active = el.querySelector<HTMLElement>("[aria-current]");
    if (active) {
      const box = el.getBoundingClientRect(), tab = active.getBoundingClientRect();
      if (tab.left < box.left || tab.right > box.right) el.scrollLeft += tab.left - box.left - 24;
    }
    measureTabs();
    const observer = new ResizeObserver(measureTabs);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureTabs, query.category]);

  function scrollTabs(direction: 1 | -1) {
    const el = tabsRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * .8, behavior: reducedMotion() ? "auto" : "smooth" });
  }

  function navigate(changes: Partial<CatalogQuery>) {
    startTransition(() => router.push(catalogHref(query, changes), { scroll: false }));
  }

  function toggleBrand(slug: string) {
    navigate({ brands: query.brands.includes(slug) ? query.brands.filter((item) => item !== slug) : [...query.brands, slug] });
  }

  const brandName = (slug: string) => result.brands.find((item) => item.slug === slug)?.name ?? slug;
  const chips = [
    ...(query.q ? [{ label: `“${query.q}”`, remove: { q: undefined } }] : []),
    ...query.brands.map((slug) => ({ label: brandName(slug), remove: { brands: query.brands.filter((item) => item !== slug) } })),
    ...(query.price ? [{ label: priceRanges.find((range) => range.slug === query.price)!.label, remove: { price: undefined } }] : []),
    ...(query.inStockOnly ? [{ label: "En stock", remove: { inStockOnly: false } }] : []),
  ];
  // Las marcas elegidas siempre quedan visibles aunque estén fuera de las primeras.
  const visibleBrands = showAllBrands ? result.brands : result.brands.filter((item, index) => index < VISIBLE_BRANDS || query.brands.includes(item.slug));
  const resultsLabel = `${result.total} ${result.total === 1 ? "resultado" : "resultados"}`;

  const tabs = [{ slug: undefined, name: "Todas", count: totalProducts }, ...result.categories];

  return (
    <>
      <div className="catalog-bar">
        <div className="catalog-tabs-wrap">
          {/* Flechas solo con mouse y cuando hay pestañas ocultas de ese lado (data-overflow); con teclado o swipe las pestañas se desplazan solas. */}
          <button type="button" className="catalog-tabs-arrow catalog-tabs-arrow--prev" aria-label="Ver categorías anteriores" aria-controls="catalog-tabs" onClick={() => scrollTabs(-1)}><ChevronLeft aria-hidden="true"/></button>
          <nav id="catalog-tabs" className="catalog-tabs" aria-label="Categorías" ref={tabsRef} onScroll={measureTabs}>
            {tabs.map((item) => {
              const active = query.category === item.slug;
              return <Link href={catalogHref(query, { category: item.slug, brands: [] })} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} key={item.slug ?? "todas"}><CategoryIcon slug={item.slug}/><small>{item.count}</small><span>{item.name}</span></Link>;
            })}
          </nav>
          <button type="button" className="catalog-tabs-arrow catalog-tabs-arrow--next" aria-label="Ver más categorías" aria-controls="catalog-tabs" onClick={() => scrollTabs(1)}><ChevronRight aria-hidden="true"/></button>
        </div>
        <div className="catalog-toolbar">
          <button type="button" className="catalog-filters-toggle" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal aria-hidden="true"/>Filtros{chips.length > 0 ? <span className="catalog-filters-count">{chips.length}<span className="sr-only"> {chips.length === 1 ? "activo" : "activos"}</span></span> : null}</button>
          <p className="catalog-count" aria-live="polite">{resultsLabel}</p>
          <label className="catalog-sort"><ArrowDownUp aria-hidden="true"/><span>Ordenar:</span><select aria-label="Ordenar productos" value={query.sort} onChange={(event) => navigate({ sort: event.target.value as CatalogSort })}><option value="relevancia">Más relevantes</option><option value="menor-precio">Menor precio</option><option value="mayor-precio">Mayor precio</option><option value="nombre">Nombre (A–Z)</option></select><ChevronDown aria-hidden="true"/></label>
        </div>
      </div>
      <div className="catalog-layout">
        <aside id="catalog-filters" className={filtersOpen ? "filters-panel is-open" : "filters-panel"} aria-label="Filtros">
          <div className="filters-title"><h2>Filtros</h2><span>{chips.length} activos</span></div>
          <details className="filter-group" open><summary>Disponibilidad<ChevronDown aria-hidden="true"/></summary><fieldset><legend className="sr-only">Disponibilidad</legend><label><input type="checkbox" checked={query.inStockOnly} onChange={() => navigate({ inStockOnly: !query.inStockOnly })}/><span>Solo en stock</span></label></fieldset></details>
          {result.brands.length > 0 ? <details className="filter-group" open><summary>Marca<ChevronDown aria-hidden="true"/></summary><fieldset id="catalog-brand-options"><legend className="sr-only">Marca</legend>{visibleBrands.map((item) => <label key={item.slug}><input type="checkbox" checked={query.brands.includes(item.slug)} onChange={() => toggleBrand(item.slug)}/><span>{item.name}</span><small>{item.count}</small></label>)}</fieldset>{result.brands.length > VISIBLE_BRANDS ? <button type="button" className="filters-more" aria-expanded={showAllBrands} aria-controls="catalog-brand-options" onClick={() => setShowAllBrands((value) => !value)}>{showAllBrands ? "Ver menos" : `Ver todas (${result.brands.length})`}</button> : null}</details> : null}
          <details className="filter-group" open><summary>Precio<ChevronDown aria-hidden="true"/></summary><fieldset><legend className="sr-only">Precio</legend>{priceRanges.map((range) => <label key={range.slug}><input type="radio" name="precio" checked={query.price === range.slug} onChange={() => navigate({ price: range.slug })}/><span>{range.label}</span></label>)}{query.price ? <button type="button" className="filters-reset" onClick={() => navigate({ price: undefined })}>Cualquier precio</button> : null}</fieldset></details>
          <button type="button" className="button button--dark filters-apply" onClick={() => setFiltersOpen(false)}>Ver {resultsLabel}</button>
        </aside>
        <div aria-busy={isPending} className={isPending ? "catalog-results is-pending" : "catalog-results"}>
          {chips.length > 0 ? <div className="filter-chips">
            {chips.map((chip) => <button type="button" key={chip.label} onClick={() => navigate(chip.remove)} aria-label={`Quitar filtro ${chip.label}`}>{chip.label}<X aria-hidden="true"/></button>)}
            <button type="button" className="clear-filters" onClick={() => navigate({ q: undefined, brands: [], price: undefined, inStockOnly: false })}>Limpiar filtros</button>
          </div> : null}
          {result.products.length === 0 ? <div className="catalog-empty"><h2>No hay productos con estos filtros</h2><p>Probá quitar algún filtro o buscar otra categoría.</p><Link className="button button--dark" href="/productos">Ver todos los productos</Link></div> : <div className="catalog-product-grid">{result.products.map((product, index) => <ProductCard key={product.slug} product={product} priority={index < 4}/>)}</div>}
          {result.pageCount > 1 ? <nav className="pagination" aria-label="Páginas del catálogo">
            {result.page > 1 ? <Link href={catalogHref(query, { page: result.page - 1 })} aria-label="Página anterior"><ArrowLeft aria-hidden="true"/></Link> : <span className="is-disabled" aria-hidden="true"><ArrowLeft/></span>}
            {Array.from({ length: result.pageCount }, (_, index) => index + 1).map((page) => <Link href={catalogHref(query, { page })} className={page === result.page ? "is-active" : ""} aria-current={page === result.page ? "page" : undefined} key={page}>{page}</Link>)}
            {result.page < result.pageCount ? <Link href={catalogHref(query, { page: result.page + 1 })} aria-label="Página siguiente"><ArrowRight aria-hidden="true"/></Link> : <span className="is-disabled" aria-hidden="true"><ArrowRight/></span>}
          </nav> : null}
        </div>
      </div>
    </>
  );
}
