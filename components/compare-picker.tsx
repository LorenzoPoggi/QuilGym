import Link from "next/link";
import { Plus, RefreshCw, X } from "lucide-react";
import type { Facet, ProductSummary } from "@/lib/catalog-types";
import { formatArs } from "@/lib/commerce";
import { compareHref, MAX_COMPARE, PICKER_ANCHOR, withAdded, withReplaced } from "@/lib/compare";
import { ComparePickerSearch } from "./compare-picker-search";
import { ProductImage } from "./product-image";

const PICKER_LIMIT = 12;

type PickerProps = { slugs: string[]; categories: Facet[]; categoria?: string; q?: string; showAll?: boolean; replacing?: ProductSummary; candidates: ProductSummary[] };

/** Selector del comparador: todo son enlaces y un formulario GET, así funciona sin JS; la búsqueda se mejora en el cliente. */
export function ComparePicker({ slugs, categories, categoria, q, showAll = false, replacing, candidates }: PickerProps) {
  const full = slugs.length >= MAX_COMPARE && !replacing;
  const shown = showAll ? candidates : candidates.slice(0, PICKER_LIMIT);
  const cambiar = replacing?.slug;
  const sameCategory = replacing ? replacing.category.name : categories.find((item) => item.slug === categoria)?.name;

  return <section className="compare-picker" id={PICKER_ANCHOR} aria-labelledby="compare-picker-title">
    <header className="compare-picker__head">
      <div><p className="eyebrow">{replacing ? "REEMPLAZAR" : "ARMÁ TU COMPARACIÓN"}</p>
        <h2 id="compare-picker-title">{replacing ? `Elegí qué comparar en lugar de ${replacing.name}` : full ? "Ya elegiste 3 productos" : "Agregá productos"}</h2>
        <p>{full ? "Tocá «Cambiar» en un producto para reemplazarlo o quitá uno para sumar otro." : `${replacing ? "Ocupa el mismo lugar en la comparación." : `Te ${MAX_COMPARE - slugs.length === 1 ? "queda 1 lugar" : `quedan ${MAX_COMPARE - slugs.length} lugares`}.`} Conviene comparar productos de la misma categoría${sameCategory ? ` (${sameCategory})` : ""}.`}</p></div>
      {replacing ? <Link className="button button--outline compare-picker__cancel" href={compareHref({ slugs })} scroll={false}><X aria-hidden="true"/> Cancelar</Link> : null}
    </header>
    {full ? null : <>
      <nav className="compare-picker__categories" aria-label="Categorías para comparar">
        <Link href={compareHref({ slugs, cambiar, categoria: "todas", q, hash: PICKER_ANCHOR })} scroll={false} aria-current={!categoria ? "true" : undefined}>Todas</Link>
        {categories.map((item) => <Link key={item.slug} href={compareHref({ slugs, cambiar, categoria: item.slug, q, hash: PICKER_ANCHOR })} scroll={false} aria-current={categoria === item.slug ? "true" : undefined}>{item.name} <span>{item.count}</span></Link>)}
      </nav>
      <ComparePickerSearch slugs={slugs} categoria={categoria ?? "todas"} cambiar={cambiar} q={q}/>
      <p className="compare-picker__count" aria-live="polite">{candidates.length > shown.length ? <>Mostrando {shown.length} de {candidates.length}. Buscá por nombre o marca para afinar o <Link href={compareHref({ slugs, cambiar, categoria: categoria ?? "todas", q, todos: true, hash: PICKER_ANCHOR })} scroll={false}>mirá todos</Link>.</> : candidates.length === 0 ? "No encontramos productos con esos filtros. Probá con otra categoría o búsqueda." : `${candidates.length} ${candidates.length === 1 ? "producto" : "productos"} para elegir.`}</p>
      {shown.length ? <ul className="compare-picker__results">{shown.map((product) => {
        const next = replacing ? withReplaced(slugs, replacing.slug, product.slug) : withAdded(slugs, product.slug);
        return <li key={product.slug}>
          <ProductImage product={product} className="compare-picker__thumb" sizes="72px" decorative/>
          <div><p className="eyebrow">{product.brand?.name ?? product.category.name}</p><strong>{product.name}</strong>
            <span>{formatArs(product.priceArs)} · <em className={product.inStock ? undefined : "is-out"}>{product.inStock ? "En stock" : "Sin stock"}</em></span></div>
          <Link className="button button--outline compare-picker__add" href={compareHref({ slugs: next })} aria-label={`${replacing ? `Reemplazar ${replacing.name} por` : "Agregar"} ${product.name} ${replacing ? "" : "a la comparación"}`.trim()}>
            {replacing ? <RefreshCw aria-hidden="true"/> : <Plus aria-hidden="true"/>}<span>{replacing ? "Elegir" : "Agregar"}</span></Link>
        </li>;
      })}</ul> : null}
    </>}
  </section>;
}
