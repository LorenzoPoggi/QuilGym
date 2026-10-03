import "server-only";
import type { CheckoutConfig, ShippingRate } from "./checkout-types";

export function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch { return null; }
}

export function bankDetails() {
  const account = process.env.TRANSFER_ACCOUNT?.trim();
  const holder = process.env.TRANSFER_HOLDER?.trim();
  const taxId = process.env.TRANSFER_TAX_ID?.trim();
  return account && holder && taxId ? { account, holder, taxId } : null;
}

export function getCheckoutConfig(): CheckoutConfig {
  // Nunca se puede habilitar el simulador en producción, incluso con la variable en true.
  const demo = process.env.NODE_ENV === "development" && process.env.CHECKOUT_DEMO_MODE !== "false";
  if (demo) return {
    demo: true,
    pickup: { address: "Local de prueba · Quilmes (dirección a configurar)", hours: "Horario de prueba · a coordinar" },
    shippingRates: [{ id: "demo", label: "Envío simulado", postalCodes: ["*"], priceArs: 4200, estimate: "Plazo de prueba: 3 a 5 días hábiles" }],
    payments: { mercadopago: true, transfer: true, cash: true },
  };
  let shippingRates: ShippingRate[] = [];
  try {
    const parsed: unknown = JSON.parse(process.env.SHIPPING_RATES_JSON || "[]");
    if (Array.isArray(parsed)) shippingRates = parsed.filter((r): r is ShippingRate => !!r && typeof r === "object"
      && typeof r.id === "string" && typeof r.label === "string" && typeof r.estimate === "string"
      && Array.isArray(r.postalCodes) && r.postalCodes.every((c: unknown) => typeof c === "string")
      && Number.isSafeInteger(r.priceArs) && r.priceArs >= 0);
  } catch { /* Configuración ausente o inválida: no ofrecer tarifas inventadas. */ }
  const address = process.env.PICKUP_ADDRESS?.trim();
  const hours = process.env.PICKUP_HOURS?.trim();
  const pickup = address && hours ? { address, hours } : null;
  return {
    demo: false, pickup, shippingRates,
    payments: {
      mercadopago: Boolean(process.env.MP_ACCESS_TOKEN && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY && process.env.MP_WEBHOOK_SECRET && siteUrl()),
      transfer: Boolean(bankDetails()),
      cash: Boolean(pickup && process.env.CASH_PICKUP_ENABLED === "true"),
    },
  };
}
