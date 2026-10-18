import Link from "next/link";

const tabs = [{ key: "ventas", label: "Ventas", href: "/admin/metricas" }, { key: "trafico", label: "Tráfico", href: "/admin/metricas/trafico" }] as const;

/** Pestañas «Ventas | Tráfico» que conectan las dos páginas de métricas. */
export function MetricsTabs({ active }: { active: (typeof tabs)[number]["key"] }) {
  return <nav className="metrics-tabs" aria-label="Tipo de métricas">
    {tabs.map((tab) => <Link key={tab.key} href={tab.href} aria-current={tab.key === active ? "page" : undefined}>{tab.label}</Link>)}
  </nav>;
}
