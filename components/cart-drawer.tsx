"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProductSummary } from "@/lib/catalog-types";
import { ProductImage } from "./product-image";

export function CartDrawer({ initialProducts }: { initialProducts: ProductSummary[] }) {
  const [items, setItems] = useState(() => initialProducts.map((product,index) => ({ product, quantity: index === 1 ? 2 : 1 })));
  const subtotal = useMemo(() => items.reduce((sum,item) => sum + item.product.priceArs * item.quantity, 0), [items]);
  const total = Math.round(subtotal * .9);

  function changeQuantity(slug: string, delta: number) {
    setItems((current) => current.map((item) => item.product.slug === slug ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  }

  return <aside className="cart-drawer"><header><h1>Tu carrito <span>{items.reduce((sum,item) => sum + item.quantity, 0)} PRODUCTOS</span></h1><Link href="/productos" aria-label="Cerrar carrito">×</Link></header><div className="cart-items">{items.map(({ product, quantity }) => <article key={product.slug}><ProductImage product={product} sizes="95px"/><div><p className="eyebrow">{product.brand?.name ?? product.category.name}</p><h2>{product.name}</h2><span>{product.category.name}</span><div className="quantity"><button type="button" onClick={() => changeQuantity(product.slug,-1)}>−</button><span>{quantity}</span><button type="button" onClick={() => changeQuantity(product.slug,1)}>+</button></div></div><div><button type="button" className="remove-item" onClick={() => setItems((current) => current.filter((item) => item.product.slug !== product.slug))}>♲</button><strong>${(product.priceArs * quantity).toLocaleString("es-AR")}</strong></div></article>)}</div>{items.length === 0 ? <div className="empty-cart"><h2>Tu carrito está vacío</h2><Link className="button button--dark" href="/productos">Explorar productos</Link></div> : <><section className="free-shipping"><div><strong>¡Tenés envío gratis!</strong><span>Superaste $75.000</span></div><progress value={subtotal} max={75000}/><p>CP 1878 · entrega estimada: martes 6 a miércoles 7</p></section><section className="coupon"><strong>Cupón de descuento</strong><div><input aria-label="Cupón" defaultValue="ENTRENA10"/><button type="button">Aplicado ✓</button></div></section><section className="cart-totals"><p><span>Subtotal</span><strong>${subtotal.toLocaleString("es-AR")}</strong></p><p><span>Ahorro en productos</span><strong>− $12.450</strong></p><p><span>Cupón ENTRENA10</span><strong>− ${(subtotal - total).toLocaleString("es-AR")}</strong></p><p><span>Envío</span><strong>Gratis</strong></p><div><span>Total</span><strong>${total.toLocaleString("es-AR")}</strong></div><small>3 cuotas sin interés de ${Math.round(total / 3).toLocaleString("es-AR")}</small></section><Link className="button button--dark button--full" href="/checkout">Iniciar compra →</Link><Link className="button button--outline button--full" href="/productos">Seguir comprando</Link><p className="cart-safe">Compra protegida · cambios simples · medios de pago seguros</p></>}</aside>;
}
