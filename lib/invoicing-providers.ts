/**
 * Proveedores de facturación electrónica. `manual` (default) no llama a nadie: el negocio emite en
 * «Comprobantes en línea» de ARCA y registra número y CAE en el panel. `tusfacturas` usa la API REST
 * documentada en https://developers.tusfacturas.app (v2, POST /facturacion/nuevo): TusFacturas guarda el
 * certificado y el punto de venta para web service del negocio, pide el CAE a ARCA y devuelve el PDF.
 * No se hacen llamadas reales sin las credenciales del negocio; los tests usan un fetch simulado.
 */
import type { InvoicingConfig, VoucherType } from "./invoicing-config";

export type InvoiceDraft = {
  orderId: string;
  /** Fecha del comprobante (la del pago aprobado). */
  date: Date;
  voucherType: VoucherType;
  pointOfSale: number;
  receiver: { docType: "CF" | "DNI" | "CUIT"; docNumber: string | null; name: string; email: string; address: string | null };
  /** Precios finales con IVA incluido, en pesos enteros. */
  items: { code: string; description: string; quantity: number; unitPriceArs: number }[];
  discountArs: number;
  totalArs: number;
  paymentLabel: string;
};

export type InvoiceIssueResult =
  | { ok: true; voucherType: VoucherType; pointOfSale: number; number: number; cae: string; caeDueDate: string; issuedAt: Date; pdfUrl: string | null }
  /** `uncertain`: no hubo respuesta clara (timeout, red). Puede haberse emitido: no reintentar sin revisar. */
  | { ok: false; error: string; uncertain: boolean };

export interface InvoiceProvider {
  readonly id: InvoicingConfig["provider"];
  /** false = la factura se emite fuera del sitio y se registra a mano. */
  readonly automatic: boolean;
  issue(draft: InvoiceDraft): Promise<InvoiceIssueResult>;
}

export const manualInvoiceProvider: InvoiceProvider = {
  id: "manual", automatic: false,
  async issue() { return { ok: false, error: "La facturación está en modo manual: emití el comprobante en ARCA y registralo en el panel.", uncertain: false }; },
};

const TUSFACTURAS_URL = "https://www.tusfacturas.app/app/api/v2/facturacion/nuevo";
const ddmmyyyy = (date: Date) => new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(date);
const money = (value: number) => value.toFixed(2);

/** dd/mm/aaaa → aaaa-mm-dd; null si no es una fecha. */
export function isoFromDdMmYyyy(value: unknown) {
  const match = typeof value === "string" ? value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) : null;
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

