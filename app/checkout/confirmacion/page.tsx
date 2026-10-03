import { redirect } from "next/navigation";

/** No existe una confirmación genérica: cada pedido tiene URL y autorización propias. */
export default function ConfirmationPage() {
  redirect("/carrito");
}
