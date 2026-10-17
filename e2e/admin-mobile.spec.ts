import { test, expect, type Page } from "@playwright/test";

// Solo lectura. La sesión y el rol se simulan en el navegador: no se crean cuentas ni se toca la base.
// Las páginas de /admin no se pueden recorrer así porque su guard valida la sesión en el servidor.
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

async function openAccountMenu(page: Page) {
  await page.goto("/productos");
  const trigger = page.getByRole("button", { name: /menú de tu cuenta/ });
  await expect(trigger).toBeVisible();
  await trigger.click();
  return page.locator("#account-menu-panel");
}

test("menú de cuenta del admin: solo panel, configuración y salir", async ({ page }) => {
  await signedIn(page, true);
  const menu = await openAccountMenu(page);
  await expect(menu.getByRole("link", { name: "Panel de administración" })).toHaveAttribute("href", "/admin");
  await expect(menu.getByRole("link", { name: "Configuración" })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Salir" })).toBeVisible();
  for (const name of ["Ver perfil", "Compras", "Historial", "Favoritos", "Eliminar cuenta"]) await expect(menu.getByRole("link", { name })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("menú de cuenta de un cliente: secciones de cliente y sin acceso al panel", async ({ page }) => {
  await signedIn(page, false);
  const menu = await openAccountMenu(page);
  for (const name of ["Ver perfil", "Compras", "Historial", "Favoritos", "Configuración"]) await expect(menu.getByRole("link", { name })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Panel de administración" })).toHaveCount(0);
});

test("el panel sin sesión manda a ingresar", async ({ page }) => {
  await page.goto("/admin/productos");
  await expect(page).toHaveURL(/\/cuenta\/ingresar\?next=%2Fadmin%2Fproductos/);
});
