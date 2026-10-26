"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ProductDetail } from "@/lib/catalog-types";
import { formatArs } from "@/lib/commerce";
import { useCart } from "./cart-provider";
import { BagIcon } from "./icons";
import { ProductStickyBuy } from "./product-sticky-buy";
import { useProductVariant } from "./product-variant-provider";

export function CartPill() {
  const { cart, loaded, openCart, countBouncing } = useCart();
  const label = loaded ? `Carrito: ${cart.itemCount} ${cart.itemCount === 1 ? "producto" : "productos"}, ${formatArs(cart.totalArs)}` : "Carrito";
  return (
    <Link className={`cart-pill ${cart.itemCount > 0 ? "cart-pill--filled" : ""}`} href="/carrito" aria-label={label} onClick={(event) => { event.preventDefault(); openCart(); }}>
      <BagIcon/><strong>{formatArs(loaded ? cart.totalArs : 0)}</strong>
      {cart.itemCount > 0 ? <span className={`cart-pill__count ${countBouncing ? "cart-pill__count--bounce" : ""}`} aria-hidden="true">{cart.itemCount}</span> : null}
    </Link>
  );
}

export function AddToCartButton({ variantId, name, inStock, className = "button button--outline button--full", label = "Agregar" }: { variantId: number; name: string; inStock: boolean; className?: string; label?: string }) {
  const { add } = useCart();
  const [busy, setBusy] = useState(false);

  async function handleClick(source: HTMLElement) {
    if (busy) return;
    setBusy(true);
    try {
      await add(variantId, 1, { animateFrom: source });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} disabled={!inStock} aria-disabled={busy || undefined} onClick={(event) => void handleClick(event.currentTarget)} aria-label={inStock ? `Agregar ${name} al carrito` : `${name} sin stock`}>
      <BagIcon/> {!inStock ? "Sin stock" : busy ? "Agregando…" : label}
    </button>
  );
}

/** Selector de variante y cantidad de la ficha de producto. */
export function ProductPurchase({ product }: { product: Pick<ProductDetail, "name" | "variantId" | "variants"> }) {
  const router = useRouter();
  const { add } = useCart();
  const shared = useProductVariant();
  const [localVariantId, setLocalVariantId] = useState(product.variantId);
  const variantId = shared ? shared.variant.id : localVariantId;
  const setVariantId = shared ? shared.select : setLocalVariantId;
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState<"add" | "buy" | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  const max = variant.maxQuantity;
  const pricesDiffer = new Set(product.variants.map((item) => item.priceArs)).size > 1;

  // Sin `disabled` durante la espera: el botón conserva el foco y el diálogo lo restaura al cerrar.
  async function submit(mode: "add" | "buy", source: HTMLElement | null = null) {
    if (busy) return;
    setBusy(mode);
    try {
      const result = await add(variant.id, quantity, { openDrawer: mode === "add", animateFrom: mode === "add" ? source : null });
      if (result.ok && mode === "buy") router.push("/checkout");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {product.variants.length > 1 ? (
        <div className="option-group option-group--flavors" role="radiogroup" aria-label="Sabor">
          <span>Sabor: <strong>{variant.label ?? variant.sku}</strong>{variant.inStock ? "" : " · sin stock"}</span>
          <div>{product.variants.map((item) => (
            <button type="button" role="radio" aria-checked={item.id === variant.id} className={`${item.id === variant.id ? "is-active" : ""} ${item.inStock ? "" : "is-out"}`} onClick={() => { setVariantId(item.id); setQuantity(1); }} key={item.id}>
              {item.label ?? item.sku}{item.inStock ? (pricesDiffer ? ` · ${formatArs(item.priceArs)}` : "") : <small> Sin stock</small>}
            </button>
          ))}</div>
        </div>
      ) : null}
      <div className="buy-actions" ref={actionsRef}>
        <div className="purchase-quantity" role="group" aria-label="Cantidad">
          <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1 || max === 0} aria-label="Restar una unidad">−</button>
          <span aria-live="polite">{max === 0 ? 0 : quantity}</span>
          <button type="button" onClick={() => setQuantity((value) => Math.min(max, value + 1))} disabled={quantity >= max} aria-label="Sumar una unidad">+</button>
        </div>
        <div>
          <button type="button" className="button button--outline" disabled={max === 0} aria-disabled={busy !== null || undefined} onClick={(event) => void submit("add", event.currentTarget)}><BagIcon/> {max === 0 ? "Sin stock" : busy === "add" ? "Agregando…" : "Agregar al carrito"}</button>
          <button type="button" className="button button--dark" disabled={max === 0} aria-disabled={busy !== null || undefined} onClick={(event) => void submit("buy", event.currentTarget)}>{busy === "buy" ? "Procesando…" : "Comprar ahora"}</button>
        </div>
      </div>
      <ProductStickyBuy target={actionsRef} name={product.name} priceArs={variant.priceArs} quantity={max === 0 ? 0 : quantity} soldOut={max === 0} busy={busy} onSubmit={submit}/>
    </>
  );
}
