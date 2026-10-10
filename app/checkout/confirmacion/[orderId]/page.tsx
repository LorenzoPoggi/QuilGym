import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, CreditCard, Info, Landmark, RotateCcw, Store, Truck, User, Wallet, X } from "lucide-react";
import { orderDetails } from "@/lib/order-service";
import { orderStatusLabels } from "@/lib/checkout-types";
import { getCheckoutConfig, orderAccessSecret } from "@/lib/checkout-config";
import { getAllProducts } from "@/lib/catalog";
import { formatArs } from "@/lib/commerce";
import { verifyOrderAccess } from "@/lib/order-access";
import { DemoPayment, MercadoPagoPayment, MercadoPagoRedirect, RefreshOrder } from "@/components/order-payment";
import { ProductImage } from "@/components/product-image";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Tu pedido | QuilGym", robots: { index: false, follow: false }, referrer: "no-referrer" };

const statusIcons = { pending: Clock, approved: Check, rejected: X, cancelled: X, refunded: RotateCcw };
const paymentMethods = { mercadopago: ["Mercado Pago", CreditCard], transfer: ["Transferencia bancaria", Landmark], cash: ["Efectivo", Wallet] } as const;
const timeZone = "America/Argentina/Buenos_Aires";

type Step = { number: number; title: string; copy: string; state: "done" | "current" | "todo" };

