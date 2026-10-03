"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";
import type { Cart } from "@/lib/cart-types";
import type { CheckoutConfig, CheckoutInput, CheckoutQuote, DeliveryMethod, PaymentMethod } from "@/lib/checkout-types";
import { getCheckoutQuote, submitCheckout } from "@/lib/checkout-actions";
import { validateCheckout } from "@/lib/checkout-validation";
import { formatArs } from "@/lib/commerce";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";

export function CheckoutForm({ initialCart, config }: { initialCart: Cart; config: CheckoutConfig }) {
  const router = useRouter();
  const { cart: liveCart, loaded, acknowledgeChanges, refreshCart } = useCart();
  const cart = loaded ? liveCart : initialCart;
  const [delivery, setDelivery] = useState<DeliveryMethod>(config.pickup ? "pickup" : "shipping");
  const [payment, setPayment] = useState<PaymentMethod>(config.payments.mercadopago ? "mercadopago" : config.payments.transfer ? "transfer" : "cash");
  const [accepted, setAccepted] = useState(false);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const requestKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const quoteVersion = useRef(0);
  const allowed = config.payments[payment] && (payment !== "cash" || delivery === "pickup");
  const canSubmit = accepted && quote && cart.lines.length > 0 && !cart.hasBlockingIssues && !cart.hasPriceChanges && allowed && !busy && !quoting;

  function invalidateQuote() { quoteVersion.current += 1; setQuote(null); }
  function changeDelivery(value: DeliveryMethod) {
    setDelivery(value);
    invalidateQuote();
    if (value === "shipping" && payment === "cash") setPayment(config.payments.mercadopago ? "mercadopago" : "transfer");
  }

  async function calculate() {
    if (!formRef.current || quoting) return;
    setQuoting(true); setError("");
    const version = ++quoteVersion.current;
    const data = new FormData(formRef.current);
    try {
      const result = await getCheckoutQuote(delivery, String(data.get("postalCode") ?? ""));
      if (version !== quoteVersion.current) return;
      if (result.ok) setQuote(result.quote);
      else { setQuote(null); setError(result.error); }
    } catch { setError("No pudimos conectar. Volvé a calcular la entrega."); }
    finally { setQuoting(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !quote || submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setFields({});
    const data = new FormData(event.currentTarget);
    // Solo se persiste una clave aleatoria; no contacto ni información de pago.
    if (!requestKey.current) {
      try { requestKey.current = sessionStorage.getItem("qg_checkout_key") || crypto.randomUUID(); sessionStorage.setItem("qg_checkout_key", requestKey.current); }
      catch { requestKey.current = crypto.randomUUID(); }
    }
    const input = { ...Object.fromEntries(data), delivery, payment, accepted, quoteToken: quote.token, checkoutKey: requestKey.current } as CheckoutInput;
    const parsed = validateCheckout(input);
    if (!parsed.ok) { setFields(parsed.fields); setError("Revisá los campos marcados."); submitting.current = false; setBusy(false); return; }
    try {
      const result = await submitCheckout(parsed.value);
      if (result.ok) {
        try { sessionStorage.removeItem("qg_checkout_key"); } catch { /* Storage opcional. */ }
        await refreshCart();
        router.push(`/checkout/confirmacion/${result.orderId}`);
        router.refresh();
      } else { setError(result.error); setFields(result.fields ?? {}); invalidateQuote(); }
    } catch { setError("No pudimos recibir la respuesta. Reintentá: conservamos la clave para evitar duplicar el pedido."); }
    finally { setBusy(false); submitting.current = false; }
  }

  function field(name: string, label: string, options: { required?: boolean; type?: string; autoComplete?: string; maxLength?: number; className?: string } = {}) {
    return <label className={options.className} key={name}>{label}
      <input name={name} type={options.type ?? "text"} required={options.required} autoComplete={options.autoComplete} maxLength={options.maxLength ?? 120}
        aria-invalid={!!fields[name]} aria-describedby={fields[name] ? `error-${name}` : undefined}
        onChange={name === "postalCode" ? invalidateQuote : undefined}/>
      {fields[name] ? <small className="form-error" id={`error-${name}`}>{fields[name]}</small> : null}
    </label>;
  }

  return <>
    {config.demo ? <div className="checkout-demo-banner" role="note"><strong>Modo de prueba local</strong><span>Los pedidos son de prueba. No se cobra dinero, no se envían emails y no se descuenta stock real. Usá datos ficticios.</span></div> : null}
    <form className="checkout-layout" ref={formRef} onSubmit={submit}>
      <div className="checkout-main">
        <section className="checkout-card"><header><span>1</span><h2>Datos y contacto</h2></header>
          <div className="form-grid">
            {field("name", "Nombre y apellido", { required: true, autoComplete: "name", className: "span-4" })}
            {field("email", "Email", { required: true, type: "email", autoComplete: "email", maxLength: 254, className: "span-2" })}
            {field("phone", "Teléfono", { required: true, type: "tel", autoComplete: "tel", maxLength: 30, className: "span-2" })}
          </div>
        </section>
        <section className="checkout-card"><header><span>2</span><h2>Entrega o retiro</h2></header>
          <div className="checkout-choices">
            <label className={delivery === "shipping" ? "is-active" : ""}><input type="radio" name="delivery" value="shipping" checked={delivery === "shipping"} disabled={!config.shippingRates.length || busy} onChange={() => changeDelivery("shipping")}/><span><strong>Envío a domicilio</strong><small>{config.shippingRates.length ? "Calculá el costo con tu código postal." : "Envíos aún no disponibles."}</small></span></label>
            <label className={delivery === "pickup" ? "is-active" : ""}><input type="radio" name="delivery" value="pickup" checked={delivery === "pickup"} disabled={!config.pickup || busy} onChange={() => changeDelivery("pickup")}/><span><strong>Retiro en Quilmes</strong><small>{config.pickup ? "Sin costo de entrega." : "Retiro aún no disponible."}</small></span></label>
          </div>
          {delivery === "pickup" ? <div className="checkout-delivery-detail"><strong>{config.pickup?.address}</strong><p>{config.pickup?.hours}</p><p>Esperá el aviso de preparación antes de acercarte.</p></div> : <><h3>Dirección de entrega</h3><div className="form-grid">
            {field("street", "Calle", { required: true, autoComplete: "address-line1", maxLength: 160, className: "span-2" })}
            {field("streetNumber", "Número", { required: true, maxLength: 12 })}
            {field("apartment", "Piso / Depto.", { autoComplete: "address-line2", maxLength: 60 })}
            {field("postalCode", "Código postal", { required: true, autoComplete: "postal-code", maxLength: 8 })}
            {field("city", "Localidad", { required: true, autoComplete: "address-level2", maxLength: 100, className: "span-2" })}
            {field("province", "Provincia", { required: true, autoComplete: "address-level1", maxLength: 100 })}
          </div></>}
          <div className="form-grid">{field("notes", "Indicaciones (opcional)", { maxLength: 400, className: "span-4" })}</div>
          <button type="button" className="button button--outline" disabled={quoting || busy} onClick={calculate}>{quoting ? "Calculando…" : delivery === "pickup" ? "Confirmar retiro y total" : "Calcular envío"}</button>
          {quote ? <p className="checkout-quote" role="status"><strong>{quote.label} · {formatArs(quote.shippingArs)}</strong><br/>{quote.estimate}</p> : null}
        </section>
        <section className="checkout-card"><header><span>3</span><h2>Medio de pago</h2></header>
          <div className="checkout-choices payment-choices">
            {([
              ["mercadopago", "Mercado Pago", "Tarjetas, cuotas, saldo en cuenta, Rapipago y Pago Fácil."],
              ["transfer", "Transferencia bancaria", "El pedido queda pendiente hasta verificar el pago."],
              ["cash", "Efectivo al retirar", "Disponible únicamente con retiro en el local."],
            ] as const).map(([value, title, copy]) => <label key={value} className={payment === value ? "is-active" : ""}>
              <input type="radio" name="payment" value={value} checked={payment === value} disabled={busy || !config.payments[value] || (value === "cash" && delivery !== "pickup")} onChange={() => setPayment(value)}/>
              <span><strong>{title}</strong><small>{config.payments[value] ? copy : "Próximamente disponible."}</small></span>
            </label>)}
          </div>
          <p className="checkout-payment-note">{payment === "mercadopago" ? "Después de guardar el pedido podrás completar el pago. Las cuotas y sus costos se muestran en Mercado Pago." : payment === "transfer" ? "Al confirmar verás las instrucciones. Crear el pedido no acredita la transferencia." : "El pago queda pendiente hasta que retires y abones."}</p>
        </section>
      </div>
      <aside className="checkout-summary"><header><h2>Resumen</h2><Link href="/carrito">Editar carrito</Link></header>
        {cart.lines.map((line) => <article key={line.variantId}><ProductImage product={line} sizes="66px" decorative/><div><strong>{line.name}</strong><small>{line.quantity} × {formatArs(line.unitPriceArs)}</small></div><b>{line.available ? formatArs(line.lineTotalArs) : "Sin stock"}</b></article>)}
        <div role="status" aria-live="polite">{cart.notices.map((notice) => <p className="cart-feedback cart-feedback--warning" key={notice}>{notice}</p>)}
          {cart.hasPriceChanges ? <button type="button" className="cart-acknowledge" onClick={() => { invalidateQuote(); void acknowledgeChanges(); }}>Entendido, continuar con los precios actuales</button> : null}
        </div>
        <div className="summary-lines"><p><span>Subtotal</span><strong>{formatArs(cart.subtotalArs)}</strong></p>
          {cart.coupon ? <p><span>Cupón {cart.coupon.code}</span><strong>− {formatArs(cart.discountArs)}</strong></p> : null}
          <p><span>Entrega</span><strong>{quote ? formatArs(quote.shippingArs) : "A confirmar"}</strong></p>
          <div><span>Total</span><strong>{formatArs(quote?.totalArs ?? cart.totalArs)}</strong></div>
          {!quote ? <small>Confirmá la entrega para obtener el total final.</small> : null}
        </div>
        <label className="terms"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/>Confirmo que los datos, productos y forma de entrega son correctos.</label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button--dark button--full" type="submit" disabled={!canSubmit}>{busy ? "Guardando pedido…" : config.demo ? "Crear pedido de prueba" : "Confirmar pedido"}</button>
        <small className="secure-note">{config.demo ? "Simulación local. No ingreses datos de tarjetas reales." : "No se realiza ningún cobro al guardar el pedido."}</small>
      </aside>
    </form>
  </>;
}
