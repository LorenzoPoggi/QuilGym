import type { Metadata } from "next";
import Link from "next/link";
import { BusinessIdentity, consumerClaimsLabel, consumerClaimsUrl, LegalPage, LegalSection, SupplementNotice } from "@/components/legal-page";
import { readPendingOrderTtlHours } from "@/lib/checkout-env";
import { commerce } from "@/lib/commerce";

export const metadata: Metadata = {
  title: "Términos y condiciones | QuilGym",
  description: "Condiciones de compra en QuilGym: precios, medios de pago, envíos y retiro en Quilmes, derecho de revocación y atención al consumidor.",
};

export default function TermsPage() {
  const ttl = readPendingOrderTtlHours(process.env).hours;
  return <LegalPage title="Términos y condiciones" current="/legales/terminos" intro={<p>Estas condiciones rigen las compras en la tienda online de QuilGym. Al confirmar un pedido aceptás estos términos. Si algo no queda claro, escribinos antes de comprar.</p>}>
    <LegalSection id="vendedor" title="1. Quién vende">
      <p>La tienda es operada por el titular de QuilGym, con los siguientes datos:</p>
      <BusinessIdentity/>
    </LegalSection>
    <LegalSection id="productos" title="2. Productos e información">
      <p>Publicamos fotos y descripciones de cada producto con la mayor precisión posible. La información válida es la del rótulo del envase (ingredientes, porción, advertencias), que también mostramos como foto cuando la tenemos. Los colores y envases pueden variar según el lote del fabricante.</p>
      <p>El stock es limitado y se reserva recién al confirmar el pedido. Si un producto no está disponible, te avisamos y te reintegramos lo que hayas pagado por él.</p>
      <SupplementNotice/>
    </LegalSection>
    <LegalSection id="precios" title="3. Precios">
      <p>Los precios están expresados en pesos argentinos y son precios finales. El costo de envío, si corresponde, se informa antes de pagar. Respetamos el precio vigente al momento de confirmar tu pedido aunque después cambie en la tienda.</p>
      <p>Si un precio se publica con un error material evidente, te avisamos antes de cobrar y podés cancelar el pedido sin costo.</p>
    </LegalSection>
    <LegalSection id="pagos" title="4. Medios de pago">
      <ul>
        <li><strong>Mercado Pago y Mercado Crédito:</strong> pagás en el sitio de Mercado Pago.</li>
        <li><strong>Tarjetas de débito y crédito:</strong> los datos de la tarjeta los procesa Mercado Pago en un formulario seguro; QuilGym no los ve ni los guarda. Las cuotas disponibles y su interés los define el emisor de tu tarjeta y se muestran antes de confirmar el pago.</li>
        <li><strong>Efectivo:</strong> solo al retirar en el local, cuando te avisamos que el pedido está listo.</li>
      </ul>
      <p>El pedido queda confirmado cuando el pago se acredita. Si un pago es rechazado, no se cobra y podés reintentar con otro medio. Los pedidos sin pago se cancelan automáticamente a las {ttl} horas y se libera el stock reservado.</p>
    </LegalSection>
    <LegalSection id="entrega" title="5. Envío y retiro">
      <p>Antes de pagar ves el costo y el plazo estimado del envío para tu código postal. Los plazos son estimados y corren desde la acreditación del pago. Si elegís retiro en {commerce.pickupLocation}, esperá nuestro aviso de «listo para retirar» y llevá el número de pedido.</p>
      <p>Revisá el paquete al recibirlo. Si llega dañado o incompleto, avisanos lo antes posible, con fotos, para resolverlo rápido. Esto no limita los derechos que te da la ley.</p>
    </LegalSection>
    <LegalSection id="revocacion" title="6. Derecho de revocación (arrepentimiento)">
      <p>Tenés 10 días corridos para arrepentirte de la compra, contados desde que recibís el producto o desde la compra, lo que ocurra último, sin explicar motivos y sin costo (Ley 24.240, art. 34, y Código Civil y Comercial, arts. 1110 a 1116). Podés hacerlo desde el <Link href="/arrepentimiento">Botón de arrepentimiento</Link>. El detalle está en <Link href="/legales/cambios-y-devoluciones">Cambios y devoluciones</Link>.</p>
    </LegalSection>
    <LegalSection id="cuentas" title="7. Cuenta de cliente">
      <p>Podés comprar sin cuenta. Si creás una, sos responsable de mantener tu contraseña en reserva. Podés borrar tu cuenta cuando quieras desde <Link href="/cuenta/configuracion">Configuración</Link>; los pedidos se conservan por obligaciones fiscales.</p>
    </LegalSection>
    <LegalSection id="factura" title="8. Factura">
      <p>Emitimos factura electrónica por cada compra. Por regla general se emite a consumidor final; desde el monto que fija ARCA te vamos a pedir DNI o CUIT para identificarte en el comprobante.</p>
    </LegalSection>
    <LegalSection id="propiedad" title="9. Marcas y contenidos">
      <p>Las marcas de los productos pertenecen a sus titulares. Los textos, fotos propias y el diseño del sitio pertenecen a QuilGym; no los copies sin autorización.</p>
    </LegalSection>
    <LegalSection id="consumidor" title="10. Atención y reclamos">
      <p>Ante cualquier problema, escribinos primero por WhatsApp o email: buscamos resolverlo rápido. También podés hacer un reclamo ante la autoridad de defensa del consumidor:</p>
      <p><a className="legal-claims-link" href={consumerClaimsUrl} target="_blank" rel="noopener noreferrer">{consumerClaimsLabel}</a></p>
      <p>Para residentes en la provincia de Buenos Aires también interviene la Dirección Provincial de Defensa de las y los Consumidores y las oficinas municipales (OMIC). Se aplica la ley argentina; son competentes los tribunales del domicilio del consumidor (Ley 24.240, art. 36).</p>
    </LegalSection>
    <LegalSection id="cambios" title="11. Cambios en estos términos">
      <p>Podemos actualizar estos términos. Cada pedido se rige por la versión vigente cuando lo confirmaste. La fecha de la última actualización figura arriba.</p>
    </LegalSection>
  </LegalPage>;
}
