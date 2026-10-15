"use client";

import { useInstallmentsData } from "./installments-provider";

/**
 * Logos de las tarjetas aceptadas, tomados de Mercado Pago (`secure_thumbnail`, solo activas de crédito o débito).
 * Sin datos de Mercado Pago no se muestra nada. Cada logo lleva el nombre como texto alternativo.
 */
export function AcceptedCards({ className = "", label = "Tarjetas aceptadas", showLabel = true, type }: { className?: string; label?: string; showLabel?: boolean; type?: "credit" | "debit" }) {
  const data = useInstallmentsData();
  const seen = new Set<string>();
  // Sin filtro de tipo, Visa y Visa débito comparten logo: se muestra una sola vez.
  const cards = (data?.cards ?? []).filter((card) => (!type || card.type === type) && !seen.has(card.thumbnail) && seen.add(card.thumbnail));
  if (cards.length === 0) return null;
  return <div className={`accepted-cards ${className}`.trim()} role="group" aria-label={label}>
    {showLabel ? <span className="accepted-cards__label" aria-hidden="true">{label}</span> : null}
    <ul>{cards.map((card) => <li key={card.id}>
      {/* Logos oficiales alojados por Mercado Pago: tamaño fijo, sin pasar por el optimizador de imágenes. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.thumbnail} alt={card.name} title={card.name} height={22} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
    </li>)}</ul>
  </div>;
}
