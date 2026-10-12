"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { simulatePayment } from "@/lib/checkout-actions";
import { payOrder, prepareCardPayment, preparePayment, verifyReturnedPayment } from "@/lib/payment-actions";
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

type CardChoice = "debit_card" | "credit_card";
type CardMessage = { kind: "error" | "pending" | "success"; text: string };
type Challenge = { paymentId: string; externalResourceUrl: string; creq: string };

/**
 * Card Payment Brick de Mercado Pago (el SDK se carga solo acá). Restringe el formulario al tipo elegido
 * (débito o crédito), tope de cuotas fijado por el servidor (débito = 1). Tras un rechazo vuelve a montar un
 * formulario limpio para reintentar con otra tarjeta; si el banco pide 3-D Secure, muestra el desafío con el
 * Status Screen Brick. El estado final siempre lo confirma el servidor consultando a Mercado Pago.
 */
export function MercadoPagoPayment({ orderId, paymentChoice, accessToken, lastAttemptFailed = false, inReview = false, onPaid }: { orderId: string; paymentChoice: CardChoice; accessToken?: string | null; lastAttemptFailed?: boolean; inReview?: boolean; onPaid?: () => void | Promise<void> }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [preparedTestMode, setPreparedTestMode] = useState(false);
  const [message, setMessage] = useState<CardMessage | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [verifying, setVerifying] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const statusContainer = useRef<HTMLDivElement>(null);
  const onPaidRef = useRef(onPaid);
  const publicKeyRef = useRef<string | null>(null);
  useEffect(() => { onPaidRef.current = onPaid; }, [onPaid]);

  useEffect(() => {
    // Con un pago en proceso no se ofrece pagar de nuevo (salvo que el desafío 3DS siga abierto en esta pestaña).
    if (!ready || challenge || inReview || !container.current) return;
    let disposed = false;
    let controller: Controller | undefined;
    // SDK requiere un ID: uno distinto por montaje evita colisiones al desmontar en StrictMode o al reintentar.
    const id = `mp-card-${crypto.randomUUID()}`;
    container.current.id = id;
    async function mount() {
      try {
        setLoading(true);
        const prepared = await prepareCardPayment(orderId, accessToken);
        if (disposed) return;
        if (!prepared.ok) { setMessage({ kind: "error", text: prepared.error }); setLoading(false); return; }
        setPreparedTestMode(prepared.data.testMode);
        publicKeyRef.current = prepared.data.publicKey;
        const MercadoPago = (window as unknown as { MercadoPago: MercadoPagoConstructor }).MercadoPago;
        const mp = new MercadoPago(prepared.data.publicKey, { locale: "es-AR" });
        const brick = await mp.bricks().create("cardPayment", id, {
          initialization: { amount: prepared.data.amount, payer: { email: prepared.data.email } },
          customization: {
            // El Brick configura los tipos por exclusión (doc. «Personalización de comportamiento del Card Payment»).
            paymentMethods: { types: { excluded: prepared.data.excludedTypes }, minInstallments: 1, maxInstallments: prepared.data.maxInstallments },
            visual: { style: { theme: "default" }, hidePaymentButton: false },
          },
          callbacks: {
            onReady: () => { if (!disposed) setLoading(false); },
            onError: () => { if (!disposed) { setLoading(false); setMessage({ kind: "error", text: "No pudimos cargar el formulario de pago. Recargá la página para reintentar con este pedido." }); } },
            onSubmit: async (formData: unknown, additionalData: unknown) => {
              setMessage(null);
              const result = await payOrder(orderId, { formData, additionalData }, accessToken);
              if (!result.ok) { setMessage({ kind: "error", text: result.error }); throw new Error("Payment not accepted"); }
              if (result.outcome === "approved") {
                setMessage({ kind: "success", text: result.message });
                if (onPaidRef.current) await onPaidRef.current();
                else router.refresh();
                return;
              }
              if (result.outcome === "pending" && result.challenge) {
                setChallenge({ paymentId: result.paymentId, ...result.challenge });
                setMessage({ kind: "pending", text: result.message });
                return;
              }
              if (result.outcome === "pending") { setMessage({ kind: "pending", text: result.message }); router.refresh(); return; }
              // Rechazo: el token ya se usó. Se monta un formulario nuevo para intentar con otra tarjeta.
              setMessage({ kind: "error", text: result.message });
              setAttempt((value) => value + 1);
              router.refresh();
            },
          },
        });
        if (disposed) await brick.unmount(); else controller = brick;
      } catch { if (!disposed) { setLoading(false); setMessage({ kind: "error", text: "El formulario de pago no está disponible. Recargá para reintentar con este pedido." }); } }
    }
    void mount();
    return () => { disposed = true; controller?.unmount().catch(() => {}); };
  }, [ready, attempt, challenge, inReview, orderId, accessToken, router]);

  useEffect(() => {
    if (!ready || !challenge || !statusContainer.current) return;
    let disposed = false;
    let controller: Controller | undefined;
    const id = `mp-status-${crypto.randomUUID()}`;
    statusContainer.current.id = id;
    async function mount() {
      try {
        const publicKey = publicKeyRef.current;
        if (disposed || !publicKey || !challenge) return;
        const MercadoPago = (window as unknown as { MercadoPago: MercadoPagoConstructor }).MercadoPago;
        const brick = await new MercadoPago(publicKey, { locale: "es-AR" }).bricks().create("statusScreen", id, {
          // Mercado Pago rechaza el pago si el desafío no empieza dentro de los 30 segundos.
          initialization: { paymentId: challenge.paymentId, additionalInfo: { externalResourceURL: challenge.externalResourceUrl, creq: challenge.creq } },
          callbacks: { onReady: () => {}, onError: () => { if (!disposed) setMessage({ kind: "error", text: "No pudimos abrir la verificación del banco. Tocá «Ya completé la verificación» para ver el estado del pago." }); } },
        });
        if (disposed) await brick.unmount(); else controller = brick;
      } catch { if (!disposed) setMessage({ kind: "error", text: "No pudimos abrir la verificación del banco. Tocá «Ya completé la verificación» para ver el estado del pago." }); }
    }
    void mount();
    return () => { disposed = true; controller?.unmount().catch(() => {}); };
  }, [ready, challenge]);

  async function verifyChallenge() {
    if (!challenge || verifying) return;
    setVerifying(true);
    try {
      const result = await verifyReturnedPayment(orderId, challenge.paymentId, accessToken);
      if (!result.ok) setMessage({ kind: "error", text: result.error });
      else { setChallenge(null); setAttempt((value) => value + 1); setMessage(null); }
      router.refresh();
    } catch { setMessage({ kind: "error", text: "No pudimos verificar el pago todavía. No vuelvas a pagar; actualizá el estado en unos minutos." }); }
    finally { setVerifying(false); }
  }

  const label = paymentChoice === "debit_card" ? "tarjeta de débito" : "tarjeta de crédito";
  return <section className="checkout-card card-payment" id="pago" aria-labelledby="card-payment-title">
    <h2 id="card-payment-title">{inReview && !challenge ? "Estamos verificando tu pago" : `Pagá con ${label}`}</h2>
    <p>{paymentChoice === "debit_card" ? "Se debita en un solo pago." : "Elegí las cuotas en el formulario: las cuotas con interés las define tu tarjeta y se muestran antes de confirmar."} Los datos de la tarjeta los procesa Mercado Pago; QuilGym no los ve ni los guarda.</p>
    {preparedTestMode ? <p className="card-payment__test-help" role="note"><strong>Pago de prueba:</strong> para aprobarlo escribí <strong>APRO</strong> en mayúsculas como titular y usá DNI 12345678.</p> : null}
    {lastAttemptFailed && !message ? <p className="card-payment__notice" role="status">Tu último intento de pago fue rechazado y no se cobró nada. Podés reintentar con otra tarjeta.</p> : null}
    {message ? <p className={`card-payment__message is-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p> : null}
    <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => { setLoading(false); setMessage({ kind: "error", text: "No pudimos cargar Mercado Pago. Revisá tu conexión y recargá la página." }); }}/>
    {challenge ? <div className="card-payment__challenge">
      <div ref={statusContainer}/>
      <button type="button" className="button button--outline" disabled={verifying} onClick={() => { void verifyChallenge(); }}>{verifying ? "Verificando…" : "Ya completé la verificación"}</button>
    </div> : inReview ? message ? null : <p className="card-payment__message is-pending" role="status">Mercado Pago está procesando el pago. Te avisamos por email cuando se acredite. No vuelvas a pagar este pedido.</p> : <>
      {loading ? <p className="card-payment__loading" aria-live="polite">Cargando el formulario seguro…</p> : null}
      <div ref={container} key={attempt}/>
    </>}
  </section>;
}

export function MercadoPagoRedirect({ orderId, accessToken, returnedPaymentId, lastAttemptFailed = false }: { orderId: string; accessToken?: string | null; returnedPaymentId?: string | null; lastAttemptFailed?: boolean }) {
  const router = useRouter();
  const attemptedReturn = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(Boolean(returnedPaymentId));
  const checkPayment = useCallback(async () => {
    if (!returnedPaymentId) return;
    setVerifying(true);
    setError("");
    try {
      const result = await verifyReturnedPayment(orderId, returnedPaymentId, accessToken);
      if (!result.ok) setError(result.error);
      router.refresh();
    } catch {
      setError("No pudimos verificar este pago todavía. No vuelvas a pagarlo; actualizá el estado más tarde.");
    } finally { setVerifying(false); }
  }, [orderId, returnedPaymentId, accessToken, router]);
  useEffect(() => {
    if (!returnedPaymentId || attemptedReturn.current === returnedPaymentId) return;
    attemptedReturn.current = returnedPaymentId;
    void checkPayment();
  }, [returnedPaymentId, checkPayment]);
  async function redirect() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await preparePayment(orderId, accessToken);
      if (!result.ok || !result.data.initPoint) throw new Error("Pago no disponible.");
      window.location.assign(result.data.initPoint);
    } catch { setBusy(false); setError("No pudimos abrir Mercado Pago. Intentá nuevamente."); }
  }
  return <section className="checkout-card demo-payment" id="pago"><h2>{returnedPaymentId ? "Verificamos tu pago" : lastAttemptFailed ? "Reintentá el pago" : "Continuá el pago"}</h2><p>{returnedPaymentId ? "Mercado Pago registró una operación. No vuelvas a pagar mientras comprobamos su estado." : lastAttemptFailed ? "Tu último intento de pago fue rechazado y no se cobró nada. Podés volver a Mercado Pago y probar con otro medio." : "Mercado Pago todavía no confirmó el pago. Podés volver al checkout seguro para completarlo."}</p>
    {returnedPaymentId ? <button className="button button--outline" type="button" disabled={verifying} onClick={() => { void checkPayment(); }}>{verifying ? "Verificando pago…" : "Verificar pago otra vez"}</button>
      : <button className="button button--dark" type="button" disabled={busy} onClick={() => { void redirect(); }}>{busy ? "Abriendo Mercado Pago…" : "Ir a pagar"}</button>}
    {error ? <p role="alert" className="form-error">{error}</p> : null}
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
