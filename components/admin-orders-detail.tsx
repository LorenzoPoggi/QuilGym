import Link from "next/link";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { formatArs } from "@/lib/commerce";
import type { AdminOrderDetail } from "@/lib/admin-orders";
import { allowedShipmentStatuses, isPaidOnClosedOrder, orderCode, paymentLabel, shipmentLabel } from "@/lib/admin-orders-types";
import { orderStatusLabels } from "@/lib/checkout-types";
import { AdminOrderStatus, formatAdminDate } from "./admin-orders-list";
import { AdminOrderActions, AdminShipmentForm } from "./admin-orders-actions";

const emailLabels: Record<string, string> = { created: "Pedido recibido", ready_for_pickup: "Listo para retirar", shipped: "Pedido despachado", ...orderStatusLabels };
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div><dt>{label}</dt><dd>{children}</dd></div>;

export function AdminOrderDetailView({ detail }: { detail: AdminOrderDetail }) {
  const { order, items, payment, shipment, emails } = detail;
  const alert = isPaidOnClosedOrder(order.status, payment?.status);
  const mismatch = !alert && payment && payment.providerId && payment.status !== order.status;
  const available = alert ? ["reactivate" as const]
    : order.status === "pending" ? [...(order.paymentMethod !== "mercadopago" ? ["confirm" as const] : []), "cancel" as const]
    : order.status === "approved" ? ["refund" as const] : [];
  const cancelWarning = order.paymentMethod === "mercadopago" && payment?.providerId ? `Este pedido tiene un pago iniciado en Mercado Pago (#${payment.providerId}). Si se aprueba después de cancelar, aparecerá como alerta de pago.` : undefined;
  const address = order.address;
  return <div className="admin-content admin-orders admin-order-detail">
    <Link className="admin-back" href="/admin/pedidos"><ArrowLeft size={17} aria-hidden="true"/> Pedidos</Link>
    <header className="admin-page-head"><div><p className="admin-eyebrow">PEDIDO {order.isDemo ? "DE PRUEBA" : ""}</p><h1>{orderCode(order.id)}</h1><p className="admin-order-meta"><AdminOrderStatus status={order.status}/>{order.isDemo && <span className="admin-status admin-order-demo">Prueba · sin cobro</span>}<span>Creado el {formatAdminDate(order.createdAt)}</span></p></div><strong className="admin-order-total">{formatArs(order.totalArs)}</strong></header>
    {alert && payment && <div className="admin-order-alert" role="alert"><AlertTriangle size={20} aria-hidden="true"/><div><strong>Pago aprobado sobre pedido {order.status === "cancelled" ? "cancelado" : "rechazado"}</strong><p>Mercado Pago acreditó {formatArs(order.totalArs)} (pago #{payment.providerId ?? "sin ID"}, actualizado el {payment.providerUpdatedAt ? formatAdminDate(payment.providerUpdatedAt) : "—"}) pero el pedido ya no está vigente{order.resourcesReleasedAt ? " y su stock fue liberado" : ""}. Resolvelo de una de estas formas: reembolsá el pago desde tu cuenta de Mercado Pago (la notificación de reembolso cierra la alerta) o reactivá el pedido si todavía hay stock.</p></div></div>}
    {mismatch && <div className="admin-order-alert is-info" role="status"><AlertTriangle size={20} aria-hidden="true"/><div><strong>El estado de Mercado Pago no coincide con el pedido</strong><p>Mercado Pago informa «{orderStatusLabels[payment.status]}» y el pedido figura como «{orderStatusLabels[order.status]}». Revisá el pago #{payment.providerId} en Mercado Pago.</p></div></div>}
    <div className="admin-editor-grid admin-order-grid">
      <div className="admin-editor-main">
        <section className="admin-card"><h2>Productos</h2><div className="admin-table-wrap admin-order-items"><table className="admin-table"><thead><tr><th>Producto</th><th>SKU</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><Link href={`/productos/${item.slug}`} target="_blank" rel="noreferrer">{item.name}<ExternalLink size={13} aria-label="(abre la ficha en otra pestaña)"/></Link>{item.variantLabel && <small>{item.variantLabel}</small>}{!item.stockReserved && <small>Sin reserva de stock</small>}</td><td>{item.sku}</td><td>{item.quantity}</td><td>{formatArs(item.unitPriceArs)}</td><td>{formatArs(item.unitPriceArs * item.quantity)}</td></tr>)}</tbody></table></div>
          <dl className="admin-order-totals"><Row label="Subtotal">{formatArs(order.subtotalArs)}</Row>{order.discountArs > 0 && <Row label={`Descuento${order.couponCode ? ` (${order.couponCode})` : ""}`}>−{formatArs(order.discountArs)}</Row>}<Row label={order.delivery === "pickup" ? "Retiro" : "Envío"}>{order.shippingArs ? formatArs(order.shippingArs) : "Sin cargo"}</Row><Row label="Total">{formatArs(order.totalArs)}</Row></dl>
        </section>
        <div className="admin-order-pair">
          <section className="admin-card"><h2>Cliente</h2><dl className="admin-order-dl"><Row label="Nombre">{order.name}</Row><Row label="Email"><a href={`mailto:${order.email}`}>{order.email}</a></Row><Row label="Teléfono"><a href={`tel:${order.phone}`}>{order.phone}</a></Row><Row label="Cuenta">{order.userId ? "Pedido hecho con cuenta" : "Invitado"}</Row>{order.notes && <Row label="Notas">{order.notes}</Row>}</dl></section>
          <section className="admin-card"><h2>{order.delivery === "pickup" ? "Retiro en el local" : "Envío a domicilio"}</h2><dl className="admin-order-dl">
            {order.delivery === "pickup" ? <><Row label="Local">{order.pickupDetails?.address ?? "—"}</Row><Row label="Horario">{order.pickupDetails?.hours ?? "—"}</Row></>
              : address ? <><Row label="Dirección">{address.street} {address.number}{address.apartment ? `, ${address.apartment}` : ""}</Row><Row label="Localidad">{address.city}, {address.province} ({address.postalCode})</Row></> : <Row label="Dirección">—</Row>}
            {shipment && <><Row label="Tarifa">{shipment.label}</Row><Row label="Estimación">{shipment.estimate}</Row><Row label="Estado">{shipmentLabel(shipment.status)}</Row>{shipment.trackingCode && <Row label="Seguimiento">{shipment.trackingCode}</Row>}</>}
          </dl></section>
        </div>
        <section className="admin-card"><h2>Emails al cliente</h2>{emails.length ? <ul className="admin-order-emails">{emails.map((email) => <li key={email.id}><strong>{emailLabels[email.event] ?? email.event}</strong><span>{email.sentAt ? `Enviado el ${formatAdminDate(email.sentAt)}` : email.attempts ? `Pendiente · ${email.attempts} intento${email.attempts === 1 ? "" : "s"}` : "En cola"}</span></li>)}</ul> : <p className="admin-help">{order.isDemo ? "Los pedidos de prueba no envían emails." : "Sin emails en la cola."}</p>}</section>
      </div>
      <aside className="admin-editor-side admin-order-side">
        <section className="admin-card"><h2>Pago</h2><dl className="admin-order-dl"><Row label="Medio">{paymentLabel(order)}</Row><Row label="Estado del pago">{payment ? orderStatusLabels[payment.status] : "—"}</Row>{payment?.providerId && <Row label="ID en Mercado Pago">{payment.providerId}</Row>}{payment?.preferenceId && <Row label="Preferencia">{payment.preferenceId}</Row>}{payment?.providerUpdatedAt && <Row label="Última novedad">{formatAdminDate(payment.providerUpdatedAt)}</Row>}{payment?.ticketUrl && <Row label="Comprobante"><a href={payment.ticketUrl} target="_blank" rel="noreferrer">Ver ticket</a></Row>}{order.bankDetails && <Row label="Cuenta informada">{order.bankDetails.account}</Row>}</dl>
          <AdminOrderActions orderId={order.id} available={available} cancelWarning={cancelWarning}/></section>
        <section className="admin-card"><h2>Envío</h2><AdminShipmentForm orderId={order.id} allowed={allowedShipmentStatuses(order)} status={shipment?.status ?? "pending"} trackingCode={shipment?.trackingCode ?? null} delivery={order.delivery}/></section>
        <section className="admin-card admin-order-times"><h2>Registro</h2><dl className="admin-order-dl"><Row label="Creado">{formatAdminDate(order.createdAt)}</Row><Row label="Última actualización">{formatAdminDate(order.updatedAt)}</Row><Row label="Consentimiento">{formatAdminDate(order.consentAt)}</Row>{order.resourcesReleasedAt && <Row label="Stock liberado">{formatAdminDate(order.resourcesReleasedAt)}</Row>}{shipment && <Row label="Envío actualizado">{formatAdminDate(shipment.updatedAt)}</Row>}<Row label="ID completo"><code>{order.id}</code></Row></dl></section>
      </aside>
    </div>
  </div>;
}
