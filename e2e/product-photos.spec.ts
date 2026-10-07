import { test, expect, type Page } from "@playwright/test";

const slug = "proteina-star-2lb"; // 2 fotos de producto + rótulo: carrusel en la tarjeta y 3 imágenes en la ficha
const card = (page: Page) => page.locator("article.product-card").filter({ has: page.locator(`a[href="/productos/${slug}"]`) }).first();
const fitsViewport = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("carrusel de la tarjeta: flechas sin navegar, recorrido con el mouse y clic a la ficha", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Flechas y recorrido solo con mouse");
  await page.goto("/productos?q=Proteína STAR 2 lb");
  const item = card(page);
  const dots = item.locator(".card-media-dots span");
  await expect(dots).toHaveCount(2);
  await expect(dots.nth(0)).toHaveClass("is-active");
  await item.getByRole("button", { name: "Foto siguiente de Proteína STAR 2 lb" }).click();
  await expect(dots.nth(1)).toHaveClass("is-active");
  await expect(page).toHaveURL(/\/productos\?q=/);
  // Al salir vuelve a la primera; al volver a pasar el mouse recorre solo.
  await page.mouse.move(2, 2);
  await expect(dots.nth(0)).toHaveClass("is-active");
  // Mouse directo (sin hover() de Playwright, que scrollea la página si la tarjeta todavía está en transición).
  const title = (await item.locator("h3").boundingBox())!;
  await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2);
  await expect(dots.nth(1)).toHaveClass("is-active", { timeout: 5000 });
  await page.screenshot({ path: info.outputPath("card-carousel.png") });
  await item.locator(".card-media-track").click();
  await expect(page).toHaveURL(`/productos/${slug}`, { timeout: 30000 });
});

test("carrusel de la tarjeta en mobile: swipe sin flechas y sin desborde", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Solo aplica al ancho de 390");
  await page.goto("/productos?q=Proteína STAR 2 lb");
  const item = card(page);
  await expect(item.getByRole("button", { name: /Foto siguiente/ })).toBeHidden();
  await item.locator(".card-media-track").evaluate((el) => el.scrollTo({ left: el.clientWidth }));
  await expect(item.locator(".card-media-dots span").nth(1)).toHaveClass("is-active");
  expect(await fitsViewport(page)).toBe(true);
});

test("ficha: galería sincronizada, lightbox con flechas, zoom y Escape", async ({ page }, info) => {
  await page.goto(`/productos/${slug}`);
  const track = page.locator(".gallery-track");
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Proteína STAR 2 lb, foto 2", exact: true }).click();
    await expect(page.getByRole("button", { name: "Proteína STAR 2 lb, foto 2", exact: true })).toHaveAttribute("aria-current", "true");
  } else {
    await track.evaluate((el) => el.scrollTo({ left: el.clientWidth }));
    await expect(page.locator(".gallery-counter")).toHaveText("2 / 3");
  }
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
  expect(await fitsViewport(page)).toBe(true);

  const ampliar = page.getByRole("button", { name: /^Ampliar/ });
  await ampliar.click();
  const dialog = page.getByRole("dialog", { name: "Fotos de Proteína STAR 2 lb" });
  await expect(dialog).toBeVisible();
  const counter = dialog.locator(".lightbox-counter");
  await expect(counter).toContainText("2 / 3");
  await page.keyboard.press("ArrowRight");
  await expect(counter).toContainText("3 / 3");
  await dialog.getByRole("button", { name: "Foto siguiente" }).click();
  await expect(counter).toContainText("1 / 3");
  await page.screenshot({ path: info.outputPath("lightbox.png") });

  // Zoom con clic sobre la foto; el primer Escape solo lo saca.
  const frame = dialog.locator(".lightbox-slide:not([aria-hidden]) .lightbox-frame");
  await frame.click();
  await expect(frame).toHaveAttribute("style", /scale\(2\.5\)/);
  await page.keyboard.press("Escape");
  await expect(frame).not.toHaveAttribute("style", /scale/);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(ampliar).toBeFocused();
  // La galería queda en la última foto que se vio en el lightbox.
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(0);
});

test("pulso de stock: animado por defecto y apagado con movimiento reducido", async ({ page }) => {
  const pulse = () => page.locator(".product-buybox .stock span").evaluate((el) => { const style = getComputedStyle(el, "::after"); return { name: style.animationName, display: style.display }; });
  await page.goto(`/productos/${slug}`);
  expect((await pulse()).name).toBe("stock-pulse");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await pulse()).display).toBe("none");
  await page.goto("/productos?q=Proteína STAR 2 lb");
  const item = card(page);
  await item.hover();
  expect(await item.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});
