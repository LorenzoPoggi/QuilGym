import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import Link from "next/link";
import { getCart } from "@/lib/cart";
import { getCheckoutConfig } from "@/lib/checkout-config";
import { isOnlineCheckoutAvailable } from "@/lib/checkout-whatsapp";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { trackServerEvent } from "@/lib/analytics";
import { recentCheckoutOrder } from "@/lib/order-service";
import { CheckoutRedirecting } from "@/components/checkout-redirecting";

export const metadata: Metadata = { title: "Finalizar compra | QuilGym", robots: { index: false } };

export default async function CheckoutPage() {
  // Precio, stock y cupón se recalculan en el servidor antes de mostrar el checkout.
  const cart = await getCart();
  const config = getCheckoutConfig();
  if (cart.lines.length === 0) {
    // Recién confirmado: el carrito ya está vacío pero el navegador todavía no salió hacia el pago.
    const order = await recentCheckoutOrder();
    if (!order) redirect("/carrito");
    if (!config.demo && ["debit_card", "credit_card"].includes(order.paymentChoice)) redirect(`/checkout/pago/${order.id}`);
    if (config.demo || !["mercadopago", "mercado_credito"].includes(order.paymentChoice)) redirect(`/checkout/confirmacion/${order.id}`);
    return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark" aria-label="QuilGym, inicio"><Logo/></Link></div></header><main className="checkout-page"><div className="container">
      <CheckoutRedirecting orderId={order.id}/>
    </div></main></>;
  }
  const user = await currentUser();
  // Un Server Component no puede escribir cookies: solo se cuenta si el visitante ya tiene sus ids anónimos.
  await trackServerEvent("checkout_start", { canWriteCookies: false });
  return <><header className="checkout-header"><div className="container"><Link href="/" className="wordmark" aria-label="QuilGym, inicio"><Logo/></Link></div></header><main className="checkout-page"><div className="container">
    <h1 className="sr-only">Finalizar compra</h1>
    <CheckoutForm initialCart={cart} config={config} whatsappOnly={!isOnlineCheckoutAvailable(config)} initialCustomer={{ name: user?.name ?? "", email: user?.email ?? "" }}/>
  </div></main></>;
}
