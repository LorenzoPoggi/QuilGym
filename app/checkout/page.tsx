import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { CheckoutForm } from "@/components/checkout-form";
import { WhatsAppGlyph } from "@/components/icons";
import { ProductImage } from "@/components/product-image";
import { getCart } from "@/lib/cart";
import type { Cart } from "@/lib/cart-types";
import { getCheckoutConfig } from "@/lib/checkout-config";
import { isOnlineCheckoutAvailable, whatsappOrderMessage } from "@/lib/checkout-whatsapp";
import { formatArs, whatsappUrl } from "@/lib/commerce";

export const metadata: Metadata = { title: "Finalizar compra | QuilGym", robots: { index: false } };

/** Sin entrega o pago configurados: el pedido se manda por WhatsApp con el carrito recalculado acá. */
function WhatsAppCheckout({ cart }: { cart: Cart }) {
  return <div className="checkout-layout">
    <section className="checkout-card checkout-unavailable" aria-labelledby="checkout-unavailable-title">
      <span className="checkout-unavailable__icon" aria-hidden="true"><Clock size={22}/></span>
      <div><h2 id="checkout-unavailable-title">La compra online se habilita pronto</h2>
        <p>Mientras tanto, mandanos el pedido por WhatsApp y te confirmamos stock, forma de pago y entrega. No se cobra nada desde la web.</p></div>
      <a className="button button--whatsapp" href={whatsappUrl(whatsappOrderMessage(cart))} target="_blank" rel="noopener noreferrer"><WhatsAppGlyph/>Pedir por WhatsApp</a>
      <small>Se abre WhatsApp con los productos y el total de tu carrito listos para enviar.</small>
    </section>
    <aside className="checkout-summary checkout-summary--whatsapp"><header><h2>Resumen</h2><Link href="/carrito">Editar carrito</Link></header>
      {cart.lines.map((line) => <article key={line.variantId}><div className="checkout-line-thumb"><ProductImage product={line} sizes="64px" decorative/><span aria-hidden="true">{line.quantity}</span></div><div><strong>{line.name}</strong><small>{line.quantity} × {formatArs(line.unitPriceArs)}</small></div><b>{line.available ? formatArs(line.lineTotalArs) : "Sin stock"}</b></article>)}
      <div className="summary-lines"><p><span>Subtotal</span><strong>{formatArs(cart.subtotalArs)}</strong></p>
        {cart.coupon ? <p><span>Cupón {cart.coupon.code}</span><strong>− {formatArs(cart.discountArs)}</strong></p> : null}
        <p><span>Entrega</span><strong className="is-muted">A coordinar</strong></p>
        <div><span>Total</span><strong>{formatArs(cart.totalArs)}</strong></div>
      </div>
    </aside>
  </div>;
}

export default async function CheckoutPage() {
  // Precio, stock y cupón se recalculan en el servidor antes de mostrar el checkout.
  const cart = await getCart();
  if (cart.lines.length === 0) redirect("/carrito");
  const config = getCheckoutConfig();
  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark">QUILGYM</Link><h1>Finalizar compra</h1></div></header><main className="checkout-page"><div className="container">
    {isOnlineCheckoutAvailable(config) ? <CheckoutForm initialCart={cart} config={config}/> : <WhatsAppCheckout cart={cart}/>}
  </div></main></>;
}
