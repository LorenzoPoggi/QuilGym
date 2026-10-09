import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Info, Plus, Sparkles } from "lucide-react";
import { ComparePicker } from "@/components/compare-picker";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getCategories, getProduct, getProductsByCategory, getSearchProducts } from "@/lib/catalog";
import type { RawSearchParams } from "@/lib/catalog-params";
import { formatArs } from "@/lib/commerce";
import { compareHref, MAX_COMPARE, netWeight, parseCompareParam, PICKER_ANCHOR, pickerCandidates, pricePer100g, selectCompared, withRemoved } from "@/lib/compare";

type ComparePageProps = { searchParams: Promise<RawSearchParams> };
type CompareCell = { text: string; href?: string; label?: string; out?: boolean; actions?: { cambiar: string; quitar: string } };
/** `diff: false` excluye la fila del resaltado de diferencias (no describe al producto, sino qué material tenemos o qué se puede hacer). */
type CompareRow = { label: string; note?: string; cells: CompareCell[]; diff?: boolean };

const EXAMPLE_CATEGORY = "creatinas";
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

export async function generateMetadata({ searchParams }: ComparePageProps): Promise<Metadata> {
  const params = await searchParams;
  const base = { title: "Comparador de productos | QuilGym", description: "Compará hasta 3 suplementos lado a lado: precio, marca, presentación, disponibilidad y rótulo.", alternates: { canonical: "/comparar" } };
  // Cada combinación de productos es una URL distinta: se indexa solo el comparador base.
  return Object.keys(params).length ? { ...base, robots: { index: false, follow: true } } : base;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const requested = parseCompareParam(params.p);
  const [catalog, categories] = await Promise.all([getSearchProducts(), getCategories()]);
  const example = requested === null;
  const compared = example ? await getProductsByCategory(EXAMPLE_CATEGORY, MAX_COMPARE) : selectCompared(requested, catalog);
  const slugs = compared.map((product) => product.slug);
  const replacing = compared.find((product) => product.slug === first(params.cambiar));
  const rawCategory = first(params.categoria);
  // Sin elección explícita, el selector sugiere la categoría del producto a reemplazar o del primero elegido.
  const categoria = rawCategory === "todas" ? undefined : categories.some((item) => item.slug === rawCategory) ? rawCategory : (replacing ?? compared[0])?.category.slug;
  const q = first(params.q)?.slice(0, 80);
  const candidates = pickerCandidates(catalog, slugs, categoria, q);

  // El rótulo es una foto real (kind = "nutrition"); el resumen del catálogo no trae las imágenes, la ficha sí.
  const details = await Promise.all(compared.map((product) => getProduct(product.slug)));
  const weights = compared.map((product) => netWeight(product.name, product.category.slug));
  const rows: CompareRow[] = [
    { label: "Precio", note: "El precio puede cambiar según promociones vigentes.", cells: compared.map((product) => ({ text: formatArs(product.priceArs) })) },
    { label: "Precio cada 100 g", note: "Calculado con el peso que figura en el nombre. Verificá el rótulo.", cells: compared.map((product, index) => ({ text: weights[index] ? formatArs(pricePer100g(product.priceArs, weights[index].grams)) : "No aplica" })) },
    { label: "Presentación", cells: compared.map((product, index) => {
      const variant = details[index]?.variants.find((item) => item.id === product.variantId)?.label;
      return { text: variant ?? weights[index]?.label ?? "Ver ficha" };
    }) },
    { label: "Marca", cells: compared.map((product) => ({ text: product.brand?.name ?? "—" })) },
    { label: "Categoría", cells: compared.map((product) => ({ text: product.category.name })) },
    { label: "Disponibilidad", cells: compared.map((product) => ({ text: product.inStock ? "En stock" : "Sin stock", out: !product.inStock })) },
    { label: "Rótulo nutricional", diff: false, cells: compared.map((product, index) => details[index]?.images.some((image) => image.kind === "nutrition")
      ? { text: "Ver rótulo nutricional", href: `/productos/${product.slug}#galeria-producto`, label: `Ver rótulo nutricional de ${product.name}` }
      : { text: "Sin foto del rótulo" }) },
    { label: "Selección", diff: false, cells: compared.map((product) => ({ text: product.name, actions: {
      cambiar: compareHref({ slugs, cambiar: product.slug, categoria: product.category.slug, hash: PICKER_ANCHOR }),
      quitar: compareHref({ slugs: withRemoved(slugs, product.slug) }),
    } })) },
  ];

  return <><Header/><main className="compare-page"><div className="container">
    <p className="breadcrumb"><Link href="/">Inicio</Link> / Comparador</p>
    <div className="page-title-row"><div><p className="eyebrow">COMPARÁ CON CLARIDAD</p><h1>Comparador de productos</h1><p>Elegí hasta 3 productos y revisá sus diferencias. Ninguna opción es universalmente mejor: elegí según tu uso, presupuesto y preferencias.</p></div><span>{compared.length} de {MAX_COMPARE} productos</span></div>
    {example ? <p className="compare-example"><Info aria-hidden="true"/><span><strong>Ejemplo:</strong> tres creatinas del catálogo. Cambialas, quitalas o agregá otras para armar tu comparación.</span></p> : null}
    {compared.length ? <>
      <div className="compare-note"><span><Sparkles aria-hidden="true"/><span><strong>Diferencias destacadas:</strong> los fondos suaves marcan los valores que cambian entre productos; no indican ganador.</span></span>
        <Link className="button button--outline" href={`#${PICKER_ANCHOR}`}>{compared.length < MAX_COMPARE ? <><Plus aria-hidden="true"/> Agregar producto</> : <><ArrowLeftRight aria-hidden="true"/> Cambiar productos</>}</Link></div>
      <div className="compare-scroll" style={{ "--compare-count": Math.max(compared.length, 1) } as CSSProperties}>
        <section className="compare-products" aria-label="Productos comparados"><aside><h2>Atributos</h2><p>Comparación lado a lado con la información disponible de cada producto.</p></aside>{compared.map((product) => <ProductCard product={product} priority key={product.slug}/>)}</section>
        <div className="compare-table" role="table" aria-label="Comparación de atributos">{rows.filter((row) => row.cells.some((cell) => cell.text !== "No aplica" && cell.text !== "Ver ficha")).map((row) => {
          const differs = row.diff !== false && compared.length > 1 && new Set(row.cells.map((cell) => cell.text)).size > 1;
          return <div className={`compare-row ${differs ? "compare-row--diff" : ""}`} role="row" key={row.label}>
            <div role="rowheader"><strong>{row.label}</strong>{row.note ? <small>{row.note}</small> : null}</div>
            {/* data-label: en mobile cada producto se apila con filas «etiqueta: valor». */}
            {row.cells.map((cell, index) => <div role="cell" data-label={row.label} className={cell.out ? "is-out" : undefined} key={`${row.label}-${index}`}>{cell.actions
              ? <span className="compare-actions"><Link className="compare-link" href={cell.actions.cambiar} aria-label={`Cambiar ${cell.text}`}>Cambiar</Link><Link className="compare-link" href={cell.actions.quitar} aria-label={`Quitar ${cell.text} de la comparación`}>Quitar</Link></span>
              : cell.href ? <Link className="compare-link" href={cell.href} aria-label={cell.label}>{cell.text}</Link> : <strong>{cell.text}</strong>}</div>)}
          </div>;
        })}</div>
      </div>
    </> : <div className="compare-empty"><h2>Todavía no elegiste productos</h2><p>Sumá hasta 3 productos desde el selector para verlos lado a lado.</p></div>}
    <ComparePicker slugs={slugs} categories={categories} categoria={categoria} q={q} showAll={first(params.ver) === "todos"} replacing={replacing} candidates={candidates}/>
    <p className="compare-disclaimer"><Info aria-hidden="true"/><span>La información nutricional puede variar por lote. Consultá siempre el rótulo del producto. Este comparador brinda orientación informativa y no reemplaza asesoramiento profesional.</span></p>
  </div></main><Footer/></>;
}
