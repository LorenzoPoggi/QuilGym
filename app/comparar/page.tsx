import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { storeProducts } from "@/lib/store-data";

export const metadata: Metadata = { title: "Comparador de productos | QuilGym" };

const compared = [storeProducts[0], storeProducts[2], storeProducts[3]];
const rows = [
  ["Precio", "$31.680", "$36.400", "$42.900"], ["Marca", "Star Nutrition", "ENA Sport", "Universal"], ["Presentación", "Pote · 300 g", "Pote · 300 g", "Pote · 200 g"],
  ["Porciones", "60 porciones", "60 porciones", "40 porciones"], ["Por porción", "5 g", "5 g", "5 g"], ["Carbohidratos", "0 g", "0 g", "0 g"], ["Sodio", "0 mg", "12 mg", "0 mg"],
  ["Sabores", "Sin sabor", "Neutro", "Sin sabor"], ["Objetivo", "Rendimiento y fuerza", "Rendimiento y recuperación", "Rendimiento y fuerza"], ["Rating", "4,8 · 126 reseñas", "4,9 · 204 reseñas", "4,8 · 91 reseñas"], ["Stock", "En stock", "En stock", "Sin stock"], ["Pago", "3 cuotas de $10.560", "3 cuotas de $12.133", "3 cuotas de $14.300"],
];

export default function ComparePage() {
  return <><Header/><main className="compare-page"><div className="container"><p className="breadcrumb">Inicio / Comparador</p><div className="page-title-row"><div><p className="eyebrow">COMPARÁ CON CLARIDAD</p><h1>Comparador de productos</h1><p>Revisá diferencias relevantes para tu rutina. Ninguna opción es universalmente mejor: elegí según tu uso, presupuesto y preferencias.</p></div><span>3 de 3 productos</span></div><div className="compare-note"><span>✣ <strong>Diferencias destacadas:</strong> los fondos suaves ayudan a escanear valores distintos; no indican ganador.</span><Link className="button button--outline" href="/productos">Cambiar productos</Link></div><section className="compare-products"><aside><h2>Atributos</h2><p>Comparación lado a lado con información declarada por cada marca.</p><span>HASTA 3</span></aside>{compared.map((product) => <ProductCard product={product} priority key={product.slug}/>)}</section><div className="compare-table" role="table">{rows.map((row) => <div className="compare-row" role="row" key={row[0]}>{row.map((cell,index) => <div role={index === 0 ? "rowheader" : "cell"} key={`${cell}-${index}`}><strong>{cell}</strong>{index === 0 && row[0] === "Precio" ? <small>El precio puede cambiar según promociones vigentes.</small> : null}</div>)}</div>)}</div><p className="compare-disclaimer">ⓘ La información nutricional puede variar por lote. Consultá siempre el rótulo del producto. Este comparador brinda orientación informativa y no reemplaza asesoramiento profesional.</p></div></main><Footer/></>;
}
