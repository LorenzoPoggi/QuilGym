import type { OrderStatus } from "./checkout-types";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["pending", "approved", "rejected", "cancelled"],
  approved: ["approved", "refunded"],
  rejected: ["rejected"], cancelled: ["cancelled"], refunded: ["refunded"],
};
export function canTransition(from: OrderStatus, to: OrderStatus) { return transitions[from].includes(to); }
export function providerStatus(value: string): OrderStatus {
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
  if (value === "cancelled") return "cancelled";
  if (value === "refunded" || value === "charged_back") return "refunded";
  return "pending";
}
