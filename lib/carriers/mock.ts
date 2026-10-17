/**
 * Transportista simulado para el modo demo y los E2E (`SHIPPING_CARRIER=mock`, nunca en producción).
 * Precio determinístico por peso, alta con un número ficticio y una línea de tiempo fija. No hace red.
 */
import type { Carrier } from "./types";

/** Hora fija por proceso: como un transportista real, repetir la consulta devuelve el mismo evento. */
const admittedAt = new Date(Date.now() - 60 * 60_000);

export function createMockCarrier(): Carrier {
  return {
    code: "mock",
    label: "Transportista simulado",
    async quote(request) {
      if (!/\d{4}/.test(request.destinationPostalCode)) return [];
      const kilos = Math.max(1, Math.ceil(request.parcel.weightGrams / 1000));
      return [{ serviceId: "D:SIM", label: "Envío simulado a domicilio", priceArs: 3_000 + kilos * 600, estimate: "Plazo de prueba: 3 a 6 días hábiles" }];
    },
    async createShipment(request) {
      const code = `SIM${request.orderId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
      return { carrierShipmentId: code, trackingCode: code, trackingUrl: null };
    },
    async tracking() {
      return [{ occurredAt: admittedAt, status: "admitted", description: "Envío admitido (simulación)", location: "Quilmes" }];
    },
  };
}
