import { redirect } from "next/navigation";

export const metadata = { title: "Asesor QuilGym", robots: { index: false, follow: false } };
/** Compatibilidad con enlaces del cuestionario anterior; ahora las sugerencias viven en la charla. */
export default function RecommendationsPage() { redirect("/asesor"); }
