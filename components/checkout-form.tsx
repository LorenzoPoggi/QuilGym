"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CreditCard, Info, LocateFixed, Lock, MapPin, Store, Truck, UserRound } from "lucide-react";
import type { Cart } from "@/lib/cart-types";
import type { CheckoutConfig, CheckoutInput, CheckoutQuote, CheckoutQuoteRequest, DeliveryMethod, PaymentMethod } from "@/lib/checkout-types";
import { getCheckoutQuote, submitCheckout } from "@/lib/checkout-actions";
import { preparePayment } from "@/lib/payment-actions";
import { validateCheckout } from "@/lib/checkout-validation";
import { addressDeliveryAvailable, initialCheckoutChoice, usablePayments, whatsappOrderMessage } from "@/lib/checkout-whatsapp";
import { formatArs, whatsappUrl } from "@/lib/commerce";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";
import { WhatsAppGlyph } from "./icons";
import { AcceptedCards } from "./accepted-cards";
import { InstallmentsLine } from "./product-installments";
import { quilgymMapsUrl } from "@/lib/review-types";
import { storeMapEmbedUrl } from "@/lib/store-location";
import { formatDistance } from "@/lib/delivery-labels";

const flowSteps = [[1, "Datos", UserRound], [2, "Entrega", Truck], [3, "Pago", CreditCard]] as const;
const mapEmbedUrl = storeMapEmbedUrl();
const addressFieldNames = ["street", "streetNumber", "postalCode", "city", "province"] as const;
const checkoutDraftKey = "qg_checkout_draft_v1";
const checkoutFieldNames = ["name", "email", "phone", "street", "streetNumber", "apartment", "postalCode", "city", "province", "notes"] as const;
const checkoutPaymentOptions = ["Mercado Pago", "Mercado Crédito", "Tarjeta de débito", "Tarjeta de crédito", "Efectivo"] as const;

type CheckoutDraft = {
  version: 1;
  cartSignature: string;
  step: 1 | 2 | 3;
  values: Record<string, string>;
  delivery: DeliveryMethod;
  payment: PaymentMethod;
  paymentOption: (typeof checkoutPaymentOptions)[number];
  accepted: boolean;
  /** Opción de entrega cotizada que había elegido (local, tarifa o transportista); se vuelve a cotizar al restaurar. */
  optionId?: string;
};

type QuoteState = { options: CheckoutQuote[]; notice: string };

