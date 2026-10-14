/**
 * Supuestos de rentabilidad que cambian los programadores (no el panel). `null` = no se aplica.
 */
export const metricsConfig = {
  /** Ingresos Brutos u otros impuestos sobre las ventas netas, en porcentaje (p. ej. 3.5). */
  salesTaxPercent: null as number | null,
  /**
   * Comisión de Mercado Pago a estimar en pagos viejos sin el dato real (porcentaje del total cobrado).
   * Los pagos nuevos guardan la comisión real; efectivo y transferencia no tienen comisión.
   */
  estimatedMercadoPagoFeePercent: null as number | null,
};
