import { useId } from "react";

/**
 * Logo de QuilGym: isotipo (una «Q» calada en un cuadrado redondeado, con la cola terminada en un
 * disco de pesa) + logotipo en Archivo expandida. Todo toma `currentColor`, así que el mismo
 * componente sirve en blanco sobre el video del hero, en oscuro sobre el header blanco y en el footer.
 * La «Q» se recorta con una máscara: el fondo real se ve a través, sin depender de un segundo color.
 */
export function LogoMark({ className }: { className?: string }) {
  const maskId = `qg-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="#fff" />
        <circle cx="15" cy="15" r="7.4" fill="none" stroke="#000" strokeWidth="4.2" />
        <path d="M18 18 24.2 24.2" stroke="#000" strokeWidth="3" />
        <path d="M21.6 26.8 26.8 21.6" stroke="#000" strokeWidth="3.6" strokeLinecap="round" />
      </mask>
      <rect width="32" height="32" rx="8" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function Logo({ variant = "full" }: { variant?: "full" | "mark" }) {
  return (
    <span className="logo">
      <LogoMark className="logo__mark" />
      {variant === "full" ? <span className="logo__type" aria-hidden="true">QUILGYM</span> : null}
    </span>
  );
}
