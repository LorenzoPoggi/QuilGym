import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { WithdrawalForm } from "@/components/withdrawal-form";

export const metadata: Metadata = {
  title: "Botón de arrepentimiento | QuilGym",
  description: "Revocá tu compra dentro de los 10 días corridos sin explicar motivos y sin costo. No necesitás cuenta.",
};

export default function WithdrawalPage() {
  return <LegalPage eyebrow="DERECHO DE REVOCACIÓN" title="Botón de arrepentimiento" current="/arrepentimiento" intro={<>
    <p>Tenés <strong>10 días corridos</strong> desde que recibiste el producto o desde la compra (lo último) para arrepentirte, sin explicar motivos y sin costo (Ley 24.240, art. 34; Res. SCI 424/2020). No necesitás cuenta ni ningún otro trámite.</p>
  </>}>
    <LegalSection id="formulario" title="Pedí la revocación">
      <p>Completá tus datos. Te damos un código de trámite en el momento y te contactamos para coordinar la devolución; el reintegro se hace por el mismo medio de pago. Más detalles en <Link href="/legales/cambios-y-devoluciones">Cambios y devoluciones</Link>.</p>
      <WithdrawalForm/>
    </LegalSection>
  </LegalPage>;
}
