/**
 * Plantillas de emails transaccionales (HTML con estilos en línea + texto plano). Puras y sin `server-only`
 * para probarlas sin red. Todo dato variable se escapa: nombres, direcciones y notas los escribe el cliente.
 */
import { commerce, formatArs, formatCuit } from "./commerce";

export type EmailContent = { subject: string; html: string; text: string };
type Detail = [label: string, value: string];
export type EmailBlock = {
  subject: string;
  /** Texto corto que los clientes de correo muestran junto al asunto. */
  preheader: string;
  heading: string;
  paragraphs: string[];
  details?: Detail[];
  lines?: { name: string; quantity: number; totalArs: number }[];
  action?: { label: string; url: string } | null;
  footnote?: string;
};

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const safeUrl = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" || url.hostname === "localhost" ? url.href : null; } catch { return null; } };

function footerLines(siteUrl: string | null) {
  const { legalName, cuit, legalAddress } = commerce.business;
  const identity = [legalName, formatCuit(cuit) ? `CUIT ${formatCuit(cuit)}` : null, legalAddress].filter(Boolean).join(" · ");
  const links = siteUrl ? [["Términos y condiciones", `${siteUrl}/legales/terminos`], ["Privacidad", `${siteUrl}/legales/privacidad`], ["Botón de arrepentimiento", `${siteUrl}/arrepentimiento`]] as const : [];
  return { identity: identity || `QuilGym · Suplementos deportivos en ${commerce.pickupLocation}`, links };
}

