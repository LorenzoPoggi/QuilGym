import { test, expect, type Page } from "@playwright/test";
import { databaseWritesEnabled, databaseWriteSkipReason } from "./database-safety";

async function checkout(page: Page) {
  await page.goto("/productos");
  await page.getByRole("button", { name: /^Agregar .* al carrito$/ }).first().click();
  await page.getByRole("link", { name: /Iniciar compra/ }).click();
  // El checkout puede estar online o en modo WhatsApp según el entorno: los dos empiezan por los datos de contacto.
  await expect(page.getByLabel("Nombre y apellido")).toBeVisible();
  await page.getByLabel("Nombre y apellido").fill("Cliente QA QuilGym");
  await page.getByLabel("Email", { exact: true }).fill("quilgym-qa@example.com");
  await page.getByLabel("Teléfono").fill("1144444444");
  await page.getByRole("button", { name: "Seguir con entrega" }).click();
  await expect(page.getByRole("heading", { name: "¿Te lo enviamos o retirás?" })).toBeVisible();
}

test("checkout: mapa móvil libre y validación del consentimiento accesible", async ({ page }) => {
  // Agregar al carrito escribe en la base: solo con una base aislada (ver e2e/database-safety.ts).
  test.skip(!databaseWritesEnabled, databaseWriteSkipReason);
  await checkout(page);
  await page.getByRole("radio", { name: /Retiro en Quilmes/ }).check();
  const map = page.locator(".checkout-pickup-map");
  const details = page.locator(".checkout-pickup-map__details");
  const iframe = page.locator(".checkout-pickup-map__frame iframe");
  await expect(map).toBeVisible();
  await expect(iframe).toBeVisible();
  expect(await iframe.evaluate((element) => getComputedStyle(element).pointerEvents)).not.toBe("none");
  if ((page.viewportSize()?.width ?? 1440) <= 768) {
    await expect(details).toBeHidden();
    const positions = await iframe.evaluate((element) => {
      const frame = element.getBoundingClientRect();
      const link = element.parentElement?.querySelector(".checkout-pickup-map__link")?.getBoundingClientRect();
      return { frameBottom: frame.bottom, linkTop: link?.top ?? 0 };
    });
    expect(positions.linkTop).toBeGreaterThanOrEqual(positions.frameBottom);
  } else await expect(details).toBeVisible();

  await page.getByRole("button", { name: "Seguir con pago" }).click();
  // La cotización se resuelve en el servidor; dale tiempo sin asumir que será instantánea.
  await expect(page.getByRole("heading", { name: "Elegí cómo pagar" })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: /^(Ir a pagar|Continuar por WhatsApp)/ }).click();
  const consent = page.getByRole("checkbox", { name: /Confirmo que los datos|Revisé mis datos/ });
  const consentError = page.locator("#error-accepted");
  await expect(consentError).toHaveText("Confirmá los datos de tu pedido para continuar.");
  await expect(consent).toHaveAttribute("aria-invalid", "true");
  await expect(consent).toHaveAttribute("aria-describedby", "error-accepted");
  await expect(consent).toBeFocused();
});

test("retiro: pago digital simulado, preparación, reembolso y privacidad", async ({ page, browser }, info) => {
  test.skip(!databaseWritesEnabled, databaseWriteSkipReason);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await checkout(page);
  await expect(page.getByLabel("Calle", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Seguir con pago" }).click();
  await expect(page.getByRole("heading", { name: "Elegí cómo pagar" })).toBeVisible();
  await page.getByRole("checkbox", { name: /Confirmo que los datos/ }).check();
  const submit = page.getByRole("button", { name: /^Ir a pagar/ });
  await expect(submit).toBeEnabled();
  await page.screenshot({ path: info.outputPath("checkout.png"), fullPage: true });
  await submit.click();
  await expect(page).toHaveURL(/\/checkout\/confirmacion\/[a-f0-9-]+(?:\?.*)?$/, { timeout: 60000 });
  await expect(page.getByRole("heading", { name: "¡Gracias por tu compra!" })).toBeVisible();
  await expect(page.getByText("NÚMERO DE COMPRA")).toBeVisible();
  await expect(page.locator(".order-steps li").nth(0)).toHaveClass(/is-done/);
  await expect(page.locator(".order-steps li").nth(1)).toHaveClass(/is-done/);
  await expect(page.locator(".order-steps li").nth(2)).toHaveClass(/is-current/);
  const orderUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: "¡Gracias por tu compra!" })).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: info.outputPath("confirmation.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Simular reembolso" }).click();
  await expect(page.getByRole("heading", { name: "Tu pago fue reembolsado" })).toBeVisible({ timeout: 30000 });
  const other = await browser.newContext();
  const unauthorized = await other.newPage();
  const response = await unauthorized.goto(orderUrl);
  expect(response?.status()).toBe(404);
  await expect(unauthorized.getByText("Cliente QA QuilGym", { exact: true })).toHaveCount(0);
  await other.close();
  expect(errors).toEqual([]);
});

