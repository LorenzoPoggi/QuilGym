import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminUser } from "@/lib/admin-auth";
import { getCostRows } from "@/lib/admin-metrics";
import { AdminCostsEditor } from "@/components/admin-costs";
import "../../../styles/admin-metrics.css";

export const metadata = { title: "Costos de productos | Administración QuilGym" };

export default async function AdminCostsPage() {
  await requireAdminUser();
  const { rows, ready } = await getCostRows();
  return <div className="admin-content metrics-page">
    <Link className="admin-back" href="/admin/metricas"><ArrowLeft size={17} aria-hidden="true"/> Volver a métricas</Link>
    <header className="admin-page-head"><div><p className="admin-eyebrow">NEGOCIO</p><h1>Costos de productos</h1><p>Con el costo de cada producto, las métricas calculan tu ganancia y margen reales.</p></div></header>
    <AdminCostsEditor rows={rows} ready={ready}/>
  </div>;
}
