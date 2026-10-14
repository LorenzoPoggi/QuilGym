import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CardPaymentFlow } from "@/components/card-payment-flow";
import { Logo } from "@/components/logo";
import { RefreshOrder } from "@/components/order-payment";
import { formatArs } from "@/lib/commerce";
import { orderDetails } from "@/lib/order-service";

export const metadata: Metadata = { title: "Pago con tarjeta | QuilGym", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function CardPaymentPage({ params, searchParams }: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { orderId } = await params;
  const { t } = await searchParams;
  const accessToken = typeof t === "string" ? t : null;
  const details = await orderDetails(orderId, accessToken);
  if (!details) notFound();

  const { order, payment } = details;
  const confirmationHref = `/checkout/confirmacion/${order.id}${accessToken ? `?t=${encodeURIComponent(accessToken)}` : ""}`;
  const cardChoice = order.paymentChoice === "debit_card" || order.paymentChoice === "credit_card" ? order.paymentChoice : null;
  if (order.isDemo || order.paymentMethod !== "mercadopago" || !cardChoice || order.status !== "pending") redirect(confirmationHref);

  const inReview = Boolean(payment?.providerId && payment.status === "pending");
  const lastAttemptFailed = Boolean(payment?.providerId && (payment.status === "rejected" || payment.status === "cancelled"));
  const code = `QG-${order.id.slice(0, 8).toUpperCase()}`;

  return <>
    <header className="checkout-header"><div className="container"><Link href="/" className="wordmark" aria-label="QuilGym, inicio"><Logo/></Link></div></header>
    <main className="card-payment-page"><div className="container">
      <div className="card-payment-page__heading">
        <p className="eyebrow">PAGO SEGURO · {code}</p>
        <h1>{inReview ? "Estamos verificando tu pago" : "Completá tu pago"}</h1>
        <p>{inReview ? "Mercado Pago está procesando la operación. No vuelvas a pagar este pedido." : `Pagá ${formatArs(order.totalArs)} con tu tarjeta. Después vas a poder seguir el estado del pedido.`}</p>
      </div>
      {inReview
        ? <section className="checkout-card card-payment" role="status"><h2>Pago en proceso</h2><p>Te avisaremos por email cuando se acredite. Podés actualizar el estado sin volver a ingresar tu tarjeta.</p><RefreshOrder pending/><Link className="button button--outline" href={confirmationHref}>Ver mi pedido</Link></section>
        : <CardPaymentFlow orderId={order.id} paymentChoice={cardChoice} accessToken={accessToken} confirmationHref={confirmationHref} lastAttemptFailed={lastAttemptFailed}/>}
    </div></main>
  </>;
}
