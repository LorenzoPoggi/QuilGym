import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { AuthForm } from "@/components/auth-form";
import { authConfigured, currentUser, googleConfigured } from "@/lib/auth";
import { safeAccountReturn } from "@/lib/account-validation";
export const metadata = { title: "Ingresar | QuilGym", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeAccountReturn(params.next);
  if (await currentUser()) redirect(next);
  return <><Header/><main className="account-page container">{params.error ? <p role="alert">No se pudo completar el acceso con Google. Podés ingresar con email.</p> : null}<AuthForm register={false} google={googleConfigured()} available={authConfigured()} next={next}/></main></>;
}
