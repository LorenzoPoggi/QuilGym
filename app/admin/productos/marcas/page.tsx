import { getAdminTaxonomyWithCounts } from "@/lib/admin-catalog";
import { AdminCatalogNav } from "@/components/admin-catalog-nav";
import { AdminTaxonomyManager } from "@/components/admin-catalog-taxonomy";

export default async function AdminBrandsPage() {
  const { brands } = await getAdminTaxonomyWithCounts();
  return <div className="admin-content">
    <header className="admin-page-head"><div><p className="admin-eyebrow">GESTIÓN DEL CATÁLOGO</p><h1>Marcas</h1><p>Creá y renombrá marcas. Las que tienen productos no se pueden borrar.</p></div></header>
    <AdminCatalogNav current="/admin/productos/marcas"/>
    <AdminTaxonomyManager kind="brand" rows={brands}/>
  </div>;
}
