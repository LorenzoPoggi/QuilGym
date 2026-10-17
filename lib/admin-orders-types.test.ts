import { describe, expect, it } from "vitest";
import { allowedShipmentStatuses, shipmentLabel } from "./admin-orders-types";

describe("estados de envío según la entrega", () => {
  it("la entrega propia pasa por «En camino» y no por «Enviado» ni «Listo para retirar»", () => {
    expect(allowedShipmentStatuses({ status: "approved", delivery: "local", paymentMethod: "mercadopago" })).toEqual(["pending", "preparing", "out_for_delivery", "delivered"]);
    expect(shipmentLabel("out_for_delivery")).toBe("En camino");
  });
  it("el envío por transportista suma «En camino» después de «Enviado»", () => {
    expect(allowedShipmentStatuses({ status: "approved", delivery: "shipping", paymentMethod: "mercadopago" })).toEqual(["pending", "preparing", "shipped", "out_for_delivery", "delivered"]);
  });
  it("con efectivo pendiente se prepara y sale a entregar, pero se marca entregado recién al confirmar el cobro", () => {
    expect(allowedShipmentStatuses({ status: "pending", delivery: "local", paymentMethod: "cash" })).toEqual(["pending", "preparing", "out_for_delivery"]);
    expect(allowedShipmentStatuses({ status: "pending", delivery: "pickup", paymentMethod: "cash" })).toEqual(["pending", "preparing", "ready_for_pickup"]);
    expect(allowedShipmentStatuses({ status: "pending", delivery: "local", paymentMethod: "mercadopago" })).toEqual([]);
  });
});
