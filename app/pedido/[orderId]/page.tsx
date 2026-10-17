import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { orderDetails } from "@/lib/order-service";
import { loadOrderTracking } from "@/lib/tracking";
import { OrderTrackingView } from "@/components/order-tracking-view";

export const metadata: Metadata = { title: "Seguí tu pedido | QuilGym", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function OrderTrackingPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ t?: string | string[] }> }) {
  const { orderId } = await params;
  const { t } = await searchParams;
  // Misma autorización que la confirmación: cookie del carrito, cuenta propietaria o link firmado.
  const token = typeof t === "string" ? t : null;
  const details = await orderDetails(orderId, token);
  if (!details) notFound();
  const { order, shipment } = details;
  return <OrderTrackingView order={order} shipment={shipment ?? null} tracking={await loadOrderTracking(order, shipment)} token={token}/>;
}
