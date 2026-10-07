"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/motion";

const AUTOPLAY_MS = 1200;
const sizes = "(max-width: 1100px) 50vw, 25vw";
const currentIndex = (el: HTMLElement) => Math.round(el.scrollLeft / el.clientWidth);

function scrollToPhoto(el: HTMLElement, index: number, count: number) {
  el.scrollTo({ left: ((index + count) % count) * el.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
}

/**
 * Carrusel de fotos de la tarjeta: swipe nativo con scroll-snap y flechas con mouse.
 * Con el mouse sobre la tarjeta recorre las fotos solo; usar las flechas lo detiene y al salir vuelve a la primera.
 */
export function ProductCardMedia({ href, name, photos, preload = false }: { href: string; name: string; photos: string[]; preload?: boolean }) {
  const track = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [active, setActive] = useState(0);
  const [warm, setWarm] = useState(false);
  const count = photos.length;

  useEffect(() => {
    // Se escucha en toda la tarjeta para que pasar por la estrella o el texto no corte el recorrido.
    const card = track.current?.closest<HTMLElement>(".product-card");
    if (!card) return;
    const stop = () => { window.clearInterval(timer.current); timer.current = undefined; };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      setWarm(true);
      if (timer.current || reducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      timer.current = window.setInterval(() => { if (track.current) scrollToPhoto(track.current, currentIndex(track.current) + 1, count); }, AUTOPLAY_MS);
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      stop();
      if (track.current) scrollToPhoto(track.current, 0, count);
    };
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    return () => { stop(); card.removeEventListener("pointerenter", enter); card.removeEventListener("pointerleave", leave); };
  }, [count]);

  // Si se deslizó antes de hidratar, marca la foto que quedó visible.
  useEffect(() => {
    if (track.current?.scrollLeft) setActive(Math.min(count - 1, currentIndex(track.current)));
  }, [count]);

  function step(delta: number) {
    window.clearInterval(timer.current);
    timer.current = -1; // Manda el control manual hasta que el mouse salga de la tarjeta.
    if (track.current) scrollToPhoto(track.current, active + delta, count);
  }

  function onScroll() {
    if (track.current) setActive(Math.min(count - 1, Math.max(0, currentIndex(track.current))));
  }

  return (
    <div className="card-media">
      <Link ref={track} href={href} className="card-media-track" aria-label={`Ver ${name}`} onScroll={onScroll} draggable={false}>
        {photos.map((src, index) => (
          <div className="product-thumb card-media-slide" key={src}>
            <Image src={src} alt="" fill sizes={sizes} preload={preload && index === 0} loading={preload && index === 0 ? undefined : warm ? "eager" : "lazy"} draggable={false}/>
          </div>
        ))}
      </Link>
      <button type="button" className="card-media-arrow card-media-arrow--prev" aria-label={`Foto anterior de ${name}`} onClick={() => step(-1)}><ChevronLeft aria-hidden="true"/></button>
      <button type="button" className="card-media-arrow card-media-arrow--next" aria-label={`Foto siguiente de ${name}`} onClick={() => step(1)}><ChevronRight aria-hidden="true"/></button>
      <div className="card-media-dots" aria-hidden="true">{photos.map((src, index) => <span key={src} className={index === active ? "is-active" : undefined}/>)}</div>
    </div>
  );
}
