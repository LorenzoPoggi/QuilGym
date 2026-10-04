import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Info, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getProductsByCategory } from "@/lib/catalog";
import type { ProductSummary } from "@/lib/catalog-types";
import { formatArs } from "@/lib/commerce";

export const metadata: Metadata = { title: "Tus recomendaciones | QuilGym" };

/** Etiqueta derivada solo del precio dentro de la selección (sin afirmar calidad ni resultados). */
function priceLabel(product: ProductSummary, index: number, picks: ProductSummary[]) {
  if (product.priceArs === picks[0].priceArs) return "Menor precio";
  return index === picks.length - 1 ? "Mayor precio" : "Precio intermedio";
}

function reason(product: ProductSummary, cheapest: ProductSummary) {
  const diff = product.priceArs - cheapest.priceArs;
  const brand = product.brand ? `De ${product.brand.name}, a ${formatArs(product.priceArs)}` : `A ${formatArs(product.priceArs)}`;
  return `${brand}${diff > 0 ? `: ${formatArs(diff)} más que la opción de menor precio` : ""}. ${product.inStock ? "En stock." : "Sin stock por el momento."}`;
}

export default async function RecommendationsPage() {
  // Selección fija hasta implementar el motor de reglas del asesor (Fase 4): se ordena por precio.
  const picks = (await getProductsByCategory("creatinas", 3)).toSorted((a, b) => a.priceArs - b.priceArs);
  return <><Header/><main className="recommendations-page"><div className="container">
    <section className="recommendation-hero"><span><Sparkles aria-hidden="true"/></span><div><p className="eyebrow">SELECCIÓN DE EJEMPLO</p><h1>{picks.length === 3 ? "Tres creatinas" : "Creatinas"} para empezar a comparar</h1><p>Selección de ejemplo mientras el asesor se completa: todavía no usa tus respuestas. Ordenada de menor a mayor precio.</p></div><div><Link className="button button--light" href="/asesor"><SlidersHorizontal aria-hidden="true"/> Cambiar respuestas</Link><Link className="button button--light" href="/asesor"><RefreshCw aria-hidden="true"/> Reiniciar asesor</Link></div></section>
    <p className="recommendation-note"><Info aria-hidden="true"/><span>Esta selección es orientativa: no reemplaza una evaluación profesional ni implica resultados garantizados.</span></p>
    <div className="recommendation-grid">{picks.map((product, index) => <div className="recommendation-item" key={product.slug}><span className="recommendation-label">{priceLabel(product, index, picks)}</span><ProductCard product={product} priority/><p><CircleCheck aria-hidden="true"/><span>{reason(product, picks[0])}</span></p></div>)}</div>
    <section className="selection-adjust"><div><h2>¿Querés ver más opciones?</h2><p>Compará estas creatinas lado a lado o recorré toda la categoría.</p></div><div><Link className="button button--outline" href="/comparar">Comparar productos</Link><Link className="button button--outline" href="/productos?categoria=creatinas">Ver todas las creatinas</Link></div></section>
  </div></main></>;
}
