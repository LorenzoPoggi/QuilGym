import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { CheckIcon, SparkIcon } from "@/components/icons";
import { storeProducts } from "@/lib/store-data";

export const metadata: Metadata = { title: "Tus recomendaciones | QuilGym" };
const picks = [storeProducts[2], storeProducts[0], storeProducts[1]];

export default function RecommendationsPage() {
  return <><Header/><main className="recommendations-page"><div className="container"><section className="recommendation-hero"><span><SparkIcon/></span><div><p className="eyebrow">TU SELECCIÓN ORIENTATIVA</p><h1>Tres opciones que encajan con tus respuestas</h1><p>Objetivo: rendimiento · experiencia intermedia · fuerza 4 veces por semana · sin restricciones · hasta $45.000.</p></div><div><Link className="button button--light" href="/asesor">☷ Cambiar respuestas</Link><Link className="button button--light" href="/asesor">↻ Reiniciar asesor</Link></div></section><p className="recommendation-note">ⓘ Estas sugerencias organizan opciones según tus respuestas; no reemplazan evaluación profesional ni implican resultados garantizados.</p><div className="recommendation-grid">{picks.map((product,index) => <div className="recommendation-item" key={product.slug}><span className="recommendation-label">{["RECOMENDACIÓN PRINCIPAL","ALTERNATIVA ECONÓMICA","ALTERNATIVA PREMIUM"][index]}</span><ProductCard product={product} priority/><p><CheckIcon/>{["Alineada con fuerza 4 veces por semana, sabor neutro y presupuesto de hasta $45.000.","Menor precio por presentación, misma porción declarada y disponibilidad inmediata.","Opción de marca importada con presentación compacta para priorizar formato y portabilidad."][index]}</p></div>)}</div><section className="selection-adjust"><div><h2>¿Querés ajustar la selección?</h2><p>Podés cambiar presupuesto, preferencias alimentarias o tipo de entrenamiento sin empezar de cero.</p></div><div><Link className="button button--outline" href="/asesor">Editar respuestas</Link><button type="button" className="button button--outline">Guardar selección</button></div></section></div></main></>;
}
