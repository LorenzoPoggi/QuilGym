import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { storeProducts } from "@/lib/store-data";

export const metadata: Metadata = { title: "Finalizar compra | QuilGym" };

export default function CheckoutPage() {
  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark">QUILGYM</Link><span>Compra protegida · Pago seguro</span></div></header><main className="checkout-page"><div className="container"><CheckoutForm products={[storeProducts[2],storeProducts[0]]}/></div></main></>;
}
