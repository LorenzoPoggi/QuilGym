"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Pause, Pencil, Play, Plus, TicketPercent, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { saveAdminCoupon, setAdminCouponActive, type CouponActionResult } from "@/lib/admin-coupon-actions";
import { couponStatus, couponStatusLabels, describeCoupon, MAX_PERCENT, normalizeCouponCode, toArgentinaDate, type AdminCouponInput, type CouponFieldErrors, type CouponKind, type CouponRow } from "@/lib/admin-coupons";

const toNumber = (value: string) => value.trim() === "" ? null : Number(value.replace(/\./g, "").replace(",", "."));

function CouponForm({ row, onDone, onCancel }: { row?: CouponRow; onDone: (message: string) => void; onCancel?: () => void }) {
  const router = useRouter();
  const uid = useId();
  const [code, setCode] = useState(row?.code ?? "");
  const [kind, setKind] = useState<CouponKind>(row?.kind ?? "percent");
  const [value, setValue] = useState(row ? String(row.value) : "");
  const [minimum, setMinimum] = useState(row?.minSubtotalArs ? String(row.minSubtotalArs) : "");
  const [startsOn, setStartsOn] = useState(row?.startsAt ? toArgentinaDate(new Date(row.startsAt)) : "");
  const [endsOn, setEndsOn] = useState(row?.endsAt ? toArgentinaDate(new Date(row.endsAt)) : "");
  const [limit, setLimit] = useState(row?.maxRedemptions ? String(row.maxRedemptions) : "");
  const [errors, setErrors] = useState<CouponFieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const used = (row?.redemptions ?? 0) > 0;

  const input: AdminCouponInput = {
    id: row?.id, code, kind, value: Number(value) || 0, minSubtotalArs: toNumber(minimum),
    startsOn: startsOn || null, endsOn: endsOn || null, maxRedemptions: toNumber(limit),
  };
  const field = (name: keyof CouponFieldErrors) => ({ "aria-invalid": errors[name] ? true : undefined, "aria-describedby": errors[name] ? `${uid}-${name}` : undefined });
  const fieldError = (name: keyof CouponFieldErrors) => errors[name] ? <small className="admin-field-error" id={`${uid}-${name}`}>{errors[name]}</small> : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setErrors({}); setError("");
    try {
      const result: CouponActionResult = await saveAdminCoupon(input);
      if (!result.ok) { setErrors(result.fields ?? {}); setError(result.error); return; }
      const saved = normalizeCouponCode(code);
      if (!row) { setCode(""); setValue(""); setMinimum(""); setStartsOn(""); setEndsOn(""); setLimit(""); setKind("percent"); }
      onDone(row ? `${saved}: cambios guardados.` : `${saved}: cupón creado y activo.`);
      router.refresh();
    } catch { setError("No pudimos guardar. Revisá la conexión e intentá de nuevo."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <form className="coupon-form" onSubmit={submit} noValidate aria-busy={busy}>
    <div className="coupon-form__grid">
      <label className="coupon-form__code"><span className="coupon-label">Código</span>
        <input value={code} onChange={(e) => setCode(normalizeCouponCode(e.target.value))} maxLength={24} placeholder="Ej. BIENVENIDA15" autoCapitalize="characters" spellCheck={false} disabled={used} required {...field("code")}/>
        {used ? <small className="admin-help">Ya se usó {row?.redemptions} {row?.redemptions === 1 ? "vez" : "veces"}: el código no se puede cambiar.</small> : fieldError("code")}
      </label>
      <fieldset className="coupon-form__kind">
        <legend>Tipo de descuento</legend>
        <div className="coupon-segmented">
          <label><input type="radio" name={`${uid}-kind`} checked={kind === "percent"} onChange={() => setKind("percent")}/><span>Porcentaje</span></label>
          <label><input type="radio" name={`${uid}-kind`} checked={kind === "fixed"} onChange={() => setKind("fixed")}/><span>Monto fijo</span></label>
        </div>
      </fieldset>
      <label><span className="coupon-label">{kind === "percent" ? "Descuento (%)" : "Descuento ($)"}</span>
        <span className="coupon-affix">{kind === "fixed" && <b aria-hidden="true">$</b>}<input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} placeholder={kind === "percent" ? "15" : "5000"} required {...field("value")}/>{kind === "percent" && <b aria-hidden="true">%</b>}</span>
        {errors.value ? fieldError("value") : <small className="admin-help">{kind === "percent" ? `Entre 1% y ${MAX_PERCENT}%.` : "Se descuenta del subtotal de productos."}</small>}
      </label>
      <label><span className="coupon-label">Compra mínima <span className="coupon-optional">(opcional)</span></span>
        <span className="coupon-affix"><b aria-hidden="true">$</b><input inputMode="numeric" value={minimum} onChange={(e) => setMinimum(e.target.value.replace(/\D/g, ""))} placeholder="Sin mínimo" {...field("minSubtotalArs")}/></span>
        {fieldError("minSubtotalArs")}
      </label>
      <label><span className="coupon-label">Válido desde <span className="coupon-optional">(opcional)</span></span>
        <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} {...field("startsOn")}/>{fieldError("startsOn")}
      </label>
      <label><span className="coupon-label">Válido hasta <span className="coupon-optional">(opcional)</span></span>
        <input type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} {...field("endsOn")}/>{fieldError("endsOn")}
      </label>
      <label><span className="coupon-label">Límite de usos <span className="coupon-optional">(opcional)</span></span>
        <input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} placeholder="Sin límite" {...field("maxRedemptions")}/>{fieldError("maxRedemptions")}
      </label>
    </div>
    <p className="coupon-preview" aria-live="polite"><TicketPercent size={18} aria-hidden="true"/><span><strong>{normalizeCouponCode(code) || "TUCODIGO"}</strong> · {describeCoupon(input)}</span></p>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="coupon-form__actions">
      {onCancel && <button type="button" className="coupon-btn" onClick={onCancel} disabled={busy}>Cancelar</button>}
      <button type="submit" className="admin-primary" disabled={busy}>{busy ? "Guardando…" : row ? "Guardar cambios" : <><Plus size={16} aria-hidden="true"/> Crear cupón</>}</button>
    </div>
  </form>;
}

