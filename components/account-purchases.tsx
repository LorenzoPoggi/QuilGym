"use client";
import Link from "next/link";
import { useState } from "react";
import { ProductImage } from "./product-image";
import { formatArs } from "@/lib/commerce";
import { orderStatusLabels, type OrderStatus } from "@/lib/checkout-types";

export type AccountPurchase = {
  id: string; createdAt: string; status: OrderStatus; isDemo: boolean; totalArs: number;
  items: { id: number; name: string; slug: string; quantity: number; category: string; imageUrl: string | null }[];
};

export function AccountPurchases({ purchases, today }: { purchases: AccountPurchase[]; today: string }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("all");
  const categories = [...new Set(purchases.flatMap((purchase) => purchase.items.map((item) => item.category)))].sort();
  const currentDate = new Date(today);
  const visible = purchases.filter((purchase) => {
    const term = search.trim().toLocaleLowerCase("es-AR");
    if (term && !purchase.id.toLowerCase().includes(term) && !purchase.items.some((item) => item.name.toLocaleLowerCase("es-AR").includes(term))) return false;
    if (category && !purchase.items.some((item) => item.category === category)) return false;
    if (date === "30" && currentDate.getTime() - new Date(purchase.createdAt).getTime() > 30 * 86400000) return false;
    if (date === "year" && new Date(purchase.createdAt).getFullYear() !== currentDate.getFullYear()) return false;
    return true;
  });
  return <>
    <div className="account-toolbar"><label className="sr-only" htmlFor="purchase-search">Buscar compras</label><input id="purchase-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscá por compra o producto"/>
      <label className="sr-only" htmlFor="purchase-category">Categoría</label><select id="purchase-category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select>
      <label className="sr-only" htmlFor="purchase-date">Fecha</label><select id="purchase-date" value={date} onChange={(event) => setDate(event.target.value)}><option value="all">Todas las fechas</option><option value="30">Últimos 30 días</option><option value="year">Este año</option></select><span>{visible.length} {visible.length === 1 ? "compra" : "compras"}</span>
    </div>
    {visible.length ? <div className="account-list">{visible.map((purchase) => <article className="purchase-card" key={purchase.id}><header><strong>{new Date(purchase.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })}</strong><small>{purchase.isDemo ? "Pedido de prueba" : `QG-${purchase.id.slice(0, 8).toUpperCase()}`}</small></header><div className="purchase-card-body"><div><p className={`purchase-status purchase-status--${purchase.status}`}>{orderStatusLabels[purchase.status]}</p><div className="purchase-card-items">{purchase.items.map((item) => <div className="purchase-line" key={item.id}><ProductImage product={{ name: item.name, brand: null, category: { name: item.category, slug: "" }, imageUrl: item.imageUrl }} decorative sizes="70px"/><span><strong>{item.name}</strong><small>{item.quantity} {item.quantity === 1 ? "unidad" : "unidades"}</small></span></div>)}</div></div><div className="purchase-card-actions"><strong>{formatArs(purchase.totalArs)}</strong><Link className="button button--dark" href={`/checkout/confirmacion/${purchase.id}`}>Ver compra</Link>{purchase.items[0] ? <Link className="button button--outline" href={`/productos/${purchase.items[0].slug}`}>Volver a comprar</Link> : null}</div></div></article>)}</div> : <div className="account-empty"><p>{purchases.length ? "No hay compras con esos filtros." : "Todavía no tenés compras asociadas a tu cuenta."}</p><Link className="button button--dark" href="/productos">Explorar productos</Link></div>}
  </>;
}
