import { notFound } from "next/navigation";
import { getAdminProduct, getAdminTaxonomy } from "@/lib/admin-catalog";
import { AdminProductForm, type AdminNotice } from "@/components/admin-product-form";

const notices = new Set(["creado", "guardado", "archivado"]);
export default async function EditAdminProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const [{ id }, { aviso }] = await Promise.all([params, searchParams]);
  const productId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(productId) || productId < 1) notFound();
  const [entry, taxonomy] = await Promise.all([getAdminProduct(productId), getAdminTaxonomy()]);
  if (!entry) notFound();
  const notice = (aviso && notices.has(aviso) ? aviso : null) as AdminNotice;
  return <AdminProductForm key={`${entry.product.updatedAt.getTime()}-${notice}`} entry={entry} taxonomy={taxonomy} notice={notice}/>;
}
