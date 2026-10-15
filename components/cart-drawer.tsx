"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { commerce, formatArs } from "@/lib/commerce";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";

type CartPanelProps = {
  /** En el diálogo cierra el drawer; en /carrito se usa un enlace. */
  onClose?: () => void;
  closeHref?: string;
  headingId?: string;
  /** En /carrito el panel es el contenido principal y su título es el h1. */
  headingLevel?: "h1" | "h2";
};

export function CartPanel({ onClose, closeHref = "/productos", headingId = "cart-heading", headingLevel: Heading = "h2" }: CartPanelProps) {
  const { cart, loaded, pending, feedback, setQuantity, remove, applyCoupon, removeCoupon, acknowledgeChanges } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const close = onClose
    ? <button type="button" className="cart-close" onClick={onClose} aria-label="Cerrar carrito"><X aria-hidden="true" size={20}/></button>
    : <Link href={closeHref} className="cart-close" aria-label="Cerrar carrito"><X aria-hidden="true" size={20}/></Link>;
  const continueShopping = onClose
    ? <button type="button" className="button button--outline button--full" onClick={onClose}>Seguir comprando</button>
    : <Link className="button button--outline button--full" href={closeHref}>Seguir comprando</Link>;

  async function submitCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await applyCoupon(couponCode);
    if (result.ok) setCouponCode("");
  }

  return (
    <>
      <header>
        <Heading id={headingId}>Tu carrito <span>{cart.itemCount} {cart.itemCount === 1 ? "PRODUCTO" : "PRODUCTOS"}</span></Heading>
        {close}
      </header>

      <div className="cart-messages" role="status" aria-live="polite">
        {feedback ? <p className={`cart-feedback cart-feedback--${feedback.tone}`}>{feedback.text}</p> : null}
        {cart.notices.map((notice) => <p className="cart-feedback cart-feedback--warning" key={notice}>{notice}</p>)}
        {cart.hasPriceChanges ? <button type="button" className="cart-acknowledge" onClick={() => acknowledgeChanges()}>Entendido, continuar con los precios actuales</button> : null}
      </div>

      {!loaded ? <p className="cart-loading">Cargando tu carrito…</p> : cart.lines.length === 0 ? (
        <div className="empty-cart"><h3>Tu carrito está vacío</h3><p>Sumá productos desde el catálogo y aparecen acá.</p><Link className="button button--dark" href="/productos" onClick={onClose}>Explorar productos</Link></div>
      ) : (
        <>
          <div className="cart-panel-scroll">
            <div className="cart-items" aria-busy={pending}>
              {cart.lines.map((line) => (
                <article key={line.variantId} className={line.available ? "" : "is-unavailable"}>
                  <Link href={`/productos/${line.slug}`} onClick={onClose}><ProductImage product={line} sizes="86px" decorative/></Link>
                  <div>
                    <p className="eyebrow">{line.brand?.name ?? line.category.name}</p>
                    <h3><Link href={`/productos/${line.slug}`} onClick={onClose}>{line.name}</Link></h3>
                    <span>{line.variantLabel ?? line.category.name} · {formatArs(line.unitPriceArs)} c/u</span>
                    {line.available ? (
                      <div className="quantity" role="group" aria-label={`Cantidad de ${line.name}`}>
                        <button type="button" onClick={() => { if (!pending) void setQuantity(line.variantId, line.quantity - 1); }} disabled={line.quantity <= 1} aria-disabled={pending || undefined} aria-label="Restar una unidad"><Minus aria-hidden="true" size={15} strokeWidth={2.5}/></button>
                        <span aria-live="polite">{line.quantity}</span>
                        <button type="button" onClick={() => { if (!pending) void setQuantity(line.variantId, line.quantity + 1); }} disabled={line.quantity >= line.maxQuantity} aria-disabled={pending || undefined} aria-label="Sumar una unidad"><Plus aria-hidden="true" size={15} strokeWidth={2.5}/></button>
                      </div>
                    ) : <strong className="cart-unavailable">Sin stock</strong>}
                  </div>
                  <div>
                    <button type="button" className="remove-item" onClick={() => remove(line.variantId)} disabled={pending} aria-label={`Quitar ${line.name}`}><Trash2 aria-hidden="true" size={18}/></button>
                    <strong>{line.available ? formatArs(line.lineTotalArs) : "—"}</strong>
                  </div>
                </article>
              ))}
            </div>

            {cart.freeShippingRemainingArs !== null && commerce.freeShippingFromArs ? (
              <section className="free-shipping">
                <div><strong>{cart.freeShippingRemainingArs === 0 ? "¡Tenés envío gratis!" : `Te faltan ${formatArs(cart.freeShippingRemainingArs)} para el envío gratis`}</strong><span>Desde {formatArs(commerce.freeShippingFromArs)}</span></div>
                <progress value={Math.min(cart.totalArs, commerce.freeShippingFromArs)} max={commerce.freeShippingFromArs}/>
              </section>
            ) : null}

            <section className="coupon">
              <strong>Cupón de descuento</strong>
              {cart.coupon ? (
                <div className="coupon-active"><span>{cart.coupon.code}{cart.coupon.description ? ` · ${cart.coupon.description}` : ""}</span><button type="button" onClick={() => removeCoupon()} disabled={pending}>Quitar</button></div>
              ) : (
                <form onSubmit={submitCoupon}><input aria-label="Código de cupón" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} maxLength={40} autoComplete="off" placeholder="Ingresá tu código"/><button type="submit" disabled={pending || couponCode.trim().length === 0}>Aplicar</button></form>
              )}
            </section>
          </div>

          <footer className="cart-panel-footer">
            <section className="cart-totals" aria-label="Totales">
              <p><span>Subtotal</span><strong>{formatArs(cart.subtotalArs)}</strong></p>
              {cart.coupon ? <p><span>Cupón {cart.coupon.code}</span><strong>− {formatArs(cart.discountArs)}</strong></p> : null}
              <p><span>Envío</span><strong className="is-muted">Se calcula en el checkout</strong></p>
              <div><span>Total</span><strong>{formatArs(cart.totalArs)}</strong></div>
              {commerce.interestFreeInstallments > 1 ? <small>{commerce.interestFreeInstallments} cuotas sin interés de {formatArs(cart.totalArs / commerce.interestFreeInstallments)}</small> : null}
            </section>

            {cart.hasBlockingIssues
              ? <p className="cart-feedback cart-feedback--error">Quitá los productos sin stock para continuar.</p>
              : <Link className="button button--dark button--full" href="/checkout" onClick={onClose}><ArrowRight aria-hidden="true" size={18}/>Iniciar compra</Link>}
            {continueShopping}
            <p className="cart-safe">Precios y stock verificados al momento · compra protegida</p>
          </footer>
        </>
      )}
    </>
  );
}

/** Drawer global como diálogo modal nativo: foco atrapado, Escape y restauración de foco. */
export function CartDialog() {
  const { isOpen, closeCart } = useCart();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
      dialog.dataset.state = "open";
      return;
    }
    if (!dialog.open) return;
    dialog.dataset.state = "closing";
    const timer = window.setTimeout(() => { dialog.close(); delete dialog.dataset.state; }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  return (
    <dialog ref={dialogRef} className="cart-dialog" aria-labelledby="cart-dialog-heading" onCancel={(event) => { event.preventDefault(); closeCart(); }} onClose={closeCart} onClick={(event) => { if (event.target === event.currentTarget) closeCart(); }}>
      <aside className="cart-drawer"><CartPanel onClose={closeCart} headingId="cart-dialog-heading"/></aside>
    </dialog>
  );
}
