import { test, expect } from "@playwright/test";

test("cuenta: registro, sesión persistente, favoritos, pedido propio y logout", async ({ page, browser }, info) => {
  const email = `quilgym-qa-${info.project.name}-${Date.now()}@example.com`;
  const password = "QuilGym-QA-only-2026";
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/cuenta/registro");
  await page.getByLabel("Nombre", { exact: true }).fill("Cliente QA");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Repetí la contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).toHaveURL("/", { timeout: 60000 });
  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { name: "Hola, Cliente" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Secciones de tu cuenta" })).toHaveCount(0);
  await page.goto("/productos");
  const favorite = page.getByRole("button", { name: /^Guardar en favoritos:/ }).first();
  await expect(favorite).toBeEnabled();
  const productName = (await favorite.getAttribute("aria-label"))!.replace("Guardar en favoritos: ", "");
  await favorite.click();
  await expect(page.getByRole("button", { name: `Quitar de favoritos: ${productName}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: `Quitar de favoritos: ${productName}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/cuenta/favoritos");
  await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("account.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.includes("session_token"));
  expect(session?.httpOnly).toBe(true);
  expect(session?.expires).toBeGreaterThan(Date.now() / 1000 + 86400);
  const other = await browser.newContext();
  const foreign = await other.newPage();
  await foreign.goto("http://localhost:3000/cuenta");
  await expect(foreign).toHaveURL(/\/cuenta\/ingresar/);
  const privateFavorites = await other.request.get("http://localhost:3000/api/account/favorites");
  expect((await privateFavorites.json()).ids).toEqual([]);
  await other.close();
  await page.goto("/productos");
  await page.getByRole("button", { name: /^Agregar .* al carrito$/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-state", "open");
  await expect(dialog.locator(".cart-drawer")).toHaveCSS("animation-name", "cart-slide-in");
  await page.getByRole("link", { name: /Iniciar compra/ }).click();
  await page.getByLabel("Nombre y apellido").fill("Cliente QA");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Teléfono").fill("1144444444");
  await page.getByRole("button", { name: "Confirmar retiro y total" }).click();
  await page.getByRole("checkbox", { name: /Confirmo que los datos/ }).check();
  await page.getByRole("button", { name: "Crear pedido de prueba" }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmacion\/[a-f0-9-]+$/, { timeout: 60000 });
  const orderUrl = page.url();
  await page.context().clearCookies({ name: "qg_cart" });
  const ownedResponse = await page.goto(orderUrl);
  expect(ownedResponse?.status()).toBe(200);
  await page.getByRole("button", { name: "Simular pago aprobado" }).click();
  await expect(page.getByRole("heading", { name: "¡Tu pago está aprobado!" })).toBeVisible({ timeout: 30000 });
  await page.goto("/cuenta/compras");
  await expect(page.getByRole("navigation", { name: "Secciones de tu cuenta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver compra" })).toHaveCount(1);
  await page.goto("/cuenta/configuracion");
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/cuenta/ingresar");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.locator(".auth-card").getByRole("alert")).toContainText("Email o contraseña incorrectos");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL("/", { timeout: 60000 });
  await page.goto("/cuenta/favoritos");
  await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Quitar de favoritos: ${productName}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: productName, exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("asesor conversacional: texto libre, contexto, tarjetas, reintento y reinicio", async ({ page }, info) => {
  // Solo QA: respuestas interceptadas sin una clave real ni consultas facturables.
  const errors: string[] = [];
  page.on("pageerror", (cause) => errors.push(cause.message));
  let calls = 0;
  const sent: { role: string; content: string }[][] = [];
  await page.route("**/api/advisor", async (route) => {
    sent.push(route.request().postDataJSON().messages);
    calls++;
    if (calls === 1) return route.fulfill({ json: { reply: "Querés ganar fuerza y ya entrenás tres veces. ¿Cómo venís con las comidas?", recommendations: [] } });
    if (calls === 2) return route.fulfill({ status: 502, json: { error: "No pudimos consultar al asesor. Podés reintentar." } });
    // Producto y contenido simulados exclusivamente en la respuesta interceptada del test.
    return route.fulfill({ json: { reply: "Por lo que contás, una opción práctica puede acompañar tus comidas sin reemplazarlas.", recommendations: [{ product: { id: 1, variantId: 1, slug: "proteina-star-nutrition-2-lb", name: "Proteína de prueba QA", category: { slug: "proteinas", name: "Proteínas" }, brand: null, priceArs: 20000, compareAtPriceArs: null, inStock: true, imageUrl: null }, reason: "Por tus horarios, podría darte practicidad cuando te cuesta incluir proteína en las comidas.", caution: "Revisá ingredientes y advertencias en el rótulo." }] } });
  });
  await page.goto("/asesor");
  const message = page.getByRole("textbox", { name: "Tu mensaje al asesor" });
  await expect(message).toBeEnabled();
  await expect(page.getByText(/Soy tu asesor fitness virtual/)).toBeVisible();
  await expect(page.getByText("¿Tenés 18 años o más?", { exact: true })).toHaveCount(0);
  await expect(page.locator(".advisor-options")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("advisor-welcome.png"), fullPage: true });
  await message.fill("Quiero ganar fuerza, entreno hace dos años tres veces por semana.");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.getByText(/¿Cómo venís con las comidas/)).toBeVisible();
  await message.fill("Por el trabajo me cuesta preparar comidas, tengo hasta 30000 pesos.");
  await message.press("Enter");
  await expect(page.locator(".advisor-chat-error")).toContainText("reintentar");
  await page.getByRole("button", { name: "Reintentar mensaje" }).click();
  await expect(page.getByRole("heading", { name: "Por qué podría servirte" })).toHaveCount(1);
  await expect(page.locator(".recommendation-reason")).toContainText("tus horarios");
  expect(sent[1]).toHaveLength(3);
  expect(sent[2]).toEqual(sent[1]);
  expect(sent[2][0].content).toContain("dos años");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("advisor-conversation.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(page.locator(".advisor-entry")).toHaveCount(1);
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(message).toBeFocused();
  expect(errors).toEqual([]);
});

test("asesor: conexión pendiente conserva el mensaje y los enlaces anteriores llevan al chat", async ({ page }) => {
  await page.route("**/api/advisor", (route) => route.fulfill({ status: 503, json: { error: "El chat de IA todavía no está conectado. Falta configurar GOOGLE_GENERATIVE_AI_API_KEY en el servidor." } }));
  await page.goto("/asesor/recomendaciones?orientacion=personal");
  await expect(page).toHaveURL(/\/asesor$/);
  await page.getByRole("textbox", { name: "Tu mensaje al asesor" }).fill("Quiero empezar a entrenar y mejorar mis hábitos.");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(page.locator(".advisor-chat-error")).toContainText("GOOGLE_GENERATIVE_AI_API_KEY");
  await expect(page.locator(".advisor-entry--user")).toContainText("mejorar mis hábitos");
  await expect(page.locator(".advisor-entry--assistant")).toHaveCount(1);
  await expect(page.locator(".product-card")).toHaveCount(0);
});

test("acceso flotante, mapa real y carrito offcanvas accesible", async ({ page }, info) => {
  await page.goto("/");
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "Abrir chat del asesor QuilGym", exact: true }).click();
    await expect(page.getByRole("link", { name: "Empezar la conversación" })).toHaveAttribute("href", "/asesor");
    await page.screenshot({ path: info.outputPath("advisor-launcher.png"), fullPage: false, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Abrir chat del asesor QuilGym", exact: true })).toBeFocused();
  } else {
    // En mobile un solo botón despliega WhatsApp y el asesor (cubierto en floating-buy-catalog.spec.ts).
    await page.getByRole("button", { name: "Ayuda: WhatsApp y asesor QuilGym" }).click();
    await expect(page.getByRole("link", { name: "Asesor QuilGym" })).toHaveAttribute("href", "/asesor");
    await page.keyboard.press("Escape");
  }
  await expect(page.getByRole("link", { name: "Abrir ubicación de QuilGym en Google Maps" })).toHaveAttribute("href", /1791416799115149607/);
  await expect(page.getByRole("link", { name: "Ver todas las reseñas" })).toBeVisible();
  await page.goto("/productos");
  await page.getByRole("button", { name: /^Agregar .* al carrito$/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar carrito", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: /^Carrito:/ }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("carrusel usa atribuciones y controles con datos de proveedor simulados solo en QA", async ({ page }) => {
  await page.route("**/api/reviews", (route) => route.fulfill({ json: { source: "google", rating: 4.5, count: 3, reviews: [1,2,3].map((id) => ({ id:String(id),author:`Usuario de prueba ${id}`,authorUrl:"https://www.google.com/maps",rating:5,text:`Opinión simulada para QA ${id}`,original:null,date:"4/10/2026",url:"https://www.google.com/maps" })) } }));
  await page.goto("/");
  await expect(page.locator(".review-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Pausar carrusel" }).click();
  await expect(page.getByRole("button", { name: "Reanudar carrusel" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente reseña" }).click();
  await expect.poll(() => page.locator(".reviews-track").evaluate((n) => n.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Usuario de prueba 1" })).toHaveAttribute("href", "https://www.google.com/maps");
  await expect(page.getByText("COMPRA VERIFICADA", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
