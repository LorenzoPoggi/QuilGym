import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { getCart } from "@/lib/cart";
import { getCheckoutConfig } from "@/lib/checkout-config";

export const metadata: Metadata = { title: "Finalizar compra | QuilGym", robots: { index: false } };

export default async function CheckoutPage() {
  // Precio, stock y cupón se recalculan en el servidor antes de mostrar el checkout.
  const cart = await getCart();
  if (cart.lines.length === 0) redirect("/carrito");
  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark">QUILGYM</Link><h1>Finalizar compra</h1></div></header><main className="checkout-page"><div className="container"><CheckoutForm initialCart={cart} config={getCheckoutConfig()}/></div></main></>;
}
