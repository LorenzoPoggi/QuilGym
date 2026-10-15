import { test, expect } from "@playwright/test";

// Solo lectura. Las cuotas vienen de la API de Mercado Pago; si no responde, la UI no muestra nada y estos casos se omiten.
test("ficha: cuotas con CFT, tarjetas aceptadas y tabla «Ver cuotas» sin desbordar", async ({ page }) => {
  await page.goto("/productos/proteina-star-2lb");
  const box = page.locator(".installments-box").first();
  test.skip(await box.count() === 0, "Mercado Pago no devolvió cuotas");
  await expect(box.locator(".installments-box__headline")).toContainText(/cuotas/);
  await expect(box).toContainText("CFT");
  await expect(box.locator(".accepted-cards img").first()).toHaveAttribute("alt", /\S/);
  await box.locator("summary").click();
  await expect(box.getByRole("table")).toBeVisible();
  await box.getByRole("button", { name: "Mastercard" }).click();
  await expect(box.getByRole("button", { name: "Mastercard" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("catálogo: las tarjetas no anuncian cuotas con interés (solo sin interés)", async ({ page }) => {
  await page.goto("/productos");
  await expect(page.locator(".product-card").first()).toBeVisible();
  // Con cuotas con interés la línea de las tarjetas no se muestra; el CFT queda en la ficha.
  // Si el negocio activa cuotas sin interés, la única línea permitida es la destacada.
  const lines = page.locator(".product-card .installments-line");
  expect(await lines.count()).toBe(await page.locator(".product-card .installments-line--free").count());
});
