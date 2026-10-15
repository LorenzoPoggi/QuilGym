import { test, expect } from "@playwright/test";

test("búsqueda predictiva: catálogo, estado inicial y footer sin etiquetas de depuración", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/buscar");
  await expect(page.getByRole("heading", { name: "Empezá a buscar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CATEGORÍAS" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SUGERENCIAS" })).toBeVisible();
  await expect(page.getByText(/^(INICIAL|VACÍO|RESULTADOS)$/)).toHaveCount(0);
  await expect(page.locator("#footer")).toBeVisible();

  const input = page.getByRole("searchbox", { name: "Buscar" });
  await input.fill("creatina");
  await expect(page.getByRole("heading", { name: "Resultados para “creatina”" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PRODUCTOS" })).toBeVisible();
  await expect(page.locator(".search-product").first()).toBeVisible();
  await expect(page.locator(".search-product")).toHaveCount(4);
  await expect(page.locator(".search-product").first().locator("small")).toContainText("En stock");
  await expect(page.locator(".search-panel")).not.toContainText("RESULTADOS");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("search-results.png"), fullPage: true });
});
