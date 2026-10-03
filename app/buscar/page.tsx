import type { Metadata } from "next";
import { Header } from "@/components/header";
import { PredictiveSearch } from "@/components/predictive-search";
import { storeProducts } from "@/lib/store-data";

export const metadata: Metadata = { title: "Buscar | QuilGym" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  return <><Header/><main className="search-page"><div className="container"><p className="eyebrow">BÚSQUEDA PREDICTIVA</p><h1>Encontrá lo que necesitás</h1><PredictiveSearch products={storeProducts} initialQuery={q}/></div></main></>;
}
