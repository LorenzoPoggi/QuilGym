import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { shipments } from "@/lib/db/schema";
import { findOwnedOrder } from "@/lib/order-service";
import { readCourierPosition } from "@/lib/tracking";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/**
 * Última posición del repartidor para el mapa de `/pedido/[id]`. Misma autorización que la página (cookie del
 * carrito, cuenta o `?t=` firmado); sin acceso responde 404 para no revelar si el pedido existe.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("t");
  const order = await findOwnedOrder(id, token);
  if (!order) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  const [shipment] = await db.select({ id: shipments.id, status: shipments.status }).from(shipments).where(eq(shipments.orderId, order.id)).limit(1);
  const position = await readCourierPosition(order, shipment);
  return Response.json({ status: shipment?.status ?? "pending", position }, { headers: noStore });
}
