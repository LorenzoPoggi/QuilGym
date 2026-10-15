import { test, expect } from "@playwright/test";

const cart = {
  lines: Array.from({ length: 8 }, (_, index) => ({
    variantId: index + 1,
    slug: "creatina-star-300gr-doypack",
    name: `Creatina Star ${index + 1}`,
    variantLabel: "300 g",
    brand: { slug: "star-nutrition", name: "Star Nutrition" },
    category: { slug: "creatinas", name: "Creatinas" },
    imageUrl: "/assets/products/creatina-star-300gr-doypack/01.webp",
    unitPriceArs: 10000,
    quantity: 1,
    lineTotalArs: 10000,
    maxQuantity: 10,
    available: true,
  })),
  itemCount: 8,
  subtotalArs: 80000,
  coupon: null,
  discountArs: 0,
  totalArs: 80000,
  freeShippingRemainingArs: null,
  notices: [],
  hasBlockingIssues: false,
  hasPriceChanges: false,
};

test("carrito: página dedicada y pie de compra fijo al desplazar los productos", async ({ page }) => {
  await page.route("**/api/cart", (route) => route.fulfill({ json: cart }));
  await page.goto("/carrito");

  await expect(page.getByRole("heading", { level: 1, name: "Tu carrito" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "También te puede interesar" })).toBeVisible();
  await expect(page.locator(".cart-overlay")).toHaveCount(0);
  await expect(page.locator(".cart-page-panel .cart-drawer")).toHaveCSS("position", "relative");

  const list = page.locator(".cart-page-panel .cart-panel-scroll");
  const footer = page.locator(".cart-page-panel .cart-panel-footer");
  await expect(page.getByRole("link", { name: "Iniciar compra" })).toBeVisible();
  const dimensions = await list.evaluate((element) => ({ client: element.clientHeight, scroll: element.scrollHeight }));
  expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
  const before = await footer.boundingBox();
  await list.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const after = await footer.boundingBox();
  expect(after?.y).toBe(before?.y);
  await expect(page.getByRole("link", { name: "Iniciar compra" })).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.evaluate(() => window.innerWidth));
  await list.evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: test.info().outputPath("cart-page.png"), fullPage: true });
});