function CouponItem({ row, onMessage }: { row: CouponRow; onMessage: (message: string) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = couponStatus({ ...row, startsAt: row.startsAt && new Date(row.startsAt), endsAt: row.endsAt && new Date(row.endsAt) });
  const usage = row.maxRedemptions ? `${row.redemptions} de ${row.maxRedemptions} usos` : `${row.redemptions} ${row.redemptions === 1 ? "uso" : "usos"}`;
  const start = row.startsAt ? toArgentinaDate(new Date(row.startsAt)) : null;
  const end = row.endsAt ? toArgentinaDate(new Date(row.endsAt)) : null;

  async function toggle() {
    setBusy(true); setError("");
    try {
      const result = await setAdminCouponActive(row.id, !row.isActive);
      if (!result.ok) { setError(result.error); return; }
      onMessage(row.isActive ? `${row.code}: pausado. Ya no se aplica en el carrito.` : `${row.code}: reactivado.`);
      router.refresh();
    } catch { setError("No pudimos actualizar el cupón."); }
    finally { setBusy(false); }
  }

  return <li className={`coupon-item coupon-item--${status}`}>
    <div className="coupon-item__main">
      <div className="coupon-item__code"><strong>{row.code}</strong><span className={`coupon-status coupon-status--${status}`}>{couponStatusLabels[status]}</span></div>
      <p>{describeCoupon({ kind: row.kind, value: row.value, minSubtotalArs: row.minSubtotalArs, startsOn: start, endsOn: end, maxRedemptions: row.maxRedemptions })}</p>
      <small>{usage}</small>
    </div>
    <div className="coupon-item__actions">
      <button type="button" className="coupon-btn" onClick={() => setEditing((value) => !value)} aria-expanded={editing}>{editing ? <><X size={16} aria-hidden="true"/> Cerrar</> : <><Pencil size={16} aria-hidden="true"/> Editar</>}</button>
      <button type="button" className="coupon-btn" onClick={toggle} disabled={busy}>{row.isActive ? <><Pause size={16} aria-hidden="true"/> Pausar</> : <><Play size={16} aria-hidden="true"/> Reactivar</>}</button>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {editing && <div className="coupon-item__editor"><CouponForm row={row} onCancel={() => setEditing(false)} onDone={(message) => { setEditing(false); onMessage(message); }}/></div>}
  </li>;
}

export function AdminCouponsManager({ rows }: { rows: CouponRow[] }) {
  const [message, setMessage] = useState("");
  const active = rows.filter((row) => row.isActive).length;
  return <div className="admin-coupons">
    <p className="admin-notice-inline" role="status">{message && <><CheckCircle2 size={17} aria-hidden="true"/> {message}</>}</p>
    <section className="admin-card"><h2>Nuevo cupón</h2><CouponForm onDone={setMessage}/></section>
    <section className="admin-card">
      <h2>Tus cupones {rows.length > 0 && <span className="coupon-count">{active} activos de {rows.length}</span>}</h2>
      {rows.length ? <ul className="coupon-list">{rows.map((row) => <CouponItem key={`${row.id}-${row.isActive}-${row.code}-${row.value}`} row={row} onMessage={setMessage}/>)}</ul>
        : <div className="coupon-empty"><TicketPercent size={28} aria-hidden="true"/><p>Todavía no creaste cupones. Cuando crees uno, tus clientes lo van a poder escribir en el carrito.</p></div>}
      <small className="admin-help">Pausar un cupón no lo borra: deja de aplicarse y podés reactivarlo cuando quieras. Los cupones ya usados conservan su historial.</small>
    </section>
  </div>;
}
