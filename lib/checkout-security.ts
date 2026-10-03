import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** La cookie de carrito, HttpOnly y aleatoria, ata la cotización al navegador. No se envía al cliente. */
export function signQuote(cartId: string, payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", cartId).update(encoded).digest("hex")}`;
}

export function readQuote(cartId: string, token: string): Record<string, unknown> | null {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const expected = createHmac("sha256", cartId).update(encoded).digest();
  if (!timingSafeEqual(Buffer.from(signature, "hex"), expected)) return null;
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { return null; }
}

export function checkoutFingerprint(lines: { variantId: number; quantity: number; unitPriceArs: number }[], discountArs: number, couponCode: string | null) {
  return createHash("sha256").update(JSON.stringify({
    lines: lines.map(({ variantId, quantity, unitPriceArs }) => ({ variantId, quantity, unitPriceArs })).sort((a, b) => a.variantId - b.variantId),
    discountArs, couponCode,
  })).digest("hex");
}

/** Firma oficial: id:{data.id};request-id:{x-request-id};ts:{ts}; */
export function verifyMercadoPagoSignature(signature: string | null, requestId: string | null, dataId: string, secret: string, now = Date.now()) {
  if (!signature || !requestId || !secret || !/^[a-zA-Z0-9_-]+$/.test(dataId)) return false;
  const parts = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")));
  if (!/^\d+$/.test(parts.ts ?? "") || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "")) return false;
  const timestamp = Number(parts.ts);
  const milliseconds = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  if (Math.abs(now - milliseconds) > 5 * 60_000) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  return timingSafeEqual(createHmac("sha256", secret).update(manifest).digest(), Buffer.from(parts.v1, "hex"));
}
