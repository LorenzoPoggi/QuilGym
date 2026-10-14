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
  /**
   * Tope de cuotas que ofrece el formulario de tarjeta de crédito. null = las que habilite Mercado Pago
   * para la tarjeta (hasta 48). Las cuotas con interés las paga el comprador; ver `interestFreeInstallments`.
   */
  maxCardInstallments: 12 as number | null,
  /**
   * Identidad legal y fiscal del vendedor. La usan las páginas legales, los emails y la facturación.
   * Todo en null hasta que el negocio y su contador lo confirmen: nunca completar con valores de ejemplo.
   * Con un dato en null la página legal lo marca como «pendiente» y la facturación automática queda apagada.
   */
  business: {
    /** Razón social o nombre y apellido del titular, tal como figura en ARCA. */
    legalName: null as string | null,
    /** CUIT con o sin guiones (11 dígitos). */
    cuit: null as string | null,
    /** Domicilio legal/fiscal completo. */
    legalAddress: null as string | null,
    /** Condición frente al IVA: define el tipo de factura (monotributo → C; responsable inscripto → B/A). */
    taxCondition: null as "monotributo" | "responsable_inscripto" | null,
    /** Ingresos Brutos (número o «Convenio multilateral»), si el contador quiere mostrarlo. */
    grossIncome: null as string | null,
    /** Email público de atención: recibe los pedidos de arrepentimiento y figura en las páginas legales. */
    contactEmail: null as string | null,
  },
};

/** Datos del vendedor que faltan cargar en `commerce.business` (para avisos en páginas legales y diagnósticos). */
export function missingBusinessData(business = commerce.business) {
  const labels: Record<keyof typeof business, string> = {
    legalName: "razón social", cuit: "CUIT", legalAddress: "domicilio legal", taxCondition: "condición frente al IVA",
    grossIncome: "Ingresos Brutos", contactEmail: "email de atención",
  };
  return (Object.keys(labels) as (keyof typeof business)[]).filter((key) => !business[key]).map((key) => labels[key]);
}

/** CUIT con el formato habitual 20-12345678-3; null si no es un CUIT de 11 dígitos. */
export function formatCuit(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 11 ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : null;
}

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
