import type { Metadata } from "next";
import Link from "next/link";
import { BusinessIdentity, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad | QuilGym",
  description: "Qué datos personales usa QuilGym, para qué, con quién se comparten, cookies y cómo ejercer tus derechos (Ley 25.326).",
};

const cookies = [
  ["qg_cart", "Cookie propia esencial", "Identifica tu carrito con un código aleatorio para que no pierdas los productos.", "60 días"],
  ["quilgym.session_token (y cookies auxiliares de inicio de sesión)", "Cookie propia esencial", "Mantiene tu sesión si entrás con tu cuenta (email o Google).", "Hasta 30 días o hasta que cierres sesión"],
  ["qg_advisor", "Cookie propia esencial", "Limita la cantidad de consultas al asesor virtual para evitar abusos.", "24 horas"],
  ["qg_orders", "Cookie propia esencial", "Recuerda, firmados, los números de tus últimos 3 pedidos como invitado para mostrarte el aviso de pedido en curso. No guarda datos personales.", "30 días"],
  ["qg_active_order_dismissed", "Almacenamiento local de tu navegador", "Recuerda que cerraste el aviso de un pedido para no volver a mostrarlo en ese estado.", "Hasta que borres los datos del sitio"],
  ["Búsquedas recientes", "Almacenamiento local del navegador", "Muestra tus últimas búsquedas en este dispositivo. No se envía a nuestros servidores.", "Hasta que las borres"],
  ["Borrador del checkout", "Almacenamiento de sesión del navegador", "Conserva los datos del formulario de compra mientras la pestaña está abierta. No guarda datos de tarjetas.", "Se borra al cerrar la pestaña o al confirmar"],
  ["Mercado Pago", "Terceros, solo en la página de pago", "El formulario de pago de Mercado Pago usa sus propias cookies y datos del dispositivo para prevenir fraudes.", "Según la política de Mercado Pago"],
  ["Google Maps", "Terceros, solo si elegís retiro en el local", "El mapa del local se carga desde Google, que puede usar sus propias cookies.", "Según la política de Google"],
] as const;

