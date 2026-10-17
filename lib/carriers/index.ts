/**
 * Selección del transportista por variables de entorno (`SHIPPING_CARRIER`). Sin configuración completa devuelve
 * null y el checkout sigue con la tarifa fija de `SHIPPING_RATES_JSON`, como antes de esta integración.
 */
import { readCarrierConfig } from "../checkout-env";
import { createCorreoArgentinoCarrier } from "./correo-argentino";
import { createMockCarrier } from "./mock";
import type { Carrier } from "./types";

type Env = Record<string, string | undefined>;

export function getCarrier(env: Env = process.env): Carrier | null {
  const config = readCarrierConfig(env);
  if (!config.carrier) return null;
  if (config.carrier.code === "mock") return createMockCarrier();
  return createCorreoArgentinoCarrier(config.carrier.correoArgentino);
}

export type { Carrier, CarrierCode, CarrierRate, CarrierShipment, CarrierTrackingEvent } from "./types";
export { CarrierError } from "./types";
