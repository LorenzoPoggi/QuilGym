import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { getFeaturedProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Finalizar compra | QuilGym" };

export default async function CheckoutPage() {
  const products = await getFeaturedProducts(2);
  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark">QUILGYM</Link><span>Compra protegida · Pago seguro</span></div></header><main className="checkout-page"><div className="container"><CheckoutForm products={products}/></div></main></>;
}
