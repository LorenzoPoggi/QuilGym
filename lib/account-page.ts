import "server-only";
import { redirect } from "next/navigation";
import { currentUser } from "./auth";
import { getAdminUser } from "./admin-auth";

/** Las secciones de cliente (perfil, compras, historial, favoritos) no aplican al admin: va al panel.
 *  Configuración las permite con `allowAdmin` (nombre y avatar). */
export async function requireAccountUser({ allowAdmin = false }: { allowAdmin?: boolean } = {}) {
  const user = await currentUser();
  if (!user) redirect("/cuenta/ingresar");
  const isAdmin = Boolean(await getAdminUser(user));
  if (isAdmin && !allowAdmin) redirect("/admin/pedidos");
  return { ...user, isAdmin };
}
