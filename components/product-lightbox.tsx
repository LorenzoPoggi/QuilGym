"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/motion";

export type LightboxImage = { url: string; alt: string; kind: "product" | "nutrition"; width: number; height: number };

const ZOOM = 2.5;
const clamp = (value: number) => Math.min(100, Math.max(0, value));

/** Índice visible de un track horizontal con scroll-snap. `scrollToIndex` fija el destino y evita saltar por los intermedios. */
export function useSnapTrack(ref: React.RefObject<HTMLDivElement | null>, count: number) {
  const target = useRef<number | null>(null);
  const timer = useRef(0);
  const [index, setIndex] = useState(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Si se deslizó antes de hidratar, arranca desde la foto que quedó visible.
  useEffect(() => {
    const track = ref.current;
    if (track?.scrollLeft && track.clientWidth) setIndex(Math.min(count - 1, Math.round(track.scrollLeft / track.clientWidth)));
  }, [ref, count]);

  function visible() {
    const track = ref.current;
    return track && track.clientWidth ? Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth))) : null;
  }

  function onScroll() {
    window.clearTimeout(timer.current);
    const now = visible();
    if (now !== null && target.current === null) setIndex(now);
    timer.current = window.setTimeout(() => {
      const track = ref.current;
      const wanted = target.current;
      target.current = null;
      const settled = visible();
      if (!track || settled === null) return;
      // Si un destino nuevo cortó el desplazamiento anterior y no se llegó, termina de llevarlo ahí.
      if (wanted !== null && Math.abs(track.scrollLeft - wanted * track.clientWidth) >= 1) track.scrollTo({ left: wanted * track.clientWidth, behavior: "auto" });
      setIndex(wanted ?? settled);
    }, 120);
  }

  function scrollToIndex(next: number, smooth = true) {
    const track = ref.current;
    setIndex(next);
    if (!track) return;
    const left = next * track.clientWidth;
    // Con un desplazamiento en curso hay que pedir el nuevo destino aunque ya estemos ahí, para cortarlo.
    if (target.current === null && Math.abs(track.scrollLeft - left) < 1) return;
    target.current = next;
    track.scrollTo({ left, behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
  }

  /** El usuario toma el control (dedo, mouse o rueda): se descarta el destino pendiente. */
  function release() { target.current = null; }

  return { index, setIndex, onScroll, scrollToIndex, release };
}

/** Caja sin transformar del marco que se amplía (los offset* ignoran el transform). */
function frameBox(slide: HTMLElement) {
  const frame = slide.firstElementChild as HTMLElement;
  const rect = slide.getBoundingClientRect();
  return { left: rect.left + frame.offsetLeft, top: rect.top + frame.offsetTop, width: frame.offsetWidth, height: frame.offsetHeight };
}

type LightboxProps = {
  images: LightboxImage[];
  /** Foto con la que se abre; null = cerrado. */
  index: number | null;
  title: string;
  /** Se llama cuando el diálogo ya se cerró, con la foto que quedó visible. */
  onClose: (index: number) => void;
};

/** Visor a pantalla completa: diálogo modal nativo con swipe, flechas, teclado y zoom con paneo. */
export function ProductLightbox({ images, index, title, onClose }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef(0);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { index: current, setIndex, onScroll, scrollToIndex, release } = useSnapTrack(trackRef, images.length);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [openedAt, setOpenedAt] = useState(index);
  const total = images.length;

  if (index !== openedAt) {
    setOpenedAt(index);
    if (index !== null) { setIndex(index); setZoomed(false); }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || index === null) return;
    if (!dialog.open) dialog.showModal();
    dialog.dataset.state = "open";
    const strip = trackRef.current;
    strip?.scrollTo({ left: index * strip.clientWidth, behavior: "auto" });
  }, [index]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function requestClose() {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.dataset.state === "closing") return;
    dialog.dataset.state = "closing";
    closeTimer.current = window.setTimeout(() => dialog.close(), reducedMotion() ? 0 : 220);
  }

  function go(next: number) {
    setZoomed(false);
    scrollToIndex((next + total) % total);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (total < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    go(current + (event.key === "ArrowRight" ? 1 : -1));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = { x: event.clientX, y: event.clientY, moved: 0 };
    if (zoomed && event.pointerType !== "mouse") event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const dx = start ? event.clientX - start.x : 0;
    const dy = start ? event.clientY - start.y : 0;
    if (start) drag.current = { x: event.clientX, y: event.clientY, moved: start.moved + Math.abs(dx) + Math.abs(dy) };
    if (!zoomed) return;
    const box = frameBox(event.currentTarget);
    // Con mouse el punto ampliado sigue al cursor; con el dedo la imagen acompaña el arrastre.
    if (event.pointerType === "mouse") setOrigin({ x: clamp(((event.clientX - box.left) / box.width) * 100), y: clamp(((event.clientY - box.top) / box.height) * 100) });
    else if (start) setOrigin((value) => ({ x: clamp(value.x - (dx / (ZOOM - 1) / box.width) * 100), y: clamp(value.y - (dy / (ZOOM - 1) / box.height) * 100) }));
  }

  function onSlideClick(event: React.MouseEvent<HTMLDivElement>, image: LightboxImage) {
    const moved = drag.current?.moved ?? 0;
    drag.current = null;
    if (moved > 8) return;
    if (zoomed) { setZoomed(false); return; }
    const box = frameBox(event.currentTarget);
    const ratio = image.width / image.height;
    const width = Math.min(box.width, box.height * ratio);
    const height = width / ratio;
    const left = box.left + (box.width - width) / 2;
    const top = box.top + (box.height - height) / 2;
    // Tocar fuera de la foto (el fondo) cierra; sobre la foto, amplía en ese punto.
    if (event.clientX < left || event.clientX > left + width || event.clientY < top || event.clientY > top + height) { requestClose(); return; }
    setOrigin({ x: clamp(((event.clientX - box.left) / box.width) * 100), y: clamp(((event.clientY - box.top) / box.height) * 100) });
    setZoomed(true);
  }

  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      aria-label={`Fotos de ${title}`}
      onCancel={(event) => { event.preventDefault(); if (zoomed) setZoomed(false); else requestClose(); }}
      onClose={(event) => { delete event.currentTarget.dataset.state; setZoomed(false); onClose(current); }}
      onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      onKeyDown={onKeyDown}
    >
      {index !== null ? (
        <>
          <header className="lightbox-bar">
            <p className="lightbox-counter" aria-live="polite"><span aria-hidden="true">{current + 1} / {total}</span><span className="sr-only">Foto {current + 1} de {total}</span></p>
            <button type="button" className="lightbox-close" onClick={requestClose} aria-label="Cerrar"><X aria-hidden="true"/></button>
          </header>
          <div className={`lightbox-track ${zoomed ? "is-zoomed" : ""}`} ref={trackRef} onScroll={onScroll} onPointerDown={release} onWheel={release} tabIndex={0} role="region" aria-label="Fotos ampliadas">
            {images.map((image, slide) => (
              <div
                className={`lightbox-slide ${slide === current && zoomed ? "is-zoomed" : ""}`}
                aria-hidden={slide !== current || undefined}
                onPointerDown={onPointerDown}
                onPointerMove={slide === current ? onPointerMove : undefined}
                onPointerCancel={() => { drag.current = null; }}
                onClick={(event) => onSlideClick(event, image)}
                key={image.url}
              >
                <div className="lightbox-frame" style={slide === current ? { transform: zoomed ? `scale(${ZOOM})` : undefined, transformOrigin: `${origin.x}% ${origin.y}%` } : undefined}>
                  <Image src={image.url} alt={image.alt} fill sizes="100vw" loading={slide === openedAt ? "eager" : "lazy"} draggable={false}/>
                </div>
              </div>
            ))}
          </div>
          {total > 1 ? (
            <>
              <button type="button" className="lightbox-arrow lightbox-arrow--prev" onClick={() => go(current - 1)} aria-label="Foto anterior"><ChevronLeft aria-hidden="true"/></button>
              <button type="button" className="lightbox-arrow lightbox-arrow--next" onClick={() => go(current + 1)} aria-label="Foto siguiente"><ChevronRight aria-hidden="true"/></button>
            </>
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}
