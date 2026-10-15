"use client";

import { useId, useState } from "react";
import { CreditCard } from "lucide-react";
import { commerce, formatArs } from "@/lib/commerce";
import { buildOffer, formatPct, type InstallmentQuote } from "@/lib/installments-core";
import { AcceptedCards } from "./accepted-cards";
import { useInstallmentsData } from "./installments-provider";

const costText = (quote: InstallmentQuote) => quote.interestFree ? "" : ` · CFT ${formatPct(quote.cft)}`;

function useOffer(price: number) {
  const data = useInstallmentsData();
  return buildOffer(price, data, { maxInstallments: commerce.maxCardInstallments, interestFree: commerce.interestFreeInstallments });
}

/**
 * Línea compacta para las tarjetas de producto. Con cuotas con interés informa el costo financiero total (CFT)
 * en la misma línea y con el mismo tamaño; con cuotas sin interés confirmadas por el negocio las destaca.
 */
export function InstallmentsLine({ price, onlyInterestFree = false }: { price: number; onlyInterestFree?: boolean }) {
  const offer = useOffer(price);
  if (!offer) return null;
  const free = offer.interestFreeHeadline;
  // En las tarjetas solo se anuncian cuotas sin interés: las cuotas con interés y su CFT quedan para la ficha.
  if (!free && onlyInterestFree) return null;
  if (free) return <p className="installments-line installments-line--free"><strong>{free.n} cuotas sin interés de {formatArs(free.amount)}</strong></p>;
  const { headline } = offer;
  return <p className="installments-line">Hasta {headline.n} cuotas de {formatArs(headline.amount)}{costText(headline)}</p>;
}

/** Bloque de la ficha: oferta destacada, marcas aceptadas y tabla «Ver cuotas» por tarjeta. */
export function InstallmentsBlock({ price }: { price: number }) {
  const offer = useOffer(price);
  const data = useInstallmentsData();
  const [selected, setSelected] = useState(0);
  const tabsId = useId();
  if (!offer) return data?.cards.length ? <div className="installments-box"><AcceptedCards label="Pagá con tarjeta"/></div> : null;
  const { headline, interestFreeHeadline } = offer;
  const card = offer.byCard[Math.min(selected, offer.byCard.length - 1)];
  const hasInterest = offer.byCard.some((item) => item.quotes.some((quote) => quote.n > 1 && !quote.interestFree));
  return <section className="installments-box" aria-label="Cuotas con tarjeta de crédito">
    <p className="installments-box__headline"><CreditCard aria-hidden="true"/>
      {interestFreeHeadline
        ? <span><strong>{interestFreeHeadline.n} cuotas sin interés de {formatArs(interestFreeHeadline.amount)}</strong></span>
        : <span>Hasta <strong>{headline.n} cuotas de {formatArs(headline.amount)}</strong></span>}
    </p>
    {!interestFreeHeadline ? <p className="installments-box__cost">Total {formatArs(headline.total)}{costText(headline)} · TEA {formatPct(headline.tea)}</p> : null}
    <AcceptedCards type="credit" label="Tarjetas de crédito aceptadas" className="installments-box__cards"/>
    <details className="installments-box__details">
      <summary>Ver cuotas</summary>
      <div className="installments-box__tabs" role="group" aria-label="Elegí tu tarjeta">
        {offer.byCard.map((item, index) => <button type="button" key={item.id} aria-pressed={index === selected} aria-controls={`${tabsId}-table`} onClick={() => setSelected(index)}>{item.name}</button>)}
      </div>
      <div className="installments-box__scroll" id={`${tabsId}-table`}>
        <table>
          <caption className="sr-only">Cuotas con {card.name} para {formatArs(price)}</caption>
          <thead><tr><th scope="col">Cuotas</th><th scope="col">Valor de cada cuota</th><th scope="col">Total</th><th scope="col">CFT</th></tr></thead>
          <tbody>{card.quotes.map((quote) => <tr key={quote.n}>
            <th scope="row">{quote.n === 1 ? "1 pago" : quote.interestFree ? `${quote.n} sin interés` : `${quote.n} cuotas`}</th>
            <td>{formatArs(quote.amount)}</td><td>{formatArs(quote.total)}</td><td>{quote.n === 1 || quote.interestFree ? "—" : formatPct(quote.cft)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {hasInterest ? <p className="installments-box__legal">Cuotas con interés. CFT: costo financiero total, expresado en tasa efectiva anual; TEA: tasa efectiva anual. Los valores pueden variar según el banco emisor de tu tarjeta y el plan de cuotas disponible; el importe definitivo se muestra antes de confirmar el pago.</p> : null}
    </details>
  </section>;
}
