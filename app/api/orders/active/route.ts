import { getActiveOrder } from "@/lib/active-order";

export const runtime = "nodejs";

/**
 * Pedido en curso del visitante para el aviso flotante: por la sesión o por la cookie firmada `qg_orders`.
 * Devuelve solo código, estado, texto y el link de seguimiento; nunca datos personales. Sin caché.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    return Response.json({ order: await getActiveOrder() }, { headers });
  } catch (error) {
    // El aviso es accesorio: ante un error (o sin la base) simplemente no se muestra.
    console.warn("[Pedidos] No se pudo consultar el pedido en curso", { reason: error instanceof Error ? error.name : "error" });
    return Response.json({ order: null }, { headers });
  }
}
