import { getAdminTaxonomy, variantShippingAvailable } from "@/lib/admin-catalog";
import { AdminProductForm } from "@/components/admin-product-form";
export default async function NewAdminProductPage() {
  const [taxonomy, shippingAvailable] = await Promise.all([getAdminTaxonomy(), variantShippingAvailable()]);
  return <AdminProductForm taxonomy={taxonomy} shippingAvailable={shippingAvailable}/>;
}
