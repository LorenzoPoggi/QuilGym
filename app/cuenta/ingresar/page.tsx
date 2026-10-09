import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { AuthForm } from "@/components/auth-form";
import { authConfigured, authEmailAvailable, currentUser, googleAvailableHere } from "@/lib/auth";
import { safeAccountReturn } from "@/lib/account-validation";
import { loginNotice } from "@/lib/auth-errors";
import { Footer } from "@/components/footer";
export const metadata = { title: "Ingresar | QuilGym", robots: { index: false, follow: false } };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string | string[]; verificado?: string; restablecida?: string }> }) {
  const params = await searchParams;
  const next = safeAccountReturn(params.next);
  if (await currentUser()) redirect(next);
  return <><Header/><main className="account-page container"><AuthForm register={false} google={await googleAvailableHere()} available={authConfigured()} recovery={authEmailAvailable()} next={next} notice={loginNotice(params)}/></main><Footer/></>;
}
