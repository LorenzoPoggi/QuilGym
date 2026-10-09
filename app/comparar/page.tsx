import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Info, Sparkles } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getProduct, getProductsByCategory } from "@/lib/catalog";
import { formatArs } from "@/lib/commerce";

export const metadata: Metadata = { title: "Comparador de productos | QuilGym" };

type CompareCell = { text: string; href?: string; out?: boolean };
/** `diff: false` excluye la fila del resaltado de diferencias (no describe al producto, sino qué material tenemos). */
type CompareRow = { label: string; note?: string; cells: CompareCell[]; diff?: boolean };

export default async function ComparePage() {
  // Selección fija hasta implementar la elección de productos (Fase 4).
  const compared = await getProductsByCategory("creatinas", 3);
  // El rótulo es una foto real (kind = "nutrition"); el resumen del catálogo no trae las imágenes, la ficha sí.
  const details = await Promise.all(compared.map((product) => getProduct(product.slug)));
  const rows: CompareRow[] = [
    { label: "Precio", note: "El precio puede cambiar según promociones vigentes.", cells: compared.map((product) => ({ text: formatArs(product.priceArs) })) },
    { label: "Marca", cells: compared.map((product) => ({ text: product.brand?.name ?? "—" })) },
    { label: "Categoría", cells: compared.map((product) => ({ text: product.category.name })) },
    { label: "Stock", cells: compared.map((product) => ({ text: product.inStock ? "En stock" : "Sin stock", out: !product.inStock })) },
    { label: "Rótulo nutricional", diff: false, cells: compared.map((product, index) => details[index]?.images.some((image) => image.kind === "nutrition")
      ? { text: "Ver rótulo nutricional", href: `/productos/${product.slug}#galeria-producto` }
      : { text: "Sin foto del rótulo" }) },
  ];

  return <><Header/><main className="compare-page"><div className="container">
    <p className="breadcrumb"><Link href="/">Inicio</Link> / Comparador</p>
    <div className="page-title-row"><div><p className="eyebrow">COMPARÁ CON CLARIDAD</p><h1>Comparador de productos</h1><p>Revisá diferencias relevantes para tu rutina. Ninguna opción es universalmente mejor: elegí según tu uso, presupuesto y preferencias.</p></div><span>{compared.length} de 3 productos</span></div>
    <div className="compare-note"><span><Sparkles aria-hidden="true"/><span><strong>Diferencias destacadas:</strong> los fondos suaves marcan los valores que cambian entre productos; no indican ganador.</span></span><Link className="button button--outline" href="/productos"><ArrowLeftRight aria-hidden="true"/> Cambiar productos</Link></div>
    <div className="compare-scroll" style={{ "--compare-count": Math.max(compared.length, 1) } as CSSProperties}>
      <section className="compare-products" aria-label="Productos comparados"><aside><h2>Atributos</h2><p>Comparación lado a lado con la información disponible de cada producto.</p><span>HASTA 3</span></aside>{compared.map((product) => <ProductCard product={product} priority key={product.slug}/>)}</section>
      <div className="compare-table" role="table" aria-label="Comparación de atributos">{rows.map((row) => {
        const differs = row.diff !== false && new Set(row.cells.map((cell) => cell.text)).size > 1;
        return <div className={`compare-row ${differs ? "compare-row--diff" : ""}`} role="row" key={row.label}>
          <div role="rowheader"><strong>{row.label}</strong>{row.note ? <small>{row.note}</small> : null}</div>
          {/* data-label: en mobile cada producto se apila con filas «etiqueta: valor». */}
          {row.cells.map((cell, index) => <div role="cell" data-label={row.label} className={cell.out ? "is-out" : undefined} key={`${row.label}-${index}`}>{cell.href ? <Link className="compare-link" href={cell.href} aria-label={`${cell.text} de ${compared[index].name}`}>{cell.text}</Link> : <strong>{cell.text}</strong>}</div>)}
        </div>;
      })}</div>
    </div>
    <p className="compare-disclaimer"><Info aria-hidden="true"/><span>La información nutricional puede variar por lote. Consultá siempre el rótulo del producto. Este comparador brinda orientación informativa y no reemplaza asesoramiento profesional.</span></p>
  </div></main><Footer/></>;
}
