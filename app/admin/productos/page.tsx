import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { ADMIN_PAGE_SIZE, adminSorts, getAdminCatalog, getAdminTaxonomy, queryAdminCatalog, type AdminCatalogParams } from "@/lib/admin-catalog";
import { AdminCatalogNav } from "@/components/admin-catalog-nav";

const statusLabels = { active: "Publicado", draft: "Borrador", archived: "Archivado" } as const;
const tabLabels = { todos: "Todos", active: "Publicados", draft: "Borradores", archived: "Archivados" } as const;
const stockLabel = (stock: number | null) => stock === null ? "Sin control" : stock === 0 ? "Agotado" : `${stock} u.`;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
type Param = "q" | "estado" | "marca" | "categoria" | "orden" | "pagina";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const input: AdminCatalogParams = { q: one(raw.q), estado: one(raw.estado), marca: one(raw.marca), categoria: one(raw.categoria), orden: one(raw.orden), pagina: one(raw.pagina) };
  const [all, taxonomy] = await Promise.all([getAdminCatalog(), getAdminTaxonomy()]);
  const result = queryAdminCatalog(all, input);
  const { params } = result;
  const href = (patch: Partial<Record<Param, string>>) => {
    const next = new URLSearchParams();
    const merged: Record<Param, string> = { q: params.q, estado: params.estado, marca: params.marca, categoria: params.categoria, orden: params.orden, pagina: "", ...patch };
    for (const [key, value] of Object.entries(merged)) if (value && !(key === "estado" && value === "todos") && !(key === "orden" && value === "actualizado") && !(key === "pagina" && value === "1")) next.set(key, value);
    const query = next.toString();
    return query ? `/admin/productos?${query}` : "/admin/productos";
  };
  const active = all.filter((p) => p.status === "active");
  const lowStock = active.filter((p) => p.stock !== null && p.stock > 0 && p.stock <= 5).length;
  const soldOut = active.filter((p) => p.stock === 0).length;
  const filtered = Boolean(params.q || params.marca || params.categoria || params.estado !== "todos");
  const first = (result.page - 1) * ADMIN_PAGE_SIZE + 1;
  return <div className="admin-content">
    <header className="admin-page-head"><div><p className="admin-eyebrow">GESTIÓN DEL CATÁLOGO</p><h1>Productos</h1><p>Actualizá precios, stock, fotos y publicaciones desde un solo lugar.</p></div><Link className="admin-primary" href="/admin/productos/nuevo"><Plus size={18}/> Agregar producto</Link></header>
    <AdminCatalogNav current="/admin/productos"/>
    <div className="admin-stats admin-stats--four"><div><span>Productos</span><strong>{all.length}</strong></div><div><span>Publicados</span><strong>{active.length}</strong></div><Link href={href({ q: "", marca: "", categoria: "", estado: "active", orden: "stock-asc" })} title="Ver publicados ordenados por stock"><span>Stock bajo (1 a 5)</span><strong>{lowStock}</strong></Link><div><span>Publicados agotados</span><strong>{soldOut}</strong></div></div>
    <nav className="admin-status-tabs" aria-label="Filtrar por estado">{(["todos", "active", "draft", "archived"] as const).map((status) => <Link key={status} href={href({ estado: status })} aria-current={params.estado === status ? "page" : undefined}>{tabLabels[status]}<span>{result.counts[status]}</span></Link>)}</nav>
    <form className="admin-filters" action="/admin/productos">
      {params.estado !== "todos" && <input type="hidden" name="estado" value={params.estado}/>}
      <label className="admin-filter-search"><Search size={18} aria-hidden="true"/><input name="q" defaultValue={params.q} placeholder="Buscar por nombre, marca, categoría o SKU" aria-label="Buscar productos" type="search"/></label>
      <select name="marca" defaultValue={params.marca} aria-label="Filtrar por marca"><option value="">Todas las marcas</option><option value="sin-marca">Sin marca</option>{taxonomy.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
      <select name="categoria" defaultValue={params.categoria} aria-label="Filtrar por categoría"><option value="">Todas las categorías</option>{taxonomy.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <select name="orden" defaultValue={params.orden} aria-label="Ordenar">{Object.entries(adminSorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button type="submit">Aplicar</button>{filtered && <Link className="admin-filter-clear" href="/admin/productos">Limpiar</Link>}
    </form>
    <p className="admin-results" aria-live="polite">{result.total ? `Mostrando ${first}–${first + result.items.length - 1} de ${result.total} ${result.total === 1 ? "producto" : "productos"}` : "Sin resultados"}</p>
    <div className="admin-table-wrap"><table className="admin-table admin-table--products"><thead><tr><th scope="col">Producto</th><th scope="col">Estado</th><th scope="col">Precio</th><th scope="col">Stock</th><th scope="col">Actualizado</th><th scope="col"><span className="admin-sr">Acción</span></th></tr></thead><tbody>{result.items.map((p) => <tr key={p.id}>
      <td><div className="admin-product-cell">{p.imageUrl ? <Image src={p.imageUrl} alt="" width={52} height={52}/> : <span className="admin-image-empty"/>}<span><Link className="admin-row-link" href={`/admin/productos/${p.id}`}><strong>{p.name}</strong></Link><small>{p.brand ?? "Sin marca"} · {p.category}{p.sku ? ` · ${p.sku}` : ""}{p.variantCount > 1 ? ` · ${p.variantCount} variantes` : ""}</small></span></div></td>
      <td data-label="Estado"><span className={`admin-status admin-status--${p.status}`}>{statusLabels[p.status]}</span></td>
      <td data-label="Precio">{p.priceArs === null ? "—" : `$${p.priceArs.toLocaleString("es-AR")}`}</td>
      <td data-label="Stock" className={p.stock === 0 ? "admin-stock-out" : p.stock !== null && p.stock <= 5 ? "admin-stock-low" : undefined}>{stockLabel(p.stock)}</td>
      <td data-label="Actualizado">{p.updatedAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</td>
      <td className="admin-row-action"><Link href={`/admin/productos/${p.id}`} aria-label={`Editar ${p.name}`}>Editar</Link></td></tr>)}</tbody></table>{!result.items.length && <div className="admin-empty">No hay productos con esos filtros. {filtered && <Link href="/admin/productos">Ver todos</Link>}</div>}</div>
    {result.pages > 1 && <nav className="admin-pagination" aria-label="Páginas">{result.page > 1 ? <Link href={href({ pagina: String(result.page - 1) })} aria-label="Página anterior"><ChevronLeft size={17}/></Link> : <span aria-hidden="true"><ChevronLeft size={17}/></span>}{Array.from({ length: result.pages }, (_, i) => i + 1).map((page) => <Link key={page} href={href({ pagina: String(page) })} aria-current={page === result.page ? "page" : undefined} aria-label={`Página ${page}`}>{page}</Link>)}{result.page < result.pages ? <Link href={href({ pagina: String(result.page + 1) })} aria-label="Página siguiente"><ChevronRight size={17}/></Link> : <span aria-hidden="true"><ChevronRight size={17}/></span>}</nav>}
  </div>;
}
