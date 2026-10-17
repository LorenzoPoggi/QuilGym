import { notFound } from "next/navigation";
import { getAdminOrder } from "@/lib/admin-orders";
import { allowedShipmentStatuses, orderCode } from "@/lib/admin-orders-types";
import { googleMapsSearchUrl } from "@/lib/store-location";
import { formatEtaWindow } from "@/lib/tracking-core";
import { CourierDeliveryView } from "@/components/courier-delivery-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Reparto ${orderCode(id)} | Administración QuilGym`, robots: { index: false, follow: false } };
}

/** Vista de reparto para el celular del dueño (entrega propia). El layout admin ya exige la cuenta autorizada. */
export default async function CourierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAdminOrder(id);
  if (!detail || detail.order.delivery !== "local") notFound();
  const { order, shipment, delivery } = detail;
  const address = order.address;
  const point = delivery.option?.lat != null && delivery.option?.lng != null ? { lat: delivery.option.lat, lng: delivery.option.lng } : null;
  const addressText = address ? `${address.street} ${address.number}${address.apartment ? `, ${address.apartment}` : ""}, ${address.city}` : "Dirección no disponible";
  const mapsUrl = point ? googleMapsSearchUrl(point) : address ? googleMapsSearchUrl(`${address.street} ${address.number}, ${address.city}, ${address.province}, Argentina`) : null;
  const eta = formatEtaWindow(delivery.tracking?.etaFrom ?? null, delivery.tracking?.etaTo ?? null);
  const cashPending = order.paymentMethod === "cash" && order.status === "pending";
  return <CourierDeliveryView orderId={order.id} code={orderCode(order.id)} customer={{ name: order.name, phone: order.phone }}
    addressText={addressText} notes={order.notes} mapsUrl={mapsUrl} eta={eta} totalArs={order.totalArs}
    status={shipment?.status ?? "pending"} cashPending={cashPending} canDeliver={allowedShipmentStatuses(order).includes("delivered")}/>;
}
