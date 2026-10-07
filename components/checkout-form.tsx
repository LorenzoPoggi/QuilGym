"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ChevronDown, CreditCard, Landmark, Lock, ScanSearch, ShieldCheck, Store, Truck, Wallet } from "lucide-react";
import type { Cart } from "@/lib/cart-types";
import type { CheckoutConfig, CheckoutInput, CheckoutQuote, DeliveryMethod, PaymentMethod } from "@/lib/checkout-types";
import { getCheckoutQuote, submitCheckout } from "@/lib/checkout-actions";
import { validateCheckout } from "@/lib/checkout-validation";
import { initialCheckoutChoice, usablePayments } from "@/lib/checkout-whatsapp";
import { formatArs } from "@/lib/commerce";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";

export function CheckoutForm({ initialCart, config }: { initialCart: Cart; config: CheckoutConfig }) {
  const router = useRouter();
  const { cart: liveCart, loaded, acknowledgeChanges, refreshCart } = useCart();
  const cart = loaded ? liveCart : initialCart;
  const [delivery, setDelivery] = useState<DeliveryMethod>(() => initialCheckoutChoice(config).delivery);
  const [payment, setPayment] = useState<PaymentMethod>(() => initialCheckoutChoice(config).payment);
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
  const deliveryEnabled = { shipping: config.shippingRates.length > 0, pickup: !!config.pickup };
  const payments = usablePayments(config, delivery);
  const allowed = deliveryEnabled[delivery] && payments.includes(payment);
  const canSubmit = accepted && quote && cart.lines.length > 0 && !cart.hasBlockingIssues && !cart.hasPriceChanges && allowed && !busy && !quoting;

  function invalidateQuote() { quoteVersion.current += 1; setQuote(null); }
  function changeDelivery(value: DeliveryMethod) {
    setDelivery(value);
    invalidateQuote();
    const next = usablePayments(config, value);
    if (!next.includes(payment) && next[0]) setPayment(next[0]);
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

  const total = formatArs(quote?.totalArs ?? cart.totalArs);
  // Líneas y totales compartidos por el resumen lateral y el desplegable mobile.
  const summaryItems = cart.lines.map((line) => <article key={line.variantId}><div className="checkout-line-thumb"><ProductImage product={line} sizes="64px" decorative/><span aria-hidden="true">{line.quantity}</span></div><div><strong>{line.name}</strong><small>{line.quantity} × {formatArs(line.unitPriceArs)}</small></div><b>{line.available ? formatArs(line.lineTotalArs) : "Sin stock"}</b></article>);
  const summaryTotals = <><p><span>Subtotal</span><strong>{formatArs(cart.subtotalArs)}</strong></p>
    {cart.coupon ? <p><span>Cupón {cart.coupon.code}</span><strong>− {formatArs(cart.discountArs)}</strong></p> : null}
    <p><span>Entrega</span><strong className={quote ? undefined : "is-muted"}>{quote ? formatArs(quote.shippingArs) : "A confirmar"}</strong></p>
    <div><span>Total</span><strong>{total}</strong></div></>;

  return <>
    {config.demo ? <div className="checkout-demo-banner" role="note"><strong>Modo de prueba local</strong><span>Los pedidos son de prueba. No se cobra dinero, no se envían emails y no se descuenta stock real. Usá datos ficticios.</span></div> : null}
    <form className="checkout-layout" ref={formRef} onSubmit={submit}>
      <div className="checkout-main">
        <details className="checkout-summary-mobile"><summary><span>Ver resumen · <strong>{total}</strong></span><small>{cart.itemCount} {cart.itemCount === 1 ? "producto" : "productos"}</small><ChevronDown aria-hidden="true" size={18}/></summary>
          <div className="checkout-summary-mobile__body">{summaryItems}<div className="summary-lines">{summaryTotals}</div></div>
        </details>
        <section className="checkout-card"><header><span>1</span><h2>Datos y contacto</h2></header>
          <div className="form-grid">
            {field("name", "Nombre y apellido", { required: true, autoComplete: "name", className: "span-4" })}
            {field("email", "Email", { required: true, type: "email", autoComplete: "email", maxLength: 254, className: "span-2" })}
            {field("phone", "Teléfono", { required: true, type: "tel", autoComplete: "tel", maxLength: 30, className: "span-2" })}
          </div>
        </section>
        <section className="checkout-card"><header><span>2</span><h2>Entrega o retiro</h2></header>
          <div className="checkout-choices">
            <label className={delivery === "shipping" && deliveryEnabled.shipping ? "is-active" : ""}><input type="radio" name="delivery" value="shipping" checked={delivery === "shipping" && deliveryEnabled.shipping} disabled={!deliveryEnabled.shipping || busy} onChange={() => changeDelivery("shipping")}/><b aria-hidden="true"><Truck size={18}/></b><span><strong>Envío a domicilio</strong><small>{config.shippingRates.length ? "Calculá el costo con tu código postal." : "Envíos aún no disponibles."}</small></span></label>
            <label className={delivery === "pickup" && deliveryEnabled.pickup ? "is-active" : ""}><input type="radio" name="delivery" value="pickup" checked={delivery === "pickup" && deliveryEnabled.pickup} disabled={!deliveryEnabled.pickup || busy} onChange={() => changeDelivery("pickup")}/><b aria-hidden="true"><Store size={18}/></b><span><strong>Retiro en Quilmes</strong><small>{config.pickup ? "Sin costo de entrega." : "Retiro aún no disponible."}</small></span></label>
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
              ["mercadopago", "Mercado Pago", "Tarjetas, cuotas, saldo en cuenta, Rapipago y Pago Fácil.", CreditCard],
              ["transfer", "Transferencia bancaria", "El pedido queda pendiente hasta verificar el pago.", Landmark],
              ["cash", "Efectivo al retirar", "Disponible únicamente con retiro en el local.", Wallet],
            ] as const).map(([value, title, copy, Icon]) => <label key={value} className={payment === value && payments.includes(value) ? "is-active" : ""}>
              <input type="radio" name="payment" value={value} checked={payment === value && payments.includes(value)} disabled={busy || !payments.includes(value)} onChange={() => setPayment(value)}/><b aria-hidden="true"><Icon size={18}/></b>
              <span><strong>{title}</strong><small>{config.payments[value] ? copy : "Próximamente disponible."}</small></span>
            </label>)}
          </div>
          <p className="checkout-payment-note">{payment === "mercadopago" ? "Después de guardar el pedido podrás completar el pago. Las cuotas y sus costos se muestran en Mercado Pago." : payment === "transfer" ? "Al confirmar verás las instrucciones. Crear el pedido no acredita la transferencia." : "El pago queda pendiente hasta que retires y abones."}</p>
        </section>
        <ul className="checkout-trust" aria-label="Compra segura">
          <li><ScanSearch aria-hidden="true" size={18}/>Precio y stock verificados al confirmar</li>
          <li><ShieldCheck aria-hidden="true" size={18}/>No guardamos datos de tarjetas</li>
          <li><BadgeCheck aria-hidden="true" size={18}/>Productos originales</li>
        </ul>
      </div>
      <aside className="checkout-summary"><header><h2>Resumen</h2><Link href="/carrito">Editar carrito</Link></header>
        {summaryItems}
        <div role="status" aria-live="polite">{cart.notices.map((notice) => <p className="cart-feedback cart-feedback--warning" key={notice}>{notice}</p>)}
          {cart.hasPriceChanges ? <button type="button" className="cart-acknowledge" onClick={() => { invalidateQuote(); void acknowledgeChanges(); }}>Entendido, continuar con los precios actuales</button> : null}
        </div>
        <div className="summary-lines">{summaryTotals}
          {!quote ? <small>Confirmá la entrega para obtener el total final.</small> : null}
        </div>
        <label className="terms"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/>Confirmo que los datos, productos y forma de entrega son correctos.</label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button--dark button--full" type="submit" disabled={!canSubmit}><Lock aria-hidden="true" size={17}/>{busy ? "Guardando pedido…" : config.demo ? "Crear pedido de prueba" : "Confirmar pedido"}</button>
        <small className="secure-note">{config.demo ? "Simulación local. No ingreses datos de tarjetas reales." : "No se realiza ningún cobro al guardar el pedido."}</small>
      </aside>
    </form>
  </>;
}
