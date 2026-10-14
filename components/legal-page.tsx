import Link from "next/link";
import { Footer } from "./footer";
import { Header } from "./header";
import { commerce, formatCuit, missingBusinessData, whatsappUrl } from "@/lib/commerce";
import { consumerClaimsUrl, LEGAL_UPDATED, legalLinks } from "@/lib/legal";

export { consumerClaimsLabel, consumerClaimsUrl } from "@/lib/legal";

/** Datos del vendedor desde `commerce.business`. Los que faltan no se inventan: se omiten. */
export function BusinessIdentity() {
  const { legalName, cuit, legalAddress, grossIncome, contactEmail } = commerce.business;
  const rows = [
    ["Razón social", legalName], ["CUIT", formatCuit(cuit)], ["Domicilio legal", legalAddress], ["Ingresos Brutos", grossIncome],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  return <dl className="legal-identity">
    <div><dt>Tienda</dt><dd>QuilGym · Suplementos deportivos en {commerce.pickupLocation}, provincia de Buenos Aires</dd></div>
    {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    {contactEmail ? <div><dt>Email</dt><dd><a href={`mailto:${contactEmail}`}>{contactEmail}</a></dd></div> : null}
    <div><dt>WhatsApp</dt><dd><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">+{commerce.whatsapp.phone}</a></dd></div>
  </dl>;
}

/** Aviso solo para revisión interna (desarrollo y Preview): qué datos legales faltan cargar. */
function MissingDataNotice() {
  const missing = missingBusinessData();
  if (!missing.length || process.env.VERCEL_ENV === "production") return null;
  return <aside className="legal-review-note" role="note"><strong>Revisión interna (no se muestra en producción)</strong>
    <span>Faltan en <code>lib/commerce.ts</code> (business): {missing.join(", ")}. Los textos deben revisarlos un abogado y el contador antes de publicar.</span></aside>;
}

export function LegalPage({ eyebrow = "INFORMACIÓN LEGAL", title, intro, current, children }: { eyebrow?: string; title: string; intro: React.ReactNode; current: string; children: React.ReactNode }) {
  return <><Header/>
    <main className="legal-page"><div className="container legal-layout">
      <nav className="legal-nav" aria-label="Páginas legales">
        <p className="eyebrow">LEGALES</p>
        <ul>{legalLinks.map(([label, href]) => <li key={href}><Link href={href} aria-current={href === current ? "page" : undefined}>{label}</Link></li>)}
          <li><a href={consumerClaimsUrl} target="_blank" rel="noopener noreferrer">Reclamos de consumo (Ventanilla Federal)</a></li></ul>
      </nav>
      <article className="legal-article">
        <header className="legal-head"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><div className="legal-intro">{intro}</div><p className="legal-updated">Última actualización: {LEGAL_UPDATED}</p></header>
        <MissingDataNotice/>
        {children}
      </article>
    </div></main>
    <Footer/></>;
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section className="legal-section" id={id} aria-labelledby={`${id}-title`}><h2 id={`${id}-title`}>{title}</h2>{children}</section>;
}

/** Leyendas de rotulado de suplementos dietarios (Código Alimentario Argentino, art. 1381) y aviso de uso. */
export function SupplementNotice() {
  return <div className="legal-callout" role="note"><strong>Sobre los suplementos dietarios</strong>
    <p>Los suplementos dietarios no son medicamentos ni reemplazan una alimentación variada y equilibrada. Consultá a tu médico o nutricionista antes de consumirlos, en especial si estás embarazada o en período de lactancia, sos menor de edad, tenés una enfermedad o tomás medicación. Respetá la porción diaria recomendada y las advertencias del rótulo de cada producto. Mantenelos fuera del alcance de los niños.</p>
    <p>Las descripciones, el comparador y el asesor virtual de QuilGym orientan sobre el uso habitual de cada producto: no son consejo médico ni prometen resultados.</p></div>;
}
