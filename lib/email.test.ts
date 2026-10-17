import { describe, expect, it, vi } from "vitest";
import { parseSender, readEmailConfig, resendPayload, sendWithResend } from "./email-config";
import { authEmailTemplate, orderEmailContent, type OrderEmailOrder } from "./email-templates";
import { authEmailConfigured } from "./auth-email";

const env = { RESEND_API_KEY: "re_123", EMAIL_FROM: "QuilGym <Pedidos@QuilGym.com.ar>", EMAIL_REPLY_TO: "quilgym@gmail.com" };
const order: OrderEmailOrder = { id: "1a2b3c4d-0000-4000-8000-000000000000", name: "Ana <b>Pérez</b>", status: "pending", paymentMethod: "mercadopago", paymentChoice: "credit_card",
  delivery: "pickup", totalArs: 12345, pickupDetails: { address: "San Martín 492", hours: "Lunes a viernes" }, address: null };

describe("configuración de Resend", () => {
  it("acepta remitente con nombre de un dominio propio y Reply-To que alguien lea", () => {
    expect(parseSender("QuilGym <Pedidos@QuilGym.com.ar>")).toMatchObject({ name: "QuilGym", address: "pedidos@quilgym.com.ar", domain: "quilgym.com.ar" });
    const config = readEmailConfig(env);
    expect(config).toMatchObject({ enabled: true, from: "QuilGym <pedidos@quilgym.com.ar>", replyTo: "quilgym@gmail.com", issues: [] });
    expect(authEmailConfigured(env)).toBe(true);
  });

  it("no habilita Gmail como remitente, avisa resend.dev y nunca expone la clave", () => {
    const gmail = readEmailConfig({ RESEND_API_KEY: "re_secreto", EMAIL_FROM: "quilgym@gmail.com" });
    expect(gmail.enabled).toBe(false);
    expect(gmail.issues.join(" ")).toContain("gmail.com");
    expect(readEmailConfig({ RESEND_API_KEY: "re_x", EMAIL_FROM: "QuilGym <onboarding@resend.dev>" }).warnings.join(" ")).toContain("resend.dev");
    expect(JSON.stringify(gmail)).not.toContain("re_secreto");
    expect(readEmailConfig({}).enabled).toBe(false);
    expect(readEmailConfig({ ...env, EMAIL_REPLY_TO: "no-es-email" }).issues).toHaveLength(1);
  });

  it("arma el cuerpo de Resend con Reply-To, texto plano y categoría sin datos personales", () => {
    const payload = resendPayload(readEmailConfig(env), { to: "cliente@example.com", subject: "S", html: "<p>h</p>", text: "t", tag: "order_created" });
    expect(payload).toEqual({ from: "QuilGym <pedidos@quilgym.com.ar>", to: ["cliente@example.com"], subject: "S", html: "<p>h</p>", text: "t", reply_to: "quilgym@gmail.com", tags: [{ name: "category", value: "order_created" }] });
  });

  it("envía con Idempotency-Key y devuelve solo el status ante un error", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 422 }));
    const result = await sendWithResend(env, { to: "c@example.com", subject: "S", html: "h", text: "t", tag: "x" }, "order-email-9", fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, reason: "http_422" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("order-email-9");
    expect(await sendWithResend({}, { to: "c@example.com", subject: "S", html: "h", text: "t", tag: "x" }, "k", fetchImpl as unknown as typeof fetch)).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("plantillas de emails", () => {
  it("escapa lo que escribe el cliente y siempre incluye versión de texto plano", () => {
    const email = orderEmailContent("created", { order, link: "https://quilgym.test/checkout/confirmacion/1?t=x", siteUrl: "https://quilgym.test", lines: [{ name: "Creatina <script>", quantity: 2, totalArs: 1000 }] });
    expect(email.subject).toBe("Recibimos tu pedido QG-1A2B3C4D");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("Creatina &lt;script&gt;");
    expect(email.text).toContain("Hola, Ana.");
    expect(email.text).toContain("- 2 × Creatina <script>: ");
    expect(email.text).toContain("Ver mi pedido: https://quilgym.test/checkout/confirmacion/1?t=x");
    expect(email.text).toContain("Botón de arrepentimiento: https://quilgym.test/arrepentimiento");
  });

  it("rechazo con reintento, vencimiento y factura tienen su propio texto", () => {
    expect(orderEmailContent("payment_rejected", { order, link: "https://quilgym.test/p", siteUrl: null }).text).toContain("Reintentar el pago: https://quilgym.test/p");
    expect(orderEmailContent("expired", { order, link: null, siteUrl: "https://quilgym.test" }).subject).toContain("venció");
    const invoice = orderEmailContent("invoice_issued", { order: { ...order, status: "approved" }, link: null, siteUrl: null,
      invoice: { voucherType: "C", pointOfSale: 3, number: 125, cae: "12345678901234", caeDueDate: "2026-10-20", pdfUrl: "https://facturas.test/f.pdf" } });
    expect(invoice.text).toContain("Comprobante: Factura C 00003-00000125");
    expect(invoice.text).toContain("Vencimiento del CAE: 20/10/2026");
    expect(invoice.text).toContain("Descargar factura: https://facturas.test/f.pdf");
  });

  it("descarta enlaces que no son https en el botón", () => {
    const email = authEmailTemplate("reset-password", "Ana", "javascript:alert(1)", null);
    expect(email.html).not.toContain("javascript:");
    expect(authEmailTemplate("verify-email", null, "https://quilgym.test/v?token=1", null).text).toContain("Confirmar email: https://quilgym.test/v?token=1");
  });
});

describe("emails de entrega (Fase 6)", () => {
  const link = "https://quilgym.test/checkout/confirmacion/1?t=x";
  const trackingLink = "https://quilgym.test/pedido/1?t=x";
  const local: OrderEmailOrder = { ...order, status: "approved", delivery: "local", pickupDetails: null,
    address: { street: "Rivadavia", number: "500", apartment: "", postalCode: "1878", city: "Quilmes", province: "Buenos Aires" } };
  const from = new Date("2026-10-17T15:00:00-03:00");

  it("entrega propia recién despachada: «en las próximas X horas» y botón de seguimiento", () => {
    const email = orderEmailContent("out_for_delivery", { order: local, link, trackingLink, siteUrl: null, now: new Date(from.getTime() + 60_000),
      tracking: { carrier: "own", etaFrom: from, etaTo: new Date(from.getTime() + 5 * 3_600_000) } });
    expect(email.subject).toBe("Tu pedido llega en las próximas 5 horas · pedido QG-1A2B3C4D");
    expect(email.text).toContain(`Seguir mi pedido: ${trackingLink}`);
    expect(email.text).toContain("El costo de la entrega se arregla con QuilGym al llevar tu pedido");
  });

  it("si el aviso sale más tarde, muestra la ventana exacta en hora argentina", () => {
    const email = orderEmailContent("out_for_delivery", { order: local, link, trackingLink, siteUrl: null, now: new Date("2026-10-17T17:30:00-03:00"),
      tracking: { carrier: "own", etaFrom: from, etaTo: new Date("2026-10-17T20:00:00-03:00") } });
    expect(email.subject).toContain("Tu pedido llega hoy entre las 15:00 y las 20:00");
  });

  it("Correo Argentino: «En distribución» con fecha estimada si existe", () => {
    const shipping = { ...local, delivery: "shipping" };
    const withDate = orderEmailContent("out_for_delivery", { order: shipping, link, trackingLink, siteUrl: null, shipment: { label: "Correo Argentino a domicilio", trackingCode: "CP123" },
      tracking: { carrier: "correo_argentino", etaFrom: null, etaTo: new Date("2026-10-20T12:00:00-03:00") } });
    expect(withDate.subject).toBe("Tu pedido QG-1A2B3C4D está en distribución");
    expect(withDate.text).toContain("En distribución");
    expect(withDate.text).toContain("Fecha estimada de entrega: martes, 20 de octubre.");
    expect(withDate.text).toContain("Seguimiento: CP123");
    expect(orderEmailContent("out_for_delivery", { order: shipping, link, siteUrl: null }).text).not.toContain("Fecha estimada");
  });

  it("entregado: título, link a la compra y seguimiento como enlace secundario", () => {
    const email = orderEmailContent("delivered", { order: local, link, trackingLink, siteUrl: null });
    expect(email.subject).toBe("¡Tu pedido QG-1A2B3C4D fue entregado!");
    expect(email.text).toContain("¡Tu pedido fue entregado!");
    expect(email.text).toContain(`Ver mi pedido: ${link}`);
    expect(email.text).toContain(`Seguir mi pedido: ${trackingLink}`);
  });

  it("todos los emails de pedido muestran el número y el seguimiento", () => {
    const events = ["created", "approved", "payment_rejected", "rejected", "cancelled", "expired", "refunded", "ready_for_pickup", "shipped", "out_for_delivery", "delivered", "invoice_issued"] as const;
    for (const event of events) {
      const email = orderEmailContent(event, { order: local, link, trackingLink, siteUrl: "https://quilgym.test" });
      expect(email.text, event).toContain("Pedido: QG-1A2B3C4D");
      expect(email.text, event).toContain(`Seguir mi pedido: ${trackingLink}`);
      expect(email.html, event).toContain(trackingLink);
    }
  });
});
