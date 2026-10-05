"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, X } from "lucide-react";
export function AdvisorLauncher() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const region = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function close(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } }
    function outside(event: PointerEvent) { if (!region.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("keydown", close); document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  if (pathname.startsWith("/asesor") || pathname.startsWith("/checkout")) return null;
  return <div className="advisor-floating" ref={region}>{open ? <section className="advisor-popover" id="advisor-popover" aria-labelledby="advisor-popover-title"><header><span><Bot aria-hidden="true"/><strong id="advisor-popover-title">Asesor QuilGym</strong></span><button type="button" aria-label="Cerrar asesor" onClick={() => { setOpen(false); button.current?.focus(); }}><X/></button></header><div className="advisor-popover-message"><Bot aria-hidden="true"/><p>¡Hola! Contame cómo entrenás y qué querés conseguir. Vamos a explorar opciones y entender por qué podrían encajar con vos.</p></div><p className="advisor-popover-note">Una guía informativa, sin registro.</p><Link className="button button--dark button--full" href="/asesor" onClick={() => setOpen(false)}>Empezar la conversación<ArrowRight aria-hidden="true"/></Link></section> : null}<button ref={button} type="button" className="advisor-floating-button" aria-label={open ? "Cerrar chat del asesor QuilGym" : "Abrir chat del asesor QuilGym"} aria-expanded={open} aria-controls={open ? "advisor-popover" : undefined} onClick={() => setOpen(!open)}>{open ? <X aria-hidden="true"/> : <Bot aria-hidden="true"/>}</button></div>;
}
