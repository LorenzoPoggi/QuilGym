import { test, expect, type Page } from "@playwright/test";

const fitsViewport = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const brandLinks = (page: Page) => page.locator("#marcas").getByRole("link", { name: /^Ver \d+ productos? de / });
const trackState = (page: Page) => page.locator(".brand-track").evaluate((track) => getComputedStyle(track).animationPlayState);

test("hero: video según el ancho, botón de pausa y texto en el primer viewport", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  await page.goto("/");
  const hero = page.locator("section.hero");
  await expect(hero.getByRole("heading", { level: 1, name: "Entrená en serio. Suplementate bien." })).toBeVisible();
  // El poster está en el HTML inicial con prioridad alta: es el candidato a LCP.
  await expect(hero.locator("img.hero-poster")).toHaveAttribute("fetchpriority", "high");
  const viewport = page.viewportSize()!;
  for (const target of [hero.locator("h1"), hero.getByRole("link", { name: "Ver productos" })]) {
    const box = (await target.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  await expect(hero.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/productos");

  const video = hero.locator("video.hero-video");
  await expect(hero.locator(".hero-media")).toHaveAttribute("data-shown", "true", { timeout: 30000 });
  const src = await video.evaluate((element: HTMLVideoElement) => element.currentSrc);
  expect(src).toMatch(mobile ? /hero-720x1280\.webm$/ : /hero-1280\.webm$/);

  const pause = hero.getByRole("button", { name: "Pausar video de fondo" });
  await pause.click();
  await expect(hero.getByRole("button", { name: "Reproducir video de fondo" })).toBeVisible();
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await hero.getByRole("button", { name: "Reproducir video de fondo" }).click();
  await expect(pause).toBeVisible();
  await page.screenshot({ path: info.outputPath("hero.png") });
  expect(await fitsViewport(page)).toBe(true);
});

test("hero y marcas con movimiento reducido: sin video, sin botón y fila estática", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const videos: string[] = [];
  page.on("request", (request) => { if (/\.(mp4|webm)(\?|$)/.test(request.url())) videos.push(request.url()); });
  await page.goto("/");
  await expect(page.locator("img.hero-poster")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(videos).toEqual([]);
  await expect(page.locator(".hero-video-toggle")).toHaveCount(0);

  await page.locator("#marcas").scrollIntoViewIfNeeded();
  await expect(brandLinks(page)).toHaveCount(6);
  await expect(page.locator(".brand-copy").first()).toBeHidden();
  await expect(page.locator(".brand-pause")).toBeHidden();
  expect(await page.locator(".brand-track").evaluate((track) => getComputedStyle(track).animationName)).toBe("none");
  expect(await fitsViewport(page)).toBe(true);
});

test("cinta de marcas: 6 links accesibles, pausa con foco y con el control", async ({ page }) => {
  await page.goto("/");
  const marquee = page.locator(".brand-marquee");
  await marquee.scrollIntoViewIfNeeded();
  const links = brandLinks(page);
  await expect(links).toHaveCount(6);
  await expect(links.first()).toHaveAttribute("href", /^\/productos\?marca=/);
  // Las copias del loop no se pueden enfocar.
  await expect(page.locator(".brand-copy a").first()).toHaveAttribute("tabindex", "-1");
  expect(await trackState(page)).toBe("running");

  await links.first().focus();
  expect(await trackState(page)).toBe("paused");
  await page.keyboard.press("Tab");
  await expect(links.nth(1)).toBeFocused();
  await links.nth(1).blur();
  // Control explícito (WCAG 2.2.2), también para pantallas táctiles.
  await page.mouse.move(0, 0);
  const toggle = page.getByRole("checkbox", { name: "Pausar la cinta de marcas" });
  await page.locator(".brand-pause").click();
  await expect(toggle).toBeChecked();
  await page.mouse.move(0, 0);
  expect(await trackState(page)).toBe("paused");
  const box = (await page.locator(".brand-pause").boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.locator(".brand-pause").click();
  await expect(toggle).not.toBeChecked();
  await page.mouse.move(0, 0);
  await page.locator("body").evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await trackState(page)).toBe("running");
  expect(await fitsViewport(page)).toBe(true);
});
