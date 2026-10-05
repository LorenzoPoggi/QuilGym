"use client";
import Link from "next/link";
import { Star, UserRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "./account-provider";
import { authClient } from "@/lib/auth-client";
import { setMarketingConsent } from "@/lib/account-actions";

export function AccountLink() {
  const { user } = useAccount();
  return <Link className="account-link" aria-label={user ? "Mi cuenta" : "Ingresar a mi cuenta"} href={user ? "/cuenta" : "/cuenta/ingresar"}><UserRound aria-hidden="true"/><span>{user ? `Hola, ${user.name.split(" ")[0]}` : "Hola"}<br/><strong>{user ? "Mi cuenta" : "Ingresar"}</strong></span></Link>;
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
