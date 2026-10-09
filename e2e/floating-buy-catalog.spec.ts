import { test, expect, type Page } from "@playwright/test";

const fitsViewport = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const stickyHeight = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sticky-buy-h").trim());

test("botones flotantes: uno solo en mobile con WhatsApp y asesor, dos en desktop", async ({ page }, info) => {
  await page.goto("/productos");
  const toggle = page.getByRole("button", { name: "Ayuda: WhatsApp y asesor QuilGym" });
  if (info.project.name === "desktop") {
    await expect(toggle).toBeHidden();
    await expect(page.getByRole("link", { name: "Contactar a QuilGym por WhatsApp" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir chat del asesor QuilGym", exact: true })).toBeVisible();
    return;
  }
  await expect(page.getByRole("link", { name: "Contactar a QuilGym por WhatsApp" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir chat del asesor QuilGym", exact: true })).toBeHidden();
  const toggleBox = (await toggle.boundingBox())!;
  expect(toggleBox.width).toBe(52);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const whatsapp = page.getByRole("link", { name: "WhatsApp", exact: true });
  const advisor = page.getByRole("link", { name: "Asesor QuilGym" });
  await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\//);
  await expect(advisor).toHaveAttribute("href", "/asesor");
  for (const item of [whatsapp, advisor]) {
    const box = (await item.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(toggleBox.y);
  }
  await page.screenshot({ path: info.outputPath("floating-dial.png") });
  // Teclado: Tab recorre las opciones y Escape cierra devolviendo el foco.
  await page.keyboard.press("Tab");
  await expect(whatsapp).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(advisor).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await expect(advisor).toHaveCount(0);
  // Un toque afuera también lo cierra.
  await toggle.click();
  await expect(advisor).toBeVisible();
  await page.mouse.click(20, 400);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // El último contenido del footer queda por encima del botón.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const last = (await page.locator("#footer .footer-main").boundingBox())!;
  const paddingBottom = await page.locator("#footer .footer-main").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(paddingBottom).toBeGreaterThanOrEqual(68);
  expect(last.y + last.height - paddingBottom).toBeLessThanOrEqual((await toggle.boundingBox())!.y);
  expect(await fitsViewport(page)).toBe(true);
});

test("ficha mobile: barra de compra fija al pasar el bloque de compra", async ({ page }, info) => {
  await page.goto("/productos/proteina-star-2lb");
  const bar = page.getByRole("region", { name: "Compra rápida" });
  await expect(bar).toBeHidden();
  expect(await stickyHeight(page)).toBe("");
  await page.locator(".buy-actions").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY + 300));
  if (info.project.name === "desktop") {
    await page.waitForTimeout(400);
    await expect(bar).toBeHidden();
    expect(await stickyHeight(page)).toBe("");
    return;
  }
  await expect(bar).toBeVisible();
  await expect(bar).toHaveClass(/is-visible/);
  await expect.poll(() => stickyHeight(page)).toMatch(/^\d+px$/);
  // La imagen principal deja lugar al precio: como máximo el 52 % del alto.
  const image = await page.locator(".product-main-image").first().evaluate((el) => el.getBoundingClientRect().height);
  expect(image).toBeLessThanOrEqual(844 * 0.52 + 1);
  // El botón flotante sube por encima de la barra.
  await page.waitForTimeout(400);
  const barBox = (await bar.boundingBox())!;
  const toggleBox = (await page.getByRole("button", { name: "Ayuda: WhatsApp y asesor QuilGym" }).boundingBox())!;
  expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(barBox.y);
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(844 + 0.5);
  await page.screenshot({ path: info.outputPath("sticky-buy.png") });
  expect(await fitsViewport(page)).toBe(true);
  // Al volver arriba se oculta y libera la variable.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(bar).toBeHidden();
  await expect.poll(() => stickyHeight(page)).toBe("");
  await page.locator(".buy-actions").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY + 300));
  await bar.getByRole("button", { name: "Comprar ahora" }).click();
  await expect(page).toHaveURL(/\/checkout$/, { timeout: 60000 });
});

test("ficha mobile sin stock: la barra queda deshabilitada", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "La barra existe solo en mobile");
  await page.goto("/productos/shaker-ena");
  await page.locator(".buy-actions").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().bottom + window.scrollY + 300));
  const bar = page.getByRole("region", { name: "Compra rápida" });
  await expect(bar).toBeVisible();
  await expect(bar.getByRole("button", { name: "Sin stock por el momento" })).toBeDisabled();
  await expect(bar.getByRole("button", { name: "Comprar ahora" })).toHaveCount(0);
});