test("envío y tarjeta: cotización, efectivo bloqueado y pago simulado", async ({ page }) => {
  test.skip(!databaseWritesEnabled, databaseWriteSkipReason);
  await checkout(page);
  await page.getByRole("radio", { name: /Envío a domicilio/ }).check();
  await page.getByLabel("Calle", { exact: true }).fill("Calle de prueba");
  await page.getByLabel("Número", { exact: true }).fill("123");
  await page.getByRole("textbox", { name: "Código postal", exact: true }).fill("1878");
  await page.getByLabel("Localidad").fill("Quilmes");
  await page.getByLabel("Provincia").fill("Buenos Aires");
  await page.getByRole("button", { name: "Calcular envío" }).click();
  await expect(page.getByText("Envío simulado · $4.200", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Seguir con pago" }).click();
  await expect(page.getByRole("radio", { name: "Efectivo" })).toBeDisabled();
  await page.getByRole("radio", { name: "Tarjeta de débito" }).check();
  await expect(page.getByText(/En la simulación no se piden datos de tarjeta/)).toBeVisible();
  await page.getByRole("checkbox", { name: /Confirmo que los datos/ }).check();
  await page.getByRole("button", { name: /^Ir a pagar/ }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmacion\/[a-f0-9-]+(?:\?.*)?$/, { timeout: 60000 });
  await expect(page.getByRole("heading", { name: "¡Gracias por tu compra!" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".order-steps li").nth(2)).toHaveClass(/is-current/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("efectivo solo en retiro: cancelación persistente", async ({ page }) => {
  test.skip(!databaseWritesEnabled, databaseWriteSkipReason);
  await checkout(page);
  await page.getByRole("button", { name: "Seguir con pago" }).click();
  await page.getByRole("radio", { name: "Efectivo" }).check();
  await page.getByRole("checkbox", { name: /Confirmo que los datos/ }).check();
  await page.getByRole("button", { name: /^Preparar pedido/ }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmacion\/[a-f0-9-]+(?:\?.*)?$/, { timeout: 60000 });
  await expect(page.getByRole("heading", { name: "Recibimos tu pedido" })).toBeVisible();
  const cashSteps = page.locator(".order-steps li");
  await expect(cashSteps).toHaveCount(3);
  await expect(cashSteps.nth(0)).toContainText("Pedido recibido");
  await expect(cashSteps.nth(0)).toHaveClass(/is-done/);
  await expect(cashSteps.nth(1)).toContainText("Preparación");
  await expect(cashSteps.nth(1)).toHaveClass(/is-current/);
  await expect(cashSteps.nth(2)).toContainText("Pago y Retiro en el local");
  await expect(cashSteps.nth(2)).toHaveClass(/is-todo/);
  await page.getByRole("button", { name: "Simular cancelación" }).click();
  await expect(page.getByRole("heading", { name: "Tu pedido está cancelado" })).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tu pedido está cancelado" })).toBeVisible();
});

test("modo WhatsApp: completa las tres etapas y prepara el mensaje sin crear un pedido", async ({ page }) => {
  await page.goto("/productos");
  await page.getByRole("button", { name: /^Agregar .* al carrito$/ }).first().click();
  await page.getByRole("link", { name: /Iniciar compra/ }).click();
  const whatsappMode = page.getByText("Confirmación por WhatsApp");
  if (!await whatsappMode.isVisible().catch(() => false)) test.skip(true, "El checkout online de prueba está habilitado en este entorno.");
  await page.getByLabel("Nombre y apellido").fill("Cliente QA WhatsApp");
  await page.getByLabel("Email", { exact: true }).fill("whatsapp-qa@example.com");
  await page.getByLabel("Teléfono").fill("1144444444");
  await page.getByRole("button", { name: "Seguir con entrega" }).click();
  await page.getByRole("radio", { name: /Retiro en Quilmes/ }).check();
  await page.getByRole("button", { name: "Seguir con pago" }).click();
  await page.getByRole("radio", { name: "Efectivo" }).check();
  await page.getByRole("checkbox", { name: /Revisé mis datos/ }).check();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: /Continuar por WhatsApp/ }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/^https:\/\/(?:wa\.me|api\.whatsapp\.com)\//);
  const message = new URL(popup.url()).searchParams.get("text") ?? "";
  expect(message).toContain("Nombre: Cliente QA WhatsApp");
  expect(message).toContain("Entrega: Retiro en Quilmes");
  expect(message).toContain("Preferencia de pago: Efectivo");
  await popup.close();
});