export function CheckoutForm({ initialCart, config, whatsappOnly = false, initialCustomer = { name: "", email: "" } }: { initialCart: Cart; config: CheckoutConfig; whatsappOnly?: boolean; initialCustomer?: { name: string; email: string } }) {
  const router = useRouter();
  const { cart: liveCart, loaded, acknowledgeChanges, refreshCart } = useCart();
  const cart = loaded ? liveCart : initialCart;
  const initialChoice = initialCheckoutChoice(config);
  const initialDelivery = initialChoice.payment === "transfer" && !config.payments.mercadopago && config.pickup && config.payments.cash ? "pickup" : initialChoice.delivery;
  const initialPayment: PaymentMethod = initialChoice.payment === "transfer"
    ? config.payments.mercadopago ? "mercadopago" : config.payments.cash && initialDelivery === "pickup" ? "cash" : "mercadopago"
    : initialChoice.payment;
  const initialPaymentOption = initialPayment === "cash" ? "Efectivo" : "Mercado Pago";
  const [delivery, setDelivery] = useState<DeliveryMethod>(initialDelivery);
  const [payment, setPayment] = useState<PaymentMethod>(initialPayment);
  const [paymentOption, setPaymentOption] = useState<CheckoutDraft["paymentOption"]>(initialPaymentOption);
  const [values, setValues] = useState<Record<string, string>>({ name: initialCustomer.name, email: initialCustomer.email });
  const [accepted, setAccepted] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  // Opciones cotizadas para la dirección (entrega propia, envío) y aviso del servidor si la entrega propia no aplica.
  const [quoted, setQuoted] = useState<QuoteState>({ options: [], notice: "" });
  // Pista opcional del navegador: solo ayuda al servidor a elegir entre direcciones homónimas; nunca decide.
  const [locationHint, setLocationHint] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [draftReady, setDraftReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const requestKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const quoteVersion = useRef(0);
  const cartSignature = JSON.stringify({
    lines: cart.lines.map((line) => [line.variantId, line.quantity, line.unitPriceArs]),
    coupon: cart.coupon?.code ?? null,
    customer: initialCustomer.email.trim().toLowerCase(),
  });
  const deliveryEnabled = whatsappOnly ? { shipping: true, pickup: true } : { shipping: addressDeliveryAvailable(config), pickup: !!config.pickup };
  // «A domicilio» abarca el envío y la entrega propia; la opción concreta sale de la cotización.
  const deliveryMode: "shipping" | "pickup" = delivery === "pickup" ? "pickup" : "shipping";
  const payments: PaymentMethod[] = whatsappOnly
    ? ["mercadopago", ...(delivery === "pickup" ? ["cash" as const] : [])]
    : usablePayments(config, delivery).filter((method) => method !== "transfer");
  const allowed = deliveryEnabled[deliveryMode] && payments.includes(payment);
  const cartReady = cart.lines.length > 0 && !cart.hasBlockingIssues && !cart.hasPriceChanges;
  // Dejá enviar el intento sin marcar el consentimiento para poder explicar el error junto al checkbox.
  const canSubmit = whatsappOnly
    ? cartReady && allowed && !busy && !quoting
    : quote && cartReady && allowed && !busy && !quoting;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      let draft: CheckoutDraft | null = null;
      try {
        const stored = sessionStorage.getItem(checkoutDraftKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<CheckoutDraft>;
          if (parsed.version === 1 && parsed.cartSignature === cartSignature
            && (parsed.step === 1 || parsed.step === 2 || parsed.step === 3)
            && (parsed.delivery === "pickup" || parsed.delivery === "shipping" || parsed.delivery === "local")
            && (parsed.payment === "cash" || parsed.payment === "mercadopago" || parsed.payment === "transfer")
            && checkoutPaymentOptions.includes(parsed.paymentOption as CheckoutDraft["paymentOption"])
            && parsed.values && typeof parsed.values === "object") {
            draft = parsed as CheckoutDraft;
          } else if (parsed.cartSignature !== cartSignature) sessionStorage.removeItem(checkoutDraftKey);
        }
      } catch { /* El almacenamiento de sesión es opcional. */ }

      if (draft) {
        const restoredValues = Object.fromEntries(checkoutFieldNames.map((name) => [name, typeof draft?.values[name] === "string" ? draft.values[name] : ""]));
        setValues({ name: initialCustomer.name, email: initialCustomer.email, ...restoredValues });
        // La entrega propia solo vale con una cotización vigente: fuera del paso 3 se vuelve a «a domicilio».
        setDelivery(draft.step === 3 || draft.delivery !== "local" ? draft.delivery : "shipping");
        setPayment(draft.payment);
        setPaymentOption(draft.paymentOption);
        setAccepted(draft.accepted === true);
        setStep(draft.step);

        if (draft.step === 3 && !whatsappOnly) {
          setQuoting(true);
          const savedOption = draft.optionId;
          getCheckoutQuote(quoteRequest(draft.delivery, restoredValues, null)).then((result) => {
            if (!active) return;
            if (!result.ok) { setStep(2); if (draft.delivery === "local") setDelivery("shipping"); setError(result.error + " Revisá la entrega para continuar."); return; }
            setQuoted({ options: result.options, notice: result.notice ?? "" });
            const restored = result.options.find((option) => option.optionId === savedOption) ?? (result.options.length === 1 ? result.options[0] : null);
            if (restored && (restored.delivery ?? draft.delivery) === draft.delivery) setQuote(restored);
            else { setStep(2); if (draft.delivery === "local") setDelivery("shipping"); setError("Volvé a elegir cómo recibir tu pedido para continuar."); }
          }).catch(() => {
            if (!active) return;
            setStep(2);
            setError("No pudimos recuperar la cotización. Revisá la entrega para continuar.");
          }).finally(() => { if (active) setQuoting(false); });
        }
      }
      setDraftReady(true);
    });
    return () => { active = false; };
  // Restore once for this cart; later edits are saved by the next effect.
  }, [cartSignature, initialCustomer.email, initialCustomer.name, whatsappOnly]);

  useEffect(() => {
    if (!draftReady) return;
    const draft: CheckoutDraft = { version: 1, cartSignature, step, values, delivery, payment, paymentOption, accepted, optionId: quote?.optionId };
    try { sessionStorage.setItem(checkoutDraftKey, JSON.stringify(draft)); }
    catch { /* El almacenamiento de sesión es opcional. */ }
  }, [accepted, cartSignature, delivery, draftReady, payment, paymentOption, quote?.optionId, step, values]);

  function goTo(next: 1 | 2 | 3) {
    setDirection(next > step ? "forward" : "backward");
    setStep(next);
    setError("");
  }

  function showValidationErrors(nextFields: Record<string, string>, message = "Revisá los campos marcados antes de continuar.") {
    setFields(nextFields);
    const keys = Object.keys(nextFields);
    const customerFields = ["name", "email", "phone"];
    const deliveryFields = ["street", "streetNumber", "postalCode", "city", "province", "notes", "apartment", "delivery"];
    const nextStep: 1 | 2 | 3 = keys.some((key) => customerFields.includes(key))
      ? 1
      : keys.some((key) => deliveryFields.includes(key))
        ? 2
        : 3;
    goTo(nextStep);
    setError(message);
    const firstField = keys[0];
    if (firstField) requestAnimationFrame(() => {
      const control = formRef.current?.elements.namedItem(firstField);
      if (control instanceof HTMLElement && !control.matches(":disabled")) control.focus();
    });
  }

  function invalidateQuote() {
    quoteVersion.current += 1;
    setQuote(null);
    setQuoted({ options: [], notice: "" });
    // La entrega propia depende de la dirección: si cambia, vuelve a «a domicilio» hasta recotizar.
    setDelivery((current) => current === "local" ? "shipping" : current);
  }

  /** Ajusta el medio de pago si el elegido no se puede usar con la nueva entrega (p. ej. efectivo). */
  function syncPayment(nextDelivery: DeliveryMethod) {
    const next: PaymentMethod[] = whatsappOnly
      ? ["mercadopago", ...(nextDelivery === "pickup" ? ["cash" as const] : [])]
      : usablePayments(config, nextDelivery).filter((method) => method !== "transfer");
    if (!next.includes(payment) && next[0]) { setPayment(next[0]); setPaymentOption(next[0] === "cash" ? "Efectivo" : "Mercado Pago"); }
  }

  function selectOption(option: CheckoutQuote) {
    const nextDelivery = option.delivery ?? (delivery === "pickup" ? "pickup" : "shipping");
    setQuote(option);
    setDelivery(nextDelivery);
    syncPayment(nextDelivery);
    setError("");
  }

  function useMyLocation() {
    if (locating) return;
    if (!("geolocation" in navigator)) { setLocationMessage("Tu navegador no permite compartir la ubicación. Completá la dirección y calculá el envío."); return; }
    setLocating(true); setLocationMessage("");
    navigator.geolocation.getCurrentPosition((position) => {
      setLocating(false);
      setLocationHint({ lat: position.coords.latitude, lng: position.coords.longitude });
      invalidateQuote();
      setLocationMessage("Listo. Usamos tu ubicación solo para ubicar tu dirección en el mapa: no la guardamos. Tocá «Calcular envío».");
    }, () => {
      setLocating(false);
      setLocationMessage("No pudimos obtener tu ubicación. Podés seguir con la dirección escrita.");
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 });
  }
  function openWhatsAppInNewTab(message: string) {
    const tab = window.open(whatsappUrl(message), "_blank");
    if (tab) tab.opener = null;
    else setError("El navegador bloqueó la pestaña de WhatsApp. Permití las ventanas emergentes e intentá de nuevo.");
  }

  function askShippingCost() {
    const data = new FormData(formRef.current ?? undefined);
    const postalCode = String(data.get("postalCode") ?? "").trim();
    const street = String(data.get("street") ?? "").trim();
    const streetNumber = String(data.get("streetNumber") ?? "").trim();
    const city = String(data.get("city") ?? "").trim();
    const message = [
      "Hola, quisiera consultar el costo de envío para este carrito:",
      ...cart.lines.filter((line) => line.available).map((line) => `• ${line.quantity} × ${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ""}`),
      `Dirección: ${street} ${streetNumber}, ${city}, CP ${postalCode}`,
      `Subtotal de productos: ${formatArs(cart.totalArs)}`,
      "¿Me confirman el costo y el total con envío?",
    ].join("\n");
    openWhatsAppInNewTab(message);
  }

  function changeDelivery(value: "shipping" | "pickup") {
    invalidateQuote();
    setDelivery(value);
    syncPayment(value);
  }

  /** Cotiza y devuelve la opción elegida (sola si hay una) y cuántas hay; false si falló. El estado se actualiza aparte. */
  async function calculate(): Promise<false | { chosen: CheckoutQuote | null; count: number }> {
    if (!formRef.current || quoting) return false;
    setQuoting(true); setError("");
    const version = ++quoteVersion.current;
    const data = Object.fromEntries(new FormData(formRef.current)) as Record<string, string>;
    try {
      const result = await getCheckoutQuote(quoteRequest(deliveryMode, data, locationHint));
      if (version !== quoteVersion.current) return false;
      if (!result.ok) { setQuote(null); setQuoted({ options: [], notice: result.notice ?? "" }); setError(result.error); return false; }
      setQuoted({ options: result.options, notice: result.notice ?? "" });
      // Con una sola opción se elige sola; con varias, el cliente decide (la entrega propia tiene costo a convenir).
      const keep = result.options.find((option) => option.optionId && option.optionId === quote?.optionId);
      const chosen = keep ?? (result.options.length === 1 ? result.options[0] : null);
      if (chosen) { selectOption(chosen); return { chosen, count: result.options.length }; }
      setQuote(null);
      if (delivery === "local") setDelivery("shipping");
      return { chosen: null, count: result.options.length };
    } catch { setError("No pudimos conectar. Volvé a calcular la entrega."); return false; }
    finally { setQuoting(false); }
  }

  function validateVisibleFields(names: string[]) {
    const form = formRef.current;
    if (!form) return false;
    for (const name of names) {
      const control = form.elements.namedItem(name) as HTMLInputElement | null;
      if (!control?.checkValidity()) {
        control?.reportValidity();
        control?.focus();
        return false;
      }
    }
    setError("");
    return true;
  }

  function continueToDelivery() {
    if (validateVisibleFields(["name", "email", "phone"])) goTo(2);
  }

  async function continueToPayment() {
    if (!deliveryEnabled[deliveryMode]) { setError("Elegí una forma de entrega para continuar."); return; }
    const deliveryFields = deliveryMode === "shipping" ? [...addressFieldNames] : [];
    if (!validateVisibleFields(deliveryFields)) return;
    const canQuote = deliveryMode === "shipping" ? addressDeliveryAvailable(config) : !!config.pickup;
    if (!whatsappOnly || canQuote) {
      // Si ya hay opciones para esta dirección no se recotiza: se usa la elegida.
      let chosen = quote;
      let count = quoted.options.length;
      if (!chosen && !count) {
        const result = await calculate();
        if (!result) return;
        ({ chosen, count } = result);
      }
      if (!chosen) { if (count > 1) setError("Elegí cómo querés recibir tu pedido para continuar."); return; }
    } else setQuote(null);
    goTo(3);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || (!whatsappOnly && !quote) || submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setFields({});
    const data = new FormData(event.currentTarget);
    // La clave evita duplicados; el borrador personal solo vive en sessionStorage durante esta pestaña.
    if (!requestKey.current && !whatsappOnly) {
      try { requestKey.current = sessionStorage.getItem("qg_checkout_key") || crypto.randomUUID(); sessionStorage.setItem("qg_checkout_key", requestKey.current); }
      catch { requestKey.current = crypto.randomUUID(); }
    }
    const paymentChoice: CheckoutInput["paymentChoice"] = paymentOption === "Mercado Crédito" ? "mercado_credito" : paymentOption === "Tarjeta de débito" ? "debit_card" : paymentOption === "Tarjeta de crédito" ? "credit_card" : paymentOption === "Efectivo" ? "cash" : "mercadopago";
    const input = { ...Object.fromEntries(data), delivery, payment, paymentChoice, accepted, quoteToken: quote?.token ?? "whatsapp-coordinated", checkoutKey: requestKey.current ?? crypto.randomUUID() } as CheckoutInput;
    const parsed = validateCheckout(input);
    const invalid = parsed.ok ? needsTaxId && !parsed.value.taxId ? { taxIdNumber: "Ingresá tu DNI o CUIT/CUIL para la factura." } : null : parsed.fields;
    if (invalid) {
      submitting.current = false; setBusy(false);
      showValidationErrors(invalid);
      return;
    }
    if (!parsed.ok) return;
    if (whatsappOnly) {
      const message = whatsappOrderMessage(cart, {
        name: parsed.value.name, email: parsed.value.email, phone: parsed.value.phone,
        delivery: parsed.value.delivery, payment: parsed.value.payment, paymentLabel: paymentOption,
        street: parsed.value.street, streetNumber: parsed.value.streetNumber, apartment: parsed.value.apartment,
        postalCode: parsed.value.postalCode, city: parsed.value.city, province: parsed.value.province,
        notes: parsed.value.notes, shippingLabel: quote?.label, shippingArs: quote?.shippingArs,
      });
      openWhatsAppInNewTab(message);
      setBusy(false); submitting.current = false;
      return;
    }
    try {
      const result = await submitCheckout(parsed.value);
      if (result.ok) {
        try { sessionStorage.removeItem(checkoutDraftKey); } catch { /* Storage opcional. */ }
        try { sessionStorage.removeItem("qg_checkout_key"); } catch { /* Storage opcional. */ }
        await refreshCart();
        // Tarjeta: el formulario seguro tiene su propia pantalla; el pedido queda para seguimiento.
        if (!config.demo && ["debit_card", "credit_card"].includes(parsed.value.paymentChoice)) {
          router.push(`/checkout/pago/${result.orderId}`);
          return;
        }
        if (!config.demo && ["mercadopago", "mercado_credito"].includes(parsed.value.paymentChoice)) {
          const destination = await preparePayment(result.orderId);
          if (destination.ok && destination.data.initPoint) { window.location.assign(destination.data.initPoint); return; }
        }
        router.push(`/checkout/confirmacion/${result.orderId}`);
        router.refresh();
      } else {
        if (result.fields && Object.keys(result.fields).length) showValidationErrors(result.fields, result.error);
        else { setFields({}); setError(result.error); }
        invalidateQuote();
      }
    } catch { setError("No pudimos recibir la respuesta. Reintentá: conservamos la clave para evitar duplicar el pedido."); }
    finally { setBusy(false); submitting.current = false; }
  }

  function field(name: string, label: string, options: { required?: boolean; type?: string; autoComplete?: string; maxLength?: number; className?: string; defaultValue?: string; inputMode?: "numeric" } = {}) {
    return <label className={options.className} key={name}>{label}
      <input name={name} type={options.type ?? "text"} required={options.required} autoComplete={options.autoComplete} maxLength={options.maxLength ?? 120} inputMode={options.inputMode} value={values[name] ?? options.defaultValue ?? ""}
        aria-invalid={!!fields[name]} aria-describedby={fields[name] ? `error-${name}` : undefined}
        onChange={(event) => {
          setValues((current) => ({ ...current, [name]: event.target.value }));
          if (fields[name]) setFields((current) => { const next = { ...current }; delete next[name]; return next; });
          if ((addressFieldNames as readonly string[]).includes(name) && (quote || quoted.options.length)) invalidateQuote();
        }}/>
      {fields[name] ? <small className="form-error" id={`error-${name}`}>{fields[name]}</small> : null}
    </label>;
  }

  const total = formatArs(quote?.totalArs ?? cart.totalArs);
  // Facturación: desde el umbral configurado (INVOICE_ID_THRESHOLD_ARS) se pide DNI/CUIT; null = nunca.
  const needsTaxId = !whatsappOnly && !config.demo && typeof config.taxIdThresholdArs === "number" && (quote?.totalArs ?? cart.totalArs) >= config.taxIdThresholdArs;
  const checkoutActionLabel = busy ? payment === "cash" ? "Preparando pedido…" : "Abriendo pago…" : payment === "cash" ? `Preparar pedido · ${total}` : `Ir a pagar · ${total}`;
  // Líneas y totales compartidos por el resumen lateral y el desplegable mobile.
  const summaryItems = cart.lines.map((line) => <article key={line.variantId}><div className="checkout-line-thumb"><ProductImage product={line} sizes="64px" decorative/><span aria-hidden="true">{line.quantity}</span></div><div><strong>{line.name}</strong><small>{line.quantity} × {formatArs(line.unitPriceArs)}</small></div><b>{line.available ? formatArs(line.lineTotalArs) : "Sin stock"}</b></article>);
  const summaryTotals = <><p><span>Subtotal</span><strong>{formatArs(cart.subtotalArs)}</strong></p>
    {cart.coupon ? <p><span>Cupón {cart.coupon.code}</span><strong>− {formatArs(cart.discountArs)}</strong></p> : null}
    <p><span>Entrega</span><strong className={quote ? undefined : "is-muted"}>{quote ? quote.delivery === "local" ? "A convenir" : formatArs(quote.shippingArs) : whatsappOnly ? "A coordinar" : "A confirmar"}</strong></p>
    <div><span>Total</span><strong>{total}</strong></div></>;

  return <>
    {whatsappOnly || config.demo ? <div className="checkout-demo-banner checkout-whatsapp-banner" role="note"><strong>La compra online se habilita pronto</strong><span>Mientras tanto, mandanos el pedido por WhatsApp y te confirmamos stock, forma de pago y entrega. No se cobra nada desde la web.</span><a className="button button--whatsapp" href={whatsappUrl(whatsappOrderMessage(cart))} target="_blank" rel="noopener noreferrer"><WhatsAppGlyph/>Pedir por WhatsApp</a><small>Se abre WhatsApp con los productos y el total de tu carrito listos para enviar.</small></div> : null}
    <form className="checkout-layout" ref={formRef} onSubmit={submit} noValidate>
      <div className="checkout-main">
        <details className="checkout-summary-mobile"><summary><span>Ver resumen · <strong>{total}</strong></span><small>{cart.itemCount} {cart.itemCount === 1 ? "producto" : "productos"}</small><ChevronDown aria-hidden="true" size={18}/></summary>
          <div className="checkout-summary-mobile__body">{summaryItems}<div className="summary-lines">{summaryTotals}</div></div>
        </details>
        <nav className="checkout-stepper" aria-label="Etapas de compra">
          {flowSteps.map(([number, label, Icon]) => <div className={`checkout-stepper__item${step === number ? " is-active" : ""}${step > number ? " is-complete" : ""}`} key={number}>
            <button type="button" onClick={() => { if (step > number) goTo(number); }} disabled={step <= number} aria-current={step === number ? "step" : undefined} aria-label={step > number ? `Volver a ${label}` : `${label}, paso ${number}`}><span className="checkout-stepper__icon">{step > number ? <Check aria-hidden="true"/> : <Icon aria-hidden="true"/>}</span><strong>{label}</strong></button>
            <span className="checkout-stepper__track" aria-hidden="true"><i/></span>
          </div>)}
        </nav>
        <section className="checkout-card checkout-step-panel" data-direction={direction} hidden={step !== 1}><header><span>1</span><h2>Tus datos</h2></header>
          <div className="form-grid">
            {field("name", "Nombre y apellido", { required: true, autoComplete: "name", className: "span-4", defaultValue: initialCustomer.name })}
            {field("email", "Email", { required: true, type: "email", autoComplete: "email", maxLength: 254, className: "span-2", defaultValue: initialCustomer.email })}
            {field("phone", "Teléfono", { required: true, type: "tel", autoComplete: "tel", maxLength: 30, className: "span-2" })}
          </div>
          <div className="checkout-step-actions checkout-step-actions--end"><button type="button" className="button button--dark" onClick={continueToDelivery}>Seguir con entrega <ArrowRight aria-hidden="true" size={18}/></button></div>
        </section>
        <section className="checkout-card checkout-step-panel" data-direction={direction} hidden={step !== 2}><header><span>2</span><h2>¿Te lo enviamos o retirás?</h2></header>
          <div className="checkout-choices">
            <label className={deliveryMode === "shipping" && deliveryEnabled.shipping ? "is-active" : ""}><input type="radio" name="delivery-mode" value="shipping" checked={deliveryMode === "shipping" && deliveryEnabled.shipping} disabled={!deliveryEnabled.shipping || busy} onChange={() => changeDelivery("shipping")}/><b aria-hidden="true"><Truck size={18}/></b><span><strong>Envío a domicilio</strong><small>{addressDeliveryAvailable(config) ? config.localDelivery ? `Calculá el costo con tu dirección. Cerca del local (hasta ${config.localDelivery.radiusKm.toLocaleString("es-AR")} km) te lo llevamos nosotros.` : "Calculá el costo con tu dirección." : whatsappOnly ? "El costo se confirma por WhatsApp." : "Envíos aún no disponibles."}</small></span></label>
            <label className={delivery === "pickup" && deliveryEnabled.pickup ? "is-active" : ""}><input type="radio" name="delivery-mode" value="pickup" checked={delivery === "pickup" && deliveryEnabled.pickup} disabled={!deliveryEnabled.pickup || busy} onChange={() => changeDelivery("pickup")}/><b aria-hidden="true"><Store size={18}/></b><span><strong>Retiro en Quilmes</strong><small>{config.pickup ? "Sin costo de entrega." : whatsappOnly ? "Dirección y horario a coordinar por WhatsApp." : "Retiro aún no disponible."}</small></span></label>
          </div>
          <div className="checkout-pickup-map" hidden={delivery !== "pickup"}><div className="checkout-pickup-map__frame"><iframe title="Ubicación de QuilGym en Google Maps" src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><div className="checkout-pickup-map__details"><strong>{config.pickup?.address ?? "QuilGym · Quilmes"}</strong><span>{config.pickup?.hours ?? "Horario a coordinar"}</span><span>Esperá el aviso de preparación antes de acercarte.</span></div><a className="checkout-pickup-map__link" href={quilgymMapsUrl} target="_blank" rel="noopener noreferrer">Abrir en Google Maps<span className="sr-only"> (se abre en una pestaña nueva)</span></a></div></div>
          <div hidden={deliveryMode === "pickup"}><h3>Dirección de entrega</h3><div className="form-grid">
            {field("street", "Calle", { required: true, autoComplete: "address-line1", maxLength: 160, className: "span-2" })}
            {field("streetNumber", "Número", { required: true, maxLength: 12 })}
            {field("apartment", "Piso / Depto.", { autoComplete: "address-line2", maxLength: 60 })}
            {field("postalCode", "Código postal", { required: true, autoComplete: "postal-code", maxLength: 8 })}
            {field("city", "Localidad", { required: true, autoComplete: "address-level2", maxLength: 100, className: "span-2" })}
            {field("province", "Provincia", { required: true, autoComplete: "address-level1", maxLength: 100 })}
          </div></div>
          <div className="form-grid">{field("notes", "Indicaciones (opcional)", { maxLength: 400, className: "span-4" })}</div>
          {deliveryMode === "shipping" && addressDeliveryAvailable(config) ? <div className="delivery-quote-actions">
            <button type="button" className="button button--outline" disabled={quoting || busy} onClick={() => { if (validateVisibleFields([...addressFieldNames])) void calculate(); }}>{quoting ? "Calculando…" : quoted.options.length ? "Volver a calcular" : "Calcular envío"}</button>
            {config.localDelivery ? <button type="button" className="delivery-locate" disabled={locating || busy} onClick={useMyLocation} aria-describedby="delivery-locate-help"><LocateFixed aria-hidden="true" size={17}/>{locating ? "Buscando tu ubicación…" : locationHint ? "Ubicación compartida" : "Usar mi ubicación"}</button> : null}
            {config.localDelivery ? <small id="delivery-locate-help" className="delivery-locate__help">Opcional: ayuda a ubicar tu dirección si hay calles con el mismo nombre. Decidimos con la dirección que escribiste.</small> : null}
          </div> : null}
          {locationMessage ? <p className="delivery-locate__status" role="status">{locationMessage}</p> : null}
          {deliveryMode === "shipping" && whatsappOnly && !addressDeliveryAvailable(config) ? <button type="button" className="button button--outline" disabled={busy} onClick={askShippingCost}>Consultar costo por WhatsApp</button> : null}
          {delivery === "pickup" && config.pickup ? <button type="button" className="button button--outline" disabled={quoting || busy} onClick={() => { void calculate(); }}>{quoting ? "Calculando…" : "Confirmar retiro gratis"}</button> : null}
          {deliveryMode === "shipping" && quoted.options.length ? <fieldset className="delivery-options"><legend>¿Cómo querés recibirlo?</legend>
            {quoted.options.map((option) => { const local = option.delivery === "local"; const checked = quote?.token === option.token; return <label key={option.optionId ?? option.token} className={`delivery-option${checked ? " is-active" : ""}${local ? " delivery-option--local" : ""}`}>
              <input type="radio" name="delivery-option" value={option.optionId ?? ""} checked={checked} disabled={busy} onChange={() => selectOption(option)} aria-describedby={local ? `delivery-note-${option.optionId}` : undefined}/>
              <b aria-hidden="true">{local ? <MapPin size={18}/> : <Truck size={18}/>}</b>
              <span className="delivery-option__body"><strong>{option.label}</strong><small>{option.estimate}</small>
                {local && typeof option.distanceMeters === "number" ? <small className="delivery-option__distance">A {formatDistance(option.distanceMeters)} del local, aproximadamente</small> : null}
                {local && option.note ? <small className="delivery-option__note" id={`delivery-note-${option.optionId}`}><Info aria-hidden="true" size={14}/>{option.note}.</small> : null}
              </span>
              <span className="delivery-option__price">{local ? <>$0<small>Costo a convenir</small></> : formatArs(option.shippingArs)}</span>
            </label>; })}
          </fieldset> : null}
          {deliveryMode === "shipping" && quoted.notice ? <p className="delivery-notice" role="status"><Info aria-hidden="true" size={16}/>{quoted.notice}</p> : null}
          {delivery === "pickup" && quote ? <p className="checkout-quote" role="status"><strong>{quote.label} · {quote.shippingArs === 0 ? "Sin costo" : formatArs(quote.shippingArs)}</strong><br/>{quote.estimate}</p> : null}
          <div className="checkout-step-actions"><button type="button" className="button button--outline" onClick={() => goTo(1)}><ArrowLeft aria-hidden="true" size={18}/>Volver</button><button type="button" className="button button--dark" disabled={quoting || busy} onClick={() => { void continueToPayment(); }}>{quoting ? "Calculando…" : "Seguir con pago"}<ArrowRight aria-hidden="true" size={18}/></button></div>
        </section>
        <section className="checkout-card checkout-step-panel" data-direction={direction} hidden={step !== 3}><header><span>3</span><h2>Elegí cómo pagar</h2></header>
          <div className="checkout-choices payment-choices">
            {([
              ["mercadopago", "Mercado Pago"],
              ["mercadopago", "Mercado Crédito"],
              ["mercadopago", "Tarjeta de débito"],
              ["mercadopago", "Tarjeta de crédito"],
              ["cash", "Efectivo"],
            ] as const).map(([value, title], index) => <label key={`${title}-${index}`} className={payment === value && paymentOption === title && payments.includes(value) ? "is-active" : ""}>
              <input type="radio" name="payment-choice" value={title} checked={payment === value && paymentOption === title && payments.includes(value)} disabled={busy || !payments.includes(value)} onChange={() => { setPayment(value); setPaymentOption(title); }}/><b className={`payment-mark payment-mark--${index < 2 ? "brand" : index < 4 ? "card" : "cash"}`} aria-hidden="true">{index === 0 ? <Image src="/assets/payments/mercado-pago-horizontal.png" alt="" width={73} height={20} unoptimized/> : index === 1 ? <Image className="payment-logo--mercado-credito" src="/assets/payments/mercado-credito.png" alt="" width={80} height={45}/> : index === 2 ? <Image src="/assets/payments/tarjeta-debito.svg" alt="" width={56} height={34}/> : index === 3 ? <Image src="/assets/payments/tarjeta-credito.svg" alt="" width={56} height={34}/> : <Image src="/assets/payments/efectivo.svg" alt="" width={56} height={42}/>}</b>
              <span><strong>{title}</strong>{value === "cash" && !payments.includes("cash") ? <small className="payment-unavailable">{config.payments.cash ? "Solo al retirar en el local" : "No disponible por ahora"}</small> : null}</span>
            </label>)}
          </div>
          {!whatsappOnly && payment === "mercadopago" && (paymentOption === "Tarjeta de débito" || paymentOption === "Tarjeta de crédito") ? <div className="checkout-card-info">{paymentOption === "Tarjeta de crédito" ? <InstallmentsLine price={quote?.totalArs ?? cart.totalArs}/> : null}<AcceptedCards type={paymentOption === "Tarjeta de crédito" ? "credit" : "debit"} label={paymentOption === "Tarjeta de crédito" ? "Tarjetas de crédito aceptadas" : "Tarjetas de débito aceptadas"}/></div> : null}
          <input type="hidden" name="payment" value={payment}/>
          <p className="checkout-payment-note">{whatsappOnly ? "Indicá tu preferencia: QuilGym te confirmará disponibilidad y los pasos para pagar por WhatsApp. Todavía no se realiza ningún cobro." : payment === "mercadopago" && (paymentOption === "Tarjeta de débito" || paymentOption === "Tarjeta de crédito") ? config.demo ? "En la simulación no se piden datos de tarjeta. En producción, al tocar «Ir a pagar», se abre el formulario seguro de Mercado Pago para completar número, vencimiento, código de seguridad, titular y DNI." : paymentOption === "Tarjeta de débito" ? "Al tocar «Ir a pagar» guardamos el pedido y se abre el formulario seguro de Mercado Pago para tu tarjeta de débito (un solo pago)." : "Al tocar «Ir a pagar» guardamos el pedido y se abre el formulario seguro de Mercado Pago, donde elegís las cuotas de tu tarjeta de crédito." : payment === "mercadopago" && paymentOption === "Mercado Crédito" ? config.demo ? "Simulación local: no se realiza ningún cobro. En producción, Mercado Pago abrirá el pago con Mercado Crédito y el importe de tu compra." : "Mercado Pago abrirá el importe de la compra con Mercado Crédito preseleccionado, si está habilitado para la cuenta y disponible para vos." : payment === "mercadopago" ? config.demo ? "Simulación local: no se realiza ningún cobro. En producción, Mercado Pago abrirá el pago con el importe de tu compra." : "Mercado Pago abrirá el checkout seguro con el importe de tu compra." : "El pago en efectivo se coordina al retirar en el local."}</p>
          {needsTaxId ? <fieldset className="checkout-tax-id"><legend>Datos para la factura</legend><p>Por el importe de la compra, ARCA exige identificar al comprador en la factura.</p>
            <div className="form-grid"><label>Tipo<select className="select-field" name="taxIdType" value={values.taxIdType ?? "DNI"} onChange={(event) => setValues((current) => ({ ...current, taxIdType: event.target.value }))}><option value="DNI">DNI</option><option value="CUIT">CUIT/CUIL</option></select></label>
              {field("taxIdNumber", "Número", { required: true, maxLength: 13, className: "span-2", inputMode: "numeric" })}</div></fieldset> : null}
          <label className={`terms${fields.accepted ? " is-invalid" : ""}`}><input type="checkbox" name="accepted" checked={accepted} aria-invalid={fields.accepted ? true : undefined} aria-describedby={fields.accepted ? "error-accepted" : undefined} onChange={(event) => { setAccepted(event.target.checked); if (fields.accepted) setFields((current) => { const next = { ...current }; delete next.accepted; return next; }); }}/>{whatsappOnly ? "Revisé mis datos y quiero enviar esta solicitud por WhatsApp." : "Confirmo que los datos, productos y forma de entrega son correctos."}</label>
          {fields.accepted ? <small className="form-error checkout-checkbox-error" id="error-accepted">{fields.accepted}</small> : null}
          <div className="checkout-step-actions"><button type="button" className="button button--outline" onClick={() => goTo(2)}><ArrowLeft aria-hidden="true" size={18}/>Volver</button><button className={`button ${whatsappOnly ? "button--whatsapp" : "button--dark"}`} type="submit" disabled={!canSubmit}>{whatsappOnly ? <><WhatsAppGlyph/>Continuar por WhatsApp</> : <><Lock aria-hidden="true" size={17}/><span>{checkoutActionLabel}</span><ArrowRight aria-hidden="true" size={18}/></>}</button></div>
        </section>
        {error ? <p className="form-error checkout-flow-error" role="alert">{error}</p> : null}
      </div>
      <aside className="checkout-summary"><header><h2>Resumen</h2><Link href="/carrito">Editar carrito</Link></header>
        {summaryItems}
        <div role="status" aria-live="polite">{cart.notices.map((notice) => <p className="cart-feedback cart-feedback--warning" key={notice}>{notice}</p>)}
          {cart.hasPriceChanges ? <button type="button" className="cart-acknowledge" onClick={() => { invalidateQuote(); void acknowledgeChanges(); }}>Entendido, continuar con los precios actuales</button> : null}
        </div>
        <div className="summary-lines">{summaryTotals}
          {!quote ? <small>Confirmá la entrega para obtener el total final.</small> : null}
        </div>
        <small className="secure-note">{whatsappOnly ? "El borrador se conserva solo en esta pestaña. WhatsApp abrirá el mensaje para que lo revises y lo envíes." : config.demo ? "Simulación local. No ingreses datos de tarjetas reales." : "No se realiza ningún cobro al guardar el pedido."}</small>
      </aside>
    </form>
  </>;
}

/** Pedido de cotización a partir de los campos del formulario. La ubicación del navegador viaja solo como pista. */
function quoteRequest(delivery: DeliveryMethod | "shipping", values: Record<string, string | undefined>, hint: { lat: number; lng: number } | null): CheckoutQuoteRequest {
  if (delivery === "pickup") return { delivery: "pickup" };
  const value = (name: string) => String(values[name] ?? "").trim();
  return { delivery: "address", hint, address: { street: value("street"), streetNumber: value("streetNumber"), postalCode: value("postalCode"), city: value("city"), province: value("province") } };
}
