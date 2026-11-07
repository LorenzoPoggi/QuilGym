import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { getProductsByCategory } from "@/lib/catalog";
import { getObjective, objectiveSlugs } from "@/lib/objectives";

type ObjectivePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return objectiveSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ObjectivePageProps): Promise<Metadata> {
  const objective = getObjective((await params).slug);
  if (!objective) return { title: "Objetivo no encontrado | QuilGym" };
  return {
    title: `${objective.title}: suplementos para tu objetivo | QuilGym`,
    description: `Suplementos para ${objective.title.toLowerCase()}: toda la selección disponible en QuilGym.`,
    alternates: { canonical: `/objetivos/${objective.slug}` },
  };
}

export default async function ObjectivePage({ params }: ObjectivePageProps) {
  const objective = getObjective((await params).slug);
  if (!objective) notFound();
  const groups = await Promise.all(objective.groups.map(async (group) => ({ ...group, products: await getProductsByCategory(group.category, 60) })));

  return <><Header/><main className="objective-page"><div className="container">
    <p className="breadcrumb"><Link href="/">Inicio</Link> / <Link href="/#objetivos">Objetivos</Link> / {objective.title}</p>
    <header className="objective-hero">
      <p className="eyebrow">TU OBJETIVO</p>
      <h1>{objective.title}</h1>
      <p>{objective.teaser}. Elegí entre todo lo que tenemos disponible.</p>
    </header>

    {groups.map((group) => group.products.length > 0 ? <section className="objective-group" key={group.category}>
      <div className="section-heading"><div><h2>{group.title.replace(/^\d+\.\s*/, "")}</h2></div><Link href={`/productos?categoria=${group.category}`}>Ver todas<ArrowRight aria-hidden="true"/></Link></div>
      <div className="product-grid">{group.products.map((product) => <ProductCard product={product} key={product.slug}/>)}</div>
    </section> : null)}
  </div></main><Footer/></>;
}
