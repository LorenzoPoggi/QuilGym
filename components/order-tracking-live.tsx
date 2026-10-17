"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COURIER_POLL_MS } from "@/lib/tracking-core";
import type { CourierPosition } from "@/lib/tracking";

type Point = { lat: number; lng: number };

/** Leaflet se descarga solo en esta página y solo en el navegador. */
const TrackingMap = dynamic(() => import("./order-tracking-map"), {
  ssr: false,
  loading: () => <div className="tracking-map__canvas tracking-map__placeholder" aria-hidden="true"/>,
});

const ago = (iso: string, now: number) => {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "hace instantes";
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "hace 1 minuto" : `hace ${minutes} minutos`;
};

/**
 * Mapa del pedido. En la entrega propia «En camino» consulta la posición del repartidor cada 15 s (se pausa con la
 * pestaña oculta) y refresca la página cuando cambia el estado del envío.
 */
export function OrderTrackingLive({ orderId, token, store, destination, initialCourier, initialStatus, live }: {
  orderId: string; token: string | null; store: Point; destination: Point | null; initialCourier: CourierPosition | null; initialStatus: string; live: boolean;
}) {
  const router = useRouter();
  const [courier, setCourier] = useState<CourierPosition | null>(initialCourier);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const url = `/api/orders/${orderId}/position${token ? `?t=${encodeURIComponent(token)}` : ""}`;
    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const data = await response.json() as { status: string; position: CourierPosition | null };
        if (cancelled) return;
        setCourier(data.position);
        setNow(Date.now());
        if (data.status !== initialStatus) router.refresh();
      } catch { /* Sin conexión: se reintenta en el próximo ciclo. */ }
    }
    const timer = setInterval(poll, COURIER_POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [initialStatus, live, orderId, router, token]);

  const label = courier ? "Mapa con el local, el repartidor y el destino de tu pedido" : destination ? "Mapa con el local de QuilGym y el destino de tu pedido" : "Mapa con el local de QuilGym";
  return <div className="tracking-map">
    <TrackingMap store={store} destination={destination} courier={courier} label={label}/>
    {live ? <p className="tracking-map__status" role="status" aria-live="polite">{courier ? `Ubicación del repartidor actualizada ${ago(courier.updatedAt, now)}.` : "Esperando la ubicación del repartidor…"}</p> : null}
  </div>;
}
