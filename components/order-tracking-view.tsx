import type { orders, shipments } from "@/lib/db/schema";
import Link from "next/link";
import { ArrowLeft, Check, Clock, ExternalLink, MapPin, PackageCheck, Store, Truck } from "lucide-react";
import type { OrderTracking } from "@/lib/tracking";
import { carrierTrackingPage, formatEtaWindow, TRACKING_TIME_ZONE, trackingSteps } from "@/lib/tracking-core";
import { orderStatusLabels } from "@/lib/checkout-types";
import { formatDistance } from "@/lib/delivery-labels";
import { googleMapsSearchUrl } from "@/lib/store-location";
import { OrderTrackingLive } from "@/components/order-tracking-live";
import { Logo } from "@/components/logo";

const headlines: Record<string, string> = {
  pending: "Recibimos tu pedido", preparing: "Estamos preparando tu pedido", ready_for_pickup: "Tu pedido está listo para retirar",
  shipped: "Despachamos tu pedido", out_for_delivery: "Tu pedido está en camino", delivered: "Tu pedido fue entregado",
};
const eventTime = (date: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: TRACKING_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);

/** Seguimiento del pedido: pasos, ventana de llegada, mapa, novedades y datos de entrega. Sin acceso a la base. */
export function OrderTrackingView({ order, shipment, tracking, token }: { order: typeof orders.$inferSelect; shipment: typeof shipments.$inferSelect | null; tracking: OrderTracking; token: string | null }) {
  const code = `QG-${order.id.slice(0, 8).toUpperCase()}`;
  const query = token ? `?t=${encodeURIComponent(token)}` : "";
  const shipmentStatus = shipment?.status ?? "pending";
  const closed = order.status !== "pending" && order.status !== "approved";
  const steps = trackingSteps({ delivery: order.delivery, orderStatus: order.status, paymentMethod: order.paymentMethod, shipmentStatus });
  const eta = tracking.tracking && shipmentStatus !== "delivered" ? formatEtaWindow(tracking.tracking.etaFrom ? new Date(tracking.tracking.etaFrom) : null, tracking.tracking.etaTo ? new Date(tracking.tracking.etaTo) : null) : null;
  const local = order.delivery === "local";
  const live = local && shipmentStatus === "out_for_delivery" && tracking.available;
  const showMap = tracking.available && !closed && (order.delivery === "pickup" || !!tracking.destination || !!tracking.courier);
  const carrierPage = tracking.tracking ? carrierTrackingPage(tracking.tracking.carrier, tracking.tracking.trackingUrl) : null;
  const trackingNumber = shipment?.trackingCode ?? (tracking.tracking?.carrier !== "own" ? tracking.tracking?.carrierShipmentId : null) ?? null;
  const address = order.address;
  const addressText = address ? `${address.street} ${address.number}${address.apartment ? `, ${address.apartment}` : ""}, ${address.city} (${address.postalCode})` : null;
  const headline = closed ? orderStatusLabels[order.status] : order.status === "pending" && order.paymentMethod !== "cash" ? "Tu pedido espera el pago" : headlines[shipmentStatus] ?? headlines.pending;
  const DeliveryIcon = order.delivery === "pickup" ? Store : order.delivery === "local" ? MapPin : Truck;

  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark" aria-label="QuilGym, inicio"><Logo/></Link></div></header>
    <main className="tracking-page"><div className="container">
      <Link className="tracking-back" href={`/checkout/confirmacion/${order.id}${query}`}><ArrowLeft aria-hidden="true" size={17}/>Detalle del pedido</Link>
      <section className={`tracking-hero${shipmentStatus === "delivered" ? " is-delivered" : ""}`}>
        <span className="tracking-hero__icon" aria-hidden="true">{shipmentStatus === "delivered" ? <PackageCheck size={26}/> : <DeliveryIcon size={26}/>}</span>
        <div><p className="eyebrow">Pedido {code}</p><h1>{headline}</h1>
          {eta ? <p className="tracking-eta"><Clock aria-hidden="true" size={17}/>{eta}</p> : null}
          {live ? <p className="tracking-hero__note">Te mostramos la ubicación del repartidor mientras está en camino.</p> : null}
        </div>
      </section>

      {steps ? <ol className="tracking-steps" aria-label="Estado del pedido">{steps.map((step) => <li key={step.key} className={`is-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
        <span aria-hidden="true">{step.state === "done" ? <Check size={15}/> : null}</span><div><strong>{step.title}</strong><small>{step.copy}</small></div>
        <span className="sr-only">{step.state === "done" ? "(completado)" : step.state === "current" ? "(en curso)" : "(pendiente)"}</span>
      </li>)}</ol> : null}

      <div className="tracking-grid">
        <div className="tracking-main">
          {showMap ? <section className="tracking-card tracking-card--map" aria-labelledby="tracking-map-title"><h2 id="tracking-map-title">Mapa</h2>
            <OrderTrackingLive orderId={order.id} token={token} store={tracking.store} destination={order.delivery === "pickup" ? null : tracking.destination}
              initialCourier={tracking.courier} initialStatus={shipmentStatus} live={live}/>
          </section> : null}
          <section className="tracking-card" aria-labelledby="tracking-timeline-title"><h2 id="tracking-timeline-title">Novedades</h2>
            {tracking.events.length ? <ol className="tracking-timeline">{tracking.events.map((event) => <li key={`${event.occurredAt.toISOString()}-${event.description}`}>
              <time dateTime={event.occurredAt.toISOString()}>{eventTime(event.occurredAt)}</time>
              <div><strong>{event.description}</strong>{event.location ? <small>{event.location}</small> : null}</div>
            </li>)}</ol> : <p className="tracking-empty">Todavía no hay novedades del envío. Te avisamos por email en cada cambio.</p>}
          </section>
        </div>
        <aside className="tracking-card tracking-details" aria-labelledby="tracking-details-title"><h2 id="tracking-details-title">Entrega</h2>
          <dl>
            <div><dt>Modalidad</dt><dd>{shipment?.label ?? (order.delivery === "pickup" ? "Retiro en el local" : "Envío a domicilio")}</dd></div>
            {order.delivery === "pickup" ? <div><dt>Dónde</dt><dd>{order.pickupDetails?.address ?? "Local de QuilGym"}{order.pickupDetails?.hours ? <small>{order.pickupDetails.hours}</small> : null}</dd></div>
              : addressText ? <div><dt>Dirección</dt><dd>{addressText}</dd></div> : null}
            {local && tracking.distanceM != null ? <div><dt>Distancia al local</dt><dd>{formatDistance(tracking.distanceM)} aprox.</dd></div> : null}
            {local ? <div><dt>Costo de la entrega</dt><dd>A convenir con QuilGym al llevar tu pedido</dd></div> : null}
            {trackingNumber ? <div><dt>Número de seguimiento</dt><dd><code>{trackingNumber}</code>{carrierPage ? <a href={carrierPage} target="_blank" rel="noopener noreferrer">Seguir en el sitio del Correo<ExternalLink aria-hidden="true" size={14}/><span className="sr-only"> (se abre en otra pestaña)</span></a> : null}</dd></div> : null}
          </dl>
          {order.delivery === "pickup" ? <a className="tracking-maps-link" href={googleMapsSearchUrl(tracking.store)} target="_blank" rel="noopener noreferrer">Cómo llegar al local<ExternalLink aria-hidden="true" size={14}/><span className="sr-only"> (se abre en otra pestaña)</span></a> : null}
        </aside>
      </div>
      {!tracking.available ? <p className="tracking-empty">El seguimiento detallado todavía no está disponible. Te avisamos por email cuando cambie el estado de tu pedido.</p> : null}
    </div></main></>;
}
