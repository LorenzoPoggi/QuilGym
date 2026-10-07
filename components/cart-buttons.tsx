"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProductDetail } from "@/lib/catalog-types";
import { formatArs } from "@/lib/commerce";
import { useCart } from "./cart-provider";
import { BagIcon } from "./icons";

export function CartPill() {
  const { cart, loaded, openCart } = useCart();
  const label = loaded ? `Carrito: ${cart.itemCount} ${cart.itemCount === 1 ? "producto" : "productos"}, ${formatArs(cart.totalArs)}` : "Carrito";
  return (
    <Link className={`cart-pill ${cart.itemCount > 0 ? "cart-pill--filled" : ""}`} href="/carrito" aria-label={label} onClick={(event) => { event.preventDefault(); openCart(); }}>
      <BagIcon/><strong>{formatArs(loaded ? cart.totalArs : 0)}</strong>
      {cart.itemCount > 0 ? <span className="cart-pill__count" aria-hidden="true">{cart.itemCount}</span> : null}
    </Link>
  );
}

export function AddToCartButton({ variantId, name, inStock, className = "button button--outline button--full", label = "Agregar" }: { variantId: number; name: string; inStock: boolean; className?: string; label?: string }) {
  const { add } = useCart();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      await add(variantId, 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} disabled={!inStock} aria-disabled={busy || undefined} onClick={handleClick} aria-label={inStock ? `Agregar ${name} al carrito` : `${name} sin stock`}>
      <BagIcon/> {!inStock ? "Sin stock" : busy ? "Agregando…" : label}
    </button>
  );
}

/** Selector de variante y cantidad de la ficha de producto. */
export function ProductPurchase({ product }: { product: Pick<ProductDetail, "name" | "variantId" | "variants"> }) {
  const router = useRouter();
  const { add } = useCart();
  const [variantId, setVariantId] = useState(product.variantId);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState<"add" | "buy" | null>(null);
  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  const max = variant.maxQuantity;

  // Sin `disabled` durante la espera: el botón conserva el foco y el diálogo lo restaura al cerrar.
  async function submit(mode: "add" | "buy") {
    if (busy) return;
    setBusy(mode);
    try {
      const result = await add(variant.id, quantity, { openDrawer: mode === "add" });
      if (result.ok && mode === "buy") router.push("/checkout");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {product.variants.length > 1 ? (
        <div className="option-group" role="radiogroup" aria-label="Variante">
          <span>Variante: {variant.label ?? variant.sku}</span>
          <div>{product.variants.map((item) => <button type="button" role="radio" aria-checked={item.id === variant.id} className={item.id === variant.id ? "is-active" : ""} disabled={!item.inStock} onClick={() => { setVariantId(item.id); setQuantity(1); }} key={item.id}>{item.label ?? item.sku} · {item.inStock ? formatArs(item.priceArs) : "Sin stock"}</button>)}</div>
        </div>
      ) : null}
      <div className="buy-actions">
        <div className="purchase-quantity" role="group" aria-label="Cantidad">
          <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1 || max === 0} aria-label="Restar una unidad">−</button>
          <span aria-live="polite">{max === 0 ? 0 : quantity}</span>
          <button type="button" onClick={() => setQuantity((value) => Math.min(max, value + 1))} disabled={quantity >= max} aria-label="Sumar una unidad">+</button>
        </div>
        <div>
          <button type="button" className="button button--outline" disabled={max === 0} aria-disabled={busy !== null || undefined} onClick={() => submit("add")}><BagIcon/> {max === 0 ? "Sin stock" : busy === "add" ? "Agregando…" : "Agregar al carrito"}</button>
          <button type="button" className="button button--dark" disabled={max === 0} aria-disabled={busy !== null || undefined} onClick={() => submit("buy")}>{busy === "buy" ? "Procesando…" : "Comprar ahora"}</button>
        </div>
      </div>
    </>
  );
}
