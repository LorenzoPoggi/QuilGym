import Link from "next/link";

const sections = [{ href: "/admin/productos", label: "Productos" }, { href: "/admin/productos/marcas", label: "Marcas" }, { href: "/admin/productos/categorias", label: "Categorías" }] as const;
export function AdminCatalogNav({ current }: { current: (typeof sections)[number]["href"] }) {
  return <nav className="admin-subnav" aria-label="Catálogo">{sections.map((section) => <Link key={section.href} href={section.href} aria-current={section.href === current ? "page" : undefined}>{section.label}</Link>)}</nav>;
}
