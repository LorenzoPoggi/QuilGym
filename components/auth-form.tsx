"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ register, google, available, next }: { register: boolean; google: boolean; available: boolean; next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    if (register && password !== form.get("confirm")) { setError("Las contraseñas no coinciden."); setPending(false); return; }
    try {
      const result = register ? await authClient.signUp.email({ email, password, name: String(form.get("name")).trim() }) : await authClient.signIn.email({ email, password, rememberMe: true });
      if (result.error) { setError(result.error.status === 429 ? "Demasiados intentos. Esperá un minuto y volvé a probar." : register ? "No pudimos crear la cuenta. Revisá los datos; si ya tenés cuenta, ingresá." : "Email o contraseña incorrectos."); setPending(false); return; }
      router.push(next);
      router.refresh();
    } catch { setError("No pudimos conectar. Intentá nuevamente."); setPending(false); }
  }
  return <div className="auth-card"><p className="eyebrow">TU ESPACIO QUILGYM</p><h1>{register ? "Creá tu cuenta" : "Qué bueno verte de nuevo"}</h1><p>{register ? "Guardá tus favoritos y encontrá tus pedidos en un solo lugar." : "Ingresá para seguir con tus favoritos y tus compras."}</p>
    <button type="button" className="button button--outline button--full google-button" disabled={!google || pending} onClick={async () => { setPending(true); setError(""); try { const result = await authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/cuenta/ingresar?error=google" }); if (result.error) throw new Error(); } catch { setError("No pudimos iniciar el acceso con Google."); setPending(false); } }}><span aria-hidden="true">G</span>Continuar con Google</button>
    {!google ? <small className="auth-config-note">El acceso con Google estará disponible cuando terminemos su configuración.</small> : null}
    <div className="auth-divider"><span>o con tu email</span></div>
    <form onSubmit={submit}>{register ? <label>Nombre<input name="name" autoComplete="name" minLength={2} maxLength={80} required placeholder="Tu nombre"/></label> : null}<label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="vos@gmail.com"/></label><label>Contraseña<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 10 : undefined} maxLength={128} required placeholder={register ? "Al menos 10 caracteres" : "Tu contraseña"}/></label>{register ? <label>Repetí la contraseña<input name="confirm" type="password" autoComplete="new-password" maxLength={128} required/></label> : null}
      {error ? <p role="alert" className="form-error">{error}</p> : null}{!available ? <p role="status">Las cuentas todavía no están configuradas en este entorno.</p> : null}
      <button className="button button--dark button--full" disabled={pending || !available}>{pending ? "Un momento…" : register ? "Crear cuenta" : "Ingresar"}<ArrowRight aria-hidden="true"/></button></form>
    <p className="auth-switch">{register ? "¿Ya tenés cuenta?" : "¿Primera vez por acá?"} <Link href={`${register ? "/cuenta/ingresar" : "/cuenta/registro"}?next=${encodeURIComponent(next)}`}>{register ? "Ingresá" : "Registrate"}</Link></p><small className="auth-security"><ShieldCheck aria-hidden="true"/>Tu sesión queda guardada en este navegador. Cerrala si compartís el equipo.</small>
  </div>;
}
