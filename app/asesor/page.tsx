import type { Metadata } from "next";
import { AdvisorWizard } from "@/components/advisor-wizard";
import { Header } from "@/components/header";

export const metadata: Metadata = { title: "Asesor QuilGym | Elegí con claridad" };

export default function AdvisorPage() {
  return <><Header/><main className="advisor-page"><div className="container"><AdvisorWizard/></div></main></>;
}
