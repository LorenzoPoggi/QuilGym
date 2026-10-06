"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AccountAvatar } from "./account-avatar";
import { MarketingPreference, SignOutButton } from "./account-controls";

const avatars = [
  { value: "", label: "Iniciales" },
  { value: "/assets/avatars/bolt.svg", label: "Rayo" },
  { value: "/assets/avatars/weight.svg", label: "Pesa" },
  { value: "/assets/avatars/kettlebell.svg", label: "Pesa rusa" },
  { value: "/assets/avatars/plate.svg", label: "Disco de pesas" },
  { value: "/assets/avatars/shaker.svg", label: "Shaker" },
  { value: "/assets/avatars/trophy.svg", label: "Trofeo" },
  { value: "/assets/avatars/runner.svg", label: "Corredor" },
];

export function AccountSettings({ name: initialName, image: initialImage, marketing, hasPassword, googleLinked, googleAvailable }: { name: string; image: string | null | undefined; marketing: boolean; hasPassword: boolean; googleLinked: boolean; googleAvailable: boolean }) {
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage ?? "");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();
  const choices = initialImage?.startsWith("https://") ? [{ value: initialImage, label: "Foto actual" }, ...avatars] : avatars;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2 || trimmed.length > 80) { setStatus("El nombre debe tener entre 2 y 80 caracteres."); return; }
    setPending(true); setStatus("");
    try {
      const result = await authClient.updateUser({ name: trimmed, image: image || null });
      if (result.error) throw new Error();
      setStatus("Tu perfil se actualizó.");
      router.refresh();
    } catch { setStatus("No pudimos actualizar tu perfil. Reintentá."); }
    finally { setPending(false); }
  }
  return <><form className="settings-card" onSubmit={save}><h3>Datos personales</h3><label>Nombre que aparece en tu cuenta<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required/></label><p>Tu email se usa para ingresar y consultar tus compras.</p><fieldset><legend>Elegí tu avatar</legend><div className="avatar-options">{choices.map((choice) => <label title={choice.label} key={choice.value}><input type="radio" name="avatar" value={choice.value} checked={image === choice.value} onChange={() => setImage(choice.value)}/><AccountAvatar name={name} image={choice.value} size="large"/><span className="sr-only">{choice.label}</span></label>)}</div></fieldset><button className="button button--dark" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar cambios"}</button><p role="status" className="settings-status">{status}</p></form>
    <GoogleConnection linked={googleLinked} available={googleAvailable}/>
    <section className="settings-card account-settings-preferences"><h3>Novedades y ofertas</h3><MarketingPreference initial={marketing}/></section>
    <section className="settings-card account-settings-preferences"><h3>Sesión</h3><p>Si compartís este dispositivo, cerrá tu sesión al terminar.</p><SignOutButton/></section>
    <DeleteAccount hasPassword={hasPassword}/>
  </>;
}

function GoogleConnection({ linked, available }: { linked: boolean; available: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function linkGoogle() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.linkSocial({ provider: "google", callbackURL: "/cuenta/configuracion", errorCallbackURL: "/cuenta/configuracion?google=error" });
      if (result.error) throw new Error();
    } catch {
      setError("No pudimos iniciar la vinculación con Google. Reintentá.");
      setPending(false);
    }
  }
  return <section className="settings-card account-settings-preferences"><h3>Acceso con Google</h3><p>{linked ? "Tu cuenta ya está vinculada con Google. Podés ingresar con cualquiera de los métodos asociados." : "Si ya usás email y contraseña, vinculá Google desde acá para conservar tus compras, favoritos e historial en la misma cuenta. Elegí en Google la misma dirección de email."}</p>
    {!linked && available ? <button className="button button--outline" type="button" disabled={pending} onClick={linkGoogle}>{pending ? "Conectando…" : "Vincular mi cuenta con Google"}</button> : null}
    {!linked && !available ? <p>Google todavía no está configurado en este entorno.</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </section>;
}

function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function removeAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "ELIMINAR" || (hasPassword && !password)) return;
    setPending(true);
    setError("");
    try {
      const result = await authClient.deleteUser(hasPassword ? { password } : {});
      if (result.error) {
        setError(result.error.code === "INVALID_PASSWORD" ? "La contraseña no es correcta." : result.error.code === "SESSION_EXPIRED" ? "Por seguridad, cerrá sesión y volvé a ingresar con Google antes de eliminar tu cuenta." : "No pudimos eliminar tu cuenta. Reintentá.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("No pudimos conectar para eliminar tu cuenta. Reintentá.");
    } finally {
      setPending(false);
    }
  }

  return <section id="eliminar-cuenta" className="settings-card account-settings-danger"><h3>Eliminar cuenta</h3><p>Esta acción es definitiva: se borrarán tu perfil, acceso, favoritos e historial. Los pedidos ya registrados quedarán desvinculados de tu cuenta, pero conservarán sus datos para la gestión de la compra.</p>
    <form onSubmit={removeAccount}>
      {hasPassword ? <label>Contraseña actual<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label> : <p>Si ingresaste con Google hace más de un día, tendrás que cerrar sesión y volver a ingresar antes de confirmar.</p>}
      <label>Escribí ELIMINAR para confirmar<input type="text" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required/></label>
      <button className="button button--outline account-delete-button" type="submit" disabled={pending || confirmation !== "ELIMINAR" || (hasPassword && !password)}>{pending ? "Eliminando…" : "Eliminar mi cuenta definitivamente"}</button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </form>
  </section>;
}
