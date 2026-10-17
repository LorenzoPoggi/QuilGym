/**
 * Interfaz genérica de transportista. Correo Argentino es el proveedor provisorio: sumar o cambiar a otro
 * (por ejemplo Andreani) es agregar un archivo que implemente `Carrier` y registrarlo en `lib/carriers/index.ts`.
 */
import type { Parcel } from "../shipping-defaults";

export type CarrierCode = "correo_argentino" | "mock";

export type CarrierAddress = { street: string; streetNumber: string; apartment: string; postalCode: string; city: string; province: string };

export type CarrierQuoteRequest = { destinationPostalCode: string; parcel: Parcel; declaredValueArs: number };

export type CarrierRate = {
  /** Identificador estable del servicio dentro del transportista (va en la cotización firmada). */
  serviceId: string;
  label: string;
  priceArs: number;
  estimate: string;
};

export type CarrierShipmentRequest = {
  orderId: string;
  orderCode: string;
  serviceId: string | null;
  recipient: { name: string; email: string; phone: string };
  address: CarrierAddress;
  parcel: Parcel;
  declaredValueArs: number;
};

export type CarrierShipment = {
  /** Referencia del envío en el transportista; puede ser nuestro propio código si la API no devuelve otro. */
  carrierShipmentId: string;
  trackingCode: string | null;
  trackingUrl: string | null;
};

export type CarrierTrackingEvent = { occurredAt: Date; status: string; description: string; location: string | null };

export interface Carrier {
  code: CarrierCode;
  /** Nombre visible («Correo Argentino»). */
  label: string;
  quote(request: CarrierQuoteRequest): Promise<CarrierRate[]>;
  createShipment(request: CarrierShipmentRequest): Promise<CarrierShipment>;
  tracking(reference: string): Promise<CarrierTrackingEvent[]>;
}

/** Error de proveedor con un mensaje apto para el panel; nunca incluye credenciales ni cuerpos de respuesta. */
export class CarrierError extends Error {
  constructor(message: string, readonly reason: "config" | "auth" | "http" | "timeout" | "response" = "http") { super(message); }
}
