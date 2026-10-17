"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, LocateFixed, Phone, Wallet } from "lucide-react";
import { confirmOrderPayment, markLocalDelivered, reportCourierPosition } from "@/lib/admin-orders-actions";
import { COURIER_REPORT_MIN_INTERVAL_MS } from "@/lib/tracking-core";
import { formatArs } from "@/lib/commerce";

type Props = {
  orderId: string; code: string; customer: { name: string; phone: string }; addressText: string; notes: string;
  mapsUrl: string | null; eta: string | null; totalArs: number; status: string; cashPending: boolean; canDeliver: boolean;
};
type Sharing = "idle" | "active" | "denied" | "unsupported" | "stopped";

/**
 * Vista de reparto mobile-first. Mientras está abierta y el pedido está «En camino», comparte la ubicación del
 * celular (como mucho cada 10 s). Al tocar «Entregado» deja de compartirla y el servidor borra la última posición.
 */
export function CourierDeliveryView(props: Props) {
  const router = useRouter();
  const onRoute = props.status === "out_for_delivery";
  const [sharing, setSharing] = useState<Sharing>("idle");
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [delivered, setDelivered] = useState(props.status === "delivered");
  const [cashPending, setCashPending] = useState(props.cashPending);
  const [pending, start] = useTransition();
  const lastAttempt = useRef(0);
  // Con efectivo pendiente, «Entregado» se habilita recién después de registrar el cobro.
  const deliverable = !cashPending && (props.canDeliver || props.cashPending);

  useEffect(() => {
    if (!onRoute || delivered) return;
    if (!("geolocation" in navigator)) { queueMicrotask(() => setSharing("unsupported")); return; }
    let stopped = false;
    const watch = navigator.geolocation.watchPosition(async (position) => {
      if (stopped) return;
      setSharing("active");
      setAccuracy(Math.round(position.coords.accuracy));
      if (Date.now() - lastAttempt.current < COURIER_REPORT_MIN_INTERVAL_MS) return;
      lastAttempt.current = Date.now();
      try {
        const result = await reportCourierPosition(props.orderId, { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy });
        if (result.ok) setLastSent(new Date());
        else if (result.stop) { stopped = true; navigator.geolocation.clearWatch(watch); setSharing("stopped"); setMessage(result.error); }
      } catch { /* Sin señal: se reintenta con la próxima lectura. */ }
    }, (error) => setSharing(error.code === error.PERMISSION_DENIED ? "denied" : "idle"), { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 });
    // Mantener la pantalla encendida mejora la frecuencia del GPS. Si el navegador no lo permite, se sigue igual.
    let lock: { release(): Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen").then((value) => { lock = value; }).catch(() => {});
    return () => { stopped = true; navigator.geolocation.clearWatch(watch); void lock?.release().catch(() => {}); };
  }, [delivered, onRoute, props.orderId]);

  const statusText: Record<Sharing, string> = {
    idle: "Buscando tu ubicación…",
    active: lastSent ? `Compartiendo tu ubicación · última actualización ${lastSent.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}${accuracy ? ` (±${accuracy} m)` : ""}` : "Ubicación encontrada, enviando…",
    denied: "El navegador bloqueó la ubicación. Habilitala para este sitio para que el cliente vea el mapa.",
    unsupported: "Este navegador no permite compartir la ubicación.",
    stopped: "Dejamos de compartir tu ubicación.",
  };

  return <div className="courier-view">
    <Link className="courier-view__back" href={`/admin/pedidos/${props.orderId}`}><ArrowLeft size={18} aria-hidden="true"/>Pedido {props.code}</Link>
    <header className="courier-view__head"><p className="admin-eyebrow">REPARTO · ENTREGA PROPIA</p><h1>{props.customer.name}</h1>
      <p className="courier-view__address">{props.addressText}</p>
      {props.eta ? <p className="courier-view__eta"><Clock size={16} aria-hidden="true"/>{props.eta}</p> : null}
      {props.notes ? <p className="courier-view__notes">Indicaciones: {props.notes}</p> : null}
    </header>
    <div className="courier-view__links">
      {props.mapsUrl ? <a className="courier-view__button" href={props.mapsUrl} target="_blank" rel="noreferrer"><ExternalLink size={18} aria-hidden="true"/>Abrir en Google Maps</a> : null}
      <a className="courier-view__button" href={`tel:${props.customer.phone}`}><Phone size={18} aria-hidden="true"/>Llamar al cliente</a>
    </div>
    {onRoute && !delivered ? <p className={`courier-view__sharing is-${sharing}`} role="status" aria-live="polite"><LocateFixed size={18} aria-hidden="true"/>{statusText[sharing]}</p> : null}
    {!onRoute && !delivered ? <p className="courier-view__sharing">El pedido no está «En camino». Volvé al detalle y tocá «Salir a entregar».</p> : null}

    {delivered ? <p className="courier-view__done" role="status"><CheckCircle2 size={22} aria-hidden="true"/>Pedido entregado. Ya no compartimos tu ubicación.</p>
      : onRoute ? <section className="courier-view__deliver" aria-label="Entrega">
        {cashPending ? <div className="courier-view__cash"><p><Wallet size={18} aria-hidden="true"/>Cobrá <strong>{formatArs(props.totalArs)}</strong> en efectivo. El costo de la entrega se arregla aparte, como acordaron.</p>
          <button type="button" className="courier-view__secondary" disabled={pending} onClick={() => start(async () => {
            const result = await confirmOrderPayment(props.orderId);
            setMessage(result.ok ? result.message : result.error);
            if (result.ok) setCashPending(false);
          })}>{pending ? "Guardando…" : "Ya cobré en efectivo"}</button></div> : null}
        {confirming ? <div className="courier-view__confirm"><p>¿Confirmás que entregaste el pedido {props.code}?</p>
          <button type="button" className="courier-view__primary" disabled={pending} onClick={() => start(async () => {
            const result = await markLocalDelivered(props.orderId);
            setMessage(result.ok ? result.message : result.error);
            setConfirming(false);
            if (result.ok) { setDelivered(true); router.refresh(); }
          })}>{pending ? "Guardando…" : "Sí, entregado"}</button>
          <button type="button" className="courier-view__secondary" disabled={pending} onClick={() => setConfirming(false)}>Volver</button></div>
          : <button type="button" className="courier-view__primary" disabled={!deliverable} onClick={() => setConfirming(true)}><CheckCircle2 size={22} aria-hidden="true"/>Entregado</button>}
        {cashPending ? <p className="admin-help">Para marcarlo entregado, primero registrá el cobro.</p> : null}
      </section> : null}
    <p className="admin-order-feedback" role="status" aria-live="polite">{message}</p>
  </div>;
}
