import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { AuthForm } from "@/components/auth-form";
import { authConfigured, currentUser, googleConfigured } from "@/lib/auth";
import { safeAccountReturn } from "@/lib/account-validation";
export const metadata = { title: "Crear cuenta | QuilGym", robots: { index: false, follow: false } };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeAccountReturn((await searchParams).next);
  if (await currentUser()) redirect(next);
  return <><Header/><main className="account-page container"><AuthForm register google={googleConfigured()} available={authConfigured()} next={next}/></main></>;
}
