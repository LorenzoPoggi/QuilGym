"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Heart, KeyRound, MessageCircle, PackageCheck, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, MAX_PASSWORD, MIN_PASSWORD, NETWORK_ERROR } from "@/lib/auth-errors";
import { whatsappUrl } from "@/lib/commerce";

export type AuthNotice = { tone: "error" | "success"; text: string } | null;
const forgotWhatsapp = whatsappUrl("¡Hola! Olvidé la contraseña de mi cuenta QuilGym y necesito ayuda para recuperarla.");

/** Foco en el primer campo solo con pantalla ancha: en mobile abriría el teclado y taparía el contexto. */
function useDesktopAutofocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => { if (window.matchMedia("(min-width: 769px)").matches) ref.current?.focus({ preventScroll: true }); }, []);
  return ref;
}

function PasswordField({ label, name, autoComplete, hint, invalid, inputRef, placeholder, onValue }: { label: string; name: string; autoComplete: string; hint?: React.ReactNode; invalid?: boolean; inputRef?: React.Ref<HTMLInputElement>; placeholder?: string; onValue?: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return <div className="auth-field">
    <label htmlFor={`${id}-input`}>{label}</label>
    <div className="auth-password">
      <input ref={inputRef} id={`${id}-input`} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} maxLength={MAX_PASSWORD} required placeholder={placeholder} aria-invalid={invalid || undefined} aria-describedby={hint ? `${id}-hint` : undefined} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={onValue ? (event) => onValue(event.target.value) : undefined}/>
      <button type="button" className="auth-password__toggle" aria-controls={`${id}-input`} aria-pressed={visible} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff aria-hidden="true"/> : <Eye aria-hidden="true"/>}</button>
    </div>
    {hint ? <small id={`${id}-hint`} className="auth-hint">{hint}</small> : null}
  </div>;
}

const LengthHint = ({ length }: { length: number }) => length >= MIN_PASSWORD
  ? <span className="auth-hint--ok"><CheckCircle2 aria-hidden="true"/>Largo correcto.</span>
  : <span>Mínimo {MIN_PASSWORD} caracteres{length ? ` · llevás ${length}` : ""}.</span>;

function NoticeBox({ notice }: { notice: AuthNotice }) {
  if (!notice) return null;
  return <p role={notice.tone === "error" ? "alert" : "status"} className={`auth-notice auth-notice--${notice.tone}`}>{notice.tone === "success" ? <CheckCircle2 aria-hidden="true"/> : null}{notice.text}</p>;
}
const Submit = ({ pending, disabled, idle, busy }: { pending: boolean; disabled?: boolean; idle: string; busy: string }) =>
  <button className="button button--dark button--full auth-submit" disabled={pending || disabled} aria-disabled={pending || disabled}>{pending ? <><span className="auth-spinner" aria-hidden="true"/>{busy}</> : <>{idle}<ArrowRight aria-hidden="true"/></>}</button>;

export function AuthCardShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <div className="auth-layout auth-layout--single"><div className="auth-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p>{children}</div></div>;
}

