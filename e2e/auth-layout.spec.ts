import { test, expect } from "@playwright/test";

for (const route of ["/cuenta/ingresar", "/cuenta/registro"]) {
  test(`${route}: layout responsive y footer`, async ({ page }, info) => {
    await page.goto(route);
    await expect(page.locator(".auth-layout")).toBeVisible();
    await expect(page.locator(".auth-aside")).toBeVisible();
    await expect(page.locator(".auth-card")).toBeVisible();
    await expect(page.locator("#footer")).toBeVisible();
    await expect(page.locator(".advisor-floating")).toHaveCount(0);
    const googleMark = page.locator(".google-button__icon img");
    await expect(googleMark).toBeVisible();
    await expect.poll(() => googleMark.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    const layout = await page.locator(".auth-layout").evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    if (info.project.name === "mobile") expect(layout.trim().split(/\s+/)).toHaveLength(1);
    else expect(layout.trim().split(/\s+/).length).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${route.split("/").at(-1)}.png`), fullPage: true });
  });
}
