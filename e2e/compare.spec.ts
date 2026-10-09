import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Solo lectura: navega el comparador como invitado; no agrega al carrito ni escribe en la base.
const fitsViewport = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const cards = (page: Page) => page.locator(".compare-products > .product-card");
const slugsInUrl = (page: Page) => new URL(page.url()).searchParams.get("p")?.split(",").filter(Boolean) ?? [];
const selection = "/comparar?p=creatina-gold-300-gr,no-existe,creatina-gold-300-gr,proteina-star-2lb";

test("sin parámetros muestra el ejemplo de creatinas, indexable", async ({ page }) => {
  await page.goto("/comparar");
  await expect(cards(page)).toHaveCount(3);
  await expect(page.getByText("Ejemplo:", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ya elegiste 3 productos" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/comparar$/);
  expect(await fitsViewport(page)).toBe(true);
});

test("la selección de la URL se valida en el servidor y no se indexa", async ({ page }, info) => {
  await page.goto(selection);
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).nth(0).getByRole("heading")).toHaveText("Creatina GOLD 300 g");
  await expect(cards(page).nth(1).getByRole("heading")).toHaveText("Proteína STAR 2 lb");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/comparar$/);
  // Peso del nombre: 300 g y 2 lb (907 g); sin rating ni datos inventados.
  const table = page.getByRole("table", { name: "Comparación de atributos" });
  await expect(table.getByRole("cell", { name: "2 lb (907 g)" })).toHaveCount(1);
  await expect(table.getByText(/rating|reseña/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Agregá productos" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Categorías para comparar" }).getByRole("link", { name: /Creatinas/ })).toHaveAttribute("aria-current", "true");
  await page.screenshot({ path: info.outputPath("compare-selection.png"), fullPage: true });
  expect(await fitsViewport(page)).toBe(true);
});

test("agregar, cambiar y quitar productos con enlaces", async ({ page }) => {
  await page.goto("/comparar?p=creatina-gold-300-gr&categoria=creatinas");
  await expect(cards(page)).toHaveCount(1);
  const add = page.getByRole("link", { name: /^Agregar .+ a la comparación$/ }).first();
  await add.click();
  await expect.poll(() => slugsInUrl(page).length).toBe(2);
  await expect(cards(page)).toHaveCount(2);

  const [kept, swapped] = slugsInUrl(page);
  await page.getByRole("link", { name: /^Cambiar / }).nth(1).click();
  await expect(page).toHaveURL(new RegExp(`cambiar=${swapped}`));
  await expect(page.getByRole("heading", { name: /^Elegí qué comparar en lugar de / })).toBeVisible();
  await page.getByRole("link", { name: /^Reemplazar .+ por / }).first().click();
  await expect.poll(() => slugsInUrl(page)).not.toContain(swapped);
  expect(slugsInUrl(page)[0]).toBe(kept);
  await expect(cards(page)).toHaveCount(2);

  const remaining = slugsInUrl(page)[1];
  await page.getByRole("link", { name: /^Quitar .+ de la comparación$/ }).first().click();
  await expect.poll(() => slugsInUrl(page)).toEqual([remaining]);
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole("link", { name: /^Quitar .+ de la comparación$/ }).click();
  await expect(page.getByRole("heading", { name: "Todavía no elegiste productos" })).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
});

test("buscar en el selector filtra sin perder la selección", async ({ page }) => {
  await page.goto("/comparar?p=creatina-gold-300-gr&categoria=todas");
  await page.getByLabel("Buscar por nombre o marca").fill("mutant");
  await expect(page).toHaveURL(/q=mutant/);
  const results = page.locator(".compare-picker__results > li");
  await expect(results.first()).toContainText("Mutant Mass");
  for (const text of await results.allTextContents()) expect(text).toMatch(/Mutant/i);
  expect(slugsInUrl(page)).toEqual(["creatina-gold-300-gr"]);
});

test("axe WCAG 2.1 A/AA en el comparador con selección", async ({ page }) => {
  await page.route("**/api/reviews", (request) => request.fulfill({ json: { reviews: [] } }));
  for (const url of [selection, "/comparar?p=creatina-gold-300-gr,proteina-star-2lb&cambiar=proteina-star-2lb#elegir-productos", "/comparar?p="]) {
    await page.goto(url);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(violations, `${url}\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
  }
});
