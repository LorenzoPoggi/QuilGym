"use client";

import { useMemo, useState } from "react";
import type { StoreProduct } from "@/lib/store-data";
import { ProductCard } from "./product-card";

const tabs = ["Todas", "Monohidrato", "Micronizada", "Con sabor", "Packs y combos", "Veganas"];
const filterGroups = [
  { title: "Objetivo", options: ["Masa muscular", "Rendimiento", "Recuperación"] },
  { title: "Tipo de producto", options: ["Creatina", "Proteína", "Pre-entreno"] },
  { title: "Marca", options: ["Star Nutrition", "ENA", "Gold Nutrition"] },
  { title: "Precio", options: ["$0 – $30.000", "$30.000 – $50.000", "Más de $50.000"] },
  { title: "Sabor", options: ["Sin sabor", "Chocolate", "Vainilla"] },
  { title: "Presentación", options: ["Pote", "Sachet", "Pack"] },
  { title: "Disponibilidad", options: ["En stock", "Últimas unidades"] },
];

export function CatalogView({ products }: { products: StoreProduct[] }) {
  const [tab, setTab] = useState("Monohidrato");
  const [selected, setSelected] = useState<string[]>(["Creatina", "En stock"]);
  const [sort, setSort] = useState("relevant");

  const visibleProducts = useMemo(() => {
    const base = products.filter((product) => selected.includes("Creatina") ? product.category === "Creatina" : true);
    return sort === "price-low" ? [...base].sort((a, b) => a.priceValue - b.priceValue) : sort === "price-high" ? [...base].sort((a, b) => b.priceValue - a.priceValue) : base;
  }, [products, selected, sort]);

  function toggleFilter(option: string) {
    setSelected((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  return (
    <>
      <div className="catalog-tabs" role="tablist" aria-label="Tipos de creatina">
        {tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)} key={item}><span>⌘</span>{item}</button>)}
      </div>
      <div className="catalog-toolbar">
        <div className="filter-chips">{selected.map((item) => <button type="button" key={item} onClick={() => toggleFilter(item)}>{item} ×</button>)}{selected.length > 0 ? <button type="button" className="clear-filters" onClick={() => setSelected([])}>Limpiar filtros</button> : null}</div>
        <label>Ordenar:<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevant">Más relevantes</option><option value="price-low">Menor precio</option><option value="price-high">Mayor precio</option></select></label>
      </div>
      <div className="catalog-layout">
        <aside className="filters-panel">
          <div className="filters-title"><h2>Filtros</h2><span>{selected.length} activos</span></div>
          {filterGroups.map((group) => <fieldset key={group.title}><legend>{group.title}<span>⌄</span></legend>{group.options.map((option, index) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={() => toggleFilter(option)} /><span>{option}</span><small>{17 - index * 4}</small></label>)}</fieldset>)}
        </aside>
        <div><div className="catalog-product-grid">{visibleProducts.concat(visibleProducts).slice(0, 8).map((product, index) => <ProductCard key={`${product.slug}-${index}`} product={product} priority={index < 3} />)}</div><nav className="pagination" aria-label="Páginas del catálogo"><button type="button">←</button><button type="button" className="is-active">1</button><button type="button">2</button><button type="button">3</button><button type="button">4</button><button type="button">→</button></nav></div>
      </div>
    </>
  );
}
