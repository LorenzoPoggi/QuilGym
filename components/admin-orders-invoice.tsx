"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, FileCheck2, RotateCcw } from "lucide-react";
import { prepareOrderInvoice, registerOrderInvoice, retryOrderInvoice, type AdminOrderActionResult } from "@/lib/admin-orders-actions";
import { formatArs } from "@/lib/commerce";
import type { AdminOrderDetail } from "@/lib/admin-orders";

type Billing = AdminOrderDetail["billing"];
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div><dt>{label}</dt><dd>{children}</dd></div>;
const providerLabels: Record<string, string> = { manual: "Manual (Comprobantes en línea)", tusfacturas: "TusFacturas (API)" };
const day = (date: Date | string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(date));
const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const voucherLabel = (type: string | null, pos: number | null, number: number | null) =>
  `Factura ${type ?? "?"} ${pos ? String(pos).padStart(5, "0") : "?????"}-${number ? String(number).padStart(8, "0") : "????????"}`;

function Feedback({ result }: { result: AdminOrderActionResult | null }) {
  return <p className={`admin-order-feedback${result ? result.ok ? " is-ok" : " is-error" : ""}`} role="status" aria-live="polite">{result ? result.ok ? result.message : result.error : ""}</p>;
}

/** Factura del pedido: estado, datos para emitirla en ARCA y registro manual de número/CAE. */
export function AdminOrderInvoice({ orderId, orderStatus, billing }: { orderId: string; orderStatus: string; billing: Billing }) {
  const [result, setResult] = useState<AdminOrderActionResult | null>(null);
  const [pending, start] = useTransition();
  const { invoice, draft, settings } = billing;
  if (!billing.available) {
    return <section className="admin-card"><h2>Factura</h2><p className="admin-help">{billing.reason === "demo" ? "Los pedidos de prueba no se facturan."
      : "La facturación todavía no está habilitada en esta base: falta aplicar la migración 0008_invoices. Mientras tanto, facturá desde «Comprobantes en línea» de ARCA."}</p></section>;
  }
  const billable = orderStatus === "approved" || orderStatus === "refunded";
  const run = (action: () => Promise<AdminOrderActionResult>) => start(async () => setResult(await action()));
  const suggestedType = invoice?.voucherType ?? settings.voucherType;
  const receiver = invoice && invoice.receiverDocType !== "CF" ? `${invoice.receiverDocType} ${invoice.receiverDocNumber}${invoice.receiverName ? ` · ${invoice.receiverName}` : ""}` : "Consumidor final";
  return <section className="admin-card admin-order-invoice" aria-labelledby="invoice-title"><h2 id="invoice-title">Factura</h2>
    {settings.issues.map((issue) => <div className="admin-order-alert is-info" role="status" key={issue}><AlertTriangle size={20} aria-hidden="true"/><div><p>{issue}</p></div></div>)}
    {!billable ? <p className="admin-help">Se factura cuando el pago esté aprobado.{invoice && invoice.receiverDocType !== "CF" ? ` El cliente informó ${receiver} para la factura.` : ""}</p> : null}

    {billable && invoice?.status === "issued" ? <>
      <dl className="admin-order-dl">
        <Row label="Comprobante">{voucherLabel(invoice.voucherType, invoice.pointOfSale, invoice.number)}</Row>
        <Row label="CAE">{invoice.cae}</Row>
        {invoice.caeDueDate ? <Row label="Vto. CAE">{invoice.caeDueDate.split("-").reverse().join("/")}</Row> : null}
        {invoice.issuedAt ? <Row label="Fecha">{day(invoice.issuedAt)}</Row> : null}
        <Row label="Receptor">{receiver}</Row>
        <Row label="Emitida por">{providerLabels[invoice.provider] ?? invoice.provider}{invoice.registeredBy ? ` · ${invoice.registeredBy}` : ""}</Row>
        {invoice.pdfUrl ? <Row label="PDF"><a href={invoice.pdfUrl} target="_blank" rel="noreferrer">Ver factura</a></Row> : null}
      </dl>
      {orderStatus === "refunded" ? <p className="admin-order-warning">El pedido se reembolsó: emití una nota de crédito asociada a esta factura en ARCA o en el proveedor.</p> : null}
    </> : null}

    {billable && invoice?.status === "processing" ? <div className="admin-order-alert is-info" role="status"><AlertTriangle size={20} aria-hidden="true"/><div><strong>Emitiendo con el proveedor</strong><p>Si este estado no cambia en unos minutos, revisá en el panel del proveedor si el comprobante se emitió y registralo a mano.</p></div></div> : null}
    {billable && invoice?.status === "failed" ? <div className="admin-order-alert" role="alert"><AlertTriangle size={20} aria-hidden="true"/><div><strong>No se pudo emitir la factura</strong><p>{invoice.error ?? "Sin detalle."}</p></div></div> : null}
    {billable && invoice?.status === "failed" && settings.provider !== "manual" ? <button type="button" className="admin-order-secondary" disabled={pending} onClick={() => run(() => retryOrderInvoice(orderId))}><RotateCcw size={17} aria-hidden="true"/> Reintentar con el proveedor</button> : null}
    {billable && !invoice && settings.provider !== "manual" && orderStatus === "approved" ? <button type="button" className="admin-primary" disabled={pending} onClick={() => run(() => prepareOrderInvoice(orderId))}><FileCheck2 size={17} aria-hidden="true"/> Emitir con {providerLabels[settings.provider]}</button> : null}

    {billable && draft && invoice?.status !== "issued" && invoice?.status !== "processing" ? <>
      <h3 className="admin-invoice-subtitle">Datos para facturar en «Comprobantes en línea»</h3>
      <dl className="admin-order-dl">
        <Row label="Tipo">{suggestedType ? `Factura ${suggestedType}` : "Definir con el contador (falta la condición fiscal en lib/commerce.ts)"}</Row>
        <Row label="Punto de venta">{settings.pointOfSale ?? "Falta INVOICE_POINT_OF_SALE"}</Row>
        <Row label="Concepto">Productos</Row>
        <Row label="Receptor">{receiver}</Row>
        <Row label="Condición de venta">{draft.paymentLabel}</Row>
        {draft.items.map((item) => <Row key={item.code + item.description} label={`${item.quantity} ×`}>{item.description} — {formatArs(item.unitPriceArs)} c/u</Row>)}
        {draft.discountArs > 0 ? <Row label="Bonificación">−{formatArs(draft.discountArs)}</Row> : null}
        <Row label="Total">{formatArs(draft.totalArs)}</Row>
      </dl>
      <p className="admin-help">Precios finales con impuestos incluidos. En factura A/B el sistema de ARCA discrimina el IVA según la alícuota que indiques.</p>
      <form className="admin-order-shipment admin-invoice-form" onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        run(() => registerOrderInvoice(orderId, data));
      }}>
        <div className="admin-form-row">
          <label>Tipo<select name="voucherType" defaultValue={suggestedType ?? ""} required><option value="" disabled>Elegí</option><option value="A">Factura A</option><option value="B">Factura B</option><option value="C">Factura C</option></select></label>
          <label>Punto de venta<input name="pointOfSale" inputMode="numeric" defaultValue={settings.pointOfSale ?? ""} required maxLength={5}/></label>
        </div>
        <div className="admin-form-row">
          <label>Número<input name="number" inputMode="numeric" required maxLength={8} autoComplete="off"/></label>
          <label>Fecha<input name="issuedAt" type="date" defaultValue={isoToday()} required/></label>
        </div>
        <div className="admin-form-row">
          <label>CAE<input name="cae" inputMode="numeric" required maxLength={14} autoComplete="off"/></label>
          <label>Vto. CAE<input name="caeDueDate" type="date" required/></label>
        </div>
        <label>Enlace al PDF (opcional)<input name="pdfUrl" type="url" placeholder="https://…" autoComplete="off"/></label>
        <p className="admin-help">Al registrarla le enviamos al cliente un email con los datos de la factura{settings.provider === "manual" ? " (y el PDF si cargás el enlace)" : ""}.</p>
        <button type="submit" className="admin-primary" disabled={pending}><FileCheck2 size={17} aria-hidden="true"/> {pending ? "Guardando…" : "Registrar factura"}</button>
      </form>
    </> : null}
    <Feedback result={result}/>
  </section>;
}
