"use client";
import Link from "next/link";
import { useState } from "react";
import { History, Trash2 } from "lucide-react";

type Entry = { id: number; query: string; createdAt: string };

export function AccountHistory({ initial }: { initial: Entry[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState("");
  async function remove(id: number) {
    setError("");
    try {
      const response = await fetch("/api/account/history", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setItems(data.items);
    } catch { setError("No pudimos borrar esa búsqueda. Reintentá."); }
  }
  return <>{error ? <p role="alert" className="form-error">{error}</p> : null}{items.length ? <div className="account-list">{items.map((item) => <div className="history-row" key={item.id}><Link href={`/buscar?q=${encodeURIComponent(item.query)}`}><History aria-hidden="true"/><span>{item.query}</span></Link><small>{new Date(item.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })}</small><button type="button" onClick={() => void remove(item.id)} aria-label={`Borrar búsqueda ${item.query}`}><Trash2 aria-hidden="true"/></button></div>)}</div> : <div className="account-empty"><History aria-hidden="true"/><h3>Todavía no hay búsquedas</h3><p>Lo que busques mientras tengas la sesión iniciada aparecerá acá.</p><Link className="button button--dark" href="/buscar">Buscar productos</Link></div>}</>;
}
