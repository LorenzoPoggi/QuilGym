/** Contratos serializables del carrito, seguros para Client Components. */
import type { BrandRef, CategoryRef } from "./catalog-types";

export const MAX_QUANTITY_PER_LINE = 10;

export type CartLine = {
  variantId: number;
  slug: string;
  name: string;
  variantLabel: string | null;
  brand: BrandRef | null;
  category: CategoryRef;
  imageUrl: string | null;
  unitPriceArs: number;
  quantity: number;
  lineTotalArs: number;
  /** Cantidad máxima que se puede pedir hoy (0 si no hay stock). */
  maxQuantity: number;
  available: boolean;
};

export type AppliedCoupon = { code: string; description: string | null; discountArs: number };

export type Cart = {
  lines: CartLine[];
  itemCount: number;
  subtotalArs: number;
  coupon: AppliedCoupon | null;
  discountArs: number;
  totalArs: number;
  /** Faltante para envío gratis; null si no hay promoción de envío. */
  freeShippingRemainingArs: number | null;
  /** Avisos de cambios detectados al recalcular (precio, stock, cupón). */
  notices: string[];
  /** true si hay productos sin stock: hay que quitarlos antes de pagar. */
  hasBlockingIssues: boolean;
  /** true si algún precio cambió desde que el cliente lo vio; debe confirmarlo antes de pagar. */
  hasPriceChanges: boolean;
};

export const emptyCart: Cart = {
  lines: [],
  itemCount: 0,
  subtotalArs: 0,
  coupon: null,
  discountArs: 0,
  totalArs: 0,
  freeShippingRemainingArs: null,
  notices: [],
  hasBlockingIssues: false,
  hasPriceChanges: false,
};

export type CartActionResult = { ok: true; cart: Cart; message?: string } | { ok: false; cart: Cart; error: string };
