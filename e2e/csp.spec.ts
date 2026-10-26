import { expect, test } from "@playwright/test";

test("CSP protege la app y no bloquea la hidratación de Next", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text()) && /refused|blocked/i.test(message.text())) {
      cspErrors.push(message.text());
    }
  });

  const response = await page.goto("/");
  expect(response).not.toBeNull();
  const policy = response!.headers()["content-security-policy"];
  expect(policy).toBeTruthy();
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'"]) {
    expect(policy).toContain(directive);
  }

  await expect(page.getByRole("banner")).toBeVisible();
  // Opening the cart exercises a client-side interaction, not just server HTML.
  await expect(page.locator("#site-search")).toBeVisible();
  await page.getByRole("link", { name: /^Carrito:/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  expect(cspErrors).toEqual([]);
});
