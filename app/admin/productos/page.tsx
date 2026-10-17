import { getAdminCatalog, getAdminTaxonomy, type AdminCatalogParams } from "@/lib/admin-catalog";
import { AdminProductsView } from "./products-view";

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const input: AdminCatalogParams = { q: one(raw.q), estado: one(raw.estado), marca: one(raw.marca), categoria: one(raw.categoria), orden: one(raw.orden), pagina: one(raw.pagina) };
  const [all, taxonomy] = await Promise.all([getAdminCatalog(), getAdminTaxonomy()]);
  return <AdminProductsView all={all} taxonomy={taxonomy} input={input}/>;
}