export default function PrivacyPage() {
  return <LegalPage title="Política de privacidad" current="/legales/privacidad" intro={<p>Cuidamos tus datos personales según la Ley 25.326 de Protección de los Datos Personales. Acá te contamos qué datos usamos, para qué y cómo podés acceder a ellos, corregirlos o pedir que los borremos.</p>}>
    <LegalSection id="responsable" title="1. Responsable de los datos">
      <BusinessIdentity/>
    </LegalSection>
    <LegalSection id="datos" title="2. Qué datos usamos">
      <ul>
        <li><strong>Al comprar:</strong> nombre, email, teléfono, dirección de entrega (si pedís envío), notas del pedido y, cuando la factura lo exige, DNI o CUIT.</li>
        <li><strong>Pagos:</strong> los datos de tarjeta los recibe y procesa Mercado Pago. QuilGym solo recibe el resultado del pago, su número de operación y el medio usado; nunca el número completo ni el código de seguridad.</li>
        <li><strong>Cuenta (opcional):</strong> nombre, email, contraseña guardada cifrada (no la podemos leer), foto de perfil si entrás con Google, favoritos, historial de búsquedas y tu preferencia de recibir novedades.</li>
        <li><strong>Asesor virtual:</strong> los mensajes que escribís se envían a Google (Gemini) para generar la respuesta. No escribas datos de salud ni datos personales que no quieras compartir.</li>
        <li><strong>Entrega propia y seguimiento:</strong> para saber si llegamos con la entrega propia ubicamos tu dirección en el mapa (con la API pública Georef del Estado argentino). Si tocás «Usar mi ubicación», el navegador nos la envía solo para ubicar tu dirección y no la guardamos. Mientras QuilGym lleva tu pedido, compartimos con vos la ubicación del repartidor: se registra solo durante el reparto y se borra al entregar el pedido (o a las 4 horas, como máximo).</li>
        <li><strong>Datos técnicos:</strong> dirección IP y datos del navegador que se usan para seguridad y para limitar abusos (por ejemplo, intentos de ingreso).</li>
      </ul>
    </LegalSection>
    <LegalSection id="finalidad" title="3. Para qué los usamos">
      <ul>
        <li>Procesar tus pedidos, pagos, envíos y retiros, y avisarte por email sobre su estado.</li>
        <li>Emitir la factura y cumplir obligaciones fiscales y contables.</li>
        <li>Atender consultas, cambios, devoluciones y pedidos de arrepentimiento.</li>
        <li>Prevenir fraudes y proteger el sitio.</li>
        <li>Enviarte novedades solo si lo aceptaste expresamente. Podés darte de baja cuando quieras.</li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>
    </LegalSection>
    <LegalSection id="terceros" title="4. Con quién los compartimos">
      <p>Solo con los proveedores que necesitamos para operar la tienda, que los tratan por cuenta nuestra:</p>
      <ul>
        <li><strong>Mercado Pago</strong>: cobros con tarjeta, dinero en cuenta y Mercado Crédito.</li>
        <li><strong>Vercel</strong> (alojamiento del sitio) y <strong>Neon</strong> (base de datos).</li>
        <li><strong>Resend</strong>: envío de emails del pedido y de la cuenta.</li>
        <li><strong>Google</strong>: ingreso con Google (si lo elegís), asesor virtual, mapa del local y reseñas públicas.</li>
        <li><strong>OpenStreetMap</strong>: el mapa del seguimiento del pedido se dibuja con sus teselas, que tu navegador descarga directamente de sus servidores (reciben tu IP, como cualquier sitio web).</li>
        <li>El servicio de facturación electrónica y la empresa de envíos que corresponda a tu pedido.</li>
        <li>Autoridades, cuando una ley o una orden judicial lo exija.</li>
      </ul>
      <p>Algunos de estos proveedores procesan datos fuera de la Argentina (por ejemplo, en Estados Unidos). Trabajamos con servicios que asumen compromisos contractuales de seguridad y confidencialidad.</p>
    </LegalSection>
    <LegalSection id="cookies" title="5. Cookies y almacenamiento en tu navegador">
      <p>Usamos solo cookies y almacenamiento esenciales para que la tienda funcione. <strong>No usamos cookies de publicidad ni de analítica</strong>; por eso no mostramos un aviso para aceptarlas. Si en el futuro las sumamos, te vamos a pedir permiso antes.</p>
      {/* Desplazable en mobile: focusable por teclado (WCAG 2.1.1). */}
      <div className="legal-table-wrap" tabIndex={0} role="region" aria-label="Cookies y almacenamiento (tabla desplazable)"><table className="legal-table">
        <caption className="sr-only">Cookies y almacenamiento que usa el sitio</caption>
        <thead><tr><th scope="col">Nombre</th><th scope="col">Tipo</th><th scope="col">Para qué</th><th scope="col">Duración</th></tr></thead>
        <tbody>{cookies.map(([name, kind, purpose, duration]) => <tr key={name}><th scope="row">{name}</th><td>{kind}</td><td>{purpose}</td><td>{duration}</td></tr>)}</tbody>
      </table></div>
      <p>Podés borrar las cookies desde la configuración de tu navegador; si lo hacés, se vacía el carrito y se cierra tu sesión.</p>
    </LegalSection>
    <LegalSection id="conservacion" title="6. Cuánto tiempo los guardamos">
      <ul>
        <li>Pedidos y facturas: durante el plazo que exigen las normas fiscales y comerciales.</li>
        <li>Cuenta, favoritos e historial: hasta que borres la cuenta o los elimines.</li>
        <li>Carritos sin compra: se eliminan automáticamente después de un período de inactividad.</li>
      </ul>
    </LegalSection>
    <LegalSection id="derechos" title="7. Tus derechos">
      <p>Podés pedir acceso a tus datos, corregirlos, actualizarlos o pedir que los borremos, escribiéndonos por los canales indicados arriba. Respondemos el pedido de acceso dentro de los 10 días corridos y los de rectificación o supresión dentro de los 5 días hábiles (Ley 25.326, arts. 14 y 16). Si tenés cuenta, también podés editar tu perfil o borrar la cuenta desde <Link href="/cuenta/configuracion">Configuración</Link>.</p>
      <p className="legal-callout legal-callout--plain">El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>
      <p>Más información en el sitio de la <a href="https://www.argentina.gob.ar/aaip/datospersonales" target="_blank" rel="noopener noreferrer">Agencia de Acceso a la Información Pública</a>.</p>
    </LegalSection>
    <LegalSection id="seguridad" title="8. Seguridad">
      <p>Usamos conexiones cifradas (HTTPS), contraseñas cifradas, accesos restringidos y proveedores con estándares de seguridad. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te vamos a avisar.</p>
    </LegalSection>
    <LegalSection id="menores" title="9. Menores de edad">
      <p>La tienda está dirigida a mayores de 18 años. Los menores deben comprar con autorización de un adulto responsable.</p>
    </LegalSection>
    <LegalSection id="cambios" title="10. Cambios en esta política">
      <p>Si cambiamos esta política, publicamos la nueva versión acá con su fecha. Si el cambio es importante, también te avisamos por email cuando tengas una cuenta.</p>
    </LegalSection>
  </LegalPage>;
}
