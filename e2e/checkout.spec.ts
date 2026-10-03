import { test, expect, type Page } from "@playwright/test";

async function checkout(page: Page) {
  await page.goto("/productos");
  await page.getByRole("button", { name: /^Agregar .* al carrito$/ }).first().click();
  await page.getByRole("link", { name: /Iniciar compra/ }).click();
  await expect(page.getByText("Modo de prueba local", { exact: true })).toBeVisible();
  await page.getByLabel("Nombre y apellido").fill("Cliente QA QuilGym");
  await page.getByLabel("Email", { exact: true }).fill("quilgym-qa@example.com");
  await page.getByLabel("Teléfono").fill("1144444444");
}

test("retiro: pedido persistente, aprobación/reembolso y privacidad", async ({ page, browser }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await checkout(page);
  await expect(page.getByLabel("Calle", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmar retiro y total" }).click();
  await page.getByRole("checkbox", { name: /Confirmo que los datos/ }).check();
  const submit = page.getByRole("button", { name: "Crear pedido de prueba" });
  await expect(submit).toBeEnabled();
  await page.screenshot({ path: info.outputPath("checkout.png"), fullPage: true });
  await submit.click();
  await expect(page).toHaveURL(/\/checkout\/confirmacion\/[a-f0-9-]+$/, { timeout: 60000 });
  await expect(page.getByRole("heading", { name: "Recibimos tu pedido" })).toBeVisible();
  const orderUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Recibimos tu pedido" })).toBeVisible();
  await page.getByRole("button", { name: "Simular pago aprobado" }).click();
  await expect(page.getByRole("heading", { name: "¡Tu pago está aprobado!" })).toBeVisible({ timeout: 30000 });
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

test("envío y transferencia: cotización, efectivo bloqueado y rechazo", async ({ page }) => {
  await checkout(page);
  await page.getByRole("radio", { name: /Envío a domicilio/ }).check();
  await expect(page.getByRole("radio", { name: /Efectivo al retirar/ })).toBeDisabled();
  await page.getByLabel("Calle", { exact: true }).fill("Calle de prueba");
  await page.getByLabel("Número", { exact: true }).fill("123");
  await page.getByRole("textbox", { name: "Código postal", exact: true }).fill("1878");
  await page.getByLabel("Localidad").fill("Quilmes");
  await page.getByLabel("Provincia").fill("Buenos Aires");
  await page.getByRole("radio", { name: /Transferencia bancaria/ }).check();
  await page.getByRole("button", { name: "Calcular envío" }).click();
  await expect(page.getByText("Envío simulado · $4.200", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /Confirmo que los datos/ }).check();
  await page.getByRole("button", { name: "Crear pedido de prueba" }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmacion\/[a-f0-9-]+$/, { timeout: 60000 });
  await expect(page.getByText(/Datos bancarios pendientes de configuración/)).toBeVisible();
  await page.getByRole("button", { name: "Simular rechazo" }).click();
  await expect(page.getByRole("heading", { name: "Tu pago fue rechazado" })).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("efectivo solo en retiro: cancelación persistente", async ({ page }) => {
  await checkout(page);
  await page.getByRole("radio", { name: /Efectivo al retirar/ }).check();
  await page.getByRole("button", { name: "Confirmar retiro y total" }).click();
  await page.getByRole("checkbox", { name: /Confirmo que los datos/ }).check();
  await page.getByRole("button", { name: "Crear pedido de prueba" }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmacion\/[a-f0-9-]+$/, { timeout: 60000 });
  await page.getByRole("button", { name: "Simular cancelación" }).click();
  await expect(page.getByRole("heading", { name: "Tu pedido está cancelado" })).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tu pedido está cancelado" })).toBeVisible();
});
