/**
 * Configuración de facturación (ARCA) leída del entorno y de `commerce.business`. Pura: la usan el servidor,
 * los tests y `npm run checkout:check`. Nunca inventa datos fiscales: si falta algo, la emisión automática
 * queda apagada y el panel muestra los datos para facturar a mano en «Comprobantes en línea».
 */
import { commerce } from "./commerce";

type Env = Record<string, string | undefined>;
export type InvoiceProviderId = "manual" | "tusfacturas";
export type VoucherType = "A" | "B" | "C";
export type InvoicingConfig = {
  /** Proveedor efectivo: `tusfacturas` solo si está completo; si no, `manual`. */
  provider: InvoiceProviderId;
  requestedProvider: string | null;
  /** Tipo de comprobante para consumidor final según la condición frente al IVA del vendedor. */
  voucherType: VoucherType | null;
  pointOfSale: number | null;
  /** Monto desde el cual el checkout pide DNI/CUIT. null = no se pide. */
  identificationThresholdArs: number | null;
  /** Alícuota de IVA de los productos (solo factura A/B con proveedor con API). */
  ivaRate: number | null;
  tusfacturas: { apiKey: string; apiToken: string; userToken: string; provinceCode: string; saleConditionCode: string } | null;
  issues: string[];
  warnings: string[];
};

const value = (env: Env, key: string) => env[key]?.trim() || undefined;
const IVA_RATES = new Set([0, 10.5, 21, 27]);

export function voucherTypeFor(taxCondition: typeof commerce.business.taxCondition): VoucherType | null {
  if (taxCondition === "monotributo") return "C";
  if (taxCondition === "responsable_inscripto") return "B";
  return null;
}

export function readInvoicingConfig(env: Env, business = commerce.business): InvoicingConfig {
  const issues: string[] = [];
  const warnings: string[] = [];
  const requested = value(env, "INVOICE_PROVIDER")?.toLowerCase() ?? null;
  if (requested && requested !== "manual" && requested !== "tusfacturas") issues.push(`INVOICE_PROVIDER="${requested}" no es válido: usá "manual" o "tusfacturas".`);

  const rawPos = value(env, "INVOICE_POINT_OF_SALE");
  const pos = rawPos ? Number(rawPos) : null;
  const pointOfSale = pos !== null && Number.isInteger(pos) && pos >= 1 && pos <= 99_999 ? pos : null;
  if (rawPos && pointOfSale === null) issues.push("INVOICE_POINT_OF_SALE debe ser un número entero entre 1 y 99999.");

  const rawThreshold = value(env, "INVOICE_ID_THRESHOLD_ARS");
  const threshold = rawThreshold ? Number(rawThreshold) : null;
  const identificationThresholdArs = threshold !== null && Number.isSafeInteger(threshold) && threshold > 0 ? threshold : null;
  if (rawThreshold && identificationThresholdArs === null) issues.push("INVOICE_ID_THRESHOLD_ARS debe ser un monto entero en pesos mayor a 0 (vacío = no pedir DNI/CUIT).");

  const rawIva = value(env, "INVOICE_IVA_RATE");
  const iva = rawIva ? Number(rawIva.replace(",", ".")) : null;
  const ivaRate = iva !== null && IVA_RATES.has(iva) ? iva : null;
  if (rawIva && ivaRate === null) issues.push("INVOICE_IVA_RATE debe ser 0, 10.5, 21 o 27.");

  const voucherType = voucherTypeFor(business.taxCondition);
  const missingBusiness = [!business.legalName && "razón social", !business.cuit && "CUIT", !business.taxCondition && "condición frente al IVA"].filter(Boolean) as string[];
  if (missingBusiness.length) warnings.push(`Facturación: faltan en lib/commerce.ts (business) ${missingBusiness.join(", ")}. El panel muestra los datos del pedido, pero el tipo de comprobante lo elegís a mano.`);
  if (!pointOfSale) warnings.push("Facturación: falta INVOICE_POINT_OF_SALE (punto de venta habilitado en ARCA).");

  let tusfacturas: InvoicingConfig["tusfacturas"] = null;
  let provider: InvoiceProviderId = "manual";
  if (requested === "tusfacturas") {
    const keys = ["TUSFACTURAS_API_KEY", "TUSFACTURAS_API_TOKEN", "TUSFACTURAS_USER_TOKEN", "TUSFACTURAS_PROVINCE_CODE", "TUSFACTURAS_SALE_CONDITION_CODE"] as const;
    const missing = keys.filter((key) => !value(env, key));
    const blockers = [
      ...missing,
      ...(missingBusiness.length ? [`commerce.business (${missingBusiness.join(", ")})`] : []),
      ...(!pointOfSale ? ["INVOICE_POINT_OF_SALE"] : []),
      ...(voucherType && voucherType !== "C" && ivaRate === null ? ["INVOICE_IVA_RATE (factura A/B)"] : []),
    ];
    if (blockers.length) issues.push(`INVOICE_PROVIDER=tusfacturas incompleto: falta ${blockers.join(", ")}. Se usa el modo manual.`);
    else {
      tusfacturas = { apiKey: value(env, "TUSFACTURAS_API_KEY")!, apiToken: value(env, "TUSFACTURAS_API_TOKEN")!, userToken: value(env, "TUSFACTURAS_USER_TOKEN")!,
        provinceCode: value(env, "TUSFACTURAS_PROVINCE_CODE")!, saleConditionCode: value(env, "TUSFACTURAS_SALE_CONDITION_CODE")! };
      provider = "tusfacturas";
    }
  }
  return { provider, requestedProvider: requested, voucherType, pointOfSale, identificationThresholdArs, ivaRate, tusfacturas, issues, warnings };
}

export type TaxId = { type: "DNI" | "CUIT"; number: string };

/** Dígito verificador de CUIT/CUIL (módulo 11). */
export function isValidCuit(value: string) {
  if (!/^(20|23|24|25|26|27|30|33|34)\d{9}$/.test(value)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(value[index]), 0);
  const rest = 11 - (sum % 11);
  const check = rest === 11 ? 0 : rest === 10 ? 9 : rest;
  return check === Number(value[10]);
}

/** DNI de 7 u 8 dígitos o CUIT/CUIL válido; acepta puntos, guiones y espacios al tipear. */
export function parseTaxId(type: unknown, raw: unknown): { ok: true; value: TaxId } | { ok: false; error: string } {
  const digits = typeof raw === "string" ? raw.replace(/[\s.-]/g, "") : "";
  if (type === "DNI") return /^\d{7,8}$/.test(digits) && Number(digits) > 0 ? { ok: true, value: { type, number: digits } } : { ok: false, error: "Ingresá un DNI de 7 u 8 números." };
  if (type === "CUIT") return isValidCuit(digits) ? { ok: true, value: { type, number: digits } } : { ok: false, error: "Ingresá un CUIT/CUIL válido de 11 números." };
  return { ok: false, error: "Elegí DNI o CUIT/CUIL." };
}

export const taxIdRequired = (threshold: number | null | undefined, totalArs: number) => typeof threshold === "number" && threshold > 0 && totalArs >= threshold;
