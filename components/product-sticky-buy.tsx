"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { formatArs } from "@/lib/commerce";
import { BagIcon } from "./icons";

type StickyBuyProps = {
  /** Bloque de compra de la ficha: la barra aparece cuando quedó arriba, fuera de pantalla. */
  target: RefObject<HTMLElement | null>;
  name: string;
  priceArs: number;
  quantity: number;
  soldOut: boolean;
  busy: "add" | "buy" | null;
  onSubmit: (mode: "add" | "buy", source: HTMLElement | null) => void;
};

/** Barra de compra fija de la ficha en mobile. Reusa el submit de ProductPurchase: nunca envía precios. */
export function ProductStickyBuy({ target, name, priceArs, quantity, soldOut, busy, onSubmit }: StickyBuyProps) {
  const bar = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = target.current;
    if (!node) return;
    const mobile = window.matchMedia("(max-width: 768px)");
    let passed = false;
    const update = () => setVisible(mobile.matches && passed);
    // El header es sticky: el bloque cuenta como oculto cuando queda debajo de él.
    const header = document.querySelector<HTMLElement>(".site-header")?.offsetHeight ?? 0;
    const observer = new IntersectionObserver(([entry]) => {
      passed = !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? header);
      update();
    }, { rootMargin: `-${header}px 0px 0px 0px` });
    observer.observe(node);
    mobile.addEventListener("change", update);
    return () => { observer.disconnect(); mobile.removeEventListener("change", update); };
  }, [target]);

  // --sticky-buy-h corre los botones flotantes y el final del footer mientras la barra se ve.
  useEffect(() => {
    const node = bar.current;
    if (!visible || !node) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--sticky-buy-h", `${node.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => { observer.disconnect(); root.style.removeProperty("--sticky-buy-h"); };
  }, [visible]);

  return (
    <div ref={bar} className={`sticky-buy ${soldOut ? "sticky-buy--out" : ""} ${visible ? "is-visible" : ""}`} role="region" aria-label="Compra rápida" inert={!visible}>
      <div className="sticky-buy__info"><span>{name}</span><strong>{quantity > 1 && !soldOut ? `${quantity} × ` : ""}{formatArs(priceArs)}</strong></div>
      {soldOut ? <button type="button" className="button button--outline" disabled>Sin stock por el momento</button> : <>
        <button type="button" className="button button--outline" aria-disabled={busy !== null || undefined} aria-label={`Agregar ${name} al carrito`} onClick={(event) => onSubmit("add", event.currentTarget)}><BagIcon/> {busy === "add" ? "Agregando…" : "Agregar"}</button>
        <button type="button" className="button button--dark" aria-disabled={busy !== null || undefined} onClick={(event) => onSubmit("buy", event.currentTarget)}>{busy === "buy" ? "Procesando…" : "Comprar ahora"}</button>
      </>}
    </div>
  );
}
