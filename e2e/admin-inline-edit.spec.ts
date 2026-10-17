import { test, expect, type Page } from "@playwright/test";

// Solo lectura. La sesión y el rol se simulan en el navegador (como en admin-mobile.spec.ts): sin sesión real,
// la Server Action del editor rechaza el pedido, así que se ve el estado de error y nunca se guarda nada.
const now = new Date().toISOString();
const session = {
  session: { id: "qa-session", userId: "qa-user", token: "qa", expiresAt: new Date(Date.now() + 86_400_000).toISOString(), createdAt: now, updatedAt: now },
  user: { id: "qa-user", name: "Cuenta QA", email: "qa@example.com", emailVerified: true, image: null, createdAt: now, updatedAt: now },
};

async function signedIn(page: Page, admin: boolean) {
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: session }));
  await page.route("**/api/account/role", (route) => route.fulfill({ json: { admin } }));
  await page.route("**/api/account/favorites", (route) => route.fulfill({ json: { ids: [] } }));
  await page.route("**/api/reviews", (route) => route.fulfill({ json: { reviews: [] } }));
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("el admin ve el lápiz en las tarjetas y abre el editor", async ({ page }) => {
  await signedIn(page, true);
  await page.goto("/productos");
  const pencil = page.locator(".product-card .product-image > .admin-edit-button").first();
  await expect(pencil).toBeVisible();
  await expect(pencil).toHaveAccessibleName("Editar producto");
  const box = await pencil.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(40);
  await expect(page.locator(".product-card .product-image > .favorite-button").first()).toBeVisible();

  const url = page.url();
  await pencil.click();
  // El clic no navega a la ficha.
  expect(page.url()).toBe(url);
  const dialog = page.getByRole("dialog", { name: "Editar producto" });
  await expect(dialog).toBeVisible();
  // Sin sesión real el servidor rechaza la lectura: estado de error con opción de reintentar.
  await expect(dialog.getByRole("alert")).toContainText(/permisos|cargar el producto/);
  await expect(dialog.getByRole("button", { name: "Reintentar" })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await dialog.getByRole("button", { name: "Cerrar editor" }).click();
  await expect(dialog).toHaveCount(0);
  await pencil.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("el admin ve el lápiz en la ficha, junto al título", async ({ page }) => {
  await signedIn(page, true);
  await page.goto("/productos");
  const href = await page.locator(".product-card h3 a").first().getAttribute("href");
  await page.goto(href!);
  const pencil = page.locator(".product-title-row .admin-edit-button");
  await expect(pencil).toBeVisible();
  await expect(pencil).toHaveAccessibleName("Editar producto");
  await pencil.click();
  await expect(page.getByRole("dialog", { name: "Editar producto" })).toBeVisible();
  expect(page.url()).toContain(href!);
  const dialogBox = await page.locator(".admin-edit-dialog").boundingBox();
  const viewport = page.viewportSize()!;
  if (viewport.width <= 768) expect(Math.round(dialogBox!.width)).toBe(viewport.width);
  else expect(dialogBox!.width).toBeLessThanOrEqual(780);
});

test("un cliente con sesión no ve el lápiz", async ({ page }) => {
  await signedIn(page, false);
  await page.goto("/productos");
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator(".admin-edit-button")).toHaveCount(0);
});

test("un visitante sin sesión no ve el lápiz", async ({ page }) => {
  await page.route("**/api/reviews", (route) => route.fulfill({ json: { reviews: [] } }));
  await page.goto("/productos");
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator(".admin-edit-button")).toHaveCount(0);
});

test("el lanzador flotante no aparece en /pedido", async ({ page }) => {
  await page.route("**/api/reviews", (route) => route.fulfill({ json: { reviews: [] } }));
  await page.goto("/productos");
  await expect(page.locator(".advisor-floating")).toHaveCount(1);
  await page.goto("/pedido");
  await expect(page.locator(".advisor-floating")).toHaveCount(0);
});
