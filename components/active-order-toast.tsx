"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Truck, X } from "lucide-react";
import type { ActiveOrder } from "@/lib/active-order-core";

const DISMISSED_KEY = "qg_active_order_dismissed";
const HIDDEN_PREFIXES = ["/checkout", "/admin", "/pedido"];
/** Al navegar dentro del sitio se vuelve a consultar como mucho una vez por minuto. */
const REFRESH_MS = 60_000;

const isHidden = (pathname: string) => HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
const dismissKey = (order: ActiveOrder) => `${order.id}:${order.status}`;

function readDismissed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-20) : [];
  } catch { return []; }
}

/**
 * Aviso discreto de pedido en curso («Tu pedido QG-XXXX está en camino · llega hoy entre…»). Se oculta en el
 * checkout, el panel y el propio seguimiento. Cerrarlo lo oculta para ese pedido y ese estado: si el estado cambia
 * (por ejemplo, sale a entregar) vuelve a aparecer.
 */
export function ActiveOrderToast() {
  const pathname = usePathname() ?? "/";
  const hidden = isHidden(pathname);
  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const lastFetch = useRef(0);
  const wasHidden = useRef(true);

  useEffect(() => {
    if (hidden) { wasHidden.current = true; return; }
    // Al salir del checkout o del seguimiento se consulta siempre: puede haber un pedido nuevo.
    if (!wasHidden.current && Date.now() - lastFetch.current < REFRESH_MS) return;
    wasHidden.current = false;
    lastFetch.current = Date.now();
    const controller = new AbortController();
    let settled = false;
    fetch("/api/orders/active", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ order: ActiveOrder | null }> : { order: null })
      .then((data) => { settled = true; setDismissed(readDismissed()); setOrder(data.order); })
      .catch(() => { /* Sin conexión o navegación interrumpida: el aviso es opcional. */ });
    // Una consulta cancelada (navegación rápida o doble montaje en desarrollo) no cuenta para el intervalo.
    return () => { controller.abort(); if (!settled) lastFetch.current = 0; };
  }, [hidden, pathname]);

  if (hidden || !order || dismissed.includes(dismissKey(order))) return null;

  function dismiss() {
    if (!order) return;
    const next = [...readDismissed().filter((item) => item !== dismissKey(order)), dismissKey(order)].slice(-20);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* Almacenamiento opcional: se oculta solo en esta visita. */ }
    setDismissed(next);
  }

  return <aside className="active-order-toast" aria-label="Pedido en curso">
    <span className="active-order-toast__icon" aria-hidden="true"><Truck size={20}/></span>
    <div className="active-order-toast__body">
      <strong>{order.title}</strong>
      <span>{order.detail}</span>
      <Link className="active-order-toast__cta" href={order.href}>Ver dónde está<ArrowRight aria-hidden="true" size={16}/></Link>
    </div>
    <button type="button" className="active-order-toast__close" onClick={dismiss} aria-label={`Cerrar el aviso del pedido ${order.code}`}><X aria-hidden="true" size={18}/></button>
  </aside>;
}