export function AuthForm({ register, google, available, next, recovery = false, notice = null }: { register: boolean; google: boolean; available: boolean; next: string; recovery?: boolean; notice?: AuthNotice }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState<"" | "password" | "confirm">("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const first = useDesktopAutofocus<HTMLInputElement>();
  const router = useRouter();
  const mode = register ? "register" : "login";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(""); setInvalid("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const pass = String(form.get("password"));
    if (register && pass.length < MIN_PASSWORD) { setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres (escribiste ${pass.length}).`); setInvalid("password"); passwordRef.current?.focus(); return; }
    if (register && pass !== form.get("confirm")) { setError("Las contraseñas no coinciden."); setInvalid("confirm"); confirmRef.current?.focus(); return; }
    setPending(true);
    try {
      const result = register
        ? await authClient.signUp.email({ email, password: pass, name: String(form.get("name")).trim(), callbackURL: "/cuenta/ingresar?verificado=1" })
        : await authClient.signIn.email({ email, password: pass, rememberMe: true });
      if (result.error) { setError(authErrorMessage(mode, result.error.code, result.error.status)); setPending(false); return; }
      router.push(next);
      router.refresh();
    } catch { setError(NETWORK_ERROR); setPending(false); }
  }
  async function signInWithGoogle() {
    setPending(true); setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/cuenta/ingresar?error=google" });
      if (result.error) { setError(authErrorMessage(mode, result.error.code, result.error.status)); setPending(false); }
    } catch { setError(NETWORK_ERROR); setPending(false); }
  }
  return <div className="auth-layout">
    <aside className="auth-aside" aria-label="Beneficios de tu cuenta QuilGym">
      <p className="eyebrow">TU ESPACIO QUILGYM</p>
      <p className="auth-aside__title">{register ? "Tu entrenamiento, más simple." : "Todo tu recorrido, en un solo lugar."}</p>
      <p>{register ? "Creá tu cuenta para guardar lo que te interesa y volver a tus compras cuando quieras." : "Ingresá para encontrar tus favoritos y consultar el estado de tus pedidos."}</p>
      <ul>
        <li><Heart aria-hidden="true"/><span><strong>Favoritos a mano</strong><small>Guardá productos para encontrarlos después.</small></span></li>
        <li><PackageCheck aria-hidden="true"/><span><strong>Seguimiento de compras</strong><small>Consultá el detalle y el estado de tus pedidos.</small></span></li>
        <li><ShieldCheck aria-hidden="true"/><span><strong>Acceso protegido</strong><small>Tus datos de cuenta son privados.</small></span></li>
      </ul>
    </aside>
    <div className="auth-card"><p className="eyebrow">{register ? "CREAR CUENTA" : "INICIAR SESIÓN"}</p><h1>{register ? "Creá tu cuenta" : "Qué bueno verte de nuevo"}</h1><p>{register ? "Guardá tus favoritos y encontrá tus pedidos en un solo lugar." : "Ingresá para seguir con tus favoritos y tus compras."}</p>
    <NoticeBox notice={notice}/>
    {google ? <button type="button" className="button button--outline button--full google-button" disabled={pending || !available} onClick={signInWithGoogle}><span className="google-button__icon" aria-hidden="true"><Image src="/assets/google-signin-icon.svg" alt="" width={40} height={40}/></span>Continuar con Google</button>
      : <><button type="button" className="button button--outline button--full google-button" disabled aria-describedby="auth-google-note"><span className="google-button__icon" aria-hidden="true"><Image src="/assets/google-signin-icon.svg" alt="" width={40} height={40}/></span>Continuar con Google</button>
        <small id="auth-google-note" className="auth-config-note">El acceso con Google no está disponible desde esta dirección o todavía no está configurado. Podés usar tu email.</small></>}
    <div className="auth-divider"><span>o con tu email</span></div>
    <form onSubmit={submit} method="post" aria-busy={pending}>
      {register ? <div className="auth-field"><label htmlFor="auth-name">Nombre</label><input ref={first} id="auth-name" name="name" autoComplete="name" minLength={2} maxLength={80} required placeholder="Tu nombre"/></div> : null}
      <div className="auth-field"><label htmlFor="auth-email">Email</label><input ref={register ? undefined : first} id="auth-email" name="email" type="email" inputMode="email" autoComplete={register ? "email" : "username"} autoCapitalize="none" spellCheck={false} maxLength={254} required placeholder="vos@gmail.com"/></div>
      {register
        ? <PasswordField label="Contraseña" name="password" autoComplete="new-password" placeholder={`Al menos ${MIN_PASSWORD} caracteres`} inputRef={passwordRef} invalid={invalid === "password"} onValue={setPassword}
            hint={<LengthHint length={password.length}/>}/>
        : <PasswordField label="Contraseña" name="password" autoComplete="current-password" placeholder="Tu contraseña"/>}
      {register ? <PasswordField label="Repetí la contraseña" name="confirm" autoComplete="new-password" inputRef={confirmRef} invalid={invalid === "confirm"}/> : null}
      {!register ? (recovery
        ? <Link className="auth-forgot" href="/cuenta/recuperar"><KeyRound aria-hidden="true"/>¿Olvidaste tu contraseña?</Link>
        : <a className="auth-forgot" href={forgotWhatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true"/>¿Olvidaste tu contraseña? Escribinos por WhatsApp<span className="sr-only"> (se abre en otra pestaña)</span></a>) : null}
      {error ? <p role="alert" className="form-error auth-notice auth-notice--error">{error}</p> : null}{!available ? <p role="status" className="auth-notice">Las cuentas todavía no están configuradas en este entorno.</p> : null}
      <Submit pending={pending} disabled={!available} idle={register ? "Crear cuenta" : "Ingresar"} busy={register ? "Creando cuenta…" : "Ingresando…"}/>
    </form>
    <p className="auth-switch">{register ? "¿Ya tenés cuenta?" : "¿Primera vez por acá?"} <Link href={`${register ? "/cuenta/ingresar" : "/cuenta/registro"}?next=${encodeURIComponent(next)}`}>{register ? "Ingresá" : "Registrate"}</Link></p><small className="auth-security"><ShieldCheck aria-hidden="true"/>Tu sesión queda guardada en este navegador. Cerrala si compartís el equipo.</small>
    </div>
  </div>;
}

export function RecoverForm({ available }: { available: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const first = useDesktopAutofocus<HTMLInputElement>();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError("");
    const email = String(new FormData(event.currentTarget).get("email")).trim().toLowerCase();
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: "/cuenta/restablecer" });
      // Respuesta genérica: no revela si el email tiene cuenta. Solo se informan límites, origen o fallas del servicio.
      if (result.error && (result.error.status === 429 || (result.error.status ?? 0) >= 500 || result.error.status === 403)) { setError(authErrorMessage("recover", result.error.code, result.error.status)); setPending(false); return; }
      setSent(true);
    } catch { setError(NETWORK_ERROR); }
    setPending(false);
  }
  if (sent) return <div className="auth-sent" role="status"><CheckCircle2 aria-hidden="true"/><div><strong>Revisá tu email</strong><p>Si hay una cuenta con ese email, te enviamos un enlace para elegir una contraseña nueva. Vence en 1 hora. Mirá también en spam o promociones.</p><Link href="/cuenta/ingresar" className="button button--outline button--full">Volver a ingresar</Link></div></div>;
  return <form onSubmit={submit} method="post" aria-busy={pending}>
    <div className="auth-field"><label htmlFor="recover-email">Email de tu cuenta</label><input ref={first} id="recover-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required placeholder="vos@gmail.com"/></div>
    {error ? <p role="alert" className="form-error auth-notice auth-notice--error">{error}</p> : null}
    <Submit pending={pending} disabled={!available} idle="Enviar enlace" busy="Enviando…"/>
    <p className="auth-switch"><Link href="/cuenta/ingresar">Volver a ingresar</Link></p>
  </form>;
}

export function ResetForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState<"" | "password" | "confirm">("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => { if (window.matchMedia("(min-width: 769px)").matches) passwordRef.current?.focus({ preventScroll: true }); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(""); setInvalid("");
    const form = new FormData(event.currentTarget);
    const pass = String(form.get("password"));
    if (pass.length < MIN_PASSWORD) { setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres (escribiste ${pass.length}).`); setInvalid("password"); passwordRef.current?.focus(); return; }
    if (pass !== form.get("confirm")) { setError("Las contraseñas no coinciden."); setInvalid("confirm"); confirmRef.current?.focus(); return; }
    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword: pass, token });
      if (result.error) { setError(authErrorMessage("reset", result.error.code, result.error.status)); setPending(false); return; }
      router.replace("/cuenta/ingresar?restablecida=1");
    } catch { setError(NETWORK_ERROR); setPending(false); }
  }
  return <form onSubmit={submit} method="post" aria-busy={pending}>
    <PasswordField label="Contraseña nueva" name="password" autoComplete="new-password" placeholder={`Al menos ${MIN_PASSWORD} caracteres`} inputRef={passwordRef} invalid={invalid === "password"} onValue={setPassword}
      hint={<LengthHint length={password.length}/>}/>
    <PasswordField label="Repetí la contraseña nueva" name="confirm" autoComplete="new-password" inputRef={confirmRef} invalid={invalid === "confirm"}/>
    {error ? <p role="alert" className="form-error auth-notice auth-notice--error">{error}</p> : null}
    <Submit pending={pending} idle="Guardar contraseña" busy="Guardando…"/>
    <small className="auth-security"><ShieldCheck aria-hidden="true"/>Al cambiarla se cierran las sesiones abiertas en otros dispositivos.</small>
  </form>;
}
