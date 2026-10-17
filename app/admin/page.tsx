import { redirect } from "next/navigation";
// Mismo destino que el admin al entrar a /cuenta*: los pedidos son lo primero que se opera.
export default function AdminPage() { redirect("/admin/pedidos"); }