export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ t?: string | string[]; payment_id?: string | string[]; collection_id?: string | string[] }> }) {
  const { orderId } = await params;
  const { t, payment_id, collection_id } = await searchParams;
  // Link firmado del email o de la vuelta desde Mercado Pago; sin él, autoriza la cookie del carrito.
  const accessToken = typeof t === "string" ? t : null;
  const returnedPaymentId = typeof payment_id === "string" ? payment_id : typeof collection_id === "string" ? collection_id : null;
  const details = await orderDetails(orderId, accessToken);
  if (!details) {
    console.warn("[Order confirmation] Pedido no disponible", {
      order: orderId.slice(0, 8),
      signedLinkProvided: Boolean(accessToken),
      signedLinkValid: verifyOrderAccess(orderId, accessToken, orderAccessSecret()),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      deployment: process.env.VERCEL_URL,
    });
    notFound();
  }
  const { order, items, payment, shipment } = details;
  const demoEnabled = getCheckoutConfig().demo;
  const pending = order.status === "pending";
  const pickup = order.delivery === "pickup";
  const cashPickup = order.paymentMethod === "cash" && pickup;
  const titles = { pending: "Pedido pendiente de pago", approved: "¡Gracias por tu compra!", rejected: "Tu pago fue rechazado", cancelled: "Tu pedido está cancelado", refunded: "Tu pago fue reembolsado" };
  // Código legible derivado del ID real; el UUID completo queda como referencia secundaria.
  const code = `QG-${order.id.slice(0, 8).toUpperCase()}`;
  const StatusIcon = statusIcons[order.status];
  const [defaultMethodLabel, MethodIcon] = paymentMethods[order.paymentMethod];
  const methodLabel = order.paymentMethod === "mercadopago" ? ({ mercadopago: "Mercado Pago", mercado_credito: "Mercado Crédito", debit_card: "Tarjeta de débito", credit_card: "Tarjeta de crédito" } as Record<string, string>)[order.paymentChoice] ?? defaultMethodLabel : defaultMethodLabel;
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const createdAt = `${new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone }).format(order.createdAt)} · ${new Intl.DateTimeFormat("es-AR", { timeStyle: "short", timeZone }).format(order.createdAt)}`;
  const catalog = new Map((await getAllProducts()).map((product) => [product.slug, product]));
  const estimate = shipment?.estimate && shipment.estimate !== order.pickupDetails?.hours ? shipment.estimate : null;

  const steps: Step[] | null = pending || order.status === "approved"
    ? cashPickup
      ? [
        { number: 1, title: "Pedido recibido", copy: `Guardamos tu pedido ${code}.`, state: "done" },
        { number: 2, title: "Preparación", copy: "Armamos tu pedido y te avisamos cuando esté listo.", state: order.status === "approved" ? "done" : "current" },
        { number: 3, title: "Pago y Retiro en el local", copy: "Cuando te avisemos, abonás en el local y te llevás el pedido.", state: order.status === "approved" ? "done" : "todo" },
      ]
      : [
        { number: 1, title: "Pedido recibido", copy: `Guardamos tu pedido ${code}.`, state: "done" },
        { number: 2, title: order.status === "approved" ? "Pago aprobado" : "Pago", copy: order.status === "approved" ? order.isDemo ? "Pago simulado: no se cobró dinero." : "Acreditamos el pago de tu compra." : order.paymentMethod === "transfer" ? "Transferí el total. Lo confirmamos al verificar la acreditación." : "Completá el pago para que podamos preparar tu pedido.", state: order.status === "approved" ? "done" : "current" },
        { number: 3, title: "Preparación", copy: "Armamos y controlamos tu pedido.", state: order.status === "approved" ? "current" : "todo" },
        pickup
          ? { number: 4, title: "Retiro en el local", copy: "Te avisamos cuando esté listo para retirar.", state: "todo" }
          : { number: 4, title: "Envío", copy: shipment?.trackingCode ? `Seguimiento: ${shipment.trackingCode}` : "Te enviamos el código de seguimiento al despacharlo.", state: "todo" },
      ]
    : null;

  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark" aria-label="QuilGym, inicio"><Logo/></Link></div></header>
    <main className="confirmation-page"><div className="container">
      {order.isDemo ? <div className="checkout-demo-banner"><strong>Pedido de prueba</strong><span>No representa una compra real. No se cobró dinero ni se envió ningún email.</span></div> : null}
      <section className={`confirmation-hero is-${order.status}`}><span aria-hidden="true"><StatusIcon strokeWidth={2}/></span><div><p className="eyebrow">{cashPickup && pending ? "En preparación" : orderStatusLabels[order.status]}</p><h1>{cashPickup && pending ? "Recibimos tu pedido" : titles[order.status]}</h1><p>{order.name}, podés consultar los detalles y el estado desde esta página.</p></div><div><small>{order.status === "approved" ? "NÚMERO DE COMPRA" : "NÚMERO DE PEDIDO"}</small><strong className="order-id">{code}</strong><small className="order-uuid" title="Identificador completo del pedido">{order.id}</small></div></section>
      <div className="confirmation-actions"><RefreshOrder pending={pending}/><Link className="button button--outline" href="/productos">Seguir comprando</Link><span>{pending ? "Pedido realizado" : "Compra realizada"} el {createdAt}</span></div>
      <section className="confirmation-cards">
        <article><header><span aria-hidden="true">{pickup ? <Store size={18}/> : <Truck size={18}/>}</span><h2>{pickup ? "Retiro" : "Entrega"}</h2></header>
          {shipment?.label ? <strong>{shipment.label}</strong> : null}
          {order.address
            ? <>{estimate ? <h3>{estimate}</h3> : null}<p>{order.address.street} {order.address.number} {order.address.apartment}<br/>{order.address.city}, {order.address.province} ({order.address.postalCode})</p></>
            : <><h3>{order.pickupDetails?.address}</h3><p>{order.pickupDetails?.hours}</p>{estimate ? <p>{estimate}</p> : null}</>}
          {shipment?.trackingCode ? <p>Seguimiento: {shipment.trackingCode}</p> : <p>Te avisaremos cuando esté preparado.</p>}
        </article>
        <article><header><span aria-hidden="true"><MethodIcon size={18}/></span><h2>Pago</h2></header><strong>{cashPickup && pending ? "Pago al retirar" : orderStatusLabels[order.status]}</strong><h3>{methodLabel}</h3><p className="confirmation-total">Total: {formatArs(order.totalArs)}</p>{pending ? <p>{cashPickup ? "Te avisaremos cuando esté listo para abonar y retirar." : "El pedido todavía no tiene un pago aprobado."}</p> : null}</article>
        <article><header><span aria-hidden="true"><User size={18}/></span><h2>Contacto</h2></header><h3>{order.name}</h3><p>{order.email}<br/>{order.phone}</p>{order.notes ? <p>Indicaciones: {order.notes}</p> : null}</article>
      </section>
      <div className="confirmation-grid"><section className="order-detail"><header><h2>Detalle del pedido</h2><span>{units} {units === 1 ? "unidad" : "unidades"}</span></header>
        {items.map((item) => {
          const product = catalog.get(item.slug);
          return <article className="order-snapshot-line" key={item.id}>
            <ProductImage product={product ?? { name: item.name, brand: null, category: { slug: "", name: "Producto" }, imageUrl: null }} sizes="72px" decorative/>
            <div><strong>{item.name}</strong><small>{[item.variantLabel, `Cantidad ${item.quantity} × ${formatArs(item.unitPriceArs)}`].filter(Boolean).join(" · ")}</small></div><b>{formatArs(item.quantity * item.unitPriceArs)}</b>
          </article>;
        })}
        <div className="order-total"><p><span>Subtotal</span><b>{formatArs(order.subtotalArs)}</b></p>{order.discountArs > 0 ? <p><span>Cupón {order.couponCode}</span><b>− {formatArs(order.discountArs)}</b></p> : null}<p><span>Entrega</span><b>{formatArs(order.shippingArs)}</b></p><p><strong>Total</strong><strong>{formatArs(order.totalArs)}</strong></p></div>
      </section><aside className="next-steps"><h2>Próximos pasos</h2>
        {steps ? <ol className="order-steps">{steps.map((step) => <li key={step.title} className={`is-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
          <span aria-hidden="true">{step.state === "done" ? <Check size={14} strokeWidth={2.5}/> : step.number}</span>
          <div><strong>{step.title}</strong><small>{step.copy}</small></div>
        </li>)}</ol> : <p>Este pedido no seguirá a preparación. Podés volver al catálogo para iniciar una nueva compra.</p>}
        {pending && order.paymentMethod === "transfer" ? <div className="transfer-details">{order.bankDetails ? <dl><dt>CBU / Alias</dt><dd>{order.bankDetails.account}</dd><dt>Titular</dt><dd>{order.bankDetails.holder}</dd><dt>CUIT</dt><dd>{order.bankDetails.taxId}</dd></dl> : <p>Datos bancarios pendientes de configuración. No hagas una transferencia para este pedido de prueba.</p>}</div> : null}
        {pending && payment?.ticketUrl ? <a className="button button--outline" href={payment.ticketUrl} target="_blank" rel="noopener noreferrer">Ver cupón de pago</a> : null}
        <p className="help-order"><Info aria-hidden="true" size={18}/><span>Guardá el número <strong>{code}</strong> para consultar por tu pedido.</span></p>
      </aside></div>
      {order.isDemo && demoEnabled ? <DemoPayment orderId={order.id} status={order.status}/> : null}
      {!order.isDemo && pending && order.paymentMethod === "mercadopago" && !payment?.providerId && ["debit_card", "credit_card"].includes(order.paymentChoice) ? <MercadoPagoPayment orderId={order.id} paymentChoice={order.paymentChoice as "debit_card" | "credit_card"} accessToken={accessToken}/> : null}
      {!order.isDemo && pending && order.paymentMethod === "mercadopago" && !payment?.providerId && ["mercadopago", "mercado_credito"].includes(order.paymentChoice) ? <MercadoPagoRedirect orderId={order.id} accessToken={accessToken} returnedPaymentId={returnedPaymentId}/> : null}
    </div></main></>;
}
