import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  ["inicio", "/"],
  ["catálogo", "/productos"],
  ["ficha de producto", "/productos/proteina-body-advance-1kg"],
  ["búsqueda", "/buscar"],
  ["comparador", "/comparar"],
  ["carrito vacío", "/carrito"],
  ["ingreso", "/cuenta/ingresar"],
  ["asesor", "/asesor"],
] as const;

for (const [name, route] of routes) {
  test(`${name}: axe WCAG 2.1 A/AA`, async ({ page }) => {
    // La ruta real de reseñas consume el rate limit compartido en Postgres;
    // el análisis de accesibilidad no necesita contactar ese servicio.
    await page.route("**/api/reviews", (request) => request.fulfill({ json: { reviews: [] } }));
    await page.goto(route);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}
