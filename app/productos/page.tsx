import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog-view";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { TrustStrip } from "@/components/trust-strip";
import { storeProducts } from "@/lib/store-data";

export const metadata: Metadata = { title: "Creatinas | QuilGym", description: "Creatinas de marcas confiables, con stock y presentaciones claras." };

export default function ProductsPage() {
  return <><Header/><main className="inner-page"><div className="container"><p className="breadcrumb">Inicio / Productos / Creatinas</p><div className="page-title-row"><div><p className="eyebrow">CATÁLOGO</p><h1>Creatinas</h1><p>Potenciá tu rutina con opciones de marcas confiables, presentaciones claras y stock actualizado.</p></div><span>{storeProducts.length * 4} resultados</span></div><CatalogView products={storeProducts}/><TrustStrip/></div></main><Footer/></>;
}
