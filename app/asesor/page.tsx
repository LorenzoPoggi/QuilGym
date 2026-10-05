import type { Metadata } from "next";
import { AdvisorChat } from "@/components/advisor-chat";
import { advisorConfigured } from "@/lib/advisor-chat";
import { Header } from "@/components/header";

export const metadata: Metadata = { title: "Asesor QuilGym | Conversemos sobre tu objetivo" };
export const dynamic = "force-dynamic";

export default function AdvisorPage() {
  return <><Header/><main className="advisor-page"><div className="container"><AdvisorChat configured={advisorConfigured()}/></div></main></>;
}
