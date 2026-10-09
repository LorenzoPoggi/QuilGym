import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PredictiveSearch } from "@/components/predictive-search";
import { getSearchProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Buscar | QuilGym", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q = "" }, products] = await Promise.all([searchParams, getSearchProducts()]);
  return <><Header showSearch={false}/><main className="search-page"><div className="container"><div className="search-page-head"><p className="eyebrow">BÚSQUEDA PREDICTIVA</p><p className="search-help">ESC para borrar la búsqueda</p></div><h1>Encontrá lo que necesitás</h1><PredictiveSearch products={products} initialQuery={q.slice(0, 80)}/></div></main><Footer/></>;
}
