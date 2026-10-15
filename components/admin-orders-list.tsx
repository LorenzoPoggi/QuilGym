import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { formatArs } from "@/lib/commerce";
import type { AdminOrderList } from "@/lib/admin-orders";
import { ADMIN_ORDERS_PAGE_SIZE, adminOrdersHref, adminOrderStatusLabels, isPaidOnClosedOrder, ORDER_STATUSES, orderCode, paymentChoiceLabels, paymentLabel, shipmentLabel, type AdminOrderFilters } from "@/lib/admin-orders-types";

const dateFormat = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
export const formatAdminDate = (value: Date | string) => dateFormat.format(new Date(value));

export function AdminOrderStatus({ status }: { status: keyof typeof adminOrderStatusLabels }) {
  return <span className={`admin-status admin-order-status--${status}`}>{adminOrderStatusLabels[status]}</span>;
}

export function AdminOrdersView({ data, filters }: { data: AdminOrderList; filters: AdminOrderFilters }) {
  const { rows, total, pages, summary } = data;
  const page = Math.min(filters.page, pages);
  const first = total ? (page - 1) * ADMIN_ORDERS_PAGE_SIZE + 1 : 0;
  const filtered = Boolean(filters.q || filters.status !== "all" || filters.choice !== "all" || filters.kind !== "all" || filters.from || filters.to || filters.alerts);
  return <div className="admin-content admin-orders">
    <header className="admin-page-head"><div><p className="admin-eyebrow">VENTAS</p><h1>Pedidos</h1><p>Confirmá cobros en efectivo o transferencia, prepará envíos y resolvé alertas de pago.</p></div></header>
    {summary.alerts > 0 && <div className="admin-order-alert" role="alert"><AlertTriangle size={20} aria-hidden="true"/><div><strong>{summary.alerts === 1 ? "Hay 1 pago aprobado sobre un pedido cancelado o rechazado" : `Hay ${summary.alerts} pagos aprobados sobre pedidos cancelados o rechazados`}</strong><p>El dinero se cobró pero el pedido no está vigente. Reembolsalo desde Mercado Pago o reactivá el pedido.</p></div><Link href={adminOrdersHref({ alerts: true })}>Ver alertas</Link></div>}
    <div className="admin-stats"><div><span>Esperan confirmar el pago</span><strong>{summary.awaitingPayment}</strong></div><div><span>Para preparar</span><strong>{summary.toPrepare}</strong></div><div className={summary.alerts ? "is-alert" : undefined}><span>Alertas de pago</span><strong>{summary.alerts}</strong></div></div>
    <form className="admin-filters admin-order-filters" action="/admin/pedidos">
      <label className="admin-order-search"><Search size={18} aria-hidden="true"/><input name="q" defaultValue={filters.q} placeholder="Buscar por código, email, nombre o teléfono" aria-label="Buscar pedidos"/></label>
      <select name="estado" defaultValue={filters.status} aria-label="Filtrar por estado"><option value="all">Todos los estados</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{adminOrderStatusLabels[status]}</option>)}</select>
      <select name="medio" defaultValue={filters.choice} aria-label="Filtrar por medio de pago"><option value="all">Todos los medios</option>{Object.entries(paymentChoiceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select name="tipo" defaultValue={filters.kind} aria-label="Filtrar pedidos reales o de prueba"><option value="all">Reales y de prueba</option><option value="real">Solo reales</option><option value="demo">Solo de prueba</option></select>
      <label className="admin-order-date"><span>Desde</span><input type="date" name="desde" defaultValue={filters.from}/></label>
      <label className="admin-order-date"><span>Hasta</span><input type="date" name="hasta" defaultValue={filters.to}/></label>
      {filters.alerts && <input type="hidden" name="alertas" value="1"/>}
      <button type="submit">Filtrar</button>{filtered && <Link className="admin-order-clear" href="/admin/pedidos">Limpiar</Link>}
    </form>
    <p className="admin-order-count" aria-live="polite">{total ? `${first}–${first + rows.length - 1} de ${total} pedidos` : "Sin pedidos"}{filters.alerts ? " · solo alertas de pago" : ""}</p>
    <div className="admin-table-wrap"><table className="admin-table admin-orders-table">
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Pago</th><th>Estado</th><th>Entrega</th><th>Total</th><th><span className="sr-only">Acción</span></th></tr></thead>
      <tbody>{rows.map((row) => { const alert = isPaidOnClosedOrder(row.status, row.paymentStatus); return <tr key={row.id} className={alert ? "is-alert" : undefined}>
        <td data-label="Pedido"><strong className="admin-order-code">{orderCode(row.id)}</strong><small>{formatAdminDate(row.createdAt)}</small></td>
        <td data-label="Cliente"><strong>{row.name}</strong><small>{row.email}</small></td>
        <td data-label="Pago">{paymentLabel(row)}{row.providerId && <small>MP #{row.providerId}</small>}</td>
        <td data-label="Estado"><span className="admin-order-badges"><AdminOrderStatus status={row.status}/>{row.isDemo && <span className="admin-status admin-order-demo">Prueba</span>}{alert && <span className="admin-status admin-order-status--alert"><AlertTriangle size={12} aria-hidden="true"/> Pago aprobado</span>}</span></td>
        <td data-label="Entrega">{row.delivery === "pickup" ? "Retiro" : "Envío"}<small>{shipmentLabel(row.shipmentStatus ?? "pending")}{row.trackingCode ? ` · ${row.trackingCode}` : ""}</small></td>
        <td data-label="Total"><strong>{formatArs(row.totalArs)}</strong><small>{row.units} u.</small></td>
        <td><Link href={`/admin/pedidos/${row.id}`} aria-label={`Ver pedido ${orderCode(row.id)}`}>Ver</Link></td>
      </tr>; })}</tbody>
    </table>{!rows.length && <div className="admin-empty">{filtered ? "No hay pedidos con esos filtros." : "Todavía no hay pedidos."}</div>}</div>
    {pages > 1 && <nav className="admin-pagination" aria-label="Páginas de pedidos">
      {page > 1 ? <Link href={adminOrdersHref({ ...filters, page: page - 1 })} rel="prev"><ChevronLeft size={17} aria-hidden="true"/> Anterior</Link> : <span aria-hidden="true"/>}
      <span>Página {page} de {pages}</span>
      {page < pages ? <Link href={adminOrdersHref({ ...filters, page: page + 1 })} rel="next">Siguiente <ChevronRight size={17} aria-hidden="true"/></Link> : <span aria-hidden="true"/>}
    </nav>}
  </div>;
}
