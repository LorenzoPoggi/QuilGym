import type { Metadata } from "next";
import { Header } from "@/components/header";
import { PredictiveSearch } from "@/components/predictive-search";
import { getAllProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Buscar | QuilGym", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q = "" }, products] = await Promise.all([searchParams, getAllProducts()]);
  return <><Header/><main className="search-page"><div className="container"><p className="eyebrow">BÚSQUEDA PREDICTIVA</p><h1>Encontrá lo que necesitás</h1><PredictiveSearch products={products} initialQuery={q.slice(0, 80)}/></div></main></>;
}
