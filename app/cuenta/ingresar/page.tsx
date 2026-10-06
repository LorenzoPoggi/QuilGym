import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { AuthForm } from "@/components/auth-form";
import { authConfigured, currentUser, googleConfigured } from "@/lib/auth";
import { safeAccountReturn } from "@/lib/account-validation";
export const metadata = { title: "Ingresar | QuilGym", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string | string[] }> }) {
  const params = await searchParams;
  const next = safeAccountReturn(params.next);
  const errors = Array.isArray(params.error) ? params.error : params.error ? [params.error] : [];
  const googleError = errors.includes("account_not_linked") ? "Ese email ya tiene una cuenta sin vincular. Ingresá con tu contraseña y luego vinculá Google desde Configuración." : errors.length ? "No se pudo completar el acceso con Google. Podés ingresar con email." : null;
  if (await currentUser()) redirect(next);
  return <><Header/><main className="account-page container">{googleError ? <p role="alert">{googleError}</p> : null}<AuthForm register={false} google={googleConfigured()} available={authConfigured()} next={next}/></main></>;
}
