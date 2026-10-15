import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AuthCardShell, RecoverForm } from "@/components/auth-form";
import { authEmailAvailable, currentUser } from "@/lib/auth";
import { whatsappUrl } from "@/lib/commerce";
export const metadata = { title: "Recuperar contraseña | QuilGym", robots: { index: false, follow: false } };
export default async function RecoverPage() {
  if (await currentUser()) redirect("/cuenta/configuracion");
  const available = authEmailAvailable();
  return <><Header/><main className="account-page container"><AuthCardShell eyebrow="RECUPERAR ACCESO" title="¿Olvidaste tu contraseña?" intro={available ? "Escribí el email de tu cuenta y te mandamos un enlace para elegir una nueva." : "Por ahora la recuperación por email no está habilitada. Escribinos y te ayudamos a recuperar el acceso."}>
    {available ? <RecoverForm available/> : <><a className="button button--dark button--full" href={whatsappUrl("¡Hola! Olvidé la contraseña de mi cuenta QuilGym y necesito ayuda para recuperarla.")} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true"/>Escribinos por WhatsApp<span className="sr-only"> (se abre en otra pestaña)</span></a><p className="auth-switch"><Link href="/cuenta/ingresar">Volver a ingresar</Link></p></>}
  </AuthCardShell></main><Footer/></>;
}
