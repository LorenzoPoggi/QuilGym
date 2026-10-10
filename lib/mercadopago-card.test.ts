import { describe, expect, it } from "vitest";
import { cardIdempotencyKey, cardStatusMessage, cardTypeMatches, excludedCardTypes, maxInstallmentsFor, parseCardSubmission, splitPayerName } from "./mercadopago-card";

const form = (overrides: Record<string, unknown> = {}) => ({
  token: "abcdef0123456789", payment_method_id: "visa", installments: 1, issuer_id: "310",
  payer: { email: "comprador@example.com", identification: { type: "DNI", number: "12.345.678" } }, ...overrides,
});

describe("reglas del pago con tarjeta (Card Payment Brick)", () => {
  it("el Brick excluye el tipo que no corresponde (la doc. configura por exclusión)", () => {
    expect(excludedCardTypes("debit_card")).toEqual(["credit_card"]);
    expect(excludedCardTypes("credit_card")).toEqual(["debit_card", "prepaid_card"]);
    expect(cardTypeMatches("debit_card", "prepaid_card")).toBe(true);
    expect(cardTypeMatches("credit_card", "prepaid_card")).toBe(false);
  });

  it("débito siempre en 1 cuota; crédito hasta el tope configurado o el de Mercado Pago", () => {
    expect(maxInstallmentsFor("debit_card", 12)).toBe(1);
    expect(maxInstallmentsFor("credit_card", null)).toBe(48);
    expect(maxInstallmentsFor("credit_card", 6)).toBe(6);
    expect(maxInstallmentsFor("credit_card", 99)).toBe(48);
  });

  it("acepta solo la lista permitida y nunca toma monto, email ni referencia del navegador", () => {
    const parsed = parseCardSubmission(form({ transaction_amount: 1, external_reference: "otro", installments: "6" }), { paymentTypeId: "credit_card" }, "credit_card", null);
    expect(parsed).toEqual({ ok: true, value: { token: "abcdef0123456789", paymentMethodId: "visa", installments: 6, issuerId: "310", identification: { type: "DNI", number: "12345678" } } });
    expect(JSON.stringify(parsed)).not.toContain("transaction_amount");
  });

  it("rechaza sin token, con cuotas en débito, cuotas fuera de rango o tipo de tarjeta distinto del elegido", () => {
    expect(parseCardSubmission(form({ token: undefined }), {}, "credit_card", null).ok).toBe(false);
    expect(parseCardSubmission(form({ installments: 3 }), { paymentTypeId: "debit_card" }, "debit_card", null)).toMatchObject({ ok: false, error: expect.stringContaining("una sola cuota") });
    expect(parseCardSubmission(form({ installments: 12 }), {}, "credit_card", 6)).toMatchObject({ ok: false, error: expect.stringContaining("entre 1 y 6") });
    expect(parseCardSubmission(form(), { paymentTypeId: "credit_card" }, "debit_card", null)).toMatchObject({ ok: false, error: expect.stringContaining("no es de débito") });
    expect(parseCardSubmission(form(), { paymentTypeId: "debit_card" }, "credit_card", null)).toMatchObject({ ok: false, error: expect.stringContaining("no es de crédito") });
    expect(parseCardSubmission(form(), { paymentTypeId: "prepaid_card" }, "debit_card", null).ok).toBe(true);
    expect(parseCardSubmission(form({ payment_method_id: "<script>" }), {}, "credit_card", null).ok).toBe(false);
  });

  it("descarta una identificación con tipo desconocido en vez de enviarla", () => {
    const parsed = parseCardSubmission(form({ payer: { identification: { type: "PASAPORTE", number: "X1" } } }), {}, "credit_card", null);
    expect(parsed.ok && parsed.value.identification).toBeUndefined();
  });

  it("idempotencia por intento: mismo token = misma clave; otra tarjeta = intento nuevo", () => {
    const first = cardIdempotencyKey("pago-1", "token-a");
    expect(cardIdempotencyKey("pago-1", "token-a")).toBe(first);
    expect(cardIdempotencyKey("pago-1", "token-b")).not.toBe(first);
    expect(first).not.toContain("token-a");
  });

  it("traduce el resultado de Mercado Pago para el comprador", () => {
    expect(cardStatusMessage("approved", "accredited").outcome).toBe("approved");
    expect(cardStatusMessage("in_process", "pending_contingency").outcome).toBe("pending");
    expect(cardStatusMessage("pending", "pending_challenge").message).toContain("verificar");
    const rejected = cardStatusMessage("rejected", "cc_rejected_insufficient_amount");
    expect(rejected).toMatchObject({ outcome: "rejected", message: expect.stringContaining("saldo") });
    expect(rejected.message).toContain("reintentar");
    expect(cardStatusMessage("rejected", "desconocido").message).toContain("rechazado");
  });

  it("separa nombre y apellido para el análisis de riesgo", () => {
    expect(splitPayerName("  Ana María  Pérez ")).toEqual({ first_name: "Ana", last_name: "María Pérez" });
    expect(splitPayerName("Cher")).toEqual({ first_name: "Cher", last_name: "Cher" });
  });
});
