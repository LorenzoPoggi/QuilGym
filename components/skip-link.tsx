"use client";

import { useEffect, type MouseEvent } from "react";

/** Primer foco de cada página: salta el header y lleva el foco al <main>, sin depender de un id en cada ruta. */
export function SkipLink() {
  // El destino #contenido se asigna al <main> de la página para que el enlace también funcione como ancla.
  useEffect(() => {
    const main = document.querySelector("main");
    if (main && !main.id) main.id = "contenido";
  });
  function skip(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.querySelector("main");
    if (!main) return;
    event.preventDefault();
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus();
  }
  return <a className="skip-link" href="#contenido" onClick={skip}>Saltar al contenido</a>;
}
