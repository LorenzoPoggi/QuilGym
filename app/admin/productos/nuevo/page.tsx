import { getAdminTaxonomy } from "@/lib/admin-catalog";
import { AdminProductForm } from "@/components/admin-product-form";
export default async function NewAdminProductPage() {
  const taxonomy = await getAdminTaxonomy();
  return <AdminProductForm taxonomy={taxonomy}/>;
}
