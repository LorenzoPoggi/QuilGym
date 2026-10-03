"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { catalogHref } from "@/lib/catalog-params";
import { priceRanges, type CatalogQuery, type CatalogResult, type CatalogSort } from "@/lib/catalog-types";
import { ProductCard } from "./product-card";

export function CatalogView({ result, query }: { result: CatalogResult; query: CatalogQuery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  return (
    <>
      <nav className="catalog-tabs" aria-label="Categorías">
        <Link href={catalogHref(query, { category: undefined, brands: [] })} className={!query.category ? "is-active" : ""} aria-current={!query.category ? "page" : undefined}><span>{totalProducts}</span>Todas</Link>
        {result.categories.map((item) => <Link href={catalogHref(query, { category: item.slug, brands: [] })} className={query.category === item.slug ? "is-active" : ""} aria-current={query.category === item.slug ? "page" : undefined} key={item.slug}><span>{item.count}</span>{item.name}</Link>)}
      </nav>
      <div className="catalog-toolbar">
        <div className="filter-chips">
          {chips.map((chip) => <button type="button" key={chip.label} onClick={() => navigate(chip.remove)} aria-label={`Quitar filtro ${chip.label}`}>{chip.label} ×</button>)}
          {chips.length > 0 ? <button type="button" className="clear-filters" onClick={() => navigate({ q: undefined, brands: [], price: undefined, inStockOnly: false })}>Limpiar filtros</button> : null}
        </div>
        <label>Ordenar:<select value={query.sort} onChange={(event) => navigate({ sort: event.target.value as CatalogSort })}><option value="relevancia">Más relevantes</option><option value="menor-precio">Menor precio</option><option value="mayor-precio">Mayor precio</option><option value="nombre">Nombre (A–Z)</option></select></label>
      </div>
      <div className="catalog-layout">
        <aside className="filters-panel">
          <div className="filters-title"><h2>Filtros</h2><span>{chips.length} activos</span></div>
          <fieldset><legend>Disponibilidad</legend><label><input type="checkbox" checked={query.inStockOnly} onChange={() => navigate({ inStockOnly: !query.inStockOnly })}/><span>Solo en stock</span></label></fieldset>
          {result.brands.length > 0 ? <fieldset><legend>Marca</legend>{result.brands.map((item) => <label key={item.slug}><input type="checkbox" checked={query.brands.includes(item.slug)} onChange={() => toggleBrand(item.slug)}/><span>{item.name}</span><small>{item.count}</small></label>)}</fieldset> : null}
          <fieldset><legend>Precio</legend>{priceRanges.map((range) => <label key={range.slug}><input type="radio" name="precio" checked={query.price === range.slug} onChange={() => navigate({ price: range.slug })}/><span>{range.label}</span></label>)}{query.price ? <button type="button" className="filters-reset" onClick={() => navigate({ price: undefined })}>Cualquier precio</button> : null}</fieldset>
        </aside>
        <div aria-busy={isPending} className={isPending ? "catalog-results is-pending" : "catalog-results"}>
          {result.products.length === 0 ? <div className="catalog-empty"><h2>No hay productos con estos filtros</h2><p>Probá quitar algún filtro o buscar otra categoría.</p><Link className="button button--dark" href="/productos">Ver todos los productos</Link></div> : <div className="catalog-product-grid">{result.products.map((product, index) => <ProductCard key={product.slug} product={product} priority={index < 3}/>)}</div>}
          {result.pageCount > 1 ? <nav className="pagination" aria-label="Páginas del catálogo">
            {result.page > 1 ? <Link href={catalogHref(query, { page: result.page - 1 })} aria-label="Página anterior">←</Link> : null}
            {Array.from({ length: result.pageCount }, (_, index) => index + 1).map((page) => <Link href={catalogHref(query, { page })} className={page === result.page ? "is-active" : ""} aria-current={page === result.page ? "page" : undefined} key={page}>{page}</Link>)}
            {result.page < result.pageCount ? <Link href={catalogHref(query, { page: result.page + 1 })} aria-label="Página siguiente">→</Link> : null}
          </nav> : null}
        </div>
      </div>
    </>
  );
}
