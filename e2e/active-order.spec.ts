import { test, expect, type Page } from "@playwright/test";

// Solo lectura: el pedido en curso se simula interceptando /api/orders/active (no se crean pedidos ni cookies reales).
const activeOrder = {
  id: "0f3a9c2e-1111-4a2b-9c3d-123456789abc", code: "QG-0F3A9C2E", status: "out_for_delivery",
  title: "Tu pedido QG-0F3A9C2E está en camino", detail: "llega hoy entre las 15:00 y las 20:00",
  href: "/pedido/0f3a9c2e-1111-4a2b-9c3d-123456789abc?t=simulado",
};

async function mockActiveOrder(page: Page, order: typeof activeOrder | null = activeOrder) {
  let calls = 0;
  await page.route("**/api/reviews", (request) => request.fulfill({ json: { reviews: [] } }));
  await page.route("**/api/orders/active", (request) => { calls += 1; return request.fulfill({ json: { order } }); });
  return () => calls;
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("muestra el pedido en curso con el link al seguimiento, sin tapar los botones flotantes", async ({ page }) => {
  await mockActiveOrder(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/legales/privacidad");
  const toast = page.getByRole("complementary", { name: "Pedido en curso" });
  await expect(toast).toContainText("Tu pedido QG-0F3A9C2E está en camino");
  await expect(toast).toContainText("llega hoy entre las 15:00 y las 20:00");
  await expect(toast.getByRole("link", { name: "Ver dónde está" })).toHaveAttribute("href", activeOrder.href);
  const [toastBox, floating] = await Promise.all([toast.boundingBox(), page.locator(".advisor-floating").boundingBox()]);
  expect(toastBox).not.toBeNull();
  if (floating) expect(overlaps(toastBox!, floating)).toBe(false);
  const viewport = page.viewportSize()!;
  expect(toastBox!.x).toBeGreaterThanOrEqual(0);
  expect(toastBox!.x + toastBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("cerrarlo lo oculta para ese pedido y estado, también después de recargar", async ({ page }) => {
  await mockActiveOrder(page);
  await page.goto("/legales/privacidad");
  const toast = page.getByRole("complementary", { name: "Pedido en curso" });
  await toast.getByRole("button", { name: "Cerrar el aviso del pedido QG-0F3A9C2E" }).click();
  await expect(toast).toHaveCount(0);
  await page.reload();
  await page.waitForResponse("**/api/orders/active");
  await expect(page.getByRole("complementary", { name: "Pedido en curso" })).toHaveCount(0);
});

test("si cambia el estado del pedido vuelve a aparecer", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("qg_active_order_dismissed", JSON.stringify(["0f3a9c2e-1111-4a2b-9c3d-123456789abc:preparing"])));
  await mockActiveOrder(page);
  await page.goto("/legales/privacidad");
  await expect(page.getByRole("complementary", { name: "Pedido en curso" })).toBeVisible();
});

test("no se muestra sin pedido ni en la página de seguimiento", async ({ page }) => {
  const calls = await mockActiveOrder(page, null);
  await page.goto("/legales/privacidad");
  await page.waitForResponse("**/api/orders/active");
  await expect(page.getByRole("complementary", { name: "Pedido en curso" })).toHaveCount(0);
  const before = calls();
  // Un id inválido responde 404 sin consultar la base: alcanza para probar que la ruta /pedido no muestra el aviso.
  await page.goto("/pedido/no-existe");
  await page.waitForLoadState("networkidle");
  expect(calls()).toBe(before);
  await expect(page.getByRole("complementary", { name: "Pedido en curso" })).toHaveCount(0);
});
