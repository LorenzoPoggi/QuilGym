/** Textos y formato de la entrega propia. Puro y liviano: lo importa también el formulario del checkout. */
export const LOCAL_DELIVERY_OPTION_ID = "local";
export const LOCAL_DELIVERY_LABEL = "Entrega en Quilmes (costo a convenir)";
export const LOCAL_DELIVERY_ESTIMATE = "Coordinamos el día y el horario con vos";
export const LOCAL_DELIVERY_NOTE = "El costo de la entrega se arregla con QuilGym al llevar tu pedido";
/** Distancia máxima entre la ubicación del navegador y un candidato para usarla como desempate. */
export const HINT_MATCH_RADIUS_M = 1_500;

/** «A 2,4 km del local» con una cifra decimal; debajo de 1 km, en metros redondeados a 50. */
export function formatDistance(meters: number) {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  return `${(meters / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
}
