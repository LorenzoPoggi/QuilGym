"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Ban, CheckCircle2, RotateCcw, Truck, Undo2 } from "lucide-react";
import { cancelAdminOrder, confirmOrderPayment, markOrderRefunded, reactivatePaidOrder, updateOrderShipment, type AdminOrderActionResult } from "@/lib/admin-orders-actions";
import { shipmentStatusLabels, type ShipmentStatus } from "@/lib/admin-orders-types";

type ActionKey = "confirm" | "cancel" | "refund" | "reactivate";
const actions: Record<ActionKey, { label: string; confirm: string; detail: string; run: (id: string) => Promise<AdminOrderActionResult>; danger?: boolean; Icon: typeof Ban }> = {
  confirm: { label: "Confirmar pago recibido", confirm: "Sí, confirmar pago", detail: "Marca el pedido como pagado y le avisa al cliente por email. Hacelo solo después de verificar el cobro.", run: confirmOrderPayment, Icon: CheckCircle2 },
  cancel: { label: "Cancelar pedido", confirm: "Sí, cancelar pedido", detail: "Libera el stock y el cupón reservados y le avisa al cliente. No se puede deshacer.", run: cancelAdminOrder, danger: true, Icon: Ban },
  refund: { label: "Registrar reembolso", confirm: "Sí, registrar reembolso", detail: "Solo deja constancia: no devuelve dinero ni llama a Mercado Pago. Hacé primero la devolución desde Mercado Pago o por el medio original.", run: markOrderRefunded, danger: true, Icon: Undo2 },
  reactivate: { label: "Reactivar como pagado", confirm: "Sí, reactivar pedido", detail: "Vuelve a reservar el stock y el cupón y deja el pedido pagado. Si no hay stock, reembolsá el pago desde Mercado Pago.", run: reactivatePaidOrder, Icon: RotateCcw },
};

function Feedback({ result }: { result: AdminOrderActionResult | null }) {
  return <p className={`admin-order-feedback${result ? result.ok ? " is-ok" : " is-error" : ""}`} role="status" aria-live="polite">{result ? result.ok ? result.message : result.error : ""}</p>;
}

export function AdminOrderActions({ orderId, available, cancelWarning }: { orderId: string; available: ActionKey[]; cancelWarning?: string }) {
  const [selected, setSelected] = useState<ActionKey | null>(null);
  const [result, setResult] = useState<AdminOrderActionResult | null>(null);
  const [pending, start] = useTransition();
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (selected) confirmRef.current?.focus(); }, [selected]);
  if (!available.length) return <Feedback result={result}/>;
  const action = selected ? actions[selected] : null;
  return <div className="admin-order-actions">
    {action ? <div className={`admin-order-confirm${action.danger ? " is-danger" : ""}`} role="group" aria-label={action.label}>
      <strong>{action.label}</strong><p>{action.detail}</p>{selected === "cancel" && cancelWarning && <p className="admin-order-warning">{cancelWarning}</p>}
      <div><button ref={confirmRef} type="button" className="admin-primary" disabled={pending} onClick={() => start(async () => { const next = await action.run(orderId); setResult(next); setSelected(null); })}>{pending ? "Guardando…" : action.confirm}</button><button type="button" className="admin-order-secondary" disabled={pending} onClick={() => setSelected(null)}>Volver</button></div>
    </div> : <div className="admin-order-buttons">{available.map((key) => { const { label, danger, Icon } = actions[key]; return <button key={key} type="button" className={danger ? "admin-order-secondary is-danger" : "admin-primary"} onClick={() => { setResult(null); setSelected(key); }}><Icon size={17} aria-hidden="true"/> {label}</button>; })}</div>}
    <Feedback result={result}/>
  </div>;
}

export function AdminShipmentForm({ orderId, allowed, status, trackingCode, delivery }: { orderId: string; allowed: ShipmentStatus[]; status: string; trackingCode: string | null; delivery: "pickup" | "shipping" }) {
  const [result, setResult] = useState<AdminOrderActionResult | null>(null);
  const [pending, start] = useTransition();
  if (!allowed.length) return <p className="admin-help">El envío se gestiona cuando el pedido esté pagado{delivery === "pickup" ? " o sea en efectivo al retirar" : ""}.</p>;
  return <form className="admin-order-shipment" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); start(async () => setResult(await updateOrderShipment(orderId, { status: data.get("status"), trackingCode: data.get("trackingCode") ?? "" }))); }}>
    <label>Estado del envío<select name="status" defaultValue={allowed.includes(status as ShipmentStatus) ? status : allowed[0]}>{allowed.map((value) => <option key={value} value={value}>{shipmentStatusLabels[value]}</option>)}</select></label>
    {delivery === "shipping" && <label>Código de seguimiento<input name="trackingCode" defaultValue={trackingCode ?? ""} maxLength={80} autoComplete="off" placeholder="Opcional"/></label>}
    <p className="admin-help">{delivery === "pickup" ? "«Listo para retirar» le avisa al cliente por email una sola vez." : "«Enviado» le avisa al cliente por email una sola vez, con el seguimiento si lo cargaste."}</p>
    <button type="submit" className="admin-primary" disabled={pending}><Truck size={17} aria-hidden="true"/> {pending ? "Guardando…" : "Guardar envío"}</button>
    <Feedback result={result}/>
  </form>;
}
