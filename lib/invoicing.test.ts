import { describe, expect, it, vi } from "vitest";
import { isValidCuit, parseTaxId, readInvoicingConfig, taxIdRequired, voucherTypeFor } from "./invoicing-config";
import { isoFromDdMmYyyy, tusFacturasBody, tusFacturasProvider, type InvoiceDraft } from "./invoicing-providers";

const business = { legalName: "Titular de prueba", cuit: "20123456786", legalAddress: "Calle 1", taxCondition: "monotributo" as const, grossIncome: null, contactEmail: null };
const tusEnv = { INVOICE_PROVIDER: "tusfacturas", INVOICE_POINT_OF_SALE: "3", TUSFACTURAS_API_KEY: "k", TUSFACTURAS_API_TOKEN: "t", TUSFACTURAS_USER_TOKEN: "u", TUSFACTURAS_PROVINCE_CODE: "2", TUSFACTURAS_SALE_CONDITION_CODE: "1" };
const draft: InvoiceDraft = { orderId: "o-1", date: new Date("2026-10-10T15:00:00Z"), voucherType: "C", pointOfSale: 3,
  receiver: { docType: "CF", docNumber: null, name: "Consumidor final", email: "c@example.com", address: null },
  items: [{ code: "QG-0001", description: "Creatina", quantity: 2, unitPriceArs: 1000 }], discountArs: 0, totalArs: 2000, paymentLabel: "Tarjeta de crédito" };

describe("configuración de facturación", () => {
  it("el tipo de comprobante sale de la condición fiscal; sin datos no se inventa", () => {
    expect(voucherTypeFor("monotributo")).toBe("C");
    expect(voucherTypeFor("responsable_inscripto")).toBe("B");
    expect(voucherTypeFor(null)).toBeNull();
    const empty = readInvoicingConfig({}, { ...business, legalName: null, cuit: null, taxCondition: null });
    expect(empty).toMatchObject({ provider: "manual", voucherType: null, pointOfSale: null, identificationThresholdArs: null });
    expect(empty.warnings.join(" ")).toContain("razón social");
  });

  it("TusFacturas solo se activa con todas las credenciales y datos fiscales; si no, queda manual con el motivo", () => {
    expect(readInvoicingConfig(tusEnv, business).provider).toBe("tusfacturas");
    const incomplete = readInvoicingConfig({ ...tusEnv, TUSFACTURAS_USER_TOKEN: "" }, business);
    expect(incomplete.provider).toBe("manual");
    expect(incomplete.issues.join(" ")).toContain("TUSFACTURAS_USER_TOKEN");
    expect(readInvoicingConfig({ ...tusEnv }, { ...business, taxCondition: "responsable_inscripto" }).issues.join(" ")).toContain("INVOICE_IVA_RATE");
    expect(readInvoicingConfig({ INVOICE_PROVIDER: "afip-directo" }, business).issues).toHaveLength(1);
  });

  it("DNI/CUIT: umbral configurable y dígito verificador de CUIT", () => {
    expect(taxIdRequired(null, 10_000_000)).toBe(false);
    expect(taxIdRequired(500_000, 499_999)).toBe(false);
    expect(taxIdRequired(500_000, 500_000)).toBe(true);
    expect(isValidCuit("20123456786")).toBe(true);
    expect(isValidCuit("20123456780")).toBe(false);
    expect(parseTaxId("DNI", "12.345.678")).toEqual({ ok: true, value: { type: "DNI", number: "12345678" } });
    expect(parseTaxId("CUIT", "20-12345678-6")).toEqual({ ok: true, value: { type: "CUIT", number: "20123456786" } });
    expect(parseTaxId("CUIT", "20-12345678-0").ok).toBe(false);
    expect(parseTaxId("PASAPORTE", "1").ok).toBe(false);
  });
});

describe("proveedor TusFacturas (fetch simulado, sin llamadas reales)", () => {
  const config = readInvoicingConfig(tusEnv, business).tusfacturas!;
  it("factura C a consumidor final con precios finales y referencia del pedido", () => {
    const body = tusFacturasBody(draft, config, null);
    expect(body.cliente).toMatchObject({ documento_tipo: "OTRO", documento_nro: "0", condicion_iva: "CF", domicilio: "NR" });
    expect(body.comprobante).toMatchObject({ tipo: "FACTURA C", punto_venta: "3", fecha: "10/10/2026", external_reference: "o-1", total: "2000.00" });
    expect(body.comprobante.detalle[0].producto).toMatchObject({ precio_unitario_sin_iva: "1000.00", alicuota: "0" });
    expect(tusFacturasBody({ ...draft, voucherType: "B" }, config, 21).comprobante.detalle[0].producto.precio_unitario_sin_iva).toBe("826.45");
  });

  it("interpreta éxito, rechazo y falta de respuesta (incierta: no se reintenta sola)", async () => {
    const ok = vi.fn(async () => Response.json({ error: "N", cae: "71234567890123", vencimiento_cae: "20/10/2026", comprobante_nro: "00003-00000125", comprobante_pdf_url: "https://tusfacturas.test/f.pdf" }));
    expect(await tusFacturasProvider(config, null, ok as unknown as typeof fetch).issue(draft)).toMatchObject({ ok: true, pointOfSale: 3, number: 125, cae: "71234567890123", caeDueDate: "2026-10-20", pdfUrl: "https://tusfacturas.test/f.pdf" });
    const rejected = vi.fn(async () => Response.json({ error: "S", errores: ["Punto de venta inválido"] }));
    expect(await tusFacturasProvider(config, null, rejected as unknown as typeof fetch).issue(draft)).toMatchObject({ ok: false, uncertain: false, error: expect.stringContaining("Punto de venta") });
    const timeout = vi.fn(async () => { throw new DOMException("timeout", "TimeoutError"); });
    expect(await tusFacturasProvider(config, null, timeout as unknown as typeof fetch).issue(draft)).toMatchObject({ ok: false, uncertain: true });
    expect(isoFromDdMmYyyy("31/12/2026")).toBe("2026-12-31");
  });
});