export function renderEmail(block: EmailBlock, siteUrl: string | null): EmailContent {
  const action = block.action ? safeUrl(block.action.url) : null;
  const footer = footerLines(siteUrl);
  const text = [
    block.heading, "",
    ...block.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(block.details?.length ? [...block.details.map(([label, value]) => `${label}: ${value}`), ""] : []),
    ...(block.lines?.length ? ["Detalle:", ...block.lines.map((line) => `- ${line.quantity} × ${line.name}: ${formatArs(line.totalArs)}`), ""] : []),
    ...(action && block.action ? [`${block.action.label}: ${action}`, ""] : []),
    ...(block.footnote ? [block.footnote, ""] : []),
    "—", footer.identity,
    ...footer.links.map(([label, url]) => `${label}: ${url}`),
  ].join("\n");
  const cell = "padding:6px 0;font-size:14px;line-height:20px;border-bottom:1px solid #eceeef";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(block.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f2f0;color:#1d2022;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(block.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f2f0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d6dadd;border-radius:16px">
<tr><td style="padding:22px 28px;border-bottom:1px solid #eceeef;font-size:20px;font-weight:900;letter-spacing:.02em">QUILGYM</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;font-weight:800">${escapeHtml(block.heading)}</h1>
${block.paragraphs.map((paragraph) => `<p style="margin:0 0 14px;font-size:15px;line-height:22px">${escapeHtml(paragraph)}</p>`).join("\n")}
${block.details?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px">${block.details.map(([label, value]) => `<tr><td style="${cell};color:#656c71">${escapeHtml(label)}</td><td align="right" style="${cell};font-weight:600">${escapeHtml(value)}</td></tr>`).join("")}</table>` : ""}
${block.lines?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${block.lines.map((line) => `<tr><td style="${cell}">${line.quantity} × ${escapeHtml(line.name)}</td><td align="right" style="${cell}">${escapeHtml(formatArs(line.totalArs))}</td></tr>`).join("")}</table>` : ""}
${action && block.action ? `<p style="margin:22px 0"><a href="${escapeHtml(action)}" style="display:inline-block;padding:13px 22px;background:#1d2022;color:#ffffff;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">${escapeHtml(block.action.label)}</a></p>
<p style="margin:0 0 14px;font-size:12px;line-height:18px;color:#656c71">Si el botón no funciona, copiá este enlace: ${escapeHtml(action)}</p>` : ""}
${block.footnote ? `<p style="margin:14px 0 0;font-size:13px;line-height:19px;color:#656c71">${escapeHtml(block.footnote)}</p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eceeef;font-size:12px;line-height:18px;color:#656c71">${escapeHtml(footer.identity)}${footer.links.length ? `<br>${footer.links.map(([label, url]) => `<a href="${escapeHtml(url)}" style="color:#656c71">${escapeHtml(label)}</a>`).join(" · ")}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: block.subject, html, text };
}

export type OrderEmailEvent = "created" | "approved" | "payment_rejected" | "rejected" | "cancelled" | "expired" | "refunded" | "ready_for_pickup" | "shipped" | "invoice_issued";
export type OrderEmailOrder = {
  id: string; name: string; status: string; paymentMethod: string; paymentChoice: string; delivery: string; totalArs: number;
  pickupDetails: { address: string; hours: string } | null;
  address: { street: string; number: string; apartment: string; postalCode: string; city: string; province: string } | null;
};
export type OrderEmailInvoice = { voucherType: string | null; pointOfSale: number | null; number: number | null; cae: string | null; caeDueDate: string | null; pdfUrl: string | null };

const paymentLabels: Record<string, string> = { mercadopago: "Mercado Pago", mercado_credito: "Mercado Crédito", debit_card: "Tarjeta de débito", credit_card: "Tarjeta de crédito", cash: "Efectivo al retirar", transfer: "Transferencia" };
export const orderCodeOf = (id: string) => `QG-${id.slice(0, 8).toUpperCase()}`;
const firstName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 40) || "";
export const invoiceNumberLabel = (invoice: Pick<OrderEmailInvoice, "voucherType" | "pointOfSale" | "number">) =>
  invoice.pointOfSale && invoice.number ? `Factura ${invoice.voucherType ?? ""} ${String(invoice.pointOfSale).padStart(5, "0")}-${String(invoice.number).padStart(8, "0")}`.replace(/\s+/g, " ") : "Factura";

export function orderEmailContent(event: OrderEmailEvent, input: {
  order: OrderEmailOrder; link: string | null; siteUrl: string | null;
  shipment?: { label: string; trackingCode: string | null } | null;
  lines?: { name: string; quantity: number; totalArs: number }[];
  invoice?: OrderEmailInvoice | null;
}): EmailContent {
  const { order, link, shipment } = input;
  const code = orderCodeOf(order.id);
  const hello = firstName(order.name) ? `Hola, ${firstName(order.name)}.` : "Hola.";
  const pickup = order.pickupDetails ? `${order.pickupDetails.address} (${order.pickupDetails.hours})` : "el local";
  const method = order.paymentMethod === "mercadopago" ? paymentLabels[order.paymentChoice] ?? "Mercado Pago" : paymentLabels[order.paymentMethod] ?? order.paymentMethod;
  const delivery = order.delivery === "pickup" ? `Retiro en ${pickup}` : order.address ? `Envío a ${order.address.street} ${order.address.number}${order.address.apartment ? ` ${order.address.apartment}` : ""}, ${order.address.city} (${order.address.postalCode})` : "Envío a domicilio";
  const details: Detail[] = [["Pedido", code], ["Total", formatArs(order.totalArs)], ["Pago", method], ["Entrega", delivery]];
  const view = link ? { label: "Ver mi pedido", url: link } : null;
  const cashPickup = order.paymentMethod === "cash";
  const digital = order.paymentMethod === "mercadopago";
  const blocks: Record<OrderEmailEvent, () => EmailBlock> = {
    created: () => ({
      subject: `Recibimos tu pedido ${code}`, preheader: cashPickup ? "Te avisamos cuando esté listo para retirar." : "Si todavía no pagaste, podés hacerlo desde el link.",
      heading: "Recibimos tu pedido", details, lines: input.lines, action: view,
      paragraphs: [hello, cashPickup ? "Guardamos tu pedido. Lo preparamos y te avisamos por email cuando esté listo: lo pagás en efectivo al retirarlo." : digital ? "Guardamos tu pedido. Todavía no tiene un pago aprobado: si no terminaste de pagar, podés hacerlo desde el botón. Te escribimos apenas se acredite." : "Guardamos tu pedido. Lo confirmamos cuando verifiquemos el pago."],
      footnote: "Si no hiciste este pedido, ignorá este email.",
    }),
    approved: () => ({
      subject: `Pago aprobado · pedido ${code}`, preheader: "Ya estamos preparando tu pedido.", heading: "¡Gracias por tu compra!", details, lines: input.lines, action: view,
      paragraphs: [hello, cashPickup ? "Registramos el pago de tu pedido." : "Tu pago fue aprobado y ya estamos preparando tu pedido.", order.delivery === "pickup" ? "Esperá nuestro aviso de «listo para retirar» antes de acercarte al local." : "Te avisamos por email cuando lo despachemos, con el seguimiento si corresponde."],
    }),
    payment_rejected: () => ({
      subject: `No se pudo completar el pago · pedido ${code}`, preheader: "Tu pedido sigue reservado: podés reintentar.", heading: "Tu pago fue rechazado", details, action: link ? { label: "Reintentar el pago", url: link } : null,
      paragraphs: [hello, "El medio de pago rechazó la operación y no se cobró nada. Tu pedido sigue reservado por un tiempo: podés reintentar con otra tarjeta o medio desde el botón.", "Si el rechazo se repite, consultá con tu banco o escribinos por WhatsApp."],
    }),
    rejected: () => ({
      subject: `Pago rechazado · pedido ${code}`, preheader: "No se cobró nada.", heading: "Tu pago fue rechazado", details, action: view,
      paragraphs: [hello, "El medio de pago rechazó la operación y no se cobró nada. Para comprar, hacé un pedido nuevo desde la tienda."],
    }),
    cancelled: () => ({
      subject: `Pedido ${code} cancelado`, preheader: "Liberamos los productos reservados.", heading: "Cancelamos tu pedido", details, action: view,
      paragraphs: [hello, "Tu pedido quedó cancelado y liberamos los productos reservados. Si ya habías pagado, escribinos y lo resolvemos."],
    }),
    expired: () => ({
      subject: `Tu pedido ${code} venció`, preheader: "No registramos el pago dentro del plazo.", heading: "Tu pedido venció", details,
      paragraphs: [hello, "No registramos el pago dentro del plazo, así que el pedido venció y liberamos los productos. No se cobró nada.", "Si todavía lo querés, podés hacer un pedido nuevo desde la tienda."],
      action: input.siteUrl ? { label: "Ir a la tienda", url: `${input.siteUrl}/productos` } : null,
    }),
    refunded: () => ({
      subject: `Reembolso registrado · pedido ${code}`, preheader: "El reintegro depende de tu medio de pago.", heading: "Registramos tu reembolso", details, action: view,
      paragraphs: [hello, "Registramos la devolución del pago de tu pedido. El dinero vuelve por el mismo medio: según el banco o la tarjeta puede demorar algunos días hábiles o verse en el próximo resumen."],
    }),
    ready_for_pickup: () => ({
      subject: `Tu pedido ${code} está listo para retirar`, preheader: `Retiralo en ${pickup}.`, heading: "Tu pedido está listo", details, action: view,
      paragraphs: [hello, `Podés retirarlo en ${pickup}.`, ...(order.status === "pending" && cashPickup ? ["Lo pagás en efectivo al retirarlo."] : []), "Llevá el número de pedido."],
    }),
    shipped: () => ({
      subject: `Despachamos tu pedido ${code}`, preheader: shipment?.trackingCode ? `Seguimiento: ${shipment.trackingCode}` : "Ya está en camino.", heading: "Tu pedido está en camino", action: view,
      details: [...details, ...(shipment?.label ? [["Envío", shipment.label] as Detail] : []), ...(shipment?.trackingCode ? [["Seguimiento", shipment.trackingCode] as Detail] : [])],
      paragraphs: [hello, shipment?.trackingCode ? "Despachamos tu pedido. Podés seguirlo con el código de abajo." : "Despachamos tu pedido. Te avisamos si tenemos un código de seguimiento."],
    }),
    invoice_issued: () => {
      const invoice = input.invoice;
      const pdf = invoice?.pdfUrl ? safeUrl(invoice.pdfUrl) : null;
      return {
        subject: `Tu factura · pedido ${code}`, preheader: "Comprobante electrónico de tu compra.", heading: "Tu factura", action: pdf ? { label: "Descargar factura", url: pdf } : view,
        details: [["Pedido", code], ["Comprobante", invoice ? invoiceNumberLabel(invoice) : "Factura"], ...(invoice?.cae ? [["CAE", invoice.cae] as Detail] : []), ...(invoice?.caeDueDate ? [["Vencimiento del CAE", invoice.caeDueDate.split("-").reverse().join("/")] as Detail] : []), ["Total", formatArs(order.totalArs)]],
        paragraphs: [hello, pdf ? "Te enviamos la factura electrónica de tu compra. También la adjuntamos a este email." : "Emitimos la factura electrónica de tu compra. Si necesitás el PDF, respondé este email y te lo mandamos."],
      };
    },
  };
  return renderEmail(blocks[event](), input.siteUrl);
}

export type AuthEmailKind = "reset-password" | "verify-email";
export function authEmailTemplate(kind: AuthEmailKind, name: string | null | undefined, url: string, siteUrl: string | null): EmailContent {
  const hello = name && firstName(name) ? `Hola, ${firstName(name)}.` : "Hola.";
  return renderEmail(kind === "reset-password" ? {
    subject: "Restablecé tu contraseña de QuilGym", preheader: "El enlace vence en 1 hora.", heading: "Restablecé tu contraseña",
    paragraphs: [hello, "Recibimos un pedido para restablecer la contraseña de tu cuenta QuilGym. Elegí una nueva desde el botón: el enlace vence en 1 hora y se puede usar una sola vez."],
    action: { label: "Elegir una contraseña nueva", url }, footnote: "Si no lo pediste, ignorá este email: tu contraseña no cambia.",
  } : {
    subject: "Confirmá tu email en QuilGym", preheader: "El enlace vence en 1 hora.", heading: "Confirmá tu email",
    paragraphs: [hello, "Gracias por crear tu cuenta en QuilGym. Confirmá tu email desde el botón (el enlace vence en 1 hora)."],
    action: { label: "Confirmar email", url }, footnote: "Si no creaste la cuenta, ignorá este email.",
  }, siteUrl);
}
