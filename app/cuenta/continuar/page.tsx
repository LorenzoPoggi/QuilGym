import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getAdminUser } from "@/lib/admin-auth";

export const metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Destino del ingreso cuando no hay `next`: el admin va al panel y el resto al inicio. */
export default async function ContinueAfterLogin() {
  const user = await currentUser();
  if (!user) redirect("/cuenta/ingresar");
  redirect((await getAdminUser(user)) ? "/admin" : "/");
}
