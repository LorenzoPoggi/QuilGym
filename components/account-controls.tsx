"use client";
import Link from "next/link";
import { ChevronDown, History, LogOut, Package, Settings, Star, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "./account-provider";
import { authClient } from "@/lib/auth-client";
import { setMarketingConsent } from "@/lib/account-actions";
import { AccountAvatar } from "./account-avatar";

export function AccountLink() {
  const { user, authLoading } = useAccount();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (authLoading && !user) return <span className="account-link account-link--loading" role="status" aria-label="Cargando tu cuenta"><span className="account-link-skeleton-icon"/><span className="account-link-skeleton-text"/></span>;
  if (!user) return <Link className="account-link" aria-label="Ingresar a mi cuenta" href="/cuenta/ingresar"><UserRound aria-hidden="true"/><span>Hola<br/><strong>Ingresar</strong></span></Link>;
  return <div className={`account-menu ${open ? "is-open" : ""}`} onMouseLeave={() => setOpen(false)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <button type="button" className="account-menu-trigger" aria-expanded={open} aria-controls="account-menu-panel" onClick={() => setOpen((value) => !value)} onMouseEnter={() => setOpen(true)}>
      <AccountAvatar name={user.name} image={user.image}/><span>Hola<br/><strong>{user.name.split(" ")[0]}</strong></span><ChevronDown aria-hidden="true"/>
    </button>
    <div id="account-menu-panel" className="account-menu-panel" aria-label="Menú de tu cuenta">
      <div className="account-menu-identity"><AccountAvatar name={user.name} image={user.image} size="large"/><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
      <nav aria-label="Secciones de tu cuenta">
        <Link href="/cuenta" onClick={() => setOpen(false)}><UserRound aria-hidden="true"/>Ver perfil</Link>
        <Link href="/cuenta/compras" onClick={() => setOpen(false)}><Package aria-hidden="true"/>Compras</Link>
        <Link href="/cuenta/historial" onClick={() => setOpen(false)}><History aria-hidden="true"/>Historial</Link>
        <Link href="/cuenta/favoritos" onClick={() => setOpen(false)}><Star aria-hidden="true"/>Favoritos</Link>
        <Link href="/cuenta/configuracion" onClick={() => setOpen(false)}><Settings aria-hidden="true"/>Configuración</Link>
      </nav>
      <button type="button" className="account-menu-signout" onClick={async () => { await authClient.signOut(); setOpen(false); router.push("/"); router.refresh(); }}><LogOut aria-hidden="true"/>Salir</button>
      <Link className="account-menu-danger" href="/cuenta/configuracion#eliminar-cuenta" onClick={() => setOpen(false)}><Trash2 aria-hidden="true"/>Eliminar cuenta</Link>
    </div>
  </div>;
}
export function FavoriteButton({ productId, name }: { productId: number; name: string }) {
  const { ids, toggle, loading, error } = useAccount();
  const [pending, setPending] = useState(false);
  const [clicked, setClicked] = useState(false);
  const saved = ids.includes(productId);
  return <><button className={`favorite-button ${saved ? "is-saved" : ""}`} type="button" aria-label={`${saved ? "Quitar de" : "Guardar en"} favoritos: ${name}`} aria-pressed={saved} disabled={loading || pending} onClick={async () => { setPending(true); setClicked(true); try { await toggle(productId); } finally { setPending(false); } }}><Star aria-hidden="true" fill={saved ? "currentColor" : "none"}/></button>{clicked && error ? <span className="favorite-error" role="status">{error}</span> : null}</>;
}
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <><button className="button button--outline" disabled={pending} onClick={async () => { setPending(true); try { const result = await authClient.signOut(); if (result.error) throw new Error(); router.push("/"); router.refresh(); } catch { setError("No pudimos cerrar la sesión."); setPending(false); router.refresh(); } }}>Cerrar sesión</button>{error ? <p role="alert">{error}</p> : null}</>;
}
export function MarketingPreference({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [status, setStatus] = useState("");
  return <div><label className="account-checkbox"><input type="checkbox" checked={enabled} onChange={async (event) => { const value = event.target.checked; try { const result = await setMarketingConsent(value); if (result.ok) { setEnabled(value); setStatus("Preferencia guardada."); } else setStatus("No pudimos guardar el cambio."); } catch { setStatus("No pudimos guardar el cambio."); } }}/><span>Quiero recibir novedades, lanzamientos y ofertas por email.</span></label><small>Opcional. Podés cambiarlo cuando quieras. El envío de campañas se habilitará más adelante.</small><p role="status">{status}</p></div>;
}
