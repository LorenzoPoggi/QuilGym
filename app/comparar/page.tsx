import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getProductsByCategory } from "@/lib/catalog";
import { formatArs } from "@/lib/commerce";

export const metadata: Metadata = { title: "Comparador de productos | QuilGym" };

export default async function ComparePage() {
  // Selección fija hasta implementar la elección de productos (Fase 4).
  const compared = await getProductsByCategory("creatinas", 3);
  const rows: [string, ...string[]][] = [
    ["Precio", ...compared.map((product) => formatArs(product.priceArs))],
    ["Marca", ...compared.map((product) => product.brand?.name ?? "—")],
    ["Categoría", ...compared.map((product) => product.category.name)],
    ["Stock", ...compared.map((product) => product.inStock ? "En stock" : "Sin stock")],
  ];

  return <><Header/><main className="compare-page"><div className="container"><p className="breadcrumb">Inicio / Comparador</p><div className="page-title-row"><div><p className="eyebrow">COMPARÁ CON CLARIDAD</p><h1>Comparador de productos</h1><p>Revisá diferencias relevantes para tu rutina. Ninguna opción es universalmente mejor: elegí según tu uso, presupuesto y preferencias.</p></div><span>{compared.length} de 3 productos</span></div><div className="compare-note"><span>✣ <strong>Diferencias destacadas:</strong> los fondos suaves ayudan a escanear valores distintos; no indican ganador.</span><Link className="button button--outline" href="/productos">Cambiar productos</Link></div><section className="compare-products"><aside><h2>Atributos</h2><p>Comparación lado a lado con la información disponible de cada producto.</p><span>HASTA 3</span></aside>{compared.map((product) => <ProductCard product={product} priority key={product.slug}/>)}</section><div className="compare-table" role="table">{rows.map((row) => <div className="compare-row" role="row" key={row[0]}>{row.map((cell,index) => <div role={index === 0 ? "rowheader" : "cell"} key={`${row[0]}-${index}`}><strong>{cell}</strong>{index === 0 && row[0] === "Precio" ? <small>El precio puede cambiar según promociones vigentes.</small> : null}</div>)}</div>)}</div><p className="compare-disclaimer">ⓘ La información nutricional puede variar por lote. Consultá siempre el rótulo del producto. Este comparador brinda orientación informativa y no reemplaza asesoramiento profesional.</p></div></main><Footer/></>;
}
