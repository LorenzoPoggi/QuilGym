import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import Link from "next/link";
import { getCart } from "@/lib/cart";
import { getCheckoutConfig } from "@/lib/checkout-config";
import { isOnlineCheckoutAvailable } from "@/lib/checkout-whatsapp";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Finalizar compra | QuilGym", robots: { index: false } };

export default async function CheckoutPage() {
  // Precio, stock y cupón se recalculan en el servidor antes de mostrar el checkout.
  const cart = await getCart();
  if (cart.lines.length === 0) redirect("/carrito");
  const config = getCheckoutConfig();
  const user = await currentUser();
  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark">QUILGYM</Link></div></header><main className="checkout-page"><div className="container">
    <h1 className="sr-only">Finalizar compra</h1>
    <CheckoutForm initialCart={cart} config={config} whatsappOnly={!isOnlineCheckoutAvailable(config)} initialCustomer={{ name: user?.name ?? "", email: user?.email ?? "" }}/>
  </div></main></>;
}
