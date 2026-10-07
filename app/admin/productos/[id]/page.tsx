import { notFound } from "next/navigation";
import { getAdminProduct, getAdminTaxonomy } from "@/lib/admin-catalog";
import { AdminProductForm } from "@/components/admin-product-form";
export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId < 1) notFound();
  const [entry, taxonomy] = await Promise.all([getAdminProduct(productId), getAdminTaxonomy()]);
  if (!entry) notFound();
  return <AdminProductForm entry={entry} taxonomy={taxonomy}/>;
}
