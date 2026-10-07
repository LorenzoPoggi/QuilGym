/**
 * Políticas comerciales visibles en la tienda. Un valor null u 0 oculta el
 * mensaje correspondiente: no mostrar promociones que el negocio no ofrece.
 *
 * Relevado de la tienda actual (oct. 2026): sin cuotas sin interés y sin
 * descuento por transferencia/efectivo. Confirmar con el negocio antes de cambiar.
 */
export const commerce = {
  /** Cantidad máxima de cuotas sin interés; 1 = no se ofrecen. */
  interestFreeInstallments: 1,
  /** Descuento por transferencia bancaria, en porcentaje. */
  transferDiscountPercent: 0,
  /** Monto mínimo para envío gratis; null = no hay envío gratis. */
  freeShippingFromArs: null as number | null,
  pickupLocation: "Quilmes",
  /** WhatsApp del local: número en formato internacional sin "+" y mensaje inicial. */
  whatsapp: { phone: "5491126683308", message: "¡Hola! Quiero más información sobre la compra de suplementos." },
};

/** Link de wa.me con el mensaje codificado; sin texto usa el mensaje por defecto. */
export function whatsappUrl(text: string = commerce.whatsapp.message) {
  return `https://wa.me/${commerce.whatsapp.phone}?text=${encodeURIComponent(text)}`;
}

export function formatArs(value: number) {
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}

/** Texto corto de beneficios de pago; vacío si no hay ninguno vigente. */
export function paymentHighlights() {
  return [
    commerce.interestFreeInstallments > 1 ? `${commerce.interestFreeInstallments} cuotas sin interés` : null,
    commerce.transferDiscountPercent > 0 ? `${commerce.transferDiscountPercent}% OFF transferencia` : null,
  ].filter(Boolean).join(" · ");
}

export function transferPrice(priceArs: number) {
  return Math.round(priceArs * (1 - commerce.transferDiscountPercent / 100));
}
