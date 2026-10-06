import { eq } from "drizzle-orm";
import { AccountShell } from "@/components/account-shell";
import { AccountSettings } from "@/components/account-settings";
import { requireAccountUser } from "@/lib/account-page";
import { googleConfigured } from "@/lib/auth";
import { db } from "@/lib/db";
import { authAccounts, users } from "@/lib/db/schema";

export const metadata = { title: "Configuración | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAccountUser();
  const [[preferences], accounts] = await Promise.all([
    db.select({ marketing: users.marketingConsent }).from(users).where(eq(users.id, user.id)).limit(1),
    db.select({ providerId: authAccounts.providerId, password: authAccounts.password }).from(authAccounts).where(eq(authAccounts.userId, user.id)),
  ]);
  const hasPassword = accounts.some((account) => account.providerId === "credential" && Boolean(account.password));
  const googleLinked = accounts.some((account) => account.providerId === "google");
  return <AccountShell user={user} active="/cuenta/configuracion"><h2 className="account-page-title">Configuración</h2><p className="account-page-intro">Elegí cómo se muestra tu perfil y qué comunicaciones querés recibir.</p><AccountSettings name={user.name} image={user.image} marketing={preferences?.marketing ?? false} hasPassword={hasPassword} googleLinked={googleLinked} googleAvailable={googleConfigured()}/></AccountShell>;
}
