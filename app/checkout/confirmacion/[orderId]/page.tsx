import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { orderDetails } from "@/lib/order-service";
import { orderStatusLabels } from "@/lib/checkout-types";
import { getCheckoutConfig } from "@/lib/checkout-config";
import { formatArs } from "@/lib/commerce";
import { DemoPayment, MercadoPagoPayment, RefreshOrder } from "@/components/order-payment";

export const metadata: Metadata = { title: "Tu pedido | QuilGym", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ t?: string | string[] }> }) {
  const { orderId } = await params;
  const { t } = await searchParams;
  // Link firmado del email o de la vuelta desde Mercado Pago; sin él, autoriza la cookie del carrito.
  const accessToken = typeof t === "string" ? t : null;
  const details = await orderDetails(orderId, accessToken);
  if (!details) notFound();
  const { order, items, payment, shipment } = details;
  const demoEnabled = getCheckoutConfig().demo;
  const pending = order.status === "pending";
  const titles = { pending: "Recibimos tu pedido", approved: "¡Tu pago está aprobado!", rejected: "Tu pago fue rechazado", cancelled: "Tu pedido está cancelado", refunded: "Tu pago fue reembolsado" };
  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark">QUILGYM</Link><span>Estado del pedido</span></div></header>
    <main className="confirmation-page"><div className="container">
      {order.isDemo ? <div className="checkout-demo-banner"><strong>Pedido de prueba</strong><span>No representa una compra real. No se cobró dinero ni se envió ningún email.</span></div> : null}
      <section className="confirmation-hero"><span aria-hidden="true">{order.status === "approved" ? "✓" : "◷"}</span><div><p className="eyebrow">{orderStatusLabels[order.status]}</p><h1>{titles[order.status]}</h1><p>{order.name}, podés consultar los detalles y el estado desde esta página.</p></div><div><small>NÚMERO DE PEDIDO</small><strong className="order-id">{order.id}</strong></div></section>
      <div className="confirmation-actions"><RefreshOrder pending={pending}/><Link className="button button--outline" href="/productos">Seguir comprando</Link><span>{order.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</span></div>
      <section className="confirmation-cards">
        <article><h2>{order.delivery === "pickup" ? "Retiro" : "Entrega"}</h2><h3>{shipment?.label}</h3>
          {order.address ? <p>{order.address.street} {order.address.number} {order.address.apartment}<br/>{order.address.city}, {order.address.province} ({order.address.postalCode})</p> : <p>{order.pickupDetails?.address}<br/>{order.pickupDetails?.hours}</p>}
          <p>{shipment?.estimate}</p>{shipment?.trackingCode ? <p>Seguimiento: {shipment.trackingCode}</p> : <p>Te avisaremos cuando esté preparado.</p>}
        </article>
        <article><h2>Pago</h2><strong>{orderStatusLabels[order.status]}</strong><h3>{{ mercadopago: "Mercado Pago", transfer: "Transferencia bancaria", cash: "Efectivo al retirar" }[order.paymentMethod]}</h3><p>Total: {formatArs(order.totalArs)}</p>{pending ? <p>El pedido todavía no tiene un pago aprobado.</p> : null}</article>
        <article><h2>Contacto</h2><h3>{order.name}</h3><p>{order.email}<br/>{order.phone}</p>{order.notes ? <p>Indicaciones: {order.notes}</p> : null}</article>
      </section>
      <div className="confirmation-grid"><section className="order-detail"><header><h2>Detalle del pedido</h2><span>{items.reduce((sum, item) => sum + item.quantity, 0)} unidades</span></header>
        {items.map((item) => <article className="order-snapshot-line" key={item.id}><div><strong>{item.name}</strong><small>{item.variantLabel} · {item.quantity} × {formatArs(item.unitPriceArs)}</small></div><b>{formatArs(item.quantity * item.unitPriceArs)}</b></article>)}
        <div className="order-total"><p><span>Subtotal</span><b>{formatArs(order.subtotalArs)}</b></p>{order.discountArs > 0 ? <p><span>Cupón {order.couponCode}</span><b>− {formatArs(order.discountArs)}</b></p> : null}<p><span>Entrega</span><b>{formatArs(order.shippingArs)}</b></p><p><strong>Total</strong><strong>{formatArs(order.totalArs)}</strong></p></div>
      </section><aside className="next-steps"><h2>Próximos pasos</h2><p>{pending ? order.paymentMethod === "cash" ? "Esperá el aviso del local. Abonás al retirar el pedido." : "Completá el pago para que podamos preparar tu pedido." : order.status === "approved" ? "Vamos a preparar tu pedido. La entrega o retiro se coordina según la opción elegida." : "Este pedido no seguirá a preparación. Podés volver al catálogo para iniciar una nueva compra."}</p>
        {pending && order.paymentMethod === "transfer" ? <div className="transfer-details">{order.bankDetails ? <dl><dt>CBU / Alias</dt><dd>{order.bankDetails.account}</dd><dt>Titular</dt><dd>{order.bankDetails.holder}</dd><dt>CUIT</dt><dd>{order.bankDetails.taxId}</dd></dl> : <p>Datos bancarios pendientes de configuración. No hagas una transferencia para este pedido de prueba.</p>}</div> : null}
        {pending && payment?.ticketUrl ? <a className="button button--outline" href={payment.ticketUrl} target="_blank" rel="noopener noreferrer">Ver cupón de pago</a> : null}
      </aside></div>
      {order.isDemo && demoEnabled ? <DemoPayment orderId={order.id} status={order.status}/> : null}
      {!order.isDemo && pending && order.paymentMethod === "mercadopago" && !payment?.providerId ? <MercadoPagoPayment orderId={order.id} accessToken={accessToken}/> : null}
    </div></main></>;
}
