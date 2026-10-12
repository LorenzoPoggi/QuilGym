"use client";

import { useRouter } from "next/navigation";
import { MercadoPagoPayment } from "@/components/order-payment";

type CardChoice = "debit_card" | "credit_card";

export function CardPaymentFlow({ orderId, paymentChoice, accessToken, confirmationHref, lastAttemptFailed }: {
  orderId: string;
  paymentChoice: CardChoice;
  accessToken: string | null;
  confirmationHref: string;
  lastAttemptFailed: boolean;
}) {
  const router = useRouter();

  async function showSuccessAndReturn() {
    // El mensaje de éxito del Brick permanece visible antes de abrir el seguimiento del pedido.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 1800));
    router.replace(confirmationHref);
  }

  return <MercadoPagoPayment orderId={orderId} paymentChoice={paymentChoice} accessToken={accessToken} lastAttemptFailed={lastAttemptFailed} onPaid={showSuccessAndReturn}/>;
}
