import { getCart } from "@/lib/cart";

/** Carrito actual recalculado en el servidor. Lo consume el CartProvider al montar. */
export async function GET() {
  return Response.json(await getCart(), { headers: { "Cache-Control": "no-store" } });
}
