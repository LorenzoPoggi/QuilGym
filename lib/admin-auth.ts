import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { currentUser } from "./auth";
import { db } from "./db";
import { authAccounts } from "./db/schema";
import { ADMIN_EMAIL } from "./admin-config";

/** El email por sí solo no alcanza: el registro con contraseña no verifica correos. */
export async function getAdminUser(sessionUser?: Awaited<ReturnType<typeof currentUser>>) {
  const user = sessionUser === undefined ? await currentUser() : sessionUser;
  if (!user || !user.emailVerified || user.email.trim().toLowerCase() !== ADMIN_EMAIL) return null;
  const [googleAccount] = await db.select({ id: authAccounts.id }).from(authAccounts)
    .where(and(eq(authAccounts.userId, user.id), eq(authAccounts.providerId, "google"))).limit(1);
  return googleAccount ? user : null;
}

export async function requireAdminUser() {
  const sessionUser = await currentUser();
  if (!sessionUser) redirect("/cuenta/ingresar?next=%2Fadmin%2Fproductos");
  const admin = await getAdminUser(sessionUser);
  if (!admin) notFound();
  return admin;
}
