import type { Metadata } from "next";
import Link from "next/link";
import { BusinessIdentity, consumerClaimsLabel, consumerClaimsUrl, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cambios y devoluciones | QuilGym",
  description: "Cómo arrepentirte de una compra dentro de los 10 días, qué hacer si un producto llega dañado o equivocado y cómo se reintegra el dinero.",
};

export default function ReturnsPage() {
  return <LegalPage title="Cambios y devoluciones" current="/legales/cambios-y-devoluciones" intro={<p>Si te arrepentiste de una compra o algo no llegó bien, te explicamos qué hacer. Siempre podés escribirnos antes y lo resolvemos juntos.</p>}>
    <LegalSection id="arrepentimiento" title="1. Arrepentimiento: 10 días corridos">
      <p>Podés revocar la compra dentro de los <strong>10 días corridos</strong> desde que recibiste el producto o desde que hiciste la compra, lo que ocurra último. No tenés que explicar el motivo y no tiene costo para vos: los gastos de devolución corren por nuestra cuenta (Ley 24.240, art. 34; Código Civil y Comercial, arts. 1110 a 1116).</p>
      <ol className="legal-steps">
        <li>Entrá al <Link href="/arrepentimiento">Botón de arrepentimiento</Link> y completá el formulario. No necesitás cuenta.</li>
        <li>Te damos un <strong>código de trámite</strong> en el momento, y te escribimos para coordinar el retiro o la entrega del producto.</li>
        <li>Cuando recibimos el producto, te reintegramos el total pagado por el mismo medio de pago.</li>
      </ol>
      <p>Para poder revisarlos, te pedimos que conserves los productos como los recibiste y, si es posible, con su envase y precinto originales. Si un producto ya fue abierto o consumido, escribinos y analizamos tu caso según la ley.</p>
    </LegalSection>
    <LegalSection id="danados" title="2. Producto dañado, vencido o equivocado">
      <p>Si recibís un producto dañado, con el precinto violado, vencido o distinto del que pediste, avisanos lo antes posible con fotos del producto y del paquete. Te lo cambiamos sin costo o te devolvemos el dinero, como prefieras.</p>
      <p>Los accesorios (por ejemplo, shakers) tienen además la garantía legal por defectos de fabricación que fija la Ley 24.240 (art. 11).</p>
    </LegalSection>
    <LegalSection id="reintegros" title="3. Cómo se devuelve el dinero">
      <ul>
        <li><strong>Tarjeta de crédito:</strong> Mercado Pago anula o reintegra el cargo; según el banco puede verse en el resumen siguiente.</li>
        <li><strong>Tarjeta de débito y dinero en Mercado Pago:</strong> vuelve a la misma cuenta o tarjeta; la acreditación depende de tu banco.</li>
        <li><strong>Efectivo:</strong> te lo devolvemos en el local o por transferencia a una cuenta a tu nombre.</li>
      </ul>
    </LegalSection>
    <LegalSection id="contacto" title="4. Contacto">
      <BusinessIdentity/>
      <p>Si no logramos resolverlo, podés hacer un reclamo ante la autoridad de defensa del consumidor:</p>
      <p><a className="legal-claims-link" href={consumerClaimsUrl} target="_blank" rel="noopener noreferrer">{consumerClaimsLabel}</a></p>
    </LegalSection>
  </LegalPage>;
}
