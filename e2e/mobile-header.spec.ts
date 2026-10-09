import { test, expect } from "@playwright/test";
import { databaseWritesEnabled, databaseWriteSkipReason } from "./database-safety";

test("newsletter en mobile: el botón queda dentro del form y no tapa la nota", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Solo aplica al ancho de 390");
  await page.goto("/");
  const form = page.locator(".newsletter form");
  await form.scrollIntoViewIfNeeded();
  const button = form.getByRole("button", { name: "Próximamente" });
  await expect(button).toBeDisabled();
  const [box, inner, note] = await Promise.all([form.boundingBox(), button.boundingBox(), page.locator("#newsletter-note").boundingBox()]);
  expect(inner!.x).toBeGreaterThanOrEqual(box!.x);
  expect(inner!.y).toBeGreaterThanOrEqual(box!.y);
  expect(inner!.x + inner!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
  expect(inner!.y + inner!.height).toBeLessThanOrEqual(box!.y + box!.height + 0.5);
  expect(inner!.y + inner!.height).toBeLessThanOrEqual(note!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("menú de cuenta en mobile: a la derecha, dentro de la pantalla y se cierra afuera", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Solo aplica al ancho de 390");
  test.skip(!databaseWritesEnabled, databaseWriteSkipReason);
  const email = `quilgym-qa-menu-${Date.now()}@example.com`;
  const password = "QuilGym-QA-only-2026";
  await page.goto("/cuenta/registro");
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente QA");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetí la contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).toHaveURL("/", { timeout: 60000 });
  for (const path of ["/", "/buscar"]) {
    await page.goto(path);
    const trigger = page.getByRole("button", { name: "Hola Cliente: menú de tu cuenta" });
    await expect(trigger).toBeVisible();
    const [avatar, cart, wordmark] = await Promise.all([trigger.boundingBox(), page.locator(".cart-pill").boundingBox(), page.locator(".site-header .wordmark").boundingBox()]);
    // El avatar va junto al carrito, del lado derecho, y no pegado al logo.
    expect(avatar!.x).toBeGreaterThan(195);
    expect(cart!.x - (avatar!.x + avatar!.width)).toBeLessThan(40);
    expect(avatar!.x - (wordmark!.x + wordmark!.width)).toBeGreaterThan(60);
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("#account-menu-panel");
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y).toBeGreaterThanOrEqual(avatar!.y + avatar!.height);
    await expect(panel.getByRole("link", { name: "Ver perfil" })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`account-menu${path.replace("/", "-")}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.mouse.click(8, 780);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
  }
});
