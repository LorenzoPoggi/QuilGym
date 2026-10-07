import Link from "next/link";
import Image from "next/image";
import { Plus, Search } from "lucide-react";
import { getAdminCatalog } from "@/lib/admin-catalog";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const { q = "", estado = "todos" } = await searchParams;
  const all = await getAdminCatalog();
  const term = q.trim().toLocaleLowerCase("es");
  const filtered = all.filter((p) => (estado === "todos" || p.status === estado) && (!term || `${p.name} ${p.brand ?? ""} ${p.category} ${p.slug}`.toLocaleLowerCase("es").includes(term)));
  const active = all.filter((p) => p.status === "active").length;
  const lowStock = all.filter((p) => p.status === "active" && p.stock !== null && p.stock <= 5).length;
  return <div className="admin-content">
    <header className="admin-page-head"><div><p className="admin-eyebrow">GESTIÓN DEL CATÁLOGO</p><h1>Productos</h1><p>Actualizá precios, stock, fotos y publicaciones desde un solo lugar.</p></div><Link className="admin-primary" href="/admin/productos/nuevo"><Plus size={18}/> Agregar producto</Link></header>
    <div className="admin-stats"><div><span>Productos</span><strong>{all.length}</strong></div><div><span>Publicados</span><strong>{active}</strong></div><div><span>Stock bajo o agotado</span><strong>{lowStock}</strong></div></div>
    <form className="admin-filters" action="/admin/productos"><label><Search size={18}/><input name="q" defaultValue={q} placeholder="Buscar por producto, marca o categoría" aria-label="Buscar productos"/></label><select name="estado" defaultValue={estado} aria-label="Filtrar por estado"><option value="todos">Todos los estados</option><option value="active">Publicados</option><option value="draft">Borradores</option><option value="archived">Archivados</option></select><button type="submit">Buscar</button></form>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Producto</th><th>Estado</th><th>Precio</th><th>Stock</th><th>Acción</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id}><td><div className="admin-product-cell">{p.imageUrl ? <Image src={p.imageUrl} alt="" width={62} height={62}/> : <span className="admin-image-empty"/>}<span><strong>{p.name}</strong><small>{p.brand ?? "Sin marca"} · {p.category}</small></span></div></td><td><span className={`admin-status admin-status--${p.status}`}>{p.status === "active" ? "Publicado" : p.status === "draft" ? "Borrador" : "Archivado"}</span></td><td>{p.priceArs === null ? "—" : `$${p.priceArs.toLocaleString("es-AR")}`}</td><td>{p.stock === null ? "Sin control" : p.stock === 0 ? "Agotado" : `${p.stock} u.`}</td><td><Link href={`/admin/productos/${p.id}`}>Editar</Link></td></tr>)}</tbody></table>{!filtered.length && <div className="admin-empty">No hay productos con esos filtros.</div>}</div>
  </div>;
}
