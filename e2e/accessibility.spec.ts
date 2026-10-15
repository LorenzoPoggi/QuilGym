import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  ["inicio", "/"],
  ["catálogo", "/productos"],
  ["catálogo filtrado", "/productos?categoria=proteinas"],
  ["ficha de producto", "/productos/proteina-body-advance-1kg"],
  ["ficha de combo", "/productos/combo-classic"],
  ["búsqueda", "/buscar"],
  ["búsqueda con resultados", "/buscar?q=creatina"],
  ["búsqueda sin resultados", "/buscar?q=zzzzqqq"],
  ["comparador", "/comparar"],
  ["comparador con selección", "/comparar?p=proteina-body-advance-1kg,proteina-star-2lb"],
  ["carrito vacío", "/carrito"],
  ["ingreso", "/cuenta/ingresar"],
  ["registro", "/cuenta/registro"],
  ["recuperar contraseña", "/cuenta/recuperar"],
  ["asesor", "/asesor"],
  ["términos", "/legales/terminos"],
  ["privacidad", "/legales/privacidad"],
  ["cambios y devoluciones", "/legales/cambios-y-devoluciones"],
  ["botón de arrepentimiento", "/arrepentimiento"],
  ["404", "/esta-pagina-no-existe"],
] as const;

test.beforeEach(async ({ page }) => {
  // La ruta real de reseñas consume el rate limit compartido en Postgres;
  // el análisis de accesibilidad no necesita contactar ese servicio.
  await page.route("**/api/reviews", (request) => request.fulfill({ json: { reviews: [] } }));
});

for (const [name, route] of routes) {
  test(`${name}: axe WCAG 2.2 A/AA`, async ({ page }) => {
    await page.goto(route);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}

test("saltar al contenido: primer foco de la página y lleva el foco al main", async ({ page }) => {
  await page.goto("/productos");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  const box = await skip.boundingBox();
  expect(box && box.y >= 0).toBeTruthy();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("cada página tiene un único h1 y los landmarks principales", async ({ page }) => {
  for (const route of ["/", "/productos", "/asesor", "/comparar", "/legales/terminos"]) {
    await page.goto(route);
    // checkVisibility descarta los h1 dentro de un ancestro con display: none; los .sr-only cuentan.
    const h1Count = await page.evaluate(() => [...document.querySelectorAll("h1")].filter((h) => h.checkVisibility()).length);
    expect(h1Count, route).toBe(1);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("header, [role=banner]").first()).toBeAttached();
    // /asesor es una pantalla de chat sin footer.
    if (route !== "/asesor") await expect(page.locator("footer").first()).toBeAttached();
  }
});

test("el mapa de Visitanos en Quilmes es interactivo y separado del CTA", async ({ page }) => {
  await page.goto("/");
  const map = page.locator("#resenas iframe");
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute("title", /Mapa interactivo/);
  // Ni el iframe sin eventos ni un enlace superpuesto: el arrastre y el zoom llegan al mapa.
  expect(await map.evaluate((frame) => getComputedStyle(frame).pointerEvents)).not.toBe("none");
  expect(await map.getAttribute("tabindex")).toBeNull();
  const hit = await map.evaluate((frame) => {
    const r = frame.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === frame;
  });
  expect(hit).toBe(true);
  await expect(page.getByRole("link", { name: /Ver reseñas y cómo llegar/ })).toBeVisible();
});
