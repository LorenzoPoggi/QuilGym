"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { preparePayment } from "@/lib/payment-actions";

/**
 * Pantalla de paso hacia Mercado Pago cuando `/checkout` se vuelve a renderizar con el carrito ya vacío. Normalmente
 * el checkout redirige antes; si a los pocos segundos seguimos acá, se pide la preferencia de nuevo.
 */
export function CheckoutRedirecting({ orderId }: { orderId: string }) {
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await preparePayment(orderId);
        if (cancelled) return;
        if (result.ok && result.data.initPoint) window.location.assign(result.data.initPoint);
        else setError(result.ok ? "No pudimos abrir Mercado Pago." : result.error);
      } catch { if (!cancelled) setError("No pudimos abrir Mercado Pago."); }
    }, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [orderId]);
  return <section className="checkout-card payment-prompt" aria-live="polite">
    <h2>{error ? "Tu pedido está guardado" : "Te llevamos a Mercado Pago…"}</h2>
    <p>{error ? `${error} Podés completar el pago desde tu pedido.` : "Tu pedido ya está registrado. En unos segundos se abre el pago seguro."}</p>
    {error ? <Link className="button button--dark" href={`/checkout/confirmacion/${orderId}`}>Ver mi pedido</Link> : null}
  </section>;
}
