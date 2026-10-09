import { test, expect, type Page } from "@playwright/test";

const fitsViewport = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const brandLinks = (page: Page) => page.locator("#marcas").getByRole("link", { name: /^Ver \d+ productos? de / });
const trackState = (page: Page) => page.locator(".brand-track").evaluate((track) => getComputedStyle(track).animationPlayState);

test("hero: video según el ancho, pausa accesible por teclado y texto en el primer viewport", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  await page.goto("/");
  const hero = page.locator("section.hero");
  await expect(hero.getByRole("heading", { level: 1, name: "Entrená en serio. Suplementate bien." })).toBeVisible();
  await expect(hero.locator(".chip")).toHaveCount(0);
  const reassurance = hero.locator(".hero-meta");
  if (mobile) await expect(reassurance).toBeHidden();
  else await expect(reassurance).toBeVisible();
  const benefits = page.locator("main > .benefits-section");
  await expect(benefits).toHaveCount(1);
  if (mobile) await expect(benefits).toBeHidden();
  else await expect(benefits).toBeVisible();
  expect(await benefits.evaluate((section) => section.previousElementSibling?.classList.contains("hero"))).toBe(true);
  await expect(benefits.locator(".benefit")).toHaveCount(5);
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
  // Los controles de pausa no aparecen como botones flotantes; se revelan al recibir foco de teclado.
  await pause.focus();
  await expect(pause).toBeFocused();
  await pause.click();
  const play = hero.getByRole("button", { name: "Reproducir video de fondo" });
  await expect(play).toBeFocused();
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await play.click();
  await expect(pause).toBeFocused();
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
  await expect(page.locator(".brand-pause")).toHaveCount(0);
  expect(await page.locator(".brand-track").evaluate((track) => getComputedStyle(track).animationName)).toBe("none");
  expect(await fitsViewport(page)).toBe(true);
});

test("cinta de marcas: 6 links accesibles y pausa al recibir foco", async ({ page }) => {
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
  await expect(page.locator(".brand-pause")).toHaveCount(0);
  await page.locator("body").evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await trackState(page)).toBe("running");
  expect(await fitsViewport(page)).toBe(true);
});

test("home: objetivos con contraste AA y banner del asesor con el texto aprobado", async ({ page }) => {
  await page.goto("/");
  const ratios = await page.locator(".objective").evaluateAll((cards) => cards.map((card) => {
    const background = getComputedStyle(card).backgroundColor.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const channel = (value: number) => { const normalized = value / 255; return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4; };
    const luminance = .2126 * channel(background[0]) + .7152 * channel(background[1]) + .0722 * channel(background[2]);
    const after = getComputedStyle(card, "::after");
    return { contrast: 1.05 / (luminance + .05), circleLayer: Number(after.zIndex), textOpacity: getComputedStyle(card.querySelector("p")!).opacity };
  }));
  expect(ratios).toHaveLength(6);
  for (const ratio of ratios) {
    expect(ratio.contrast).toBeGreaterThanOrEqual(4.5);
    expect(ratio.circleLayer).toBeLessThan(1);
    expect(ratio.textOpacity).toBe("1");
  }
  const banner = page.locator(".advisor-banner");
  await expect(banner.getByText("TE ORIENTAMOS EN 3 MINUTOS")).toBeVisible();
  await expect(banner.getByRole("heading", { name: "¿No sabés qué suplemento elegir?" })).toBeVisible();
  await expect(banner.locator(".advisor-preview")).toHaveText("Nuestro asesor fitness virtual puede responder tus consultas para que logres alcanzar tu objetivo");
  await expect(banner.locator(".advisor-preview")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(banner.getByRole("link", { name: "Conversar con el asesor" })).toHaveAttribute("href", "/asesor");
  expect(await fitsViewport(page)).toBe(true);
});
