import { test, expect, type Page } from "@playwright/test";

const slug = "proteina-star-2lb"; // 2 fotos de producto + rótulo: portada en la tarjeta y galería compacta en la ficha
const card = (page: Page) => page.locator("article.product-card").filter({ has: page.locator(`a[href="/productos/${slug}"]`) }).first();
const fitsViewport = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("tarjeta: solo la portada, sin carrusel", async ({ page }) => {
  await page.goto("/productos?q=Proteína STAR 2 lb");
  const item = card(page);
  await expect(item.locator(".card-media-single")).toHaveCount(1);
  await expect(item.locator(".card-media-dots")).toHaveCount(0);
  expect(await fitsViewport(page)).toBe(true);
});


test("ficha: galería sincronizada, lightbox con flechas, zoom y Escape", async ({ page }, info) => {
  await page.goto(`/productos/${slug}`);
  await expect(page.locator(".nutrition-panel")).toHaveCount(0);
  const facts = page.locator(".product-info-section");
  const description = facts.locator(".product-description");
  await expect(description).toBeVisible();
  const [factsBox, descriptionBox] = await Promise.all([facts.boundingBox(), description.boundingBox()]);
  expect(descriptionBox!.width).toBeGreaterThan(factsBox!.width * 0.85);
  const track = page.locator(".gallery-track");
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Información nutricional de Proteína STAR 2 lb", exact: true }).click();
    await expect(page.getByRole("button", { name: "Información nutricional de Proteína STAR 2 lb", exact: true })).toHaveAttribute("aria-current", "true");
  } else {
    await track.evaluate((el) => el.scrollTo({ left: el.clientWidth }));
    await expect(page.locator(".gallery-counter")).toHaveText("2 / 2");
  }
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
  expect(await fitsViewport(page)).toBe(true);

  const ampliar = page.getByRole("button", { name: /^Ampliar/ });
  await ampliar.click();
  const dialog = page.getByRole("dialog", { name: "Fotos de Proteína STAR 2 lb" });
  await expect(dialog).toBeVisible();
  const counter = dialog.locator(".lightbox-counter");
  await expect(counter).toContainText("2 / 2");
  await page.keyboard.press("ArrowRight");
  await expect(counter).toContainText("1 / 2");
  await dialog.getByRole("button", { name: "Foto siguiente" }).click();
  await expect(counter).toContainText("2 / 2");
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
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
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
