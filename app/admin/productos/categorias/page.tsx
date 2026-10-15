import { getAdminTaxonomyWithCounts } from "@/lib/admin-catalog";
import { AdminCatalogNav } from "@/components/admin-catalog-nav";
import { AdminTaxonomyManager } from "@/components/admin-catalog-taxonomy";

export default async function AdminCategoriesPage() {
  const { categories } = await getAdminTaxonomyWithCounts();
  return <div className="admin-content">
    <header className="admin-page-head"><div><p className="admin-eyebrow">GESTIÓN DEL CATÁLOGO</p><h1>Categorías</h1><p>El orden define cómo aparecen en las pestañas del catálogo (menor primero).</p></div></header>
    <AdminCatalogNav current="/admin/productos/categorias"/>
    <AdminTaxonomyManager kind="category" rows={categories}/>
  </div>;
}
