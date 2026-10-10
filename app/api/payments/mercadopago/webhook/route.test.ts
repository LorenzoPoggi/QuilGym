import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), limit: vi.fn(), payment: vi.fn(), merchantOrder: vi.fn(), revalidate: vi.fn(), after: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/checkout-security", () => ({ verifyMercadoPagoSignature: mocks.verify }));
vi.mock("@/lib/mercadopago-webhook-rate-limit", () => ({ allowInvalidMercadoPagoWebhook: mocks.limit }));
vi.mock("@/lib/mercadopago", () => ({ reconcileProviderPayment: mocks.payment, reconcileProviderMerchantOrder: mocks.merchantOrder }));
vi.mock("@/lib/order-email", () => ({ deliverOrderEmails: vi.fn() }));
import { POST } from "./route";

beforeEach(() => {
  vi.stubEnv("MP_WEBHOOK_SECRET", "test-secret");
  vi.stubEnv("MP_ACCESS_TOKEN", "TEST-token");
  mocks.verify.mockReset().mockReturnValue(false);
  mocks.limit.mockReset().mockResolvedValue(true);
  mocks.payment.mockReset(); mocks.merchantOrder.mockReset().mockResolvedValue("order-id");
  mocks.revalidate.mockReset(); mocks.after.mockReset();
});

describe("receptor Mercado Pago", () => {
  it("acepta IPN merchant_order solo para conciliación autenticada y limitada", async () => {
    const response = await POST(new Request("https://example.test/webhook?topic=merchant_order&id=900", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(mocks.limit).toHaveBeenCalledOnce();
    expect(mocks.merchantOrder).toHaveBeenCalledWith("900");
    expect(mocks.payment).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith("/checkout/confirmacion/order-id");
  });
  it("rechaza IPN malformadas y limita los intentos sin firma", async () => {
    expect((await POST(new Request("https://example.test/webhook?topic=merchant_order&id=not-a-number", { method: "POST" }))).status).toBe(401);
    mocks.limit.mockResolvedValue(false);
    expect((await POST(new Request("https://example.test/webhook?topic=merchant_order&id=900", { method: "POST" }))).status).toBe(429);
    expect(mocks.merchantOrder).not.toHaveBeenCalled();
  });
  it("conserva la conciliación de pagos con firma válida", async () => {
    mocks.verify.mockReturnValue(true);
    mocks.payment.mockResolvedValue("order-id");
    const response = await POST(new Request("https://example.test/webhook?data.id=901&type=payment", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(mocks.payment).toHaveBeenCalledWith("901");
    expect(mocks.limit).not.toHaveBeenCalled();
  });
});
