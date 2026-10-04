import type { Metadata } from "next";
import Link from "next/link";
import { CatalogView } from "@/components/catalog-view";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { TrustStrip } from "@/components/trust-strip";
import { queryCatalog } from "@/lib/catalog";
import { parseCatalogParams, type RawSearchParams } from "@/lib/catalog-params";

type ProductsPageProps = { searchParams: Promise<RawSearchParams> };

async function load(searchParams: ProductsPageProps["searchParams"]) {
  const query = parseCatalogParams(await searchParams);
  const result = await queryCatalog(query);
  const category = result.categories.find((item) => item.slug === query.category);
  return { query, result, category };
}

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const { category } = await load(searchParams);
  return category
    ? { title: `${category.name} | QuilGym`, description: `${category.name} de marcas originales con envío o retiro en Quilmes.`, alternates: { canonical: `/productos?categoria=${category.slug}` } }
    : { title: "Productos | QuilGym", description: "Suplementos deportivos originales: proteínas, creatinas, pre-entrenos y más.", alternates: { canonical: "/productos" } };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { query, result, category } = await load(searchParams);
  const title = query.q ? `Resultados para “${query.q}”` : category?.name ?? "Todos los productos";

  return <><Header/><main className="inner-page catalog-page"><div className="container"><p className="breadcrumb"><Link href="/">Inicio</Link> / <Link href="/productos">Productos</Link>{category ? <> / {category.name}</> : null}</p><div className="page-title-row"><div><p className="eyebrow">CATÁLOGO</p><h1>{title}</h1><p>Suplementos originales de marcas reconocidas, con precios actualizados y stock visible.</p></div><span>{result.total} {result.total === 1 ? "resultado" : "resultados"}</span></div><CatalogView result={result} query={query}/><TrustStrip/></div></main><Footer/></>;
}
