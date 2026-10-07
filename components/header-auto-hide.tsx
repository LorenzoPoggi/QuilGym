"use client";

import { useEffect, useRef, type ReactNode } from "react";

const THRESHOLD = 8;
const TOP_ZONE = 120;

/** Header sticky que marca `data-scroll="down"/"up"`. En ≤768 el CSS colapsa la fila de búsqueda al bajar. */
export function HeaderAutoHide({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const media = window.matchMedia("(max-width: 768px)");
    let lastY = Math.max(window.scrollY, 0);
    let frame = 0;
    const set = (state: "up" | "down") => { if (header.dataset.scroll !== state) header.dataset.scroll = state; };

    function update() {
      frame = 0;
      const y = Math.max(window.scrollY, 0);
      // Nunca se oculta con el buscador enfocado, cerca del inicio ni en desktop.
      if (!media.matches || y < TOP_ZONE || header!.querySelector(".search")?.contains(document.activeElement)) { set("up"); lastY = y; return; }
      if (Math.abs(y - lastY) < THRESHOLD) return;
      set(y > lastY ? "down" : "up");
      lastY = y;
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    const reveal = () => set("up");

    set("up");
    window.addEventListener("scroll", onScroll, { passive: true });
    media.addEventListener("change", reveal);
    header.addEventListener("focusin", reveal);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      media.removeEventListener("change", reveal);
      header.removeEventListener("focusin", reveal);
    };
  }, []);

  return <header ref={ref} className={className}>{children}</header>;
}
