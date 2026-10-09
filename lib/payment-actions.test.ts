import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOwnedOrder: vi.fn(), paymentSetup: vi.fn(), submitProviderPayment: vi.fn(),
  deliverOrderEmails: vi.fn(), consumeRateLimit: vi.fn(), revalidatePath: vi.fn(), after: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("./order-service", () => ({ findOwnedOrder: mocks.findOwnedOrder }));
vi.mock("./mercadopago", () => ({ paymentSetup: mocks.paymentSetup, submitProviderPayment: mocks.submitProviderPayment }));
vi.mock("./order-email", () => ({ deliverOrderEmails: mocks.deliverOrderEmails }));
vi.mock("./rate-limit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));

import { payOrder, preparePayment } from "./payment-actions";

const orderId = "00000000-0000-4000-8000-000000000001";
const order = { id: orderId };

describe("límites del flujo de pago", () => {
  beforeEach(() => {
    mocks.findOwnedOrder.mockReset().mockResolvedValue(order);
    mocks.paymentSetup.mockReset().mockResolvedValue({ initPoint: "https://www.mercadopago.com.ar/checkout" });
    mocks.submitProviderPayment.mockReset().mockResolvedValue(undefined);
    mocks.deliverOrderEmails.mockReset();
    mocks.consumeRateLimit.mockReset().mockResolvedValue(true);
    mocks.revalidatePath.mockReset();
    mocks.after.mockReset();
  });

  it("limita preparación por pedido antes de crear o cargar la preferencia", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    const result = await preparePayment(orderId);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("muchas veces") });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(`payment:prepare:${orderId}`, 12, 600_000);
    expect(mocks.paymentSetup).not.toHaveBeenCalled();
  });

  it("limita intentos del Brick por pedido antes de enviar el pago", async () => {
    mocks.consumeRateLimit.mockResolvedValue(false);
    const result = await payOrder(orderId, { token: "token-de-prueba" });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("muchos intentos") });
    expect(mocks.consumeRateLimit).toHaveBeenCalledWith(`payment:submit:${orderId}`, 10, 600_000);
    expect(mocks.submitProviderPayment).not.toHaveBeenCalled();
  });

  it("un error del contador falla cerrado y nunca intenta cobrar", async () => {
    mocks.consumeRateLimit.mockRejectedValue(new Error("database unavailable"));
    const result = await payOrder(orderId, { token: "token-de-prueba" });
    expect(result.ok).toBe(false);
    expect(mocks.submitProviderPayment).not.toHaveBeenCalled();
  });
});
