import { describe, expect, it } from "vitest";
import { emptyCart, type Cart, type CartLine } from "./cart-types";
import type { CheckoutConfig } from "./checkout-types";
import { parseCheckoutEnv } from "./checkout-env";
import { initialCheckoutChoice, isOnlineCheckoutAvailable, usablePayments, whatsappOrderMessage } from "./checkout-whatsapp";

const none: CheckoutConfig = { demo: false, pickup: null, shippingRates: [], payments: { mercadopago: false, transfer: false, cash: false } };
const pickup = { address: "Calle 1", hours: "9 a 18" };
const rate = { id: "quilmes", label: "Envío Quilmes", postalCodes: ["1878"], priceArs: 3500, estimate: "24 h" };

function line(overrides: Partial<CartLine>): CartLine {
  return { variantId: 1, slug: "proteina", name: "Proteína STAR 2 lb", variantLabel: null, brand: null, category: { slug: "proteinas", name: "Proteínas" }, imageUrl: null,
    unitPriceArs: 30000, quantity: 2, lineTotalArs: 60000, maxQuantity: 10, available: true, ...overrides };
}

describe("disponibilidad de la compra online", () => {
  it("sin variables no hay compra online", () => {
    expect(isOnlineCheckoutAvailable(none)).toBe(false);
  });

  it("el modo demo de npm run dev habilita la compra online; en producción sin variables, no", () => {
    expect(isOnlineCheckoutAvailable(parseCheckoutEnv({ NODE_ENV: "development" }).config)).toBe(true);
    expect(isOnlineCheckoutAvailable(parseCheckoutEnv({ NODE_ENV: "development", CHECKOUT_DEMO_MODE: "false" }).config)).toBe(false);
    expect(isOnlineCheckoutAvailable(parseCheckoutEnv({ NODE_ENV: "production" }).config)).toBe(false);
  });

  it("necesita una entrega y un medio de pago compatibles", () => {
    expect(isOnlineCheckoutAvailable({ ...none, pickup })).toBe(false);
    expect(isOnlineCheckoutAvailable({ ...none, payments: { mercadopago: true, transfer: true, cash: false } })).toBe(false);
    expect(isOnlineCheckoutAvailable({ ...none, shippingRates: [rate], payments: { mercadopago: false, transfer: false, cash: true } })).toBe(false);
    expect(isOnlineCheckoutAvailable({ ...none, pickup, payments: { mercadopago: false, transfer: false, cash: true } })).toBe(true);
    expect(isOnlineCheckoutAvailable({ ...none, shippingRates: [rate], payments: { mercadopago: false, transfer: true, cash: false } })).toBe(true);
  });

  it("el efectivo solo se usa con retiro", () => {
    const config = { ...none, pickup, shippingRates: [rate], payments: { mercadopago: false, transfer: true, cash: true } };
    expect(usablePayments(config, "pickup")).toEqual(["transfer", "cash"]);
    expect(usablePayments(config, "shipping")).toEqual(["transfer"]);
  });

  it("la elección inicial nunca es una opción deshabilitada", () => {
    expect(initialCheckoutChoice({ ...none, shippingRates: [rate], payments: { mercadopago: false, transfer: true, cash: false } })).toEqual({ delivery: "shipping", payment: "transfer" });
    expect(initialCheckoutChoice({ ...none, pickup, payments: { mercadopago: false, transfer: false, cash: true } })).toEqual({ delivery: "pickup", payment: "cash" });
    expect(initialCheckoutChoice({ ...none, pickup, shippingRates: [rate], payments: { mercadopago: true, transfer: true, cash: true } })).toEqual({ delivery: "pickup", payment: "mercadopago" });
  });
});

describe("mensaje de pedido por WhatsApp", () => {
  it("lista productos, cantidades y total con formato argentino", () => {
    const cart: Cart = { ...emptyCart, lines: [line({}), line({ variantId: 2, name: "Creatina GOLD 300 g", quantity: 1, unitPriceArs: 25500, lineTotalArs: 25500 })], itemCount: 3, subtotalArs: 85500, totalArs: 85500 };
    const message = whatsappOrderMessage(cart);
    expect(message).toContain("• 2 × Proteína STAR 2 lb: $60.000");
    expect(message).toContain("• 1 × Creatina GOLD 300 g: $25.500");
    expect(message).toContain("Total sin envío: $85.500");
    expect(message).not.toContain("Subtotal");
    expect(message).not.toContain("Sin stock");
  });

  it("muestra el cupón y separa los productos sin stock", () => {
    const cart: Cart = { ...emptyCart, lines: [line({ variantLabel: "Chocolate" }), line({ variantId: 3, name: "Mutant Mass", available: false, lineTotalArs: 0, maxQuantity: 0 })],
      itemCount: 2, subtotalArs: 60000, coupon: { code: "QUIL10", description: null, discountArs: 6000 }, discountArs: 6000, totalArs: 54000 };
    const message = whatsappOrderMessage(cart);
    expect(message).toContain("• 2 × Proteína STAR 2 lb (Chocolate): $60.000");
    expect(message).toContain("Subtotal: $60.000");
    expect(message).toContain("Cupón QUIL10: − $6.000");
    expect(message).toContain("Total sin envío: $54.000");
    expect(message).toContain("Sin stock en la web: Mutant Mass.");
    expect(message).not.toContain("× Mutant Mass");
  });
});