export function tusFacturasBody(draft: InvoiceDraft, config: NonNullable<InvoicingConfig["tusfacturas"]>, ivaRate: number | null) {
  // Factura C (monotributo): sin IVA discriminado, el precio unitario es el final.
  // Factura A/B: TusFacturas espera el neto; se calcula con la alícuota configurada.
  const divisor = draft.voucherType === "C" ? 1 : 1 + (ivaRate ?? 0) / 100;
  const alicuota = draft.voucherType === "C" ? "0" : String(ivaRate);
  const docType = draft.receiver.docType === "CF" ? "OTRO" : draft.receiver.docType;
  return {
    apikey: config.apiKey, apitoken: config.apiToken, usertoken: config.userToken,
    cliente: {
      documento_tipo: docType, documento_nro: draft.receiver.docNumber ?? "0",
      razon_social: draft.receiver.name.slice(0, 255), email: draft.receiver.email.slice(0, 255),
      // RG 5700/2025: si no hace falta identificar al consumidor final, los datos se pueden informar como «NR».
      domicilio: (draft.receiver.address ?? "NR").slice(0, 255), provincia: config.provinceCode,
      envia_por_mail: "N", condicion_pago: config.saleConditionCode, condicion_iva: draft.receiver.docType === "CUIT" && draft.voucherType === "A" ? "RI" : "CF",
      codigo: draft.receiver.docNumber ? draft.receiver.docNumber.slice(0, 20) : "CF", rg5329: "N",
    },
    comprobante: {
      fecha: ddmmyyyy(draft.date), vencimiento: ddmmyyyy(draft.date), tipo: `FACTURA ${draft.voucherType}`, operacion: "V", idioma: "1",
      punto_venta: String(draft.pointOfSale), moneda: "PES", cotizacion: "1",
      rubro: "Suplementos deportivos", rubro_grupo_contable: "Ventas",
      external_reference: draft.orderId,
      detalle: draft.items.map((item) => ({
        cantidad: money(item.quantity), afecta_stock: "N", bonificacion_porcentaje: "0",
        producto: {
          descripcion: item.description.padEnd(4, " ").slice(0, 255), unidad_bulto: "1", lista_precios: "Tienda online",
          codigo: item.code.slice(0, 20), precio_unitario_sin_iva: money(item.unitPriceArs / divisor), alicuota,
          // 7 = «unidades» en la tabla de unidades de medida de ARCA.
          unidad_medida: "7", actualiza_precio: "N", rg5329: "N",
        },
      })),
      ...(draft.discountArs > 0 ? { bonificacion: money(draft.discountArs / divisor) } : {}),
      total: money(draft.totalArs),
      pagos: { formas_pago: [{ descripcion: draft.paymentLabel.slice(0, 100), importe: draft.totalArs }], total: draft.totalArs },
    },
  };
}

export function tusFacturasProvider(config: NonNullable<InvoicingConfig["tusfacturas"]>, ivaRate: number | null, fetchImpl: typeof fetch = fetch): InvoiceProvider {
  return {
    id: "tusfacturas", automatic: true,
    async issue(draft) {
      let response: Response;
      try {
        response = await fetchImpl(TUSFACTURAS_URL, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(tusFacturasBody(draft, config, ivaRate)), signal: AbortSignal.timeout(25_000),
        });
      } catch (error) {
        return { ok: false, uncertain: true, error: `Sin respuesta de TusFacturas (${error instanceof Error ? error.name : "error de red"}). Revisá en TusFacturas si el comprobante se emitió antes de reintentar.` };
      }
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok || !payload) return { ok: false, uncertain: !payload, error: `TusFacturas respondió ${response.status}.` };
      if (payload.error !== "N") {
        const errors = Array.isArray(payload.errores) ? payload.errores.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
        const maintenance = payload.mantenimiento ? " (servicio en mantenimiento)" : "";
        return { ok: false, uncertain: false, error: `TusFacturas rechazó el comprobante${maintenance}: ${errors.join(" · ").slice(0, 500) || "sin detalle"}` };
      }
      const numberMatch = typeof payload.comprobante_nro === "string" ? payload.comprobante_nro.match(/^(\d{1,5})-(\d{1,8})$/) : null;
      const cae = typeof payload.cae === "string" && /^\d{14}$/.test(payload.cae) ? payload.cae : null;
      const caeDueDate = isoFromDdMmYyyy(payload.vencimiento_cae);
      if (!numberMatch || !cae || !caeDueDate) return { ok: false, uncertain: true, error: "TusFacturas informó éxito pero sin número/CAE legibles. Revisá el comprobante en TusFacturas." };
      const pdf = typeof payload.comprobante_pdf_url === "string" && payload.comprobante_pdf_url.startsWith("https://") ? payload.comprobante_pdf_url : null;
      return { ok: true, voucherType: draft.voucherType, pointOfSale: Number(numberMatch[1]), number: Number(numberMatch[2]), cae, caeDueDate, issuedAt: draft.date, pdfUrl: pdf };
    },
  };
}

export function invoiceProviderFor(config: InvoicingConfig, fetchImpl: typeof fetch = fetch): InvoiceProvider {
  return config.provider === "tusfacturas" && config.tusfacturas ? tusFacturasProvider(config.tusfacturas, config.ivaRate, fetchImpl) : manualInvoiceProvider;
}
