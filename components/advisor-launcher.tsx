"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, MessageCircle, X } from "lucide-react";
import { whatsappUrl } from "@/lib/commerce";
import { WhatsAppGlyph } from "./icons";

export function AdvisorLauncher() {
  const [open, setOpen] = useState(false);
  const [dial, setDial] = useState(false);
  const pathname = usePathname();
  const region = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const dialButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open && !dial) return;
    function close(event: KeyboardEvent) { if (event.key !== "Escape") return; setOpen(false); setDial(false); (dial ? dialButton : button).current?.focus(); }
    function outside(event: PointerEvent) { if (!region.current?.contains(event.target as Node)) { setOpen(false); setDial(false); } }
    // Al cruzar el corte de 768px cambia la variante visible: se cierra lo que haya quedado abierto.
    const media = window.matchMedia("(max-width: 768px)");
    function reset() { setOpen(false); setDial(false); }
    document.addEventListener("keydown", close); document.addEventListener("pointerdown", outside); media.addEventListener("change", reset);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); media.removeEventListener("change", reset); };
  }, [open, dial]);
  if (pathname.startsWith("/asesor") || pathname.startsWith("/checkout")) return null;
  return <div className="advisor-floating" ref={region} onBlur={(event) => {
    // Con teclado, salir del grupo cierra el menú mobile. Sin relatedTarget (tap) se deja al clic afuera.
    const next = event.relatedTarget as Node | null;
    if (dial && next && !event.currentTarget.contains(next)) setDial(false);
  }}>
    {open ? <section className="advisor-popover" id="advisor-popover" aria-labelledby="advisor-popover-title"><header><span><Bot aria-hidden="true"/><strong id="advisor-popover-title">Asesor QuilGym</strong></span><button type="button" aria-label="Cerrar asesor" onClick={() => { setOpen(false); button.current?.focus(); }}><X/></button></header><div className="advisor-popover-message"><Bot aria-hidden="true"/><p>¡Hola! Contame cómo entrenás y qué querés conseguir. Vamos a explorar opciones y entender por qué podrían encajar con vos.</p></div><p className="advisor-popover-note">Una guía informativa, sin registro.</p><Link className="button button--dark button--full" href="/asesor" onClick={() => setOpen(false)}>Empezar la conversación<ArrowRight aria-hidden="true"/></Link></section> : null}
    {/* Desktop: WhatsApp y asesor por separado. */}
    <a className="whatsapp-floating-button" href={whatsappUrl()} target="_blank" rel="noopener noreferrer" aria-label="Contactar a QuilGym por WhatsApp"><WhatsAppGlyph/></a>
    <button ref={button} type="button" className="advisor-floating-button" aria-label={open ? "Cerrar chat del asesor QuilGym" : "Abrir chat del asesor QuilGym"} aria-expanded={open} aria-controls={open ? "advisor-popover" : undefined} onClick={() => setOpen(!open)}>{open ? <X aria-hidden="true"/> : <Bot aria-hidden="true"/>}</button>
    {/* Mobile: un solo botón que despliega los dos accesos para no tapar el contenido. */}
    <button ref={dialButton} type="button" className="floating-dial-toggle" aria-label="Ayuda: WhatsApp y asesor QuilGym" aria-expanded={dial} aria-controls={dial ? "floating-dial" : undefined} onClick={() => setDial(!dial)}>{dial ? <X aria-hidden="true"/> : <MessageCircle aria-hidden="true"/>}</button>
    {dial ? <div className="floating-dial" id="floating-dial">
      <a className="floating-dial__item" href={whatsappUrl()} target="_blank" rel="noopener noreferrer" onClick={() => setDial(false)}><span className="floating-dial__icon floating-dial__icon--whatsapp"><WhatsAppGlyph/></span>WhatsApp</a>
      <Link className="floating-dial__item" href="/asesor" onClick={() => setDial(false)}><span className="floating-dial__icon"><Bot aria-hidden="true"/></span>Asesor QuilGym</Link>
    </div> : null}
  </div>;
}
