"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lng: number };
export type TrackingMapProps = { store: Point; destination: Point | null; courier: (Point & { accuracyM: number | null }) | null; label: string };

/** Marcadores con HTML y CSS propios (sin imágenes): los íconos por defecto de Leaflet no resuelven con el bundler. */
const glyphs = {
  store: "Q",
  destination: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  courier: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6H2v12h2"/><path d="M14 9h4l4 4v5h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 18h6"/></svg>',
};
const icon = (kind: keyof typeof glyphs) => L.divIcon({
  className: `tracking-marker tracking-marker--${kind}`,
  html: `<span aria-hidden="true">${glyphs[kind]}</span>`,
  iconSize: [34, 34], iconAnchor: [17, 17],
});

/**
 * Mapa del seguimiento con teselas de OpenStreetMap (atribución visible, exigida por su licencia). Se carga solo
 * en `/pedido/[id]` con `next/dynamic` y `ssr: false`. El repartidor se mueve sin recrear el mapa.
 */
export default function OrderTrackingMap({ store, destination, courier, label }: TrackingMapProps) {
  // Dependencias primitivas: el polling del repartidor re-renderiza el padre y no debe recrear el mapa.
  const { lat: storeLat, lng: storeLng } = store;
  const destLat = destination?.lat ?? null;
  const destLng = destination?.lng ?? null;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const courierLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false, attributionControl: true });
    // La página usa `no-referrer` para no filtrar el link firmado, pero OSM rechaza teselas sin Referer (403):
    // a las teselas se les envía solo el origen del sitio, nunca la ruta con el token.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(instance);
    const origin = { lat: storeLat, lng: storeLng };
    const target = destLat !== null && destLng !== null ? { lat: destLat, lng: destLng } : null;
    L.marker([origin.lat, origin.lng], { icon: icon("store"), title: "Local de QuilGym", keyboard: false }).addTo(instance);
    if (target) L.marker([target.lat, target.lng], { icon: icon("destination"), title: "Destino de la entrega", keyboard: false }).addTo(instance);
    courierLayer.current = L.layerGroup().addTo(instance);
    const points = [origin, target].filter((point): point is Point => !!point);
    if (points.length > 1) instance.fitBounds(L.latLngBounds(points.map((point) => [point.lat, point.lng])), { padding: [40, 40], maxZoom: 16 });
    else instance.setView([points[0].lat, points[0].lng], 15);
    map.current = instance;
    return () => { instance.remove(); map.current = null; courierLayer.current = null; };
  }, [storeLat, storeLng, destLat, destLng]);

  useEffect(() => {
    const layer = courierLayer.current;
    const instance = map.current;
    if (!layer || !instance) return;
    layer.clearLayers();
    if (!courier) return;
    if (courier.accuracyM && courier.accuracyM < 2_000) L.circle([courier.lat, courier.lng], { radius: courier.accuracyM, weight: 1, color: "#1d2022", fillOpacity: 0.08 }).addTo(layer);
    L.marker([courier.lat, courier.lng], { icon: icon("courier"), title: "Repartidor de QuilGym", keyboard: false, zIndexOffset: 1000 }).addTo(layer);
    if (destLat !== null && destLng !== null) L.polyline([[courier.lat, courier.lng], [destLat, destLng]], { color: "#1d2022", weight: 3, dashArray: "6 8", opacity: 0.7 }).addTo(layer);
    const points: [number, number][] = [[courier.lat, courier.lng], ...(destLat !== null && destLng !== null ? [[destLat, destLng] as [number, number]] : [])];
    instance.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
  }, [courier, destLat, destLng]);

  return <div className="tracking-map__canvas" ref={container} role="img" aria-label={label}/>;
}
