"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { submitWithdrawal, type WithdrawalResult } from "@/lib/withdrawal-actions";
import { WhatsAppGlyph } from "./icons";

/** Formulario del Botón de arrepentimiento: sin cuenta; devuelve el código de trámite en el momento. */
export function WithdrawalForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<WithdrawalResult | null>(null);
  const done = useRef<HTMLDivElement>(null);
  const fields = result && !result.ok ? result.fields ?? {} : {};

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const next = await submitWithdrawal(data);
      setResult(next);
      if (next.ok) requestAnimationFrame(() => done.current?.focus());
    } catch { setResult({ ok: false, error: "No pudimos enviar el pedido. Probá de nuevo o escribinos por WhatsApp." }); }
    finally { setBusy(false); }
  }

  if (result?.ok) {
    return <div className="withdrawal-done" ref={done} tabIndex={-1} role="status" aria-live="polite">
      <CheckCircle2 aria-hidden="true"/>
      <h2>Tu código de trámite es <span className="withdrawal-code">{result.code}</span></h2>
      {result.channel === "email"
        ? <p>Recibimos tu pedido de revocación. {result.confirmationSent ? "Te enviamos la constancia por email." : "Guardá este código: no pudimos enviarte la constancia por email."} Te vamos a escribir para coordinar la devolución.</p>
        : <p>Guardá este código. Para completar el trámite, enviá el mensaje que preparamos por WhatsApp: incluye tus datos y el código.</p>}
      {result.channel === "whatsapp" ? <a className="button button--whatsapp" href={result.whatsappUrl} target="_blank" rel="noopener noreferrer"><WhatsAppGlyph/>Enviar por WhatsApp</a> : null}
    </div>;
  }

  const error = (name: string) => fields[name] ? <small className="form-error" id={`withdrawal-${name}-error`}>{fields[name]}</small> : null;
  const described = (name: string) => fields[name] ? { "aria-invalid": true, "aria-describedby": `withdrawal-${name}-error` } : {};
  return <form className="withdrawal-form" onSubmit={submit} noValidate>
    <div className="form-grid">
      <label className="span-2">Nombre y apellido<input name="name" autoComplete="name" required maxLength={120} {...described("name")}/>{error("name")}</label>
      <label className="span-2">Email<input name="email" type="email" autoComplete="email" required maxLength={254} {...described("email")}/>{error("email")}</label>
      <label className="span-2">Teléfono (opcional)<input name="phone" type="tel" autoComplete="tel" maxLength={30} {...described("phone")}/>{error("phone")}</label>
      <label className="span-2">Número de pedido (opcional)<input name="orderCode" placeholder="QG-XXXXXXXX" maxLength={40} autoComplete="off" {...described("orderCode")}/>{error("orderCode")}</label>
      <label className="span-2">Fecha de compra o de recepción (opcional)<input name="purchaseDate" type="date" {...described("purchaseDate")}/>{error("purchaseDate")}</label>
      <label className="span-4">Productos o comentario (opcional)<textarea name="details" rows={3} maxLength={1000}/></label>
    </div>
    <label className="terms"><input type="checkbox" name="confirm" required {...described("confirm")}/>Quiero revocar mi compra (arrepentimiento).</label>
    {error("confirm")}
    {result && !result.ok ? <p className="form-error" role="alert">{result.error}</p> : null}
    <button type="submit" className="button button--dark" disabled={busy}><Send aria-hidden="true" size={18}/>{busy ? "Enviando…" : "Enviar pedido de arrepentimiento"}</button>
    <small className="withdrawal-note">No necesitás cuenta. Usamos estos datos solo para gestionar la revocación (ver <Link href="/legales/privacidad">Privacidad</Link>).</small>
  </form>;
}
