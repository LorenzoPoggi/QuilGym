import "server-only";
import type { CheckoutConfig } from "./checkout-types";
import { parseCheckoutEnv, readBankDetails, readOrderAccessSecret, readPendingOrderTtlHours, readSiteUrl } from "./checkout-env";
import { orderAccessToken } from "./order-access";

export function siteUrl() {
  return readSiteUrl(process.env);
}

export function bankDetails() {
  return readBankDetails(process.env);
}

export function orderAccessSecret() {
  return readOrderAccessSecret(process.env);
}

/** URL absoluta del pedido, con el link firmado cuando hay secreto. Null sin NEXT_PUBLIC_SITE_URL. */
export function orderPageUrl(orderId: string) {
  const site = siteUrl();
  if (!site) return null;
  const token = orderAccessToken(orderId, orderAccessSecret());
  return `${site}/checkout/confirmacion/${orderId}${token ? `?t=${token}` : ""}`;
}

export function pendingOrderTtlHours() {
  return readPendingOrderTtlHours(process.env).hours;
}

/** Cada medio se habilita solo con su configuración completa; ver `npm run checkout:check`. */
export function getCheckoutConfig(): CheckoutConfig {
  return parseCheckoutEnv(process.env).config;
}
