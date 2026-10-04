"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDownUp, ArrowLeft, ArrowRight, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { catalogHref } from "@/lib/catalog-params";
import { priceRanges, type CatalogQuery, type CatalogResult, type CatalogSort } from "@/lib/catalog-types";
import { CategoryIcon } from "./catalog-category-icon";
import { ProductCard } from "./product-card";

const VISIBLE_BRANDS = 6;

export function CatalogView({ result, query }: { result: CatalogResult; query: CatalogQuery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const totalProducts = result.categories.reduce((sum, item) => sum + item.count, 0);

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
      <nav className="catalog-tabs" aria-label="Categorías">
        {tabs.map((item) => {
          const active = query.category === item.slug;
          return <Link href={catalogHref(query, { category: item.slug, brands: [] })} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} key={item.slug ?? "todas"}><CategoryIcon slug={item.slug}/><small>{item.count}</small><span>{item.name}</span></Link>;
        })}
      </nav>
      <div className="catalog-toolbar">
        <div className="filter-chips">
          {chips.map((chip) => <button type="button" key={chip.label} onClick={() => navigate(chip.remove)} aria-label={`Quitar filtro ${chip.label}`}>{chip.label}<X aria-hidden="true"/></button>)}
          {chips.length > 0 ? <button type="button" className="clear-filters" onClick={() => navigate({ q: undefined, brands: [], price: undefined, inStockOnly: false })}>Limpiar filtros</button> : null}
        </div>
        <p className="catalog-count">{resultsLabel}</p>
        <button type="button" className="catalog-filters-toggle" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal aria-hidden="true"/>Filtros{chips.length > 0 ? ` · ${chips.length} ${chips.length === 1 ? "activo" : "activos"}` : ""}</button>
        <label className="catalog-sort"><ArrowDownUp aria-hidden="true"/><span>Ordenar:</span><select value={query.sort} onChange={(event) => navigate({ sort: event.target.value as CatalogSort })}><option value="relevancia">Más relevantes</option><option value="menor-precio">Menor precio</option><option value="mayor-precio">Mayor precio</option><option value="nombre">Nombre (A–Z)</option></select><ChevronDown aria-hidden="true"/></label>
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