test("header mobile: la fila de búsqueda se oculta al bajar y vuelve al subir", async ({ page }, info) => {
  await page.goto("/productos");
  const header = page.locator(".site-header");
  const search = header.locator(".search");
  await expect(header).toHaveAttribute("data-scroll", "up");
  await page.mouse.move(195, 500);
  await page.mouse.wheel(0, 900);
  if (info.project.name === "desktop") {
    await page.waitForTimeout(400);
    await expect(header).toHaveAttribute("data-scroll", "up");
    await expect(search).toBeVisible();
    return;
  }
  await expect(header).toHaveAttribute("data-scroll", "down");
  await expect(search).toBeHidden();
  // El header no cambia de alto: no hay salto de contenido.
  expect(await header.evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
  await page.mouse.wheel(0, -300);
  await expect(header).toHaveAttribute("data-scroll", "up");
  await expect(search).toBeVisible();
  // Con el buscador enfocado no se oculta.
  await page.locator("#site-search").focus();
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(300);
  await expect(header).toHaveAttribute("data-scroll", "up");
});

test("catálogo: resultados y orden en la barra, filtros con contador y chips arriba", async ({ page }, info) => {
  await page.goto("/productos?stock=1");
  const bar = page.locator(".catalog-bar");
  await expect(bar.locator(".catalog-count")).toHaveText(/^\d+ resultados?$/);
  await expect(page.getByRole("button", { name: "Quitar filtro En stock" })).toBeVisible();
  const chips = (await page.locator(".catalog-results > .filter-chips").boundingBox())!;
  const grid = (await page.locator(".catalog-product-grid").boundingBox())!;
  expect(chips.y).toBeLessThan(grid.y);
  if (info.project.name === "mobile") {
    const filters = page.getByRole("button", { name: /^Filtros/ });
    await expect(filters).toContainText("1");
    await expect(page.locator(".catalog-tabs-wrap")).toHaveAttribute("data-overflow", /end|both/);
    await page.locator(".catalog-tabs").evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(page.locator(".catalog-tabs-wrap")).toHaveAttribute("data-overflow", "start");
    await filters.click();
    await expect(page.locator("#catalog-filters")).toBeVisible();
    await filters.click();
    // Filtros, cantidad y orden comparten fila.
    const [a, b] = await Promise.all([filters.boundingBox(), page.locator(".catalog-sort").boundingBox()]);
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(4);
  }
  await page.screenshot({ path: info.outputPath("catalog.png") });
  await page.getByRole("combobox", { name: "Ordenar productos" }).selectOption("menor-precio");
  await expect(page).toHaveURL(/orden=menor-precio/);
  await page.getByRole("button", { name: "Quitar filtro En stock" }).click();
  await expect(page).not.toHaveURL(/stock=1/);
  await expect(page.locator(".catalog-results > .filter-chips")).toHaveCount(0);
  expect(await fitsViewport(page)).toBe(true);
});

test("comparador: tarjetas apiladas en mobile y link al rótulo cuando existe", async ({ page }, info) => {
  await page.goto("/comparar");
  const cards = page.locator(".compare-products > .product-card");
  await expect(cards).toHaveCount(3);
  if (info.project.name === "mobile") {
    const boxes = await Promise.all([0, 1, 2].map(async (index) => (await cards.nth(index).boundingBox())!));
    // Una tarjeta debajo de la otra, con las filas del producto entre medio.
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height + 100);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height + 100);
    expect(Math.abs(boxes[0].x - boxes[2].x)).toBeLessThan(1);
    await expect(page.getByRole("rowheader").first()).toBeHidden();
    const label = await page.getByRole("cell").first().evaluate((el) => getComputedStyle(el, "::before").content);
    expect(label).toBe('"Precio"');
  } else {
    await expect(page.getByRole("rowheader", { name: "Rótulo nutricional" })).toBeVisible();
  }
  const links = page.getByRole("link", { name: /^Ver rótulo nutricional de / });
  const withoutLabel = page.getByRole("cell").filter({ hasText: "Sin foto del rótulo" });
  expect((await links.count()) + (await withoutLabel.count())).toBe(3);
  await page.screenshot({ path: info.outputPath("compare.png"), fullPage: true });
  expect(await fitsViewport(page)).toBe(true);
  if (await links.count()) {
    const href = await links.first().getAttribute("href");
    expect(href).toMatch(/^\/productos\/[\w-]+#galeria-producto$/);
    await links.first().click();
    await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 60000 });
    await expect(page.locator("#galeria-producto")).toBeInViewport();
  }
});
