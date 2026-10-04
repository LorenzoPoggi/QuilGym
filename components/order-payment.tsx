"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { simulatePayment } from "@/lib/checkout-actions";
import { payOrder, preparePayment } from "@/lib/payment-actions";
import { canTransition } from "@/lib/order-state";
import type { OrderStatus } from "@/lib/checkout-types";

type Controller = { unmount: () => Promise<void> };
type MercadoPagoConstructor = new (key: string, options: { locale: string }) => {
  bricks: () => { create: (kind: string, container: string, settings: object) => Promise<Controller> };
};

export function DemoPayment({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function simulate(next: OrderStatus) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await simulatePayment(orderId, next);
      if (!result.ok) setError(result.error ?? "No se pudo simular.");
      router.refresh();
    } catch { setError("No pudimos conectar. Intentá nuevamente."); }
    finally { setBusy(false); }
  }
  return <section className="checkout-card demo-payment"><h2>Simular resultado del pago</h2><p>Probá los estados sin ingresar tarjetas ni hacer transferencias. Los cambios se guardan en este pedido de prueba.</p>
    <div className="demo-payment-actions">{([
      ["approved", "Simular pago aprobado"], ["rejected", "Simular rechazo"], ["cancelled", "Simular cancelación"], ["refunded", "Simular reembolso"],
    ] as const).filter(([value]) => value !== status && canTransition(status, value)).map(([value, label]) => <button key={value} type="button" className="button button--outline" disabled={busy} onClick={() => simulate(value)}>{label}</button>)}</div>
    {status === "pending" ? <p>Sin seleccionar un resultado, el pedido permanece pendiente.</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </section>;
}

export function MercadoPagoPayment({ orderId, accessToken }: { orderId: string; accessToken?: string | null }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready || !container.current) return;
    let disposed = false;
    let controller: Controller | undefined;
    // SDK requiere un ID: uno distinto por montaje evita colisiones al desmontar en StrictMode.
    const id = `mp-payment-${crypto.randomUUID()}`;
    container.current.id = id;
    async function mount() {
      try {
        const result = await preparePayment(orderId, accessToken);
        if (disposed) return;
        if (!result.ok) throw new Error(result.error);
        const MercadoPago = (window as unknown as { MercadoPago: MercadoPagoConstructor }).MercadoPago;
        const mp = new MercadoPago(result.data.publicKey, { locale: "es-AR" });
        const brick = await mp.bricks().create("payment", id, {
          initialization: { amount: result.data.amount, preferenceId: result.data.preferenceId, payer: { email: result.data.email } },
          customization: { paymentMethods: { creditCard: "all", debitCard: "all", prepaidCard: "all", ticket: "all", mercadoPago: "all" } },
          callbacks: {
            onReady: () => {},
            onError: () => { if (!disposed) setError("No pudimos cargar el formulario de pago. Recargá para reintentar."); },
            onSubmit: async ({ formData }: { formData: unknown }) => {
              const result = await payOrder(orderId, formData, accessToken);
              if (!result.ok) { setError(result.error ?? "No pudimos procesar el pago."); throw new Error("Payment failed"); }
              router.refresh();
            },
          },
        });
        if (disposed) await brick.unmount(); else controller = brick;
      } catch { if (!disposed) setError("El formulario de pago no está disponible. Recargá para reintentar con este pedido."); }
    }
    void mount();
    return () => { disposed = true; void controller?.unmount(); };
  }, [ready, orderId, accessToken, router]);
  return <section className="checkout-card"><h2>Completá el pago</h2><p>Los datos de tu tarjeta se procesan en Mercado Pago.</p>
    <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setError("No pudimos cargar Mercado Pago.")}/>
    <div ref={container}/>{error ? <p role="alert" className="form-error">{error}</p> : null}
  </section>;
}

export function RefreshOrder({ pending }: { pending: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 15000);
    return () => clearInterval(timer);
  }, [pending, router]);
  return <button type="button" className="button button--outline" onClick={() => router.refresh()}>Actualizar estado</button>;
}
