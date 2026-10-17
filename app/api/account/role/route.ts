import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Rol de la sesión para la UI. Misma regla que el panel: email del admin verificado y Google vinculado. */
export async function GET() {
  let admin = false;
  try { admin = Boolean(await getAdminUser()); } catch { admin = false; }
  return Response.json({ admin }, { headers: { "Cache-Control": "private, no-store" } });
}
