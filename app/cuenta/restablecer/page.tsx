import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AuthCardShell, ResetForm } from "@/components/auth-form";
import { authEmailAvailable } from "@/lib/auth";
export const metadata = { title: "Nueva contraseña | QuilGym", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const valid = authEmailAvailable() && !error && typeof token === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(token);
  return <><Header/><main className="account-page container"><AuthCardShell eyebrow="RECUPERAR ACCESO" title={valid ? "Elegí una contraseña nueva" : "El enlace no es válido"} intro={valid ? "Usá al menos 10 caracteres. Después vas a poder ingresar con ella." : "El enlace venció, ya se usó o está incompleto. Pedí uno nuevo: vence en 1 hora."}>
    {valid ? <ResetForm token={token}/> : <><Link className="button button--dark button--full" href="/cuenta/recuperar">Pedir un enlace nuevo</Link><p className="auth-switch"><Link href="/cuenta/ingresar">Volver a ingresar</Link></p></>}
  </AuthCardShell></main><Footer/></>;
}
