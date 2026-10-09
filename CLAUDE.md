# QuilGym — contexto integral, estado actual y plan

> Documento de traspaso técnico. Última actualización: 9 de octubre de 2026. Incluye el panel de catálogo, Checkout Pro y el diagnóstico del retorno en Preview, más la revisión visual y de seguridad de esta fecha (ver §§20–24).
>
> Es la fuente de contexto para quien continúe el proyecto. No hay un `AGENTS.md` en la raíz del repositorio al 9/10/2026; leer este documento y contrastar cualquier decisión visual con `design-reference/`.
>
> Este archivo y `AGENTS.md` están en `.gitignore`: son locales y no se suben a GitHub.
>
> **Estado vigente (9/10/2026):** rama de trabajo `mp-sandbox`; producción continúa en `main`/`quilgym.vercel.app`. Leer §§20–24 para los estados más recientes. Las secciones anteriores pueden conservar decisiones que después cambiaron; prevalece la nota cronológica más nueva. `CLAUDE.md` está ignorado por Git: para compartirlo hay que agregarlo explícitamente con `git add -f CLAUDE.md`.

---

## 1. Propósito

QuilGym es un e-commerce argentino de suplementos deportivos (local en Quilmes). La web reemplaza a la tienda actual en Tiendanube (https://quilgymsuplementos.mitiendanube.com/), que es propiedad de un amigo del usuario.

La experiencia debe permitir descubrir y comparar productos, entender ingredientes y presentaciones, orientarse según la rutina y comprar con envío o retiro en Quilmes. El dueño del negocio trabaja con el usuario y su socio (no asumir que es un amigo).

Tono: claro, responsable y comercial. **Sin promesas médicas ni resultados garantizados.** El comparador y el asesor orientan; no diagnostican ni declaran un producto universalmente superior.

---

## 2. Reglas de trabajo (obligatorias)

1. **Commits sin Claude como co-autor ni contributor.** Nunca agregar `Co-Authored-By` ni atribución en commits o PRs. El autor de los commits es Franco Lesme (configuración local de Git).
2. Mensajes de commit en español, estilo convencional (`feat:`, `fix:`, `chore:`), con lista de cambios en el cuerpo.
3. Mantener `main` como producción estable. Para integrar y probar Mercado Pago sandbox, trabajar en `mp-sandbox`; no desplegar pruebas como Production ni copiar credenciales sandbox a Production. Hacer push solo cuando el usuario lo pida o lo haya acordado.
4. No modificar ni eliminar `design-reference/`.
5. No presentar datos de ejemplo como reales: nada de reseñas, métricas, promociones o stock inventados.
6. No mostrar promociones que el negocio no confirmó. Se controlan desde `lib/commerce.ts`.
7. Server Components por defecto; `"use client"` solo donde hay interacción.
8. El cliente nunca envía precios: solo IDs de variante y cantidades. Precio, stock, descuentos y envío se calculan en el servidor.
9. No almacenar tarjeta ni CVV. Los pagos se hacen con la tokenización del proveedor.
10. Tras cambios materiales: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` y probar el flujo afectado en el navegador, en escritorio (1440) y en mobile (390).
11. Para navegar o hacer QA usar el navegador headless de gstack (`~/.claude/skills/gstack/browse/dist/browse`). No usar las herramientas `mcp__claude-in-chrome__*`. El daemon se reinicia seguido y pierde la sesión: para recorridos con carrito usar `browse chain` (JSON por stdin) en una sola llamada.
12. Este proyecto usa Next.js 16: leer la guía en `node_modules/next/dist/docs/` antes de usar APIs que puedan haber cambiado.
13. Actualizar este documento cuando cambie el estado real.
14. **No configurar Mercado Pago, transferencias ni tarifas de envío hasta que el negocio pase los datos.** El código ya está listo: alcanza con cargar las variables (ver §8.5).

---

## 3. Decisiones tomadas con el negocio

| Tema | Decisión |
| --- | --- |
| Plataforma | Backend propio: Postgres en **Neon** + **Drizzle ORM** dentro del mismo Next.js. Sin plataforma headless. |
| Hosting | **Vercel** (sitio de producción y deployments Preview) + **Neon** (Postgres). Producción está desplegada en `https://quilgym.vercel.app`; Preview es para validar cambios de `mp-sandbox`. |
| Pagos | Checkout Pro para Mercado Pago/Mercado Crédito y Payment Brick para tarjetas; efectivo solo al retirar en Quilmes. No habilitar transferencias hasta que el negocio confirme los datos y exista operación administrativa para conciliarlas. El estado pagado solo lo confirma el servidor al conciliar el proveedor. |
| Envío y retiro de prueba | En `mp-sandbox`: envío fijo $4.500 ARS a cualquier código postal, estimación 3–5 días hábiles; retiro en San Martín 492, piso 7 C, B1878 Quilmes, lunes a viernes de 7 a 17. Confirmar estos datos con el negocio antes de considerarlos definitivos para Production. |
| Catálogo inicial | Lista y precios copiados de la tienda de Tiendanube. Fotos de la tienda y de los sitios oficiales de las marcas, en la mejor calidad disponible. |
| Información nutricional | Se muestra la **foto del rótulo**; no se transcribió a texto. |

### Relevado de la tienda anterior (no inventar promociones)

- Mercado Pago está configurado con cuotas **con** interés. El descuento por transferencia o efectivo es **0%**.
- No se encontró política de envío gratis.
- Por eso `lib/commerce.ts` tiene `interestFreeInstallments: 1`, `transferDiscountPercent: 0` y `freeShippingFromArs: null`, y la UI oculta esos mensajes. Cambiar solo con confirmación del negocio.

---

## 4. Historial de trabajo

| Commit | Autor | Qué se hizo |
| --- | --- | --- |
| `df6ab4b`…`1681948` | Lorenzo Poggi | Prototipo frontend inicial (Next.js + Tailwind), README. Todo con datos de ejemplo. |
| `4076d09` | Franco Lesme | `CLAUDE.md` y `AGENTS.md` dejan de versionarse. Siguen en el historial anterior a este commit; borrarlos de ahí requiere reescribir el historial y hacer force-push, y no se hizo. |
| `2350d2f` | Franco Lesme | **Fase 1 — Catálogo real.** Neon + Drizzle, esquema, seed con 68 productos, catálogo con filtros en URL, búsqueda, fichas SSG, home desde la base, placeholder de imagen. Se quitaron promociones, reseñas y nutrición inventadas. |
| `343ce73` | Franco Lesme | **Fase 2 — Carrito persistente.** Tablas de carrito y cupones, cookie HttpOnly, Server Actions, recálculo en el servidor, avisos de precio y stock, drawer accesible, checkout con resumen real, tests con Vitest. |
| `c1bb837` | Franco Lesme | **Fotos, descripciones e información nutricional.** 152 imágenes curadas, galería en la ficha, rótulos nutricionales, 68 descripciones editadas, nuevo hero de la home, corrección de marcas. |
| `52624eb` | Lorenzo Poggi | **Fase 3 en código — checkout, órdenes y pagos.** Migración `0003` (orders, order_items, payments, shipments, order_emails). Checkout real con validación compartida, cotización firmada e idempotencia. Mercado Pago (Bricks + webhook firmado), transferencia, efectivo con retiro, outbox de emails con Resend, confirmación dinámica por pedido, simulador local de pagos. Tests de órdenes con PGlite y E2E con Playwright (1440 y 390). |
| `fbc89af` | Franco Lesme | **Checkout listo para configurar.** `npm run checkout:check`, vencimiento de pedidos pendientes, crons compatibles con Vercel (`vercel.json`), link firmado al pedido (`ORDER_ACCESS_SECRET`) en el email y en la vuelta de Mercado Pago. |
| `579727f` | Franco Lesme | **Pulido visual según `design-reference/`.** Inter con `next/font`, íconos lucide, tarjetas, home sin secciones ficticias, catálogo de 4 columnas con filtros plegables, búsqueda sin superposición, ficha, comparador, asesor, recomendaciones, carrito, checkout y confirmación. Nombres de producto unificados con `siteSlug` fijo y `db:sync-names`. |
| `580e077` | Lorenzo Poggi | **Cuentas, favoritos y asesor por reglas.** Better Auth (email y contraseña; Google preparado), migración `0004` (usuarios, sesiones, favoritos), pedidos vinculados al usuario, asesor determinista, botón flotante del asesor, drawer del carrito animado, mapa clicable y adaptador de reseñas de Google Places (sin credenciales). Ver §12. |
| `6767338` | Lorenzo Poggi | **Asesor conversacional con Gemini.** Chat de texto libre (`AdvisorChat`), `POST /api/advisor`, Gemini directo con `@ai-sdk/google` (default `gemini-3.5-flash-lite`), salida estructurada validada contra el catálogo real y rate limit en Postgres con cookie firmada. Ver §13–14. |
| `cd1eebc` | Lorenzo Poggi | **Home y elementos de compra.** Logos de las seis marcas, destacados distintos en desktop y mobile, beneficios ocultos en mobile, stock en verde, botón flotante de WhatsApp. Ver §15. |
| `7f09e99` | Lorenzo Poggi | **Cuentas de cliente y acceso con Google.** Menú de cuenta, `/cuenta/{compras,historial,favoritos,configuracion}`, avatares, historial de búsqueda por usuario (migración `0005`), vinculación con Google y borrado de cuenta. Publicado en Vercel. Ver §16–17. |
| `0011d46` | Franco Lesme | **Etapa 1 — bugs mobile y accesibilidad base.** Menú de cuenta dentro de la pantalla en mobile, newsletter sin desborde, WhatsApp sin borde con glifo oficial y `whatsappUrl` en `lib/commerce.ts`, foco visible global, contraste AA (`--muted: #656c71`), zonas táctiles de 44 px, h1 en `/carrito` y `/checkout`. |
| `638d0b1` | Franco Lesme | **Etapa 2 — fotos.** `photoUrls` en `ProductSummary` (claves de caché v2), carrusel en las tarjetas (`ProductCardMedia`), galería con swipe, lightbox nativo con zoom (`ProductLightbox`), pulso de stock y `lib/motion.ts`. |
| `13a72da` | Franco Lesme | **Etapa 3 — hero con video y cinta de marcas.** `HeroVideo`, `scripts/build-hero-video.mjs` (`npm run video:hero`), `lib/brand-logos.ts` y cinta animada con control de pausa. Se borraron `hero-productos.webp`, `build-hero.mjs` e `images:hero`. |
| `8e29db9` | Franco Lesme | **Etapa 4 — flotantes, compra mobile, checkout por WhatsApp, header, catálogo y comparador.** Un solo botón flotante en mobile, `ProductStickyBuy`, checkout sin medios → «Pedir por WhatsApp» (`lib/checkout-whatsapp.ts`), `HeaderAutoHide`, catálogo más compacto y comparador en tarjetas en mobile con link al rótulo. |
| `cd2460a` | Franco Lesme | **Etapa 5 — reseñas y documentación.** Reseñas pedidas solo al entrar en pantalla, avatar del autor, atribución «Google Maps», aviso de relevancia, «Traducida por Google» y estado «Visitanos en Quilmes» sin reseñas; este documento al día. Ver §18. |
| `8a0910e` | Franco Lesme | **Hero con montaje estilo Creed.** Reemplaza el clip de Pexels (no aprobado) por un montaje de 9 cortes / 13,33 s sin audio con clips de Mixkit y Coverr. Receta en `scripts/hero-montage.json`, `build-hero-video.mjs` reescrito (baja los clips si faltan), assets nuevos y ajustes de contraste del hero en tablet y mobile en `home.css`. Ver §8.3. |
| `0c5b80f`, `fa27007` | Franco Lesme | npm audit en 0 con `overrides` (§10) e ícono de efectivo 56 × 42 (rama `mp-sandbox`). |
| `21e1195` | Franco Lesme | **Marcas en el hero, logo nuevo, combos con fotos reales y tarjetas unificadas** (rama `mp-sandbox`, ver §23). |
| `bab335d` | Franco Lesme | **Checkout, seguridad y experiencia de compra** (rama `mp-sandbox`): el trabajo de §§23–25 (rate limits, cron de carritos, carrito/drawer, asesor, búsqueda, ingreso/registro, axe, limpieza CSS). |
| `2fcbcee`, `7bf01b6` | Lorenzo Poggi | Beneficios de nuevo como sección propia **debajo** del hero (ocultos en mobile) y nuevo texto del banner del asesor: «TE ORIENTAMOS EN 3 MINUTOS · ¿No sabés qué suplemento elegir?». |
| `25c408a` | Lorenzo Poggi | **Email de administrador:** `ADMIN_EMAIL` pasa a `lib/admin-config.ts` con valor `quilgym@gmail.com` (antes `quilgymnuevo@gmail.com`); lo usan `lib/admin-auth.ts` y el menú de cuenta. Sigue exigiendo email verificado + Google vinculado. |

---

## 5. Stack y comandos

- Next.js 16.3.8 (App Router, Webpack), React 19, TypeScript 5.9, Tailwind CSS 4 (solo como base; el estilo está en CSS propio).
- Node 24 (`.nvmrc`).
- Drizzle ORM 0.45 + `@neondatabase/serverless`: driver HTTP para lecturas y Pool WebSocket solo para transacciones (`lib/db/transaction.ts`).
- Inter autoalojada con `next/font/google` (variable `--font-sans`). Íconos con `lucide-react`; los SVG viejos de `components/icons.tsx` siguen en uso en algunos componentes (ahí está también `WhatsAppGlyph`).
- Better Auth 1.7 (cuentas, sesiones en Postgres, Google OAuth). AI SDK 7 (`ai`) + `@ai-sdk/google` para el asesor con Gemini.
- Vitest 5 (unitarios) + PGlite (Postgres en memoria para los tests de órdenes). Playwright para E2E. `sharp` (dev) para imágenes. `ffmpeg-static` (dev) para el video del hero. `tsx` para scripts.

```bash
npm install
npm run dev              # http://localhost:3000 (simulador de checkout activo)
npm run lint
npm run typecheck
npm test                 # unitarios + órdenes sobre PGlite
npm run test:e2e         # Playwright; levanta o reusa npm run dev (modo demo)
npm run build && npm run start

npm run checkout:check   # diagnóstico de variables del checkout (--strict sale con 1 si hay errores)

npm run db:generate      # migración nueva a partir de lib/db/schema.ts
npm run db:migrate       # aplica migraciones pendientes en Neon
npm run db:seed          # carga o actualiza el catálogo (¡pisa nombre, precio, stock, descripción e imágenes!)
npm run db:sync-names    # actualiza SOLO products.name desde el JSON (usar -- --dry-run primero)
npm run db:studio

npm run images:fetch     # baja la galería de Tiendanube a .cache/tiendanube (gitignored)
npm run images:build     # genera public/assets/products + data/product-images.json
npm run video:hero       # genera el video y los posters del hero en public/assets/hero (ver §8.3)
```

### Entorno

- `.env.local` está ignorado por Git y contiene secretos de desarrollo/prueba; no imprimirlo, copiarlo a Git ni compartir credenciales en el chat. `.env.example` documenta nombres de variables sin valores secretos.
- **Pendiente de seguridad:** la contraseña de Neon se compartió por chat. Hay que rotarla y actualizar `.env.local` y, más adelante, Vercel.
- La base de Neon tiene aplicadas las migraciones `0000` a `0005` (`0004` cuentas y favoritos, `0005` historial de búsqueda; ver §16) y el seed cargado.
- Neon tiene cortes o lentitud intermitentes: algunos E2E de cuenta y checkout fallan de a ratos por timeout y pasan al correrlos solos.

Variables del checkout (todas opcionales; sin ellas cada medio queda deshabilitado, nunca con valores inventados):

| Bloque | Variables | Qué habilita |
| --- | --- | --- |
| Modo demo | `CHECKOUT_DEMO_MODE` | Solo en `npm run dev`. Vacío = simulador activo; `false` = integraciones reales. Nunca se activa en build/start. |
| Sitio | `NEXT_PUBLIC_SITE_URL` | URL https. Requerida por Mercado Pago (webhook y vuelta) y por el link del email. |
| Retiro | `PICKUP_ADDRESS`, `PICKUP_HOURS` | Retiro en el local. |
| Envío | `SHIPPING_RATES_JSON` | Lista `[{"id","label","postalCodes":["1878"],"priceArs","estimate"}]`; `"*"` = resto del país. |
| Mercado Pago | `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Checkout Pro y Payment Brick. Usar las tres del mismo ambiente y la misma aplicación (TEST- para Preview/sandbox; APP_USR- solo en producción autorizada). |
| Transferencia | `TRANSFER_ACCOUNT`, `TRANSFER_HOLDER`, `TRANSFER_TAX_ID` | Datos bancarios en la confirmación. |
| Efectivo | `CASH_PICKUP_ENABLED=true` | Requiere retiro configurado. |
| Emails | `RESEND_API_KEY`, `EMAIL_FROM` | Sin ellas los emails quedan en la outbox. |
| Crons | `CRON_SECRET` | Bearer de `/api/internal/*`. Sin él responden 401. |
| Link firmado | `ORDER_ACCESS_SECRET` (≥ 32 caracteres) | Ver el pedido sin la cookie del carrito (`?t=`). Cambiarlo invalida los links enviados. |
| Vencimiento | `PENDING_ORDER_TTL_HOURS` | Horas hasta cancelar un pendiente sin pago iniciado. Default 72. |

Otras variables (también en `.env.example`):

| Bloque | Variables | Qué habilita |
| --- | --- | --- |
| Cuentas | `BETTER_AUTH_SECRET` (≥ 32 caracteres), `BETTER_AUTH_URL` (https en producción), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Better Auth. En desarrollo funciona sin configurar; en producción, sin secreto ni URL https responde «servicio no configurado». Callback: `<sitio>/api/auth/callback/google`. |
| Reseñas | `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACE_ID` | Hasta 5 reseñas de Google Places (solo servidor). Sin ellas la home muestra «Visitanos en Quilmes». Pasos de carga en §10. |
| Asesor | `GOOGLE_GENERATIVE_AI_API_KEY` (alias temporal `AI_GATEWAY_API_KEY`), `ADVISOR_MODEL` | Chat con Gemini. Default `gemini-3.5-flash-lite`. Sin clave, el chat responde 503 explicado. |

> Las variables `NEXT_PUBLIC_*` se fijan en el build: en Vercel hay que redeployar al cambiarlas.

---

## 6. Arquitectura actual

### 6.1 Rutas

| Ruta | Render | Estado |
| --- | --- | --- |
| `/` | Estática, revalida cada 5 min | Hero con video (poster como LCP, sin chip «Originales · Entrega rápida»), objetivos, destacados, banner del asesor, combos, cinta de marcas (sin botón de pausa), «Cómo comprar» y reseñas de Google o «Visitanos en Quilmes». Los mensajes hero de confianza se ocultan en mobile. |
| `/productos` | Dinámica (`searchParams`) | Catálogo real con filtros en la URL. |
| `/productos/[slug]` | SSG + revalida cada 5 min | Ficha real: galería con swipe y lightbox (rótulo nutricional incluido ahí), descripción, compra (barra fija en mobile), relacionados. |
| `not-found` | Estática | Página 404 de marca con links al catálogo e inicio. |
| `/buscar` | Dinámica | Búsqueda predictiva sobre el catálogo real. El header no muestra su buscador acá. |
| `/comparar` | Estática | 3 creatinas fijas con atributos reales y link al rótulo cuando existe; tarjetas apiladas en mobile. Sin selección (Fase 4). |
| `/asesor` | Dinámica + cliente | Chat de texto libre con Gemini; requiere `GOOGLE_GENERATIVE_AI_API_KEY` (o el alias `AI_GATEWAY_API_KEY`). |
| `/asesor/recomendaciones` | Redirección | Compatibilidad: lleva a /asesor; recomendaciones dentro de la charla. |
| `POST /api/advisor` | Dinámica, no-store | Historial validado, catálogo real, Gemini directo y límites persistentes. |
| `/cuenta/ingresar`, `/cuenta/registro` | Dinámica | Better Auth: email/contraseña operativo, Google configurable; noindex. |
| `/cuenta` | Dinámica | Cuatro accesos (Compras, Historial, Favoritos, Configuración); requiere sesión validada. |
| `/cuenta/compras`, `/cuenta/historial`, `/cuenta/favoritos`, `/cuenta/configuracion` | Dinámicas, noindex | Pedidos propios, búsquedas guardadas, favoritos y perfil (nombre, avatar, novedades, Google, borrar cuenta). |
| `/api/auth/[...all]` | Dinámica | Better Auth con cookies HttpOnly, sesiones en DB y límites de acceso. |
| `/api/account/favorites` | Dinámica, no-store | IDs de favoritos de la sesión, sin aceptar userId del cliente. |
| `/api/account/history` | Dinámica | Historial de búsqueda de la sesión. |
| `/api/reviews` | Dinámica, no-store | Adaptador Places; sin credenciales o con error devuelve estado sin opiniones (y `console.warn` con el status). La home lo pide solo cuando la sección se acerca a la pantalla. Límite compartido de 300 consultas/día en Postgres; falla cerrado. |
| `/carrito` | Estática + cliente | Panel de carrito real. |
| `/checkout` | Dinámica (lee la cookie) | Checkout real: contacto, entrega (envío o retiro), cotización firmada, medio de pago, consentimiento. Cada medio aparece solo si está configurado. Sin ninguna entrega o pago configurado (hoy en producción): aviso «La compra online se habilita pronto» y «Pedir por WhatsApp» con el carrito armado en el servidor. |
| `/checkout/confirmacion` | Estática | Redirige a `/carrito` (no hay confirmación genérica). |
| `/checkout/confirmacion/[orderId]` | Dinámica, `noindex`, `no-referrer` | Estado real del pedido. Autoriza por cookie del carrito o por `?t=` firmado; si no, 404. |
| `GET /api/cart` | Dinámica, `no-store` | Carrito recalculado para el `CartProvider`. |
| `POST /api/payments/mercadopago/webhook` | Dinámica | Verifica la firma `x-signature`, limita intentos con firma inválida por IP edge en Vercel y concilia el pago consultando a Mercado Pago. 503 si no está configurado. |
| `GET/POST /api/internal/order-emails` | Dinámica | Cron: reintenta la outbox de emails. Bearer `CRON_SECRET`. |
| `GET/POST /api/internal/expire-orders` | Dinámica | Cron: vence pendientes y envía avisos. Bearer `CRON_SECRET`. |

`vercel.json` define los dos crons diarios (12:00 y 12:30 UTC, compatibles con el plan Hobby). En el plan Pro se puede subir la frecuencia de los emails.

### 6.2 Módulos clave

| Archivo | Responsabilidad |
| --- | --- |
| `lib/db/schema.ts` | Esquema Drizzle (ver §7). |
| `lib/db/index.ts` | Cliente Drizzle HTTP (server-only). |
| `lib/db/transaction.ts` | `withOrderTransaction`: Pool WebSocket de Neon solo durante la transacción. |
| `lib/catalog.ts` | Lecturas cacheadas con `unstable_cache` (tag `catalog`, 5 min): `queryCatalog`, `getAllProducts`, `getSearchProducts` (búsqueda en orden de relevancia), `getFeaturedProducts`, `getProductsByCategory`, `getBrands`, `getCategories`, `getProduct`, `getPrimaryImages` (la usa el carrito) y `getProductPhotos` (hasta 4 fotos → `ProductSummary.photoUrls`). Claves de caché `catalog:active-products:v3` y `catalog:product:v2`; subir la versión si cambia la forma o la fuente de los datos cacheados. |
| `lib/catalog-types.ts`, `lib/catalog-params.ts` | Contratos serializables y URLs del catálogo. |
| `lib/cart.ts`, `lib/cart-actions.ts`, `lib/cart-types.ts`, `lib/pricing.ts` | Carrito recalculado, cookie `qg_cart`, Server Actions y reglas puras de cupón y cantidad. |
| `lib/commerce.ts` | Políticas visibles (cuotas, transferencia, envío gratis, local de retiro), `formatArs`, `commerce.whatsapp` (número y mensaje) y `whatsappUrl(text?)`. |
| `lib/checkout-whatsapp.ts` | `isOnlineCheckoutAvailable`, `initialCheckoutChoice` (nunca elige un radio deshabilitado) y `whatsappOrderMessage(cart)`. |
| `lib/checkout-types.ts` | Tipos del checkout y `orderStatusLabels`. |
| `lib/checkout-env.ts` | `parseCheckoutEnv(env)`: lectura pura de la configuración con errores y avisos (sin `server-only`, la usa el script). |
| `lib/checkout-config.ts` | Envoltorio server-only: `getCheckoutConfig`, `siteUrl`, `bankDetails`, `orderAccessSecret`, `orderPageUrl`, `pendingOrderTtlHours`. |
| `lib/checkout-validation.ts` | `validateCheckout` (cliente y servidor), `quoteDelivery`, `normalizePostalCode`. |
| `lib/checkout-security.ts` | `signQuote`/`readQuote` (HMAC con el cartId, 15 min), `checkoutFingerprint`, `verifyMercadoPagoSignature`. |
| `lib/checkout-actions.ts` | Server Actions: `getCheckoutQuote`, `submitCheckout`, `simulatePayment` (solo demo). |
| `lib/order-service.ts` | `createOrder` (transacción con `FOR UPDATE`), `transitionOrder` (libera stock y cupón una vez), `findOwnedOrder`/`orderDetails` (cookie o token). |
| `lib/order-state.ts` | `canTransition`, `providerStatus`. |
| `lib/order-access.ts` | `orderAccessToken` / `verifyOrderAccess` (HMAC-SHA256, base64url). |
| `lib/order-expiry.ts` | `expirePendingOrders`: cancela pendientes vencidos sin `provider_id` (lotes de 50, `SKIP LOCKED`). |
| `lib/order-email.ts` | Outbox con Resend e Idempotency-Key; incluye el link firmado. Nunca envía pedidos demo. |
| `lib/mercadopago.ts`, `lib/payment-actions.ts` | Preferencia, envío del pago del Brick (lista permitida), conciliación por ID/monto/moneda. |
| `lib/cron-auth.ts` | `isAuthorizedCron` (Bearer `CRON_SECRET`, `timingSafeEqual`). |
| `lib/slugify.ts` | `slugify` y `normalizeText`. |
| `lib/auth.ts`, `lib/auth-client.ts` | Better Auth (Drizzle, scrypt, sesiones de 30 días, rate limit en base, Google) y cliente reactivo. |
| `lib/account-actions.ts`, `lib/account-validation.ts`, `lib/account-page.ts`, `lib/search-history.ts` | Favoritos, perfil y consentimiento; validación y retornos internos saneados; historial de búsqueda por usuario. |
| `lib/advisor-chat.ts`, `lib/advisor-chat-types.ts`, `lib/advisor-config.ts`, `lib/advisor-rate-limit.ts` | Asesor con Gemini: prompt y salida estructurada, contratos validados, clave y modelo, límites por visitante y globales. `lib/advisor.ts` queda como motor histórico sin uso. |
| `lib/google-reviews.ts`, `lib/review-types.ts` | Adaptador Places (New) server-only y sin caché: valida autor, rating, enlaces y avatar (`photo`: https y host de Google). `quilgymMapsUrl` con el cid de la ficha. |
| `lib/brand-logos.ts` | Logos con dimensiones y tono; `withLogos()` deja afuera las marcas sin logo. |
| `lib/motion.ts` | `reducedMotion()` compartido del cliente. |

### 6.3 Componentes y estilos

| Componente | Tipo | Notas |
| --- | --- | --- |
| `Header`, `HeaderAutoHide` | Server + clientes | Banner, búsqueda, acceso a la cuenta (`AccountLink`) y `CartPill`. En ≤768 `HeaderAutoHide` colapsa la fila de búsqueda al bajar y la muestra al subir. |
| `Footer` | Server | Newsletter visible con el envío deshabilitado («Próximamente»), enlaces a rutas reales, franja de confianza. Sin datos de contacto. |
| `ProductCard`, `ProductImage` | Server/compartido | Foto sobre panel gris (`mix-blend-mode: multiply`) o placeholder; marca, nombre, precio, stock con pulso y `AddToCartButton`. `ProductImage` usa `preload` (no `priority`, deprecado en Next 16). |
| `ProductCardMedia` | Cliente | Carrusel de la tarjeta con varias fotos: scroll-snap, flechas (solo con mouse), puntos, recorrido con hover y agrandado sutil; sin movimiento con `prefers-reduced-motion`. |
| `ProductGallery`, `ProductLightbox` | Cliente | Track con swipe sincronizado con las miniaturas, contador en mobile y botón «Ampliar». Lightbox `<dialog>` con flechas, teclado, swipe, zoom 2,5x con paneo y foco de vuelta (`useSnapTrack`). |
| `ProductStickyBuy` | Cliente | Barra de compra fija en la ficha mobile cuando el bloque de compra queda arriba; define `--sticky-buy-h`. |
| `HeroVideo` | Cliente | Poster con `<picture>` (LCP) y fuentes webm/mp4 según el ancho; sin video con movimiento reducido o ahorro de datos; pausa fuera de pantalla y botón de pausa. |
| `GoogleReviews` | Cliente | Reseñas de Places con atribución, o «Visitanos en Quilmes» (ver §18). |
| `AdvisorLauncher` | Cliente | WhatsApp y asesor flotantes; en mobile, un solo botón que despliega los dos. Oculto en `/asesor` y `/checkout`. |
| `AccountProvider`, `AccountLink`, `FavoriteButton`, `AuthForm`, `Account*` | Cliente | Sesión global, menú de cuenta, favoritos y páginas de `/cuenta`. |
| `RichText` | Server | Párrafos, `## ` subtítulos y `- ` listas. Nunca HTML. |
| `CatalogView`, `CategoryIcon` | Cliente | Pestañas con ícono por categoría, chips, orden, filtros plegables (`<details>`), panel colapsable en mobile, paginación vía URL. |
| `PredictiveSearch` | Cliente | Búsqueda sin acentos, historial en localStorage, «¿Quisiste decir…?» por distancia de edición contra el vocabulario real. |
| `CartProvider`, `CartPanel`/`CartDialog`, `CartPill`, `AddToCartButton`, `ProductPurchase` | Cliente | Carrito global y drawer `<dialog>` accesible. |
| `CheckoutForm` | Cliente | Checkout real con `checkoutKey` en sessionStorage, resumen desplegable en mobile y franja de confianza. |
| `DemoPayment`, `MercadoPagoPayment`, `RefreshOrder` (`order-payment.tsx`) | Cliente | Simulador, Brick de Mercado Pago (SDK solo acá; recibe `accessToken`) y refresco cada 15 s mientras está pendiente. |
| `AdvisorChat` | Cliente | Texto libre, historial en memoria, sugerencias explicadas, reinicio y reintento. |
| Cinta de marcas (en `app/page.tsx`) | Server + CSS | Loop CSS con máscara, logos monocromos, links con conteo real, pausa al hover/foco y fila estática con movimiento reducido; sin control visible de pausa (solicitado 9/10). |
| `TrustStrip` | Server | Envíos, pago seguro, medios de pago, originales. |
| `Logo` | Server | Logo nuevo (8/10/2026): marca cuadrada con una «Q» cuya cola es una barra con disco + «QUILGYM» en Archivo 900 ancho (`next/font`). Color por `currentColor` (blanco sobre el video y en el footer). También es el favicon (`app/icon.svg`). Reemplaza el wordmark en Georgia. |
| `ComboShowcase`, `ComboVisual` | Server + componente visual compartido | Home, ficha y tarjetas: composición con fotos de productos incluidos, sin «+». Carrito, búsqueda y asesor usan la foto del primer componente mediante `lib/catalog.ts`. Precio y stock siguen siendo los del combo. |

Estilos: `app/globals.css` (tokens, base y estilos del prototipo) + una hoja por área en `app/styles/` (`home.css`, `catalog.css`, `product.css`, `checkout.css` y `account-advisor.css`, que tiene cuentas, asesor, flotantes y reseñas), importadas en `app/layout.tsx` después de `globals.css` para sobrescribirlo. Ojo: una regla sin media query en esas hojas pisa las media queries de `globals.css`; repetir el ajuste mobile en la hoja del área.

---

## 7. Base de datos (Neon)

Migraciones en `drizzle/` (`0000` catálogo, `0001` carrito y cupones, `0002` imágenes, `0003` órdenes, `0004_free_jack_power` cuentas/favoritos). Todas aplicadas. La última es aditiva: no reemplaza datos existentes.

| Tabla | Claves y notas |
| --- | --- |
| `brands` | `slug` único. 16 marcas. El seed borra las que quedan sin productos. |
| `categories` | `slug` único, `position`. 10 categorías. |
| `products` | `slug` único (= `siteSlug` del JSON), `status`, `is_featured`, `description` (formato de `RichText`). |
| `product_variants` | `sku` único (provisorio `QG-0001…`), `price_ars` entero, `stock` **nullable**: `null` = sin control de inventario, `0` = sin stock. Una variante default por producto. |
| `product_images` | `url`, `kind` (`product`/`nutrition`), `width`, `height`, `position`. |
| `carts`, `cart_items` | Carrito por cookie; `seen_price_ars` para avisar cambios de precio. |
| `coupons` | `code` único, `percent`/`fixed`, mínimo, vigencia, `max_redemptions`, `redemptions`. **No hay cupones cargados.** |
| `orders` | Snapshot de contacto, dirección (`jsonb`), retiro, datos bancarios y totales. `checkout_key` + `cart_id` únicos (idempotencia). `is_demo`, `consent_at`, `resources_released_at`. CHECK de totales y CHECK de efectivo solo con retiro. |
| `order_items` | Snapshot de SKU, nombre, slug, precio unitario, cantidad y `stock_reserved`. |
| `payments` | Una por orden; `provider_id` único, `preference_id`, `ticket_url`, `provider_updated_at`. |
| `shipments` | Una por orden; `label`, `estimate`, `status`, `tracking_code`. |
| `order_emails` | Outbox: `(order_id, event)` único, `attempts`, `sent_at`. |
| `users` | Nombre, email único, estado de verificación, consentimiento opcional de marketing (false por defecto). |
| `auth_accounts` | Credenciales con hash scrypt o proveedor Google; identidad única por proveedor. Tokens OAuth cifrados por Better Auth. |
| `auth_sessions`, `auth_verifications`, `auth_rate_limits` | Sesiones persistentes, flujo OAuth y límites de intentos compartidos entre instancias. |
| `favorites` | Par único usuario/producto; ambos FK. Persisten entre sesiones y dispositivos. |

`orders.user_id` ahora vincula pedidos creados mientras el usuario está conectado. Se autoriza por esa cuenta además de la cookie/link firmado. No se vinculan pedidos anteriores por email.

Stock: `createOrder` descuenta el stock de las variantes con `stock` numérico (no en demo) e incrementa `coupons.redemptions`. Rechazo o cancelación lo devuelven una sola vez (`resources_released_at`). Un reembolso no repone stock.

Datos fuente:
- `data/tiendanube-catalog.json`: 68 productos con `slug` de Tiendanube, **`siteSlug`** (slug fijo del sitio), nombre normalizado, marca, categoría, precio y disponibilidad (relevado el 3/10/2026). El seed y `images:fetch` usan `siteSlug`: renombrar un producto no cambia su URL, descripción ni imágenes.
- `data/product-content.json`: descripciones. `data/product-images.json`: imágenes (`images:build`).
- Destacados iniciales (sin datos de ventas): Proteína STAR 2 lb, Creatina STAR 300 g Clásica, Creatina GOLD 300 g, Mutant Mass 1,5 kg.

> ⚠️ `npm run db:seed` pisa nombre, precio, stock, descripción e imágenes. Para cambiar solo nombres usar `npm run db:sync-names`. No correr el seed en producción una vez que el negocio edite datos.

---

## 8. Funcionalidad implementada en detalle

### 8.1 Catálogo y búsqueda

- Filtros, facetas y paginación (12 por página) se resuelven en el servidor sobre el set activo cacheado.
- Orden "Más relevantes": en stock primero, después destacados, posición de categoría y nombre.
- `/productos?q=` también filtra por texto.
- Metadata y canonical por categoría; ficha con JSON-LD `Product` + `Offer` (sin `image` hasta tener la URL absoluta del sitio).

### 8.2 Carrito (Fase 2)

- Cookie `qg_cart` HttpOnly, SameSite=Lax, Secure en producción, 60 días; solo un ID opaco.
- `getCart()` recalcula con precio, stock y cupón actuales; ajusta cantidades, marca sin stock y cambios de precio. Los avisos de precio persisten hasta «Entendido» y bloquean el checkout.
- "Comprar ahora" va directo al checkout. `/checkout` redirige a `/carrito` si está vacío.

### 8.3 Imágenes y contenido

- **152 imágenes** en `public/assets/products/<slug>/NN.webp`, curadas en `data/product-gallery-curation.json` y procesadas por `scripts/build-product-images.mjs`.
- Descripciones editadas sin promesas terapéuticas. **Revisarlas con el negocio** (y con un profesional por ANMAT si quieren afirmar beneficios).
- Hero de la home: video `public/assets/hero/hero-1280.{mp4,webm}` (16:9) y `hero-720x1280.{mp4,webm}` (9:16) con sus posters webp, generados por `scripts/build-hero-video.mjs` (`npm run video:hero`). Es un **montaje estilo Creed de 9 cortes (13,33 s, 24 fps, 320 cuadros)** aprobado por el usuario el 7/10/2026 (commit `8a0910e`), que reemplazó al clip de Pexels 7690496 (no aprobado: toma sosa). Fuentes: 8 clips de **Mixkit** (Stock Video Free License, https://mixkit.co/license/#videoFree) y 1 de **Coverr** (Coverr License, https://coverr.co/license), ambas de uso comercial sin atribución obligatoria. La receta completa (título, página, URL de descarga, licencia y bytes de cada clip; inicio, duración, velocidad, zoom, recortes 16:9 y 9:16 y grade de cada corte; grade común, viñeta, grano, fundido final, CRF y cuadro del poster) está versionada en `scripts/hero-montage.json`. Los clips van en `.cache/hero-montaje/clips/` (gitignored) y el script los baja solo si faltan (la URL de `mixkit-4596` no se pudo verificar en la red; las otras 8 coinciden en bytes). Termina con fundido a negro y el loop vuelve en corte seco al boxeador del primer corte, que es también el poster (cuadro 2 en desktop, 12 en mobile). Pesos: `hero-1280` mp4 1,79 MB / webm 1,11 MB; `hero-720x1280` mp4 1,37 MB / webm 0,82 MB; posters 26 y 28 KB. **Sin audio** por decisión del usuario: la música se descartó por derechos y porque los navegadores bloquean el autoplay con sonido. En `home.css` el degradé es más fuerte en tablet (≤1100) y en mobile el chip tiene fondo oscuro y el video se ancla abajo (`object-position: 50% 100%`) para mantener el contraste AA sobre las caras.

### 8.4 Checkout y órdenes (Fase 3)

Flujo:
1. `/checkout` muestra los medios disponibles según `getCheckoutConfig()`.
2. «Calcular envío» / «Confirmar retiro y total» → `getCheckoutQuote` firma una cotización (HMAC con el cartId, 15 min) con fingerprint de líneas, descuento, envío y total.
3. `submitCheckout` → `validateCheckout` → `createOrder` en una transacción: bloquea carrito, variantes y cupón; revalida stock, precio, cupón y cotización; crea orden, ítems, pago y envío; reserva stock; encola el email; vacía el carrito. Reintentos con la misma `checkoutKey` devuelven la misma orden.
4. Redirección a `/checkout/confirmacion/[orderId]`.
5. Mercado Pago: el Brick llama a `preparePayment` (preferencia con idempotency key) y `payOrder` (lista permitida de campos). El webhook firmado concilia y transiciona; nunca se confía en el redirect.
6. Transferencia y efectivo quedan pendientes hasta que el negocio los confirme (hoy solo desde la base; falta el panel).

Garantías: el cliente no envía precios; efectivo solo con retiro (validación + CHECK en la base); idempotencia por `checkoutKey`; transiciones válidas (`pending → approved/rejected/cancelled`, `approved → refunded`); eventos viejos del proveedor se descartan.

Modo demo (`npm run dev`): pickup y envío simulados, todos los medios habilitados, pedidos `is_demo` que no descuentan stock, no consumen cupones ni envían emails; la confirmación muestra el simulador de estados. Los E2E lo usan.

Vencimiento: `expirePendingOrders` cancela pendientes de más de `PENDING_ORDER_TTL_HOURS` sin pago iniciado en Mercado Pago y libera stock y cupón. Corre por cron diario.

Link firmado: con `ORDER_ACCESS_SECRET`, el email incluye `Ver tu pedido: <sitio>/checkout/confirmacion/<id>?t=<token>` y las `back_urls` de Mercado Pago llevan el mismo token (la vuelta desde la app de MP puede abrir otro navegador sin la cookie).

**Riesgo conocido:** si un pago de Mercado Pago se aprueba después de que la orden se canceló (por ejemplo, por vencimiento), `canTransition` lo rechaza y queda cobrado sin pedido. Hay que detectarlo y resolverlo desde el panel de órdenes.

QA verificado (4/10/2026): `checkout:check` con y sin configuración, crons (401 sin header o con secreto incorrecto, 200 con Bearer, GET y POST), link firmado (200 con token válido, 404 sin token, alterado o de otro pedido), 6 E2E en verde, 36 tests unitarios.

Notas para quien siga:
- En `npm run dev` pueden aparecer avisos de hidratación con el atributo `data-trendtrack-react-active`: los inyecta una extensión del navegador (TrendTrack), no el código.
- El JSON-LD de la ficha escapa `<` con `"\\u003c"` (doble barra en el código). No cambiarlo a una sola barra: deja de escapar y abre la puerta a inyectar HTML. Un agente lo rompió en esta etapa y se restauró.
- Las fichas son SSG con caché de 5 min: después de `db:sync-names` o de editar datos, los cambios pueden tardar en verse hasta que revalide.

### 8.5 Puesta en marcha cuando lleguen los datos del negocio

1. Pedir al negocio y cargar en `.env.local` (y después en Vercel):
   - dirección y horario del local → `PICKUP_ADDRESS`, `PICKUP_HOURS`;
   - si aceptan efectivo al retirar → `CASH_PICKUP_ENABLED=true`;
   - tarifas de envío por código postal → `SHIPPING_RATES_JSON`, por ejemplo:
     `[{"id":"quilmes","label":"Envío Quilmes","postalCodes":["1878","1879"],"priceArs":3500,"estimate":"24 a 48 h hábiles"},{"id":"resto","label":"Envío nacional","postalCodes":["*"],"priceArs":7900,"estimate":"3 a 6 días hábiles"}]`;
   - CBU o alias, titular y CUIT → `TRANSFER_ACCOUNT`, `TRANSFER_HOLDER`, `TRANSFER_TAX_ID`;
   - credenciales **sandbox** de Mercado Pago → `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`;
   - cuenta de Resend con dominio verificado → `RESEND_API_KEY`, `EMAIL_FROM`.
2. Generar `CRON_SECRET` y `ORDER_ACCESS_SECRET` (`openssl rand -base64 32`).
3. `npm run checkout:check -- --strict` hasta que no haya errores.
4. Deploy de staging en Vercel con `NEXT_PUBLIC_SITE_URL` (https) y las mismas variables. Redeployar al cambiar `NEXT_PUBLIC_*`.
5. En el panel de Mercado Pago: configurar el webhook en `<sitio>/api/payments/mercadopago/webhook` (evento pagos), copiar la clave secreta en `MP_WEBHOOK_SECRET`.
6. Probar en sandbox: pago aprobado, rechazado y pendiente (Rapipago), transferencia y efectivo; verificar emails y el link del email en otro navegador.
7. Recién entonces pasar a credenciales de producción y hacer una compra real controlada.

**Probar el sandbox en local (8/10/2026):** `npm run dev` usa el simulador salvo que `.env.local` tenga `CHECKOUT_DEMO_MODE=false`; con el simulador el pedido queda `is_demo` y nunca se llama a Mercado Pago (fue la causa de «no me redirige»). Sin demo hace falta además una entrega configurada; si no, el checkout cae en «Pedir por WhatsApp». En `.env.local` hay un bloque marcado «Prueba sandbox» con `PICKUP_ADDRESS`/`PICKUP_HOURS` de prueba y `CASH_PICKUP_ENABLED=false`: **no copiarlo a Vercel**. Las credenciales de `.env.local` son de un vendedor de prueba (`test_user`); para pagar se entra a MP con el comprador de prueba que da el negocio (no guardarlo en archivos). Con `NEXT_PUBLIC_SITE_URL` apuntando al Preview, la vuelta y el webhook van al Preview (que responde 401 por Vercel Authentication), así que el pedido local queda pendiente aunque el pago se apruebe. Verificado: la preferencia se crea bien y `init_point` responde 302 con un navegador normal; Chromium headless recibe 403 del antibots de Mercado Libre.

---

## 9. Estado visual y brecha con `design-reference/`

El pulido de severidad alta y media está hecho (commit `579727f`, revisión con capturas 1440 y 390 contra cada referencia).

| Referencia | Ruta |
| --- | --- |
| `01-home.png` | `/` |
| `02-catalogo.png` | `/productos` y tarjetas |
| `03.1` a `03.4-busqueda.png` | `/buscar` (inicial, resultados, sin resultados) |
| `04-comparador.png` | `/comparar` |
| `05-producto.png` | `/productos/[slug]` |
| `06-asesor.png` | `/asesor` |
| `07-carrito.png` | `/carrito` |
| `08-checkout.png` | `/checkout` |
| `09-confirmacion.png` | `/checkout/confirmacion/[orderId]` |
| `10-recomendaciones.png` | `/asesor/recomendaciones` |

Diferencias que quedan **a propósito** (no hay datos reales):
- Tarjetas sin rating, badges (−10%, NUEVO, MÁS VENDIDO), precio tachado, cuotas ni «envío gratis».
- Catálogo sin filtros de objetivo, sabor, presentación, ofertas y preferencias (faltan esos atributos en la base).
- Ficha sin FAQ, reseñas ni video; la calculadora de envío está habilitada según la configuración de Preview. El selector de variantes requiere confirmar qué opciones reales vende el negocio.
- Comparador sin filas de presentación, porciones, nutrición, rating ni pago.
- Carrito sin barra de envío gratis ni «ahorro».
- Home: «Cómo comprar» reemplaza los artículos («Guías por categoría» se quitó en `cd1eebc`). Las reseñas solo aparecen si Places está configurado; si no, la sección es «Visitanos en Quilmes». Sin sección de comunidad (no hay handle confirmado).

Desviaciones **pedidas por el usuario** (6–7/10/2026):
- Hero a una columna sobre un video de entrenamiento, con degradé, CTA blanco «Ver productos» y outline «Comprar por objetivo», en lugar de la composición de `01-home.png`. Desde `8a0910e` el video es el montaje de 9 cortes de Mixkit/Coverr (§8.3); el clip de Pexels 7690496 y la alternativa mobile Pexels 36072020 (logos de gimnasio) quedaron descartados. El chip «ORIGINALES · ENTREGA RÁPIDA» se quitó el 9/10/2026. A 1440 el video ocupa todo el ancho y en algunos cortes la persona puede quedar detrás del texto: viene de los recortes aprobados.
- Marcas en una cinta animada de logos (solo las 6 que tienen logo) **dentro del hero, abajo del video** (`#marcas`, desde el 8/10/2026; ya no hay sección «Marcas disponibles»): logos blancos al 50 % que pasan a blanco pleno con hover o foco; el control visible de pausa se quitó el 9/10/2026 a pedido del usuario y la fila queda estática con movimiento reducido. Gold Nutrition y One Fit se ven toscos en blanco: faltan SVG monocromos oficiales.
- En la home el header se superpone al video sin ocupar alto (se corrigió una línea blanca de 1 px arriba y el divisor claro bajo el header en mobile).
- Tarjetas con carrusel de fotos (flechas y puntos), recorrido automático con hover y agrandado sutil; galería de la ficha con swipe y lightbox.
- Mobile: un solo botón flotante (WhatsApp + asesor), barra de compra fija en la ficha y header que se colapsa al bajar.
- Comparador en tarjetas apiladas en mobile; catálogo con resultados y orden en la barra de pestañas.

Notas de QA de las etapas 2 a 4 (verificadores):
- La home mobile transfiere ~1,3 MB con el video (webm del montaje de 0,82 MB; antes ~0,79 MB con el clip de Pexels). El poster es el primer candidato a LCP (48 ms); después Chrome toma el video como LCP porque ocupa la misma área.
- Con movimiento reducido no se pide ningún video, no aparece el botón de pausa y la cinta queda estática.
- `useSnapTrack` del lightbox se corrigió para navegación rápida y para swipes antes de la hidratación.
- `ffmpeg-static` es devDependency y su instalación descarga el binario desde GitHub: en un build de Vercel sin caché suma tiempo y, si la descarga falla, falla `npm install`. Si molesta, sacarlo del install de Vercel (por ejemplo, como `optionalDependencies`) o generar el video solo en local.

Pendientes visuales de severidad baja:
- El wordmark usa el componente de logo QuilGym, pero no se recibió el archivo vectorial oficial del negocio para validar que sea la marca final.
- Revisar el encuadre de fotos de combos cuando el negocio entregue las fotos definitivas; los componentes actuales se componen con fotos existentes.
- Checkout: CTA con importe y drawer de 480 px/divisor a sangre ya implementados. Falta revisar visualmente el checkbox y los avisos/badges menores en una pasada dedicada.

### Tokens visuales vigentes (`app/globals.css`)

```css
--ink: #1d2022; --muted: #656c71; --line: #d6dadd; --soft: #f1f2f0; --paper: #ffffff;
--radius-sm: 10px; --radius-md: 16px; --radius-lg: 24px;
--shadow: 0 12px 28px rgba(31, 35, 37, .08); --container: 1296px;
```

- Contenedor de 1296 px; gutter de 24 px (16 px por debajo de 768). Breakpoints: 1100, 768 y 520.
- Base tipográfica: `h1–h3` 800 (h3 700) con `letter-spacing: -.02em`; botones 600.

---

## 10. Pendientes y dudas abiertas con el negocio

**Para confirmar antes de Production (bloquean el lanzamiento):**
- [x] Datos de Preview recibidos del usuario: retiro en San Martín 492, piso 7 C, B1878 Quilmes; lunes a viernes de 7 a 17; efectivo permitido al retirar.
- [x] Configuración provisional de Preview recibida: $4.500 ARS de envío para cualquier código postal; estimación de 3–5 días hábiles. Confirmar con el negocio antes de Production.
- [ ] CBU o alias, titular y CUIT para transferencias.
- [x] El usuario tiene credenciales de prueba de Mercado Pago localmente. [ ] Verificar/configurar variables TEST en Vercel Preview (incluida una base Neon aislada); nunca copiarlas a Production. [ ] La aplicación y credenciales productivas deben pertenecer al titular del negocio antes de habilitar cobros reales.
- [ ] Dominio y cuenta de email para Resend.
- [ ] Stock real por producto (hoy disponible = `null`, agotado = `0`).
- [ ] Envío gratis (y desde qué monto), cuotas sin interés y descuento por transferencia.
- [ ] Cupones vigentes.
- [ ] Datos reales de contacto, redes (handle de Instagram) y logo oficial.
- [ ] Revisar las 68 descripciones.
- [ ] Logos de las marcas que faltan (no aparecen en la cinta): Mervick, Granger, Bravas, GrowsBar, Gentech, Natural Nutrition, Landerfit, Just Plant, Painlabs y Got. También los SVG oficiales de Body Advance, ENA y One Fit (los PNG actuales son de baja calidad).
- [ ] Segunda foto de Proteína STAR 2 lb (`public/assets/products/proteina-star-2lb/02.webp`): parece el dorso de un «Platinum Whey Protein», no del producto. Confirmar o reemplazar en la curaduría.
- [ ] **Ficha de Google Business**, a corregir por el dueño: tiene dos direcciones mezcladas, figura «Abierto las 24 horas» y la web apunta a Tiendanube. El mapa y el CTA de la home llevan a esa ficha.

**Desarrollo:**
- [ ] **Panel mínimo de órdenes**: confirmar transferencias y efectivo, cargar tracking, cancelar, y detectar pagos aprobados sobre órdenes canceladas. Es necesario antes de habilitar transferencia o efectivo.
- [ ] Suscripción real al newsletter (hoy deshabilitado).
- [x] Límites compartidos por carrito/pedido para cupones (12/min), cotización (30/min), `submitCheckout` (10/10 min), preparación MP (12/10 min) y envío del Brick (`payOrder`, 10/10 min), usando `auth_rate_limits`; falla cerrado si Postgres no responde.
- [x] Rate limit para solicitudes de webhook con firma inválida: solo en Vercel usa `x-forwarded-for` sobrescrito por el edge, transforma la IP en HMAC y limita 20 intentos/minuto. En local no confía en headers de IP; notificaciones con firma válida no se limitan.
- [x] Cron diario para borrar carritos inactivos por 60 días (vida de la cookie), solo si no tienen ninguna orden asociada. Borra carritos en lotes de 50 y limpia contadores del carrito; además purga contadores de rate limit cuya ventana venció hace más de 48 h, en lotes de 500 (máximo 20 por ejecución), con `SKIP LOCKED` y revalidación del timestamp al borrar. `/api/internal/expire-carts` exige `CRON_SECRET`.
- [ ] E2E del link firmado (`?t=`) y del vencimiento de pedidos (hoy cubiertos por tests unitarios y QA manual).
- [x] `npm audit` (8/10 y repetido el 9/10/2026): 0 vulnerabilidades con el lockfile actual. Los overrides de esbuild y `fast-glob` → `tinyglobby` se explican arriba; al actualizar `eslint-config-next`, verificar que el plugin siga importando solo `globSync`. No correr `npm audit fix --force` (baja `eslint-config-next` a 14 y `drizzle-kit` a 0.18).
- [ ] Consolidar CSS: `globals.css` conserva reglas del prototipo que las hojas de `app/styles/` sobrescriben; limpiar las que quedaron muertas.
- [ ] **Reseñas de Google: cargar `GOOGLE_MAPS_API_KEY` y `GOOGLE_PLACE_ID`** (el código está listo, §18):
  1. En Google Cloud (proyecto del negocio, con facturación), habilitar **Places API (New)**.
  2. Crear una API key restringida a Places API (New). Es solo de servidor: restringirla por API, no por referer, y nunca usar `NEXT_PUBLIC_`.
  3. En las cuotas de Places API (New), poner un **tope diario** de pedidos de Place Details (por ejemplo, 300 por día). Cada visita que llega a la sección hace un pedido.
  4. En Facturación → Presupuestos y alertas, crear un **presupuesto con alertas** al 50, 90 y 100 %. Place Details con reseñas cuesta alrededor de US$25 cada 1000 pedidos después de las 1000 gratis por mes (verificar los precios vigentes).
  5. Obtener el Place ID de la ficha (Place ID Finder de Google) y cargar las dos variables en Vercel (Production) y, si hace falta, en `.env.local`. Redeployar.
  6. Verificar `GET /api/reviews` (200 con `source: "google"`) y la home en 1440 y 390. Si vuelve sin reseñas, buscar el `console.warn` `[reseñas]` en los logs de Vercel.
- [x] Rate limit de `/api/reviews`: contador diario compartido en `auth_rate_limits` (máximo 300/día), responde 429 al agotarse y falla cerrado si Postgres no responde. Mantener además el tope de cuota diario del proveedor al configurar Places.
- [x] Búsqueda (`/buscar`): el servidor entrega productos en el orden de relevancia del catálogo (en stock, destacados, categoría), y el filtro de texto conserva ese orden entre productos con igual disponibilidad.
- [x] Ficha en desktop: al retirar el panel nutricional duplicado se eliminó también la grilla de dos columnas que dejaba un espacio vacío; E2E verifica localmente que la descripción ocupa al menos el 85 % del ancho de la sección.

**Contenido:**
- [ ] Rótulos faltantes: combos, shakers, barras Mervick y Brava, Omega 3 Landerfit, Beast Blood, Body Advance 3 kg, citrato Body Advance, óxido nítrico y colágeno ENA.
- [ ] Mejor foto de Beast Blood (196 px).
- [ ] Transcribir los rótulos a texto, por accesibilidad.

**Seguridad y operación:**
- [ ] Rotar la contraseña de Neon y actualizar los entornos. La clave fue expuesta en una conversación; requiere coordinación del titular y prueba de conexión, y no se debe incluir el secreto nuevo en el repo ni en el chat.
- [x] Deploy en Vercel: producción en `https://quilgym.vercel.app` (§17) y Preview de `mp-sandbox` (§22.1). [ ] Falta base de Neon aislada y variables de prueba confirmadas en Preview; Preview no debe considerarse staging operativo hasta probar webhook.
- [ ] Cortes y lentitud intermitentes de Neon (los E2E de cuenta y checkout fallan de a ratos): revisar plan, región y arranque en frío antes del lanzamiento. Aislar la base de Preview antes de correr E2E que crean pedidos o cuentas.

---

## 11. Plan restante

Orden recomendado:

1. **Datos del negocio** (§10) y configuración según §8.5.
2. **Staging en Vercel** con Neon, `NEXT_PUBLIC_SITE_URL`, crons y secretos.
3. **Sandbox de Mercado Pago** de punta a punta (aprobado, rechazado, pendiente) y emails.
4. **Panel mínimo de órdenes** (adelantado de la Fase 4) para operar transferencias, efectivo y tracking.
5. **Pendientes visuales de severidad baja** (§9) y logo.
6. **Fase 4 — Comparador, asesor, panel y cuenta**:
   - comparador seleccionable (hasta 3, en la URL);
   - asesor con reglas versionadas, filtros por presupuesto y stock y razones basadas en atributos reales: **implementado en esta etapa**, ampliar solo con atributos verificables;
   - panel de administración completo (productos, precios, stock, imágenes, cupones) para que el seed deje de ser la fuente;
   - cuenta y favoritos: **implementados**, pedidos nuevos asociados; direcciones guardadas y sincronización de carrito entre dispositivos pendientes.

---

## 12. Etapa actual: asesor, cuentas, favoritos, acceso flotante y offcanvas

### Contexto y alcance autorizado

El usuario pidió una conversación útil y explicada en el asesor, acceso flotante con robot gris conservando el banner existente, opiniones reales de Maps y ubicación clicable, login/registro con Google, favoritos y animación del carrito. Las compras permanecen en modo demo. No hacer commits ni push: el usuario revisa y commitea. No se modificaron `design-reference/` ni los recursos existentes de `public/`.

El error inicial de `lucide-react` era una instalación local desactualizada: se corrigió con `npm ci`. El repositorio actual está en `/Users/lorenzo.poggi/Documents/GitHub/QuilGym`. Durante la revisión aparecieron duplicados generados (`routes.d 2.ts`, etc.) en `.next`; se conservó el caché anterior en `/private/tmp/quilgym-next-cache.i8HKFu` y se regeneró. Las copias reaparecieron en el último build; `tsconfig.json` excluye `.next/**/* *.ts`, solo nombres duplicados con espacios del caché generado. Las definiciones originales y el código fuente siguen chequeándose. No se atribuyó el origen a una aplicación concreta sin evidencia ni se excluyeron errores de la aplicación.

### Asesor

- `lib/advisor.ts`: contratos, catálogo de preguntas, validación por lista permitida y motor determinista `2026-10-v1`.
- Pregunta edad y necesidad de consulta sin pedir detalles médicos; en esos casos deriva a orientación personal y termina sin recomendar suplementos.
- Releva si entrenó, tiempo entrenando, objetivo, tipo/frecuencia de rutina, practicidad de comidas con proteína, restricciones y presupuesto por producto.
- Proteína se considera por practicidad cuando la persona refiere dificultades; creatina se considera en objetivos de fuerza/masa con rutina de fuerza/mixta. Empezar sin rutina prioriza hábitos y accesorios opcionales. No propone quemadores ni estimulantes para bajar grasa o resolver cansancio.
- Filtra catálogo activo por stock/precio. Hasta tres alternativas; primero una por categoría pertinente y después alternativas económicas. No fuerza tres ni obliga a subir presupuesto.
- No conoce aptitud vegana/sin TACC/alérgenos de todo el catálogo: ante restricciones no etiqueta productos como aptos.
- `components/advisor-wizard.tsx`: contexto por pregunta, respuestas anteriores, progreso, navegación y reinicio. Edad/salud no se ponen en URL ni se guardan en una cuenta.
- `/asesor/recomendaciones`: valida los parámetros permitidos, resuelve catálogo actual en servidor, muestra motivos y aspectos a verificar por producto. Sin perfil muestra CTA al asesor; ya no hay selección fija de ejemplo.
- Fuentes consultadas: ISSN creatina (https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0173-z) y proteína/ejercicio (https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8). No se dan dosis personales ni promesas de resultados. Revisar los criterios con un profesional antes del lanzamiento.
- `AdvisorLauncher`: botón gris con Bot, bienvenida desplegable, enlace a `/asesor`, Escape y cierre exterior. Se oculta en asesor y checkout para evitar solapamientos; conserva el banner gris de home. No es un chat generativo ni recibe texto libre.

### Cuentas y favoritos

- Better Auth instalado; integración Drizzle en `lib/auth.ts`, cliente reactivo en `lib/auth-client.ts`, endpoints `/api/auth/[...all]`.
- Email/contraseña opera en desarrollo. Contraseña mínimo 10/máximo 128; hash scrypt de la biblioteca. Sesión DB de 30 días con renovación diaria, cookie HttpOnly, Secure en producción. Cookie cache desactivado: autorización revocable consultando DB.
- Registro/inicio/cierre de sesión con UI gris y tokens existentes. Errores de login genéricos, retorno interno saneado (`safeAccountReturn`), cuenta y favoritos protegidos en servidor.
- Rate limiting de Better Auth en base: 8 intentos de login/minuto y 5 registros/minuto. Confirmar detección de IP/proxy al desplegar; no asumir que reemplaza la revisión operativa de seguridad.
- Google implementado como proveedor, con botón deshabilitado hasta tener credenciales. Vinculación automática de cuentas por email deshabilitada para evitar unir identidades sin validación.
- Variables nuevas: `BETTER_AUTH_SECRET` (32+ caracteres aleatorios), `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. En desarrollo local hay secreto exclusivo de desarrollo; jamás se usa en producción ni se permite habilitar Google con él. Producción sin secreto/URL HTTPS devuelve servicio no configurado.
- Callback Google Cloud: `http://localhost:3000/api/auth/callback/google`; registrar luego `<dominio-https>/api/auth/callback/google`. OAuth no probado con Google real porque no hay credenciales.
- `AccountProvider`: una sesión global, favoritos desde endpoint privado sin caché; separa los IDs por propietario. `FavoriteButton`: estrella en tarjetas/ficha, estado guardado y errores. Invitado va a ingresar conservando destino; no hace favoritos falsos locales.
- `setFavorite` autentica internamente, valida producto activo y usa insertar idempotente o borrar por usuario/producto. No acepta userId del navegador. Cuenta muestra precios y disponibilidad actuales.
- `setMarketingConsent`: consentimiento opcional guardado, false inicial, modificable. No se envían newsletters/campañas todavía.
- `createOrder` recibe userId desde la sesión del servidor, nunca de `CheckoutInput`. La cuenta muestra pedidos nuevos propios; no reclama antiguos por coincidencia de email. El carrito sigue siendo por navegador.
- Privacidad después de logout: si el pedido tiene userId, la cookie del carrito sola no lo autoriza. Hace falta la cuenta propietaria o el link firmado válido; los invitados conservan su flujo anterior. El simulador local acepta la cuenta propietaria aun sin cookie del carrito.

### Reseñas y mapa: integración preparada, contenido pendiente

- Ficha exacta confirmada: https://www.google.com/maps?cid=1791416799115149607; coordenadas del enlace del usuario (-34.7212393, -58.2603596).
- Maps público entrega una «vista limitada». Al pedir «Ver más», exige acceder para leer/buscar opiniones. No se obtuvieron textos ni autores y no se copiaron reseñas ficticias.
- `GoogleReviews` se agregó a home, con mapa Google lazy y clic en tarjeta que abre la ficha original. Sin datos muestra enlace a todas las opiniones; no publica puntuación inventada ni llama «compra verificada» a una opinión de Maps.
- `lib/google-reviews.ts` y `/api/reviews`: adaptador oficial Places New, solo servidor, timeout, validación de autor/rating y enlaces permitidos, sin caché ni almacenamiento de contenido. Variables pendientes `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACE_ID`.
- Cuando esté configurado: rating/recuento reales y carrusel de opiniones con autor, fecha, texto completo, enlace a original y traducción original si existe. Controles anterior/siguiente/pausa, pausa con hover/foco y pestaña oculta, respeta movimiento reducido.
- **Places devuelve hasta cinco reseñas**. Para todas hace falta acceso autorizado al Perfil de Empresa y otra integración. El usuario hoy solo dispone del enlace público. No anunciar esta parte como completa ni prometer que una API key trae todas.
- Referencia: https://developers.google.com/maps/documentation/places/web-service/policies (atribución y restricciones de caché).

### Carrito y verificación

`CartDialog` mantiene el diálogo modal nativo montado durante la salida. Entrada desde la derecha y fondo gradual; salida antes de cerrar tras 260 ms. Escape se intercepta para animar el cierre, conserva foco/restauración, clic exterior y bloqueo de scroll. Con movimiento reducido se cierra inmediatamente. CSS compartido nuevo en `app/styles/account-advisor.css`.

Pruebas nuevas: reglas/seguridad del asesor y destinos de cuenta; navegador en 1440 y 390 para registro, sesión, favoritos, privacidad, pedido propio, logout/login, motivos del asesor, menores, botón flotante, mapa, carrusel y offcanvas. Datos simulados de reseñas existen **solo en la interceptación del test**, nunca en el sitio. Los E2E crean clientes QA `@example.com` y pedidos demo sin stock/emails/cobros; no usarlos como métricas del negocio.

Pendientes antes de producción: configurar y probar Google OAuth, verificación de email y recuperación de contraseña con correo real, fuente autorizada de reseñas (y Google Places si se elige), privacidad/consentimientos del negocio, revisar reglas con profesional, limpieza de QA cuando corresponda, y los pendientes previos de panel/comparador/pagos/staging. No se habilitaron cobros ni se agregaron tarifas o cuentas bancarias.

QA de esta etapa: lint y TypeScript sin errores ni advertencias; 50 tests unitarios, incluidas cuatro comprobaciones de privacidad de pedidos de cuenta. Build compilado con cuenta dinámica. Verificación del servidor de producción sin configuración: home 200, cuenta redirige a ingresar, auth 503 controlado, reseñas 200 sin datos. Regresión de navegador: 14 escenarios en 1440 y 390, incluyendo simulación de pedido desde cuenta sin cookie de carrito. El desbordamiento detectado era una leyenda invisible de filtros fuera de su contenedor, corregido en `app/styles/catalog.css`.
7. **Fase 5 — Lanzamiento**:
   - legales Argentina (razón social y CUIT, términos, privacidad, cambios y devoluciones, botón de arrepentimiento, precios finales y costo financiero, advertencias ANMAT, consentimiento de marketing y cookies);
   - accesibilidad WCAG 2.2 AA;
   - seguridad: headers (CSP compatible con el SDK de Mercado Pago, HSTS, `frame-ancestors`), rate limits, logs sin PII, auditoría de dependencias, backups;
   - SEO: sitemap, robots, Open Graph, `image` en el JSON-LD;
   - Core Web Vitals;
   - E2E contra el sandbox real de Mercado Pago y regresión visual en 390, 768, 1024 y 1440;
   - staging, monitoreo, alertas de pagos y webhooks, rollback y una compra real controlada.

### Definition of Done de producción

No considerar QuilGym productivo hasta que:
- el catálogo sea administrable sin el seed;
- precios, stock, descuentos y envío se calculen en el servidor (hecho);
- las órdenes persistan y los pagos tengan tokenización, idempotencia y webhooks (hecho en código; falta probar en sandbox);
- la confirmación refleje una orden real (hecho);
- funcionen los emails y el tracking;
- exista un panel para operar órdenes;
- los legales estén publicados;
- el recorrido sea accesible por teclado y lector de pantalla;
- E2E cubra los estados de pago contra el sandbox;
- estén revisados los secretos, headers y rate limits;
- existan staging, monitoreo y backups;
- no quede ningún dato ficticio.

## 13. Asesor conversacional con LLM — 5/10/2026

### Motivo del cambio

El usuario probó el cuestionario de diez opciones, lo sintió genérico y pidió escritura libre: que una IA interprete su rutina, haga preguntas particulares y explique qué productos podrían encajar. Se conserva la paleta gris y el acceso flotante. No hay pregunta obligatoria de edad ni multiple choice. No se garantiza una compra en todos los casos: sería inseguro recomendar suplementos ante riesgos o inventar productos sin stock.

### Implementación

- Se eliminó `components/advisor-wizard.tsx`, reemplazado por `components/advisor-chat.tsx`. Bienvenida: «¡Hola! Soy tu asesor fitness virtual. Contame, ¿cuál es tu principal objetivo hoy y qué te motivó a empezar?». Chat con burbujas, textarea, Enter/Shift+Enter, espera, reintento sin duplicar mensajes, cancelación al salir/reiniciar, tarjetas reutilizadas con favoritos/carrito y motivos por producto. Sin persistencia localStorage/DB ni vinculación a cuenta.
- `/asesor` es dinámico para mostrar configuración actual sin redeploy; pasa únicamente un booleano al cliente. Sin clave muestra una nota y no presenta respuestas simuladas. `/asesor/recomendaciones` ahora redirige al chat, incluso para enlaces viejos; no aplica el cuestionario. `lib/advisor.ts` y sus tests quedan como reglas históricas sin uso en el recorrido actual.
- Dependencia nueva `ai` (AI SDK 7). `lib/advisor-chat.ts` usa `createGateway`, `generateText` y `Output.object` con JSON Schema y validador propio. No es clasificación por palabras clave ni un guion fijo. Historial completo y catálogo en cada solicitud; respuesta estructurada con texto, indicador de derivación y hasta tres IDs/motivos/precauciones.
- Prompt: español rioplatense, estilo entrenador virtual sin fingir matrícula; retoma detalles, no repite preguntas contestadas, una pregunta concreta por turno, sin exigir responder diez pasos. Puede sugerir desde el primer mensaje si hay contexto. Prioriza entrenamiento/alimentación/descanso, sin dosis personalizadas, diagnósticos, curas, resultados garantizados o venta obligatoria. No recomienda quemadores/estimulantes como solución a adelgazar/fatiga. Ante restricciones no inventa certificaciones ni alérgenos. Si el cliente menciona espontáneamente minoría de edad, embarazo, medicación, enfermedad o alergias relevantes, debe derivar sin suplementos. Las instrucciones del modelo no garantizan por sí mismas seguridad clínica: revisar con profesional y probar adversarialmente antes de lanzar.
- `lib/advisor-chat-types.ts`: mensajes alternados sin roles system/tool; hasta 21 entradas enviadas (11 intervenciones de cliente) y 1.800 caracteres por mensaje de cliente. Salida con longitudes/IDs/tipos validados; resuelve recomendaciones contra catálogo activo disponible, elimina duplicados e IDs inventados. Nombres/precios/slugs/imágenes de las tarjetas provienen del servidor, nunca del LLM. Si `needsProfessional=true`, descarta tarjetas aunque el modelo haya incluido IDs.
- `app/api/advisor/route.ts`: POST solo mismo origen/JSON, cuerpo efectivo limitado a 48 KB, sin caché. 503 sin clave, 400/413 para datos inválidos, 429 para límites y 502 genérico si falla el proveedor. No imprime historial, respuestas de error del proveedor ni claves. Timeout 45 s, maxDuration 60 s, máximo 2.400 tokens de salida y sin retries automáticos.
- `lib/advisor-rate-limit.ts`: cookie HttpOnly SameSite=Strict firmada con HMAC (clave privada de IA), identificador opaco, no IP ni PII. Upsert atómico en `auth_rate_limits`, prefijo `advisor:`: 8 solicitudes por visitante/minuto, 30 globales/minuto y 200 globales/día. Los límites globales siguen aplicándose si borra cookies. No migración ni seed. El cron de limpieza elimina contadores inactivos por más de 48 h; anti-bots en despliegue y presupuesto en proveedor siguen necesarios.
- CSS agregado en `account-advisor.css` con tokens vigentes, responsive y movimiento reducido. No se modificó design-reference ni public.

### Configuración que debe hacer el usuario

El usuario preguntó cómo obtener una API key; no dispone de una confirmada. Se explicó Vercel AI Gateway → API Keys → Create key. Guardar `AI_GATEWAY_API_KEY` en `.env.local` (nunca en chat ni con NEXT_PUBLIC_), definir límite de gasto en Vercel y reiniciar dev. `ADVISOR_MODEL` opcional; default `google/gemini-3.8-flash`, confirmado consultando https://ai-gateway.vercel.sh/v1/models el 5/10/2026. Cambiarlo si el negocio elige otro modelo disponible. `.env.example` y README contienen pasos; no se editó `.env.local` ni se generó clave.

La conversación se envía al proveedor externo; QuilGym no la persiste. No prometer que el proveedor no retiene datos: revisar sus términos, privacidad y consentimiento del negocio antes del lanzamiento. La UI informa el envío externo antes del primer mensaje. No configurar cobros reales ni hacer commits.

### Verificación y límites del trabajo

Pruebas del contrato, catálogo, integración simulada, endpoint/origen/tamaño/configuración/errores y rate limiting concurrente en PGlite (base aislada). E2E del chat con respuestas interceptadas únicamente en QA: texto libre, preservación de contexto, reintento, tarjetas y reinicio, en 1440 y 390. El test no configura una clave real ni cobra tokens. Sin clave la UI permite escribir y conserva el intento, pero el servidor responde 503 explicado, nunca una respuesta falsa. La prueba conversacional REAL del proveedor queda pendiente hasta tener clave; no anunciar que se validó calidad del modelo ni seguridad nutricional por tests de respuestas simuladas.

Resultado final: **69 unitarios y 16 E2E completos aprobados**, lint y TypeScript sin errores, build de producción aprobado sin clave de IA. QA visual de bienvenida y conversación en 1440/390, sin desbordamiento horizontal ni errores JavaScript del chat. Alias `@` agregado a Vitest para probar Route Handlers. La regresión creó nuevas cuentas QA `@example.com` y pedidos demo en la base compartida; no consumió stock, cobros ni emails reales. `.env.local` sigue ignorado y sin modificar; ningún commit/push. Servidor de desarrollo existente en localhost:3000 permanece disponible.

## 14. Cambio a Gemini directo (Google AI Studio) — 5/10/2026

El usuario obtuvo una clave en Google AI Studio y la colocó en `AI_GATEWAY_API_KEY`. Su nombre descriptivo «FITNESS-CONSULTANT-API» no afecta el código. La integración anterior intentaba autenticar con esa clave en Vercel; el usuario autorizó adaptarla a Google directamente, sin commits.

- Instalado `@ai-sdk/google`, proveedor `createGoogle` en `lib/advisor-chat.ts`. Ya no se consulta Vercel AI Gateway. El modelo inicial `gemini-3.8-flash` estaba listado pero devolvía 503 en la API pública. El default vigente es `gemini-3.5-flash-lite`: nivel gratuito según la documentación oficial y respuesta mínima 200 verificada por API el 5/10/2026.
- Nuevo `lib/advisor-config.ts`: variable canónica `GOOGLE_GENERATIVE_AI_API_KEY`; alias temporal `AI_GATEWAY_API_KEY` SOLO como clave Google, para preservar el archivo privado sin copiar ni revelar el secreto. La variable canónica prevalece. Normaliza el prefijo legado `google/` de ADVISOR_MODEL. `advisorConfigured` y la firma del identificador de rate limiting usan la misma función de resolución de clave.
- No se modificó `.env.local` ni DATABASE_URL. El usuario puede renombrar la variable conservando su valor, no necesita otra clave. Se mantienen ignorados los secretos.
- Mensajes específicos del endpoint: autorización (401/403), cuota Google (429), modelo (404), configuración (400) e indisponibilidad temporal (503). No copiar textos/URLs/cuerpos privados del proveedor en respuestas públicas o logs. Diseño, catálogo, reglas de seguridad, historial y límites no cambiaron.
- `.env.example` y README ahora explican Google AI Studio, cuotas/facturación y compatibilidad temporal; la sección 13 documenta la integración anterior como historial, esta sección define el estado actual.

### Verificación real y condición externa pendiente

La consulta autenticada `GET /v1beta/models` devolvió **200**: la clave es válida. La generación real con mensaje ficticio devolvió **503 por alta demanda** tanto en `gemini-3.8-flash` como en `gemini-3.1-flash-lite`; un intento con `gemini-2.5-flash` devolvió 404. El usuario confirmó que el Playground sí respondía: una llamada REST mínima demostró que 3.8 seguía en 503 fuera del Playground, descartando como causa el catálogo, esquema o prompt de QuilGym. `gemini-3.5-flash-lite` respondió **200** por la API pública y se adoptó como default. No activar facturación ni crear claves nuevas para esto. Falta evaluar la calidad conversacional con casos reales antes de producción.

No se hicieron retries automáticos ni se guardó una conversación real en la cuenta. Las pruebas usan mensajes ficticios; los E2E interceptan el proveedor únicamente en QA para no consumir cuota. Tests adicionales cubren selección de clave/modelo y categorías de error. Resultado: **81 unitarios aprobados, 4 E2E del chat aprobados (desktop/mobile), lint y TypeScript aprobados, build de producción aprobado** con proveedor Google. No se repitió toda la regresión de checkout en esta adaptación: los 16 E2E completos anteriores estaban aprobados y no se cambiaron cuentas/pagos/carrito.

## 15. Ajustes de tienda, home y marcas — 5–6/10/2026

El dueño aprobó la base de la web y pidió cambios concretos antes de avanzar con el panel administrador y el hero video. Se entregaron en `cd1eebc` («Mejora la página principal y los elementos de compra»). No se modificó `design-reference/`; los logos servidos están en `public/assets/brands/`.

### WhatsApp, carrito y disponibilidad

- En `components/advisor-launcher.tsx` hay un botón flotante de WhatsApp encima del botón gris del asesor. Abre `https://wa.me/5491126683308` en otra pestaña, con el texto precargado **«Buenas! quiero tener mas informacion acerca de la compra de suplementos.»**. No envía el mensaje automáticamente; la persona debe confirmarlo en WhatsApp. Se volvió al estilo de ícono anterior después de descartar una variante blanca que no gustó. El acceso se oculta en `/asesor` y `/checkout`, igual que el launcher, para no solaparse.
- Se aumentó el espacio del importe y badge del carrito en el header para que el precio no quede pegado al borde derecho. Las tarjetas muestran el estado «En stock» en verde, en vez de gris.
- La franja de beneficios («Envíos nacionales», «Pago seguro», medios de pago, originales y asesoramiento) permanece en escritorio y se oculta en mobile mediante `app/styles/home.css`. «Guías por categoría» se eliminó de home en ambos tamaños.

### Destacados y marcas

- Desktop usa `getFeaturedProducts(12)`: tres filas de cuatro productos en el grid de escritorio. Mobile usa una selección separada de seis productos en tres filas de dos: dos proteínas, dos creatinas, un shaker y un pre-entreno, sujetos a los productos disponibles y a la selección de `app/page.tsx`. No confundir esta implementación con la propuesta intermedia de categorías/mezcla, que luego se cambió.
- «Marcas disponibles» contiene seis enlaces a filtros del catálogo y **solo el logo dentro del rectángulo**, sin nombre ni cantidad de productos. Las imágenes vienen de `public/assets/brands/`, generadas a partir de las referencias que el usuario puso en `design-reference/marcas/`. Colores actuales: Star Nutrition lima (`#b6df22`); ENA negro; Body Advance degradado dorado; One Fit celeste (`#83cce8`); Gold Nutrition el mismo degradado dorado; Xtrenght negro. ENA se hizo más pequeño y Gold un poco más pequeño. El logo ENA se invierte para leerse blanco; Xtrenght usa versión blanca. Mapeo/tamaño en `app/page.tsx`, fondos en `app/styles/home.css`.
- El hero sigue siendo una imagen de productos reales. **Hero video pendiente.** También están pendientes el panel de administración y una fuente completa/autorizada de reseñas Google; no incluirlos como ya implementados.

## 16. Cuenta de cliente, historial y Google — 6/10/2026

Commit `7f09e99` («Implementa cuentas de cliente y acceso con Google»). Parte de la base de Better Auth, favoritos y pedidos de §12, pero ahora cuenta con navegación y operaciones completas. No se ejecutó la eliminación de una cuenta real durante QA.

### Navegación y experiencia

- En el header, el invitado ve «Hola / Ingresar». Durante la comprobación inicial de la sesión se muestra un skeleton, evitando el destello falso de «Ingresar» al recargar. La persona autenticada ve «Hola / [primer nombre]» con su avatar; el menú se abre con hover o clic y ofrece **Ver perfil, Compras, Historial, Favoritos, Configuración y Salir**, además de un enlace a eliminar la cuenta desde Configuración. Sigue siendo operable al tocar en mobile.
- El registro y el ingreso con email/contraseña o Google redirigen al inicio `/` por defecto. Si la persona venía de una acción protegida, `next` preserva solo destinos internos saneados. No redirigir siempre a `/cuenta`.
- `/cuenta` muestra cuatro tarjetas grandes y centradas (Compras, Historial, Favoritos, Configuración), **sin** repetir la barra lateral. Las páginas internas de esas cuatro secciones sí conservan la navegación lateral. Avatares: iniciales o siete SVG deportivos (rayo, pesa, pesa rusa, disco, shaker, trofeo, corredor) de `public/assets/avatars/`. Se pueden cambiar junto con el nombre.
- `/cuenta/compras` consulta solo pedidos asociados al usuario: búsqueda por pedido/producto y filtros de categoría/fecha; tarjetas con estado, productos, total, «Ver compra» y «Volver a comprar». Los pedidos demo se etiquetan como tales. No se reclaman compras antiguas por coincidencia de email.
- `/cuenta/favoritos` muestra los productos que esa cuenta guardó, con filtro por categoría y estado/precio actuales. Las estrellas de las tarjetas/fichas usan `/api/account/favorites` y `setFavorite` validado en el servidor; el invitado va a ingresar sin generar favoritos falsos.
- `/cuenta/historial` guarda búsquedas **por usuario** en Postgres, no compartidas entre cuentas. `lib/search-history.ts` normaliza consultas de 2–80 caracteres, evita duplicados normalizados, conserva como máximo 30 recientes y permite borrar cada entrada. Invitados mantienen el historial local de la búsqueda predictiva. `/api/account/history` exige sesión y no acepta un userId del cliente.

### Datos, seguridad y configuración

- Migración aditiva `drizzle/0005_famous_millenium_guard.sql`: tabla `search_history`, índices por usuario/consulta y fecha; fue autorizada y aplicada a la base configurada. Se suma a las migraciones `0000`–`0004`. En una base nueva, `npm run db:migrate` aplica todas las pendientes. La relación `search_history.user_id` se borra en cascada al eliminar usuario.
- Better Auth en `lib/auth.ts`: contraseña scrypt de 10–128 caracteres, sesiones DB de 30 días y renovación diaria; cookie HttpOnly, Secure en producción y sin cookie cache; rate limit en DB (8 inicios/minuto y 5 registros/minuto). Producción falla cerrada si no hay `BETTER_AUTH_SECRET` de 32+ caracteres y `BETTER_AUTH_URL` HTTPS. `AccountProvider` evita mezclar favoritos de distintos usuarios durante cambios de sesión.
- Google OAuth usa un cliente de tipo **Aplicación web** de Google Cloud, distinto de la API key de AI Studio. En `/cuenta/configuracion` se puede vincular Google a una cuenta de email/contraseña existente para conservar favoritos, pedidos e historial en la misma identidad. Se probó en local el acceso por Google, por email/contraseña, la vinculación con el mismo email y el nuevo ingreso por Google. No relajar la validación de identidad por una coincidencia de email local no verificado.
- En Configuración se editan nombre/avatar y consentimiento opcional de novedades (false inicial; todavía no se envían campañas), se cierra sesión y se puede eliminar la cuenta. El borrado requiere escribir `ELIMINAR` y, si existe contraseña, introducirla; para una cuenta solo Google se exige sesión reciente. Better Auth elimina usuario, credenciales y sesiones; las FK eliminan favoritos e historial. `orders.user_id` se pone a `null`, preservando los datos propios del pedido para gestionarlo. La función está implementada, **no probada mediante borrado de la cuenta real**.
- Cuentas, compras, favoritos e historial son rutas dinámicas y privadas/noindex. No almacenar secretos OAuth, sesiones o historiales privados en localStorage. El carrito sigue asociado al navegador; no se sincroniza entre dispositivos.

## 17. Vercel Production: desplegado y acceso Google probado — 6/10/2026

Esta sección **reemplaza el estado anterior** de «todavía no se hizo deploy», «Google OAuth pendiente de configurar» y «no se hizo commit/push» en §§3, 10–14. Los párrafos anteriores se conservan como cronología; no describen el estado operativo actual.

- Repositorio `https://github.com/LorenzoPoggi/QuilGym`, rama `main`. Se publicó `7f09e99` en `origin/main`; Vercel creó un deployment Production Ready y asignó `https://quilgym.vercel.app`. Proyecto: `lorenzopoggis-projects/quilgym` (el nombre visible puede aparecer como «QuilGym»). La ruta `/api/auth/ok` devolvió `{"ok":true}`.
- Vercel Production contiene `DATABASE_URL` y la variable heredada `AI_GATEWAY_API_KEY` que estaban cargadas, además de `BETTER_AUTH_URL=https://quilgym.vercel.app`, `BETTER_AUTH_SECRET` **nuevo y exclusivo de producción**, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Los dos secretos se guardaron como variables Secret; nunca se copiaron a Git, este archivo ni la UI del cliente. `AI_GATEWAY_API_KEY` se interpreta en el código **solo como clave de Google Gemini**, no como una clave Vercel AI Gateway; antes de afirmar que el asesor público está operativo, verificar su valor y hacer una consulta real sin exponerlo. Variable canónica: `GOOGLE_GENERATIVE_AI_API_KEY`.
- En Google Cloud, el cliente web «QuilGym Web» tiene `http://localhost:3000` y `https://quilgym.vercel.app` como orígenes, y sus respectivos `/api/auth/callback/google` como redirecciones autorizadas. La URL de `BETTER_AUTH_URL` y el callback deben coincidir exactamente con el dominio público. Se probaron por navegador la redirección a Google, el regreso a `quilgym.vercel.app`, el nombre visible, la persistencia de un favorito de la misma cuenta, Configuración e Historial. La sesión siguió visible tras navegar de vuelta a la home. No se detectaron errores recientes en los logs consultados al cerrar el despliegue.
- El proyecto de Google Auth Platform estaba en modo «Prueba». El ingreso básico solicitado (`openid`, email y perfil) funcionó para la cuenta probada en producción; revisar estado, usuarios y posibles requisitos adicionales si se amplían permisos, se cambia la pantalla de consentimiento o se escala el público. No activar facturación ni otros productos de Google automáticamente. La clave Gemini y el secreto OAuth son diferentes.
- El plugin de Vercel devolvía falta de permiso para el scope `lorenzopoggis-projects`; se completó la configuración con la consola web y la CLI autenticada, indicando proyecto/scope explícitamente. Esto no significa que el deployment esté bloqueado. No guardar tokens de la CLI ni claves en el repositorio.
- Antes del push pasaron `npm run lint`, `npm run typecheck` y `npm test` (**81 pruebas**); `git diff --cached --check` no informó errores. La prueba end-to-end real de OAuth en producción se hizo con intervención del usuario para seleccionar la cuenta Google. No se ejecutó una compra real ni se activaron pagos.

### Configuración pendiente para una tienda operativa

Vercel ya publica el sitio y permite login, catálogo y favoritos. **No equivale a estar listo para cobrar.** Faltan datos reales del negocio y validación sandbox para Mercado Pago, tarifa de envíos, dirección/horario de retiro, transferencia/efectivo, Resend/dominio de correo y `CRON_SECRET`/`ORDER_ACCESS_SECRET` según §8.5. Las variables `NEXT_PUBLIC_*` requieren redeploy cuando cambian. En producción el modo demo del checkout está deshabilitado por código. No cargar importes o CBU de ejemplo.

También quedan: panel de administración para productos/precios/stock/pedidos y confirmación de transferencias, hero video, comparador seleccionable, reseñas Google por fuente autorizada, verificación de email y recuperación de contraseña, legales/privacidad, rótulos accesibles, revisión de seguridad/dependencias, monitoreo/backups y QA real del asesor Gemini. El riesgo de pago aprobado tras vencimiento/cancelación (§8.4) sigue abierto.

## 18. Etapas 1–5: mobile, fotos, hero con video, marcas, compra mobile y reseñas — 6–7/10/2026

Franco revisó `quilgym.vercel.app` desde el iPhone y pidió corregir bugs de mobile, un hero con video, fotos navegables con lightbox, marcas con logo, pulso de stock, explicar qué falta para las reseñas y auditar el sitio. Se hizo en cinco etapas, cada una con su verificador (lint, typecheck, unitarios, build, E2E en 1440 y 390 y QA con gstack browse). Los commits están en §4; el detalle técnico, en §6.

- **Etapa 1 (`0011d46`):** menú de cuenta y newsletter en mobile, WhatsApp, foco visible, contraste y zonas táctiles. El mensaje de WhatsApp de §15 cambió: ahora es «¡Hola! Quiero más información sobre la compra de suplementos.» y vive en `commerce.whatsapp`.
- **Etapa 2 (`638d0b1`):** fotos en tarjetas y ficha, lightbox, pulso de stock. E2E `e2e/product-photos.spec.ts`.
- **Etapa 3 (`13a72da`):** hero con video y cinta de marcas; el mapeo de logos de §15 pasó de `app/page.tsx` a `lib/brand-logos.ts`. E2E `e2e/home-hero.spec.ts`.
- **Etapa 4 (`8e29db9`):** flotantes, barra de compra mobile, checkout vía WhatsApp, header, catálogo y comparador. E2E `e2e/floating-buy-catalog.spec.ts` y tests de `lib/checkout-whatsapp.test.ts`.
- **Etapa 5 (`cd2460a`):** reseñas y este documento.
- **Hero con montaje (`8a0910e`, 7/10/2026):** el usuario no aprobó el clip de Pexels y sí un montaje estilo Creed de 9 cortes con clips de Mixkit y Coverr, sin audio. Receta en `scripts/hero-montage.json`; detalle en §8.3. Verificado con lint, typecheck, unitarios, build, E2E de la home (1440 y 390) y QA con gstack.

### Reseñas de Google (estado vigente; reemplaza lo dicho en §12)

- `components/google-reviews.tsx` pide `/api/reviews` recién cuando la sección está a 200 px de la pantalla (`IntersectionObserver`; si no existe, pide al montar). Cada pedido tiene costo y los términos de Places prohíben cachear reseñas y rating, así que no se cachea nada.
- Con reseñas: rating y cantidad reales, atribución de texto «Google Maps» (Roboto o sans-serif, regular, `#5e5e5e`, sin estilizar, como permiten las políticas cuando no se usa el logo oficial), link «Ver todas las reseñas», aviso «Hasta 5 opiniones, ordenadas por relevancia según Google.», y en cada tarjeta el avatar del autor (`authorAttribution.photoUri`, validado en el servidor: https y host `*.googleusercontent.com`, `*.ggpht.com` o `google.com`; `<img>` de 36 px con `referrerPolicy="no-referrer"` y `alt` vacío; si no hay foto, la inicial), su nombre con link, la fecha, las estrellas, el texto, la etiqueta «Traducida por Google» con el original desplegable cuando existe y «Leer en Google». Carrusel con pausa, flechas, pausa con hover o foco y sin movimiento automático con movimiento reducido.
- Sin reseñas (sin variables, error de Places o mientras carga): la sección es «Visitanos en Quilmes», con el mapa y el CTA «Ver reseñas y cómo llegar» a la ficha (`quilgymMapsUrl`). No lleva el eyebrow «EXPERIENCIAS REALES» ni promete opiniones. Es el estado actual en producción.
- `lib/google-reviews.ts` hace `console.warn` con el status HTTP cuando Places responde con error, cuando devuelve otro lugar o cuando falla la consulta (solo el nombre del error). Nunca loguea la clave, que viaja en un header.
- E2E en `e2e/account-advisor.spec.ts`: con datos simulados **solo en la interceptación del test** (incluye `photo` y una reseña traducida), verifica que no se pida `/api/reviews` antes de llegar a la sección, avatar, atribución, aviso y «Traducida por Google»; y el estado sin reseñas.
- Pendiente: cargar las variables con tope de cuota y alertas (§10), rate limit del endpoint y corregir la ficha de Google Business.

### Mantenimiento del documento

Este `CLAUDE.md` está ignorado por Git; una edición local no viaja a Vercel ni a GitHub. `.env.example` sí es pública y solo debe contener nombres/comentarios/valores de ejemplo, nunca credenciales. `AGENTS.md` se menciona en el historial pero no estaba presente en el directorio al 6/10/2026. Al continuar, conservar el contexto histórico y agregar nuevas secciones o correcciones puntuales: **no reemplazar todo el archivo por un resumen**.

## 19. Cabecera integrada al hero y pulido de cuenta — 7/10/2026

El usuario pidió acercar la portada a la referencia de Rancho Santana: video a pantalla completa, header superpuesto al inicio y sólido al desplazarse; simplificar el saludo del perfil y dar más espacio a los filtros/estado vacío de Compras. Los cambios locales están en curso sobre la versión con montaje de §18; todavía no tienen commit ni se publicaron en Vercel.

- `app/page.tsx` usa `<Header overlayOnHero />` solo en la portada, dentro de `.home-page-shell`. `Header` agrega las clases específicas y oculta la franja de envío en esta portada para que no empuje el hero. El header conserva navegación y buscador.
- `app/styles/home.css`: el hero tiene `min-height: 100svh`; el header ocupa el flujo visual con margen inferior negativo (76 px en desktop, 120 px en mobile) para superponerse al video. `HeroVideo` y el póster siguen siendo fondo con `object-fit: cover` y el contenido conserva el overlay de contraste. El ajuste es responsive.
- `HeaderAutoHide` actualiza `data-scrolled` al cruzar 48 px. En el inicio la cabecera es transparente sobre el hero; al bajar pasa a gris oscuro (`#202426`) con marca, navegación, cuenta y carrito blancos. En mobile se conserva el comportamiento previo de plegar el buscador cuando se baja. Hay una animación de entrada y se respeta `prefers-reduced-motion`. La búsqueda mantiene su superficie clara y tinta oscura para legibilidad; menú de cuenta desplegado conserva superficie blanca y texto oscuro.
- Los controles visibles duplicados de pausa en el video y la cinta de marcas se ocultan visualmente. Siguen en el árbol accesible y aparecen al tomar foco con teclado, de modo que se puede pausar sin mostrar los dos botones flotantes en el diseño normal. La cinta sigue sin movimiento automático cuando el sistema pide movimiento reducido.
- En `/cuenta`, `AccountShell` ya no repite avatar, nombre completo y email encima del saludo. El panel muestra `Hola, {nombre}` usando el primer nombre. Las secciones internas (Compras, Historial, Favoritos y Configuración) conservan encabezado de identidad y navegación lateral. Las tarjetas del overview continúan centradas y sin duplicar navegación.
- `components/account-purchases.tsx` marca el toolbar y el estado vacío como variantes de compras. En desktop, los filtros ganan gap, padding lateral, altura y borde más visible, dejando espacio a la derecha; en mobile se organizan en dos columnas, con búsqueda y contador a lo ancho. El estado vacío separa el texto «Todavía no tenés compras asociadas a tu cuenta.» del CTA negro con un gap amplio.
- Verificación: `git diff --check`, `npm run lint`, `npm run typecheck` y `npm run build` aprobados. El primer build dentro del sandbox no alcanzó Neon; se repitió con acceso de red aprobado y prerenderizó 89 páginas correctamente. QA visual desktop confirmado: hero a pantalla completa, header transparente al inicio y gris oscuro/legible al desplazarse. Los 6 E2E focalizados de `home-hero.spec.ts` pasan en desktop y mobile (video correcto, foco/pausa, movimiento reducido, cinta de marcas y sin overflow); el screenshot mobile confirma el header integrado y el hero dentro del primer viewport.
- No se corrieron pruebas que creen usuarios/pedidos en Neon compartido; el panel de cuenta y los estilos de compras fueron revisados en código, pero no se hizo QA visual autenticado de esas rutas. No se alteró `.env.local`, Neon, pagos, stock ni datos de clientes. `CLAUDE.md` permanece ignorado por Git; este apunte conserva el documento y su cronología. Si el usuario pide commit/publicación, actualizar §4/§6/§10 y completar QA visual autenticado si se autoriza crear fixtures aislados.

## 20. Panel de administración del catálogo — 7/10/2026

Cambios locales sin commit ni despliegue:

- `/admin/productos` lista el catálogo entero, incluidos borradores y archivados, con búsqueda y filtro. `/admin/productos/nuevo` crea; `/admin/productos/[id]` edita. El editor cubre nombre, descripción, marca y categoría existentes, variante principal (SKU/presentación/precio/precio anterior/stock), fotos, destacado y estado. Archivar oculta sin borrar historial. Si hay variantes secundarias, no se tocan por ahora.
- Solo una sesión de `quilgymnuevo@gmail.com` con **email verificado y vinculada a Google** puede administrar. La coincidencia de email sola no alcanza porque el registro con contraseña todavía no verifica correos. Layout, Server Action y token de subida validan en servidor. Sin sesión redirige al login; otras cuentas reciben 404.
- Guardado transaccional en Postgres, con validación del lado servidor e invalidación de caché. Stock `null` sigue siendo «sin control» y `0` agotado. No ejecutar `npm run db:seed` tras ediciones comerciales: sobrescribe datos.
- Fotos nuevas: compresión WebP en navegador (máximo 1600 px) y carga directa a Vercel Blob. Postgres almacena URL, tamaño, tipo y orden; las fotos locales anteriores permanecen. Hasta 12 fotos. Al quitar una foto o cancelar un alta no se borra aún el Blob: pendiente limpieza segura de huérfanos.
- Se creó en Vercel el Blob Store público `quilgym-product-images`, región GRU1, conectado solo al entorno **Production** de `quilgym`. La consola confirmó `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID` y `BLOB_WEBHOOK_PUBLIC_KEY`. Está vacío. Para cargas locales falta colocar el token en `.env.local` sin publicarlo; la integración en producción exige desplegar estos cambios de código. No hay migración nueva.
- No se implementaron ventas, pagos, métricas, cupones, creación de marcas/categorías ni edición de variantes secundarias. No confundir este panel con un backoffice comercial completo.

## 21. Revisión del panel y acceso pendiente — 7/10/2026

- El usuario revisó la vista visual del catálogo y le gustó el aspecto inicial. Se creó una ruta local temporal `/admin-preview-local` con datos ficticios para mostrar listado y formulario; después se eliminó completa. No incorporar fixtures de preview ni datos falsos al catálogo real. La vista de administración sigue en `/admin/productos` y protegida.
- **Actualización 9/10/2026:** Lorenzo fijó el email oficial `quilgym@gmail.com` en `lib/admin-config.ts` (commit `25c408a`). Lo que sigue en este punto es historial.
- El usuario prefiere continuar el diseño y la evaluación del panel cuando tenga el email oficial de QuilGym. Si no se lo entregan, avisará qué email personal autoriza como administrador. **No cambiar `ADMIN_EMAIL` ni habilitar otro correo hasta recibir esa dirección explícitamente.** El único correo autorizado por ahora sigue siendo `quilgymnuevo@gmail.com`, con email verificado y Google vinculado.
- Aclaración sobre alcance: la primera entrega es una base funcional de catálogo, no todavía una interfaz administrativa completa. Pendientes que el usuario puede priorizar en la próxima etapa: mejorar densidad y navegación del panel; filtros por marca/categoría, orden y paginación; alta y administración de marcas/categorías; edición/alta de variantes secundarias; borrado recuperable o política de archivado; mejor confirmación/feedback de guardado; limpieza de archivos Blob huérfanos al reemplazar fotos; historial de cambios de stock. No se agregaron ventas, pagos, órdenes ni métricas porque el sistema de cobros todavía no está listo.
- Al cierre de esta revisión, Git mostraba `9635e82 feat: implementar panel del administrador para la gestión del catálogo` tanto en `main` como en `origin/main`. El ajuste visual de ocultar los accesos flotantes en las pantallas admin quedó local después de ese commit; verificar `git status` antes de incluirlo en un commit posterior. `CLAUDE.md` continúa ignorado por Git y conserva toda su cronología.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 22. Checkout y pagos — 7/10/2026

Cambios locales listos para commit; no se desplegó:

- Checkout organizado en datos, entrega y pago. El borrador (datos de contacto/dirección, etapa, entrega, medio y confirmación) se conserva en `sessionStorage` para la pestaña actual, asociado a la firma del carrito; si cambia el carrito se descarta. Al restaurar en pago se vuelve a pedir la cotización al servidor. No persistir ni solicitar datos de tarjeta en el borrador. Se elimina el borrador al finalizar el envío del pedido.
- Retiro en Quilmes muestra el mapa ocupando el rectángulo de ubicación; resumen mantiene entrega $0. Métodos visibles: Mercado Pago, Mercado Crédito, débito, crédito y efectivo; recursos visuales en `public/assets/payments/`. El logo de Crédito se presenta dentro de su marco con `object-fit: contain` y escala ligeramente menor que el marco para dejar margen.
- Modo local: los cobros son simulados y no deben usarse tarjetas reales. Mercado Pago/Crédito y tarjetas digitales completan el recorrido demo como aprobados; efectivo crea un pedido pendiente. Confirmación de pago digital muestra compra aprobada y el progreso desde Preparación; efectivo sigue Pedido recibido → Preparación → Pago y retiro en el local. El estado de preparación/aviso de listo todavía no tiene una acción administrativa automatizada.
- En producción, Mercado Pago y Mercado Crédito usan preferencia de Checkout Pro y redirección a Mercado Pago; Crédito depende de elegibilidad/disponibilidad para el comprador. Débito/crédito usan el formulario seguro de Mercado Pago (Payment Brick); los datos sensibles se tokenizan y no se almacenan en QuilGym. El servidor crea primero el pedido pendiente; webhook firmado concilia pago/importe antes de cambiar el estado. No marcar pagado por el mero retorno del navegador.
- La implementación está en `lib/mercadopago.ts`, `lib/payment-actions.ts`, `components/order-payment.tsx` y `app/api/payments/mercadopago/webhook/route.ts`; requiere `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` y `NEXT_PUBLIC_SITE_URL` HTTPS. Claves públicas/privadas deben ser del mismo ambiente. No subir credenciales a Git ni pedirlas por chat.
- Para pruebas integradas: crear aplicación en Mercado Pago Developers, usar credenciales de prueba y cuentas de prueba vendedora/compradora; configurar notificaciones de pago al endpoint `/api/payments/mercadopago/webhook` y copiar el secreto de firma. El webhook necesita una URL pública HTTPS (staging/preview; localhost no es suficiente sin túnel seguro). Validar aprobado, rechazado, pendiente, repetición/idempotencia y conciliación antes de habilitar cobros reales. No mezclar credenciales TEST con producción. Alias/CVU no son credenciales de API ni identifican al receptor de Checkout Pro; la cuenta receptora se determina por el Access Token. No se hace una transferencia a un CVU arbitrario desde este checkout.
- `drizzle/0006_talented_joshua_kane.sql` agrega `orders.payment_choice`; la migración fue aplicada a la base Neon configurada durante la etapa. Aplicarla también en cualquier base/entorno nuevo antes de probar allí.
- Pendiente antes de producción: recibir autorización y credenciales del negocio de forma segura; validar cuenta receptora y ambiente; preparar HTTPS y webhook en staging; probar Checkout Pro y Brick con cuentas/tarjetas de prueba; confirmar tarifas/condiciones de Mercado Pago con el negocio. La API no requiere contratar un servicio de integración aparte, pero Mercado Pago cobra comisión por operación aprobada según método, plazo y condiciones vigentes. No activar cobros reales por el hecho de tener alias/CVU.
- Los ajustes de `e2e/checkout.spec.ts` cubren los cambios de UI y flujo. La integración real no se considera probada solo por el modo demo.
- Ajuste posterior: el checkout muestra «Calcular envío» cuando hay tarifas cargadas; si todavía no existen, ofrece consultar el costo por WhatsApp sin inventar valores. Con retiro disponible se puede confirmar la cotización gratuita ($0). WhatsApp se abre en una sola pestaña nueva; si el navegador bloquea popups se muestra un aviso y nunca se navega la pestaña del checkout.

## 22.1 Diagnóstico de retorno Mercado Pago en Preview — 8/10/2026

El usuario informó que tras aprobar un pago de prueba en Checkout Pro llegaba a 404 en el dashboard. Efectivo sí redirigía bien. Se revisaron logs de Vercel y el pedido desde el navegador, sin iniciar otro cobro.

- **Causa del 404 confirmada:** `POST /checkout` creó la preferencia en un deployment inmutable Preview, pero Mercado Pago devolvió al alias de rama `quilgym-git-mp-sandbox-…`, que apuntaba a un deployment anterior. En los logs, la petición de creación llegó al deployment `dpl_H8P2rE9zqiNmWTWJsKRTyVTturvX`; el retorno GET con estado aprobado entró al deployment distinto `dpl_GgNsTv3yns4Ki1JM7zbfwddWzjAp` y devolvió 404. Efectivo usa una ruta relativa en la misma pestaña/origen y no presenta ese desvío.
- Se cambió `readSiteUrl` en `lib/checkout-env.ts`: cuando `VERCEL_ENV=preview`, valida el hostname del `VERCEL_URL` de sistema y usa `https://${VERCEL_URL}`. No acepta valores arbitrarios ni recurre al dominio de producción si falta o es inválido. En producción y desarrollo conserva `NEXT_PUBLIC_SITE_URL`. Se presupone habilitado el acceso a variables de sistema de Vercel.
- El mismo origen lo consume `orderPageUrl` para `back_urls` y la URL del webhook para notificaciones, de modo que nueva preferencia, dashboard firmado y receptor queden en el deployment que creó el pedido. Las preferencias ya creadas no actualizan sus URLs automáticamente al desplegar; los próximos pedidos sí usarán la lógica nueva.
- Se probó el enlace firmado del pedido que retornó con 404 en el hostname del deployment que originalmente creó la preferencia: cargó el dashboard de confirmación sin 404 y conservó los datos del pedido. El dashboard mostró «Pendiente de pago» aunque Mercado Pago había devuelto `status=approved`; la vuelta del navegador no se usa para acreditar el pedido.
- **Bloqueo restante del webhook:** una solicitud POST sin firma a la URL del webhook de Preview recibió HTTP 401 de Vercel Authentication antes de alcanzar el handler de Next. La aplicación valida firma HMAC en `app/api/payments/mercadopago/webhook/route.ts`; esa validación debe seguir activa. No se cambió Deployment Protection. La cuenta Vercel observada estaba en Hobby: Vercel no ofrece una excepción de protección solo para una ruta en ese plan. La excepción por dominio requiere Pro con Advanced Deployment Protection y haría público el Preview entero. El bypass de automatización funciona con URL/query para servicios de webhook, pero su secreto concede bypass a todos los deployments del proyecto y se expondría en URL/logs; no configurarlo sin autorización explícita para ese alcance.
- Pendiente: desplegar el cambio local en `mp-sandbox`, verificar que nuevas preferencias usen el hostname propio del deployment y acordar una solución al bloqueo del webhook (p. ej. bypass de automatización con conocimiento de su alcance, plan que permita excepción por dominio, o endpoint público dedicado). Para validar el retorno no volver a pagar el pedido aprobado. Revisar si ese pago existente fue conciliado y actualizarlo solo mediante consulta autenticada al API de Mercado Pago más validación de orden/importe, nunca por `status` del query string.
- Cobertura añadida a `lib/checkout.test.ts`: hostname del Preview prevalece al alias viejo; producción/desarrollo conservan el dominio configurado; hostname faltante/malformado falla cerrado; el config de MP puede usar URL de deployment Preview. En esta sesión pasaron `npm test -- lib/checkout.test.ts lib/order-service.test.ts` (37 pruebas), `npm run typecheck` y ESLint sobre los tres archivos TypeScript modificados.
- El detalle operativo también se agregó a `README.md`. `CLAUDE.md` permanece excluido por `.gitignore`; para compartir esta actualización con el socio debe añadirse forzadamente (`git add -f CLAUDE.md`) al commit, o copiar la sección 22.1 a un documento versionado.

## 23. Pulido visual y pendientes acordados — 8–9/10/2026

### Cómo retomar (orden sugerido)

1. Combos: usar `ComboVisual` (catálogo y «Más combos»), combos en carrito/búsqueda/asesor con la foto del primer producto; evaluar la eliminación física de `public/assets/products/combo-*` después de comprobar referencias.
2. Ficha de producto: sacar el bloque «Información nutricional» y aplicar el estilo de botones de las tarjetas.
3. Home: objetivos con colores más vivos, beneficios integrados, banner del asesor, «Cómo comprar», cinta de marcas sin botón de pausa y logos monocromos de Body Advance, One Fit y Gold.
4. Interacciones: animación de favorito y burbuja que vuela al carrito y abre el drawer.
5. Checkout (logo nuevo, resumen duplicado en mobile), drawer del carrito, asesor (scroll mobile, sugerencias, panel); página 404 propia ya creada el 9/10.
6. Páginas de ingreso/registro; búsqueda queda atendida abajo.
7. Fotos nuevas (2 + rótulo por producto): buscar, procesar y dejar `db:sync-images` listo **sin correrlo** hasta publicar.
8. Actualizar `e2e/checkout.spec.ts`, correr todo (lint, typecheck, unitarios, build, E2E 1440/390); el barrido axe WCAG 2.1 A/AA de cinco rutas en ambos viewports ya está implementado y pasa. Falta el recorrido manual completo de teclado y el axe de checkout/compra.
9. Revisar los cambios localmente; no hacer commit/push sin que el usuario lo solicite. Pedir OK antes de tocar la base de producción.

### Hecho (rama `mp-sandbox`)

- `0c5b80f` npm audit en 0 (overrides de esbuild y `fast-glob` → `tinyglobby`, §10). `fa27007` ícono de efectivo 56 × 42.
- Checkout sandbox local: ver «Probar el sandbox en local» en §8.5 (`CHECKOUT_DEMO_MODE=false` + retiro de prueba en `.env.local`).
- Marcas dentro del hero (cinta gris sobre el video), sin línea blanca arriba del header, logo nuevo (`components/logo.tsx`, Archivo 900, favicon `app/icon.svg`), avatar a la izquierda de «Hola, Franco» en `/cuenta`.
- Combos: `ComboShowcase` + `ComboVisual` con fotos reales de los productos (`lib/combo-contents.ts`), sin el recuadro blanco en hover (el `multiply` va en el wrapper que se mueve), ficha de combo con `ComboGallery` y lista «Qué incluye».
- Tarjetas de producto unificadas con las de combos: precio a la izquierda, stock a la derecha, «Agregar» negro + flecha cuadrada a la ficha. Sin la línea de categoría.
- Todo lo anterior está en `21e1195`, subido a `origin/mp-sandbox` el 9/10/2026 (no está en `main`). Verificado: lint, typecheck, 101 unitarios, build, capturas 1440/390 sin desborde ni imágenes rotas.

### Cambios hechos el 9/10/2026 en el workspace (todavía sin commit)

**Fotos de producto**
- [ ] Cada producto (no combos) con **3 imágenes**: 2 fotos del producto en muy buena calidad (≥1200 px, packshot limpio, mismo tamaño/sabor/envase) + la 3.ª = **información nutricional** legible. Fuentes: sitio oficial de la marca primero (Shopify: `/products/<handle>.json`, `?width=2048`), después tiendas oficiales. Nunca inventar ni retipear rótulos; shakers sin rótulo → 2 fotos.
- [ ] El pipeline v2 descrito antes todavía **no existe**: hoy solo existen `scripts/fetch-product-images.mjs` + `scripts/build-product-images.mjs` (`npm run images:fetch`/`images:build`) para el material de Tiendanube. Diseñar la nueva curaduría y un sync con `--dry-run` antes de implementarlo. **Neon conectado es Production**: no ejecutar cambios de imágenes contra esa base sin autorización explícita y sin desplegar antes los assets.
- [ ] Eliminar las fotos viejas de Tiendanube de los combos (`public/assets/products/combo-*`) y que **ningún lugar** las muestre: tarjetas del catálogo (`/productos?categoria=combos`), «Más combos» en la ficha, carrito, búsqueda y asesor. Idea: `ProductCard` usa `ComboVisual` si `comboParts(slug)` existe y `lib/catalog.ts` devuelve la foto del primer producto componente para combos.
- [x] Quitar el símbolo «+» de la imagen de los combos (home y ficha).
- [x] `ProductCard` usa `ComboVisual`; `lib/catalog.ts` usa la foto del primer producto incluido en catálogo, carrito, búsqueda y recomendaciones.
- [x] Home: retirar el chip «ORIGINALES · ENTREGA RÁPIDA», ocultar la franja de confianza solo en mobile y quitar el control de pausa de la cinta de marcas, como pidió el usuario.
- [x] Asesor: ocultar el panel gris lateral solo en mobile; mantener el aviso de salud dentro del texto legal compacto del chat.
- [x] Ficha: eliminar el panel duplicado de información nutricional; el rótulo queda disponible como foto de galería. Los enlaces del comparador ahora llevan a esa galería.
- [x] Añadir página de marca `app/not-found.tsx` con accesos al catálogo y al inicio.

**Ficha de producto**
- [x] Quitar el bloque «Información nutricional» duplicado; mantener el rótulo en la galería y enlazar el comparador a `#galeria-producto`.
- [x] Botones con el lenguaje de las tarjetas (negro + outline), acciones sin columna vacía, stepper compacto en mobile, franja de confianza compacta y encabezado de «Información del producto» prolijo.

**Home**
- [x] «Elegí tu objetivo»: colores más vivos con contraste AA para texto blanco, anillo decorativo detrás del texto y elevación al hover (sin movimiento si se prefiere reducirlo).
- [x] Franja de beneficios integrada al borde inferior del hero en desktop/tablet; en mobile queda oculta para no sumar altura. Conserva beneficios configurados, sin afirmar tarifas o promociones nuevas.
- [x] Banner del asesor rehecho con ícono de conversación y bienvenida real compartida con el chat; ya no describe el cuestionario anterior.
- [x] «Cómo comprar» usa fondo tinta y el footer se compacta en mobile.
- [x] Cinta de marcas: quitar el control visible; quedan pausa al hover/foco y movimiento reducido sin animación.
- [ ] Logos de **Body Advance, One Fit y Gold Nutrition** en versión monocroma limpia; hace falta validar assets oficiales antes de reemplazarlos.

**Interacciones**
- [x] Favorito: realce discreto al hover y latido al guardar con éxito; compatible con preferencia de movimiento reducido.
- [x] Agregar al carrito: burbuja (miniatura del producto) que vuela hasta el carrito del header, el contador rebota y **después se abre el drawer** (`openCart()` del `CartProvider`). Sin vuelo ni rebote con movimiento reducido; si no hay miniatura o Web Animations API, abre el drawer directamente.

**Checkout y carrito**
- [x] Checkout/confirmación usan el logo actual; columnas superiores alineadas, CTA negro muestra el total y en mobile queda un solo resumen desplegable.
- [x] Drawer del carrito: lista/cupón desplazables, totales y acciones persistentes en el pie, botón de quitar en gris con hover discreto. `/carrito` es una página dedicada en desktop/mobile con recomendaciones; el drawer modal del header conserva el mismo pie fijo.

**Asesor y scroll mobile**
- [x] `/asesor` mobile: panel a alto de viewport menos el header, un historial desplazable y composer/aviso de privacidad visibles con safe-area; sin doble scroll de página y chat.
- [x] `/asesor`: panel lateral de desktop rehecho con mejor jerarquía/contraste y composer con foco/estado deshabilitado más claros; las sugerencias existentes se conservan y el diseño mobile no cambia.
- [x] Página 404 propia (`app/not-found.tsx`) con la marca y links al catálogo/inicio; no incluye buscador propio porque el Header global ya tiene búsqueda.

**Búsqueda y páginas secundarias**
- [x] `/buscar`: sacar el tinte violeta del prototipo (también en `/comparar`) y las etiquetas de depuración, resultados con el estilo de las tarjetas, mejorar el estado sin resultados y agregar footer.
- [x] `/buscar`: retirado el tinte violeta y las etiquetas de depuración; orden de resultados alineado con relevancia/stock del catálogo; agregado footer y sugerencia de corrección con estilo neutro.
- [x] Ingreso y registro en layout de dos columnas en escritorio y una columna en mobile; agregar footer a ambas rutas.
- [x] Reemplazar la «G» genérica del botón Google por el asset SVG oficial aprobado (modo de ícono), manteniendo el CTA localizado «Continuar con Google» y la acción OAuth Better Auth.
- [x] Catálogo: **dejar las tarjetas como están** (decisión del usuario).

**Pruebas**
- [x] `npm run lint`, `npm run typecheck`, `npm test` (101 pruebas) y `npm run build` ejecutados el 9/10/2026; el build requirió acceso de red para descargar Archivo e Inter desde Google Fonts.
- [x] E2E visual seguros en desktop 1440/mobile 390 para home/hero, asesor (API simulada), búsqueda, ficha, carrito y pantallas de ingreso/registro; las rutas de auth/layout no crean cuentas ni pedidos.
- [x] Barrido automático axe WCAG 2.1 A/AA en inicio, catálogo, ficha de producto, búsqueda, comparador, carrito vacío, ingreso y asesor, desktop/mobile (16 escenarios, cero violaciones después de corregir los contrastes encontrados).
- [ ] Auditoría manual completa de teclado y E2E de checkout/cuenta que escriben en DB: requieren primero una base Preview aislada y modo de prueba explícito; no apuntar a Neon Production.
- Para los E2E de checkout hace falta una base aislada y el modo demo: en un `.env` de test poner `CHECKOUT_DEMO_MODE=` (vacío). **No editar ni reemplazar `.env.local` con secretos para forzar la prueba**; arrancar con configuración aislada y restaurarla al terminar.

**E2E desactualizados (no los rompió esta tanda)**
- [ ] Revisar `e2e/checkout.spec.ts`: puede conservar selectores de textos/tarifas anteriores. Actualizarlo junto con una base Preview aislada; los E2E de pedidos y cuentas no deben apuntar al Neon de Production.

### Pagos con tarjeta y cuotas (respuesta al usuario, 8–9/10)

- Opciones del checkout: «Mercado Pago» = solo dinero en cuenta (excluye tarjetas y ticket); «Mercado Crédito» = cuotas sin tarjeta de MP (`purpose: onboarding_credits`), **no** es tarjeta de crédito; «Tarjeta de débito» y «Tarjeta de crédito» = Payment Brick embebido (Visa, Mastercard, Amex, Naranja, Cabal, cualquier banco). La tarjeta la tokeniza MP; el servidor solo recibe token, medio y cuotas, y fija el monto.
- Cuotas: el Brick ya muestra las cuotas disponibles para la tarjeta (el código acepta 1–48). Hoy son **con interés** (las paga el comprador). Las **sin interés** se activan en la cuenta de MP del negocio (las absorbe el vendedor); después poner el número en `interestFreeInstallments` de `lib/commerce.ts`. Se puede limitar el máximo de cuotas del Brick.
- Con las credenciales sandbox actuales las tarjetas reales no funcionan (y no hay que cargarlas): usar las tarjetas de prueba de MP con titular `APRO` (aprobado), `OTHE` (rechazado) o `CONT` (pendiente). Con credenciales de producción el cobro es real.

### Facturación con ARCA (pendiente, a definir con el negocio y su contador)

- [ ] Mercado Pago no factura por el negocio: cada venta la factura QuilGym con su CUIT (monotributo → Factura C; responsable inscripto → B a consumidor final, A a RI).
- [ ] Opciones: (1) manual en «Comprobantes en línea» de ARCA; (2) **recomendada**: servicio de facturación con API conectado a ARCA (TusFacturas, Facturante, Xubio, Alegra…); (3) integración directa con el web service WSFE (certificado digital, punto de venta para web service, homologación, CAE y PDF con QR).
- [ ] Datos a pedir: condición fiscal y categoría, punto de venta, si ya facturan en el local y con qué sistema, y desde qué monto la factura a consumidor final exige DNI/CUIT (cambia seguido: confirmar con el contador; si aplica, sumar el campo al checkout).
- [ ] Punto de enganche: cuando el webhook confirma un pago aprobado (`reconcileProviderPayment` → `approved`), emitir la factura y adjuntarla al email del pedido (outbox de `lib/order-email.ts`).

## 24. Revisión de código, seguridad y ajustes visuales — 9/10/2026

### Revisión de cambios del socio

- `21e1195` (Franco Lesme): cambios de presentación en home/header, logo SVG, composición de combos, galería y tarjetas; la inspección no encontró nuevas rutas de escritura ni manejo de credenciales en ese commit.
- `fa27007`: ajuste del asset de efectivo. `0c5b80f`: overrides de dependencias para resolver avisos previos.
- `npm audit` completo y `npm audit --omit=dev` repetidos el 9/10/2026: 0 vulnerabilidades. No obstante, el override scoped de `fast-glob` requiere reinspección al actualizar `eslint-config-next`.
- Pendiente de seguridad operativa: rotar la contraseña de Neon expuesta anteriormente y configurar una base aislada para Preview/E2E. No se rotó ni tocó la base compartida durante esta revisión.
- Pendiente de configuración: un POST a webhook Preview recibió HTTP 401 de Vercel antes de llegar al handler; la firma HMAC de la aplicación no reemplaza Deployment Protection. No se activó un bypass global.

### Cambios de código de esta revisión (workspace, sin commit)

- Hero: eliminados el chip «ORIGINALES · ENTREGA RÁPIDA» y los mensajes de confianza en mobile; retirada la pausa visible de la cinta de marcas.
- Asesor: oculto en mobile el panel lateral gris y conservado el aviso de salud en el texto legal compacto del chat.
- Combos: eliminada la insignia «+»; `ProductCard` y las miniaturas que derivan de `lib/catalog.ts` usan fotos de los productos incluidos, con clave de caché activa actualizada a `v3`.
- Ficha: retirado el bloque duplicado de nutrición; el rótulo sigue en la galería y el comparador enlaza a `#galeria-producto`.
- Ficha: alineados los botones de compra con el estilo de tarjetas, compactada la franja de confianza y mantenido el selector de cantidad a ancho de contenido en mobile.
- Home: reforzado el contraste/legibilidad de objetivos, actualizado el banner del asesor con el saludo real, reemplazado el fondo azul petróleo de «Cómo comprar» y compactado el footer mobile.
- Favoritos: realce al hover y latido temporal solo cuando se guarda correctamente; no anima al quitarlo ni con `prefers-reduced-motion`.
- Asesor: tres sugerencias iniciales rellenan el composer sin enviar por el usuario; en mobile el historial es el único contenedor con scroll.
- Checkout: cabecera de checkout y confirmación usan el componente de logo vigente, el CTA incluye el total y se oculta el resumen lateral en pantallas donde aparece el resumen desplegable.
- Carrito: el listado/cupón se desplazan dentro del panel y total/CTA permanecen visibles; `/carrito` tiene layout propio con recomendaciones en desktop y mobile.
- CSS: al pasar `/carrito` de modal de página a layout dedicado se eliminaron las reglas sin uso de `.cart-underlay`/`.cart-overlay` y se limitaron los estilos fijos del drawer al diálogo global; queda pendiente una auditoría completa de reglas prototipo sin referencias.
- Búsqueda: `/buscar` usa resultados en orden de relevancia del catálogo, sin etiquetas de depuración ni sombras violetas; se agregó el footer y se neutralizó el estado sin resultados.
- Seguridad de reseñas: `/api/reviews` limita las consultas externas a 300/día con contador compartido; no consulta Places si se alcanza el tope y devuelve 503 si no puede verificar el contador.
- Seguridad del checkout: extraído el contador DB compartido a `lib/rate-limit.ts`; agregados límites por carrito a cupones, cotización y creación de orden, y por orden a preparación/pago MP. Las pruebas confirman que el umbral bloquea el acceso a proveedor y creación de órdenes.
- Webhook: firmas inválidas limitadas a 20/minuto por IP de edge Vercel, guardada como HMAC; webhooks válidos no se limitan para no interferir con reintentos del proveedor.
- Operación: agregado `/api/internal/expire-carts` al cron diario; conserva carritos ligados a órdenes, elimina huérfanos de más de 60 días y sus items/contadores por lotes de 50. En esta continuación se añadió la purga acotada de contadores compartidos inactivos por más de 48 h para evitar acumular indefinidamente claves de visitantes y pedidos.
- Añadida página `app/not-found.tsx`.
- Los cuatro cambios pedidos en las capturas siguen presentes: chip del hero eliminado en desktop/mobile; franja de confianza oculta solo en mobile; botón de pausa de la cinta de marcas eliminado; panel lateral gris del asesor oculto solo en mobile, manteniendo allí el aviso de salud en el chat.
- Segunda inspección del commit del socio `21e1195`: sus archivos modificados son de logo, presentación y composición de combos; no añade rutas de servidor, autenticación, lectura de secretos ni sinks de HTML/JS dinámico. Esto no sustituye auditoría general ni revisión de futuros cambios.
- La limpieza física de `public/assets/products/combo-*` sigue aplazada: `data/product-images.json`, la curaduría y el importador todavía los referencian. Las vistas web de combos usan `ComboVisual` y fotos de productos componentes; no borrar los archivos hasta separar esas fuentes históricas y comprobar si la base conserva URLs.
- El control visible de pausa fue retirado a pedido, pero la cinta todavía se detiene al pasar el puntero o al enfocar un enlace; con `prefers-reduced-motion` no se anima.
- Verificación actual (9/10/2026): `npm run lint`, `npm run typecheck`, `npm test` (117/117), `npm run build`, E2E enfocados (20 pasaron y 2 se omitieron intencionalmente por no aplicar al viewport: hero/cinta, asesor, búsqueda y ficha desktop/mobile), `npm audit` completo y `npm audit --omit=dev` pasan. Los E2E que registran cuentas/pedidos en Neon compartido no se ejecutaron; tampoco una auditoría axe completa. La home valida por E2E contraste AA, capa del anillo y saludo real del asesor; el chat se prueba en desktop/mobile con backend simulado, incluida la composición mobile.
- Verificación adicional de esta continuación: lint, typecheck, suite unitaria (117/117), `git diff --check`, E2E dedicado de carrito (desktop 1440 y mobile 390, pie visible durante scroll, sin desborde) y E2E conversacional simulado del asesor (desktop/mobile) pasan; capturas en `test-results/cart-layout-*/cart-page.png` y `test-results/account-advisor-*/advisor-welcome.png`. Build de producción completo tras permitir conectividad a Neon (91 rutas); el primer intento sin red falló consultas de lectura durante prerender y el segundo, con red, terminó limpio. `next-env.d.ts` quedó restaurado a sus imports previos del entorno dev. `CLAUDE.md` está ignorado por `.gitignore`; para incluirlo en un commit hay que agregarlo explícitamente con `git add -f CLAUDE.md`.
- La animación al agregar al carrito quedó implementada desde tarjetas, combos y ficha (incluida la barra fija mobile): miniatura vuela al carrito, contador rebota y luego abre el drawer. Respeta `prefers-reduced-motion`; sin animación disponible abre el drawer normalmente. No modifica la operación del carrito ni crea una orden.
- Verificación tras agregar esa animación: `npm run lint`, `npm run typecheck`, `npm test -- --run` (17 archivos, 117 tests) y `git diff --check` pasan. No se corrieron pruebas de checkout/orden ni se hicieron escrituras en Neon.
- Ingreso/registro: layout en 2 columnas desktop y 1 mobile; footer añadido; «G» de texto reemplazada por el asset oficial aprobado para el modo de ícono (`public/assets/google-signin-icon.svg`), CTA «Continuar con Google» conservado. La guía oficial recomienda botones generados por GIS y permite assets de marca preaprobados; se mantiene Better Auth OAuth para la operación del botón. El launcher flotante se oculta en esas rutas para no tapar el formulario mobile. `e2e/auth-layout.spec.ts` cubre ambos flujos sin crear cuentas.
- Verificación de ingreso/registro: `npm run lint`, `npm run typecheck`, `npm test -- --run` (117/117), `git diff --check` y los 4 E2E desktop/mobile de `/cuenta/ingresar` y `/cuenta/registro` pasan; las capturas están en `test-results/auth-layout-*`. `npm audit` y `npm audit --omit=dev`: 0 vulnerabilidades conocidas según el registro consultado el 9/10/2026. No se ejecutaron E2E de creación de cuenta/orden.
- Build repetido con acceso de red a las lecturas del catálogo: limpio, 91 rutas generadas; el intento sandbox sin red sí imprimió errores Neon aunque terminara con exit code 0, no tomarlo como build limpio. Se restauraron los imports dev originales de `next-env.d.ts` después del build.
- Limpieza CSS (continuación, 9/10/2026): retiradas reglas del prototipo de la antigua página de recomendaciones (ahora redirige), del dashboard de cuenta anterior y de componentes de producto/reseñas/contenido que ya no aparecen en el markup vigente (`product-badge`, `heart-button`, `variant-warning`, `reviews-grid`, `rating-card`, `rating-bars`, `verified`, `feature-cards`, `review-summary`, `brands-block`, `articles-grid`, `article-card`, `community*`). Eliminados además estilos del cuestionario/transcript viejo del asesor, FAQ/nutrición de producto retiradas, miniatura de video inexistente, campo `.account-filter` y marcas antiguas de pago (`payment-brand-mark`, `checkout-summary--whatsapp`). También se quitaron reglas globales obsoletas de contacto/entrega/formulario de tarjeta/confianza/cupón del checkout y estilos sin markup (`checkout-whatsapp-note`, `checkout-unavailable`); se conserva `.checkout-quote`, usada por la cotización actual, y los estilos vigentes de `app/styles/checkout.css`. Las clases dinámicas del asesor conversacional, estados de compra, selección de medio de pago, `.review-card`, `installments` y `stock` se verificaron y conservaron. Validación final de esta tanda: lint, typecheck, 117/117 tests y `git diff --check` pasan; E2E enfocados de home (8/8, desktop/mobile) y conversación del asesor (2/2, desktop/mobile) pasan con el backend simulado. Un barrido PostCSS de seis hojas (globals, home, product, account-advisor, checkout y combos) no encontró selectores huérfanos fuera de las clases construidas dinámicamente (objetivos, estado de carrito, avatar, rol/estado de compra y selección de pago), que se conservaron. La auditoría CSS de las hojas revisadas ya no arroja candidatos estáticos huérfanos; no se ejecutaron E2E que escriben en Neon Production ni una auditoría axe completa.
- Continuación de la consolidación CSS: comparando orden real de importación (`globals.css` seguido por hojas especializadas), se quitaron reglas globales cuyas propiedades quedaban completamente reemplazadas por reglas posteriores del mismo selector (estilos de headings en home, textos de pestañas/resultados, layout móvil de ficha/catálogo, cantidades del carrito y detalles de confirmación). El TODO de consolidación permanece abierto: aún se debe revisar manualmente el resto de reglas duplicadas/solapadas y verificar visualmente las pantallas afectadas antes de darlo por cerrado. No se editaron reglas basándose solo en coincidencia de nombres de clase.
- Verificación de esta continuación CSS (9/10/2026): `npm run lint`, `npm run typecheck`, `npm test -- --run` (120/120) y `git diff --check` pasan. E2E de `home-hero` y `product-photos`: 14 pasaron y 2 se omitieron por ser escenarios específicos de otro viewport. No se ejecutaron flujos que crean pedidos/cuentas ni se tocó Neon.
- Revisión de seguimiento (9/10/2026): se retiraron de `globals.css` 12 declaraciones globales heredadas cuyo mismo selector y propiedad ya estaban cubiertos por las hojas de página que se importan después (comparador, carrito, checkout y confirmación). Se conservaron las reglas activas no duplicadas, incluida la apariencia de controles deshabilitados. La auditoría completa de solapamientos y su revisión visual siguen abiertas; esta limpieza puntual no implica que todo el CSS heredado esté consolidado.
- Verificación de seguimiento: `npm run lint`, `npm run typecheck`, `npm test -- --run` (18 archivos, 120/120), `git diff --check`, `npm audit --audit-level=low` y `npm audit --omit=dev --audit-level=low` pasan; ambos audits informan 0 vulnerabilidades conocidas. E2E enfocados de home/fotos: 14 pasan y 2 se omiten por viewport. No se corrieron pruebas que escriban pedidos/cuentas ni se accedió a Neon. La auditoría de accesibilidad completa y la validación end-to-end de pago/webhook continúan condicionadas a Preview con base aislada y acceso al webhook sin desactivar la protección del sitio.
- Limpieza CSS adicional (9/10/2026): se retiraron también de `globals.css` propiedades base de beneficios, headings, objetivos, banner del asesor, newsletter y footer que `home.css` reemplaza después en el orden global de imports; se conservaron las propiedades no reemplazadas. Validación visual: `home-hero` + `product-photos` (14 pasan, 2 omitidos por viewport) y `account-advisor.spec.ts --grep "asesor conversacional"` (2/2 desktop/mobile); este último intercepta la API. Suite unitaria 120/120, lint, typecheck y `git diff --check` pasan. No se ejecutaron pruebas que creen cuentas/pedidos. La tarea general de consolidar CSS sigue abierta: falta revisar el resto de duplicaciones y solapamientos, y pasar una auditoría visual amplia.
- `npm run checkout:check` en este workspace (9/10/2026) confirma que Mercado Pago y el enlace firmado están configurados localmente, pero retiro, tarifas de envío, efectivo, email y crons no; transferencia tampoco está configurada. El diagnóstico no revela secretos. Esto describe `.env.local` de esta copia y **no** confirma ni modifica las variables del Preview Vercel; volver a correrlo después de preparar la configuración aislada.

### Pendiente que requiere al socio/dueño o base aislada

- Rotación y despliegue de la nueva clave Neon; no pegar secretos en el repo o chat.
- Aprobar/configurar variables y receptor webhook de Preview con un esquema de acceso seguro. Probar pagos solo con cuentas/tarjetas TEST y no considerar `back_url` como confirmación de pago.
- Verificar configuración de variables de Preview y base Neon separada; Production sigue sin credenciales TEST.
- Curaduría de imágenes reales faltantes y SVG oficiales de logos. No inventar etiquetas ni sincronizar imágenes en Neon Production sin aprobación.
- Confirmar precios, domicilio y operación de entrega con el negocio antes de trasladar la configuración provisional de Preview a Production.
- El rate limit de firmas inválidas del webhook ya está implementado: en Vercel toma la primera IP válida del header `x-forwarded-for` que el edge sobrescribe y guarda solo un HMAC; si falta o es inválida, usa un bucket común de contingencia sin confiar ese valor. Los webhooks válidos no se limitan. Sigue pendiente acordar monitorización de endpoints y panel mínimo de órdenes antes del lanzamiento comercial.
- ARCA, Google Business/Places, Resend, stock real, política de cambios, redes e información legal requieren información del negocio/contador.

### Seguimiento del análisis y correcciones posteriores (9/10/2026)

- Se releyó la sección de pendientes completa y se revisó el último cambio del socio que está en `HEAD` (`21e1195`, `Franco Lesme`). Es de presentación/assets/composición de combos; no añade endpoints de escritura, tratamiento de secretos, ni HTML/JS dinámico nuevo. Los riesgos conocidos que siguen abiertos son operativos/configuración —Neon Production compartido, rotación de credencial, Preview protegido y falta de QA de pagos con DB aislada—, no se deben dar por corregidos por pasar `npm audit`.
- Limpieza CSS segura por cascada real (`globals.css` precede a `home.css`, `account-advisor.css` y `checkout.css`): se retiraron propiedades repetidas de carrito, cupón, totales, checkout, selector de pago, formulario, newsletter, tarjeta de reseña, imagen de producto y detalles de transferencia; las propiedades no duplicadas se conservaron. No se hizo una sustitución global de clases ni se eliminaron reglas dinámicas.
- `e2e/floating-buy-catalog.spec.ts` tenía un selector obsoleto del comparador (`#informacion-nutricional`); ahora apunta a la galería vigente `#galeria-producto`. Verificado con `e2e/search.spec.ts` + `e2e/floating-buy-catalog.spec.ts`: 13 pasan, 1 se omite intencionalmente por viewport.
- Verificación actual: `npm run lint`, `npm run typecheck`, `npm test -- --run` (18 archivos, 120/120), `git diff --check` y los E2E de búsqueda/catálogo (13 pasan, 1 omitido por viewport) pasan. En la última pasada se inició por error el archivo completo `e2e/account-advisor.spec.ts` (no solo el test conversacional): registró una cuenta QA aleatoria y avanzó hasta checkout; se interrumpió esperando el nombre de un botón obsoleto antes de crear una orden. Por tanto, pudo quedar una cuenta `quilgym-qa-desktop-<timestamp>@example.com` en la DB configurada. No se ejecutó ninguna otra prueba de escritura después de detectarlo. No borrar ni modificar ese registro sin autorización; primero confirmar cuál es la DB activa y, si hace falta, identificar el correo con el trace del test.
- `e2e/checkout.spec.ts` y el flujo de cuenta recibieron una actualización parcial de los nombres actuales de CTA de retiro/pago y permiten query params en la URL de retorno. Aún quedan aserciones/escenarios viejos (incluido WhatsApp) por revisar y verificar; no se ejecuta la parte que crea/cancela órdenes hasta tener DB aislada y modo demo del proceso. La tarifa `$4.200` es el valor de simulación local vigente, no un precio real de entrega.
- Protección añadida a E2E con escrituras: las pruebas de registro/órdenes ahora se omiten salvo que `E2E_ALLOW_DATABASE_WRITES=1` y `E2E_DATABASE_URL` apunte a un endpoint/database distinto del `DATABASE_URL` configurado (compara host/puerto/database e ignora credenciales/query para no considerar un cambio de contraseña como aislamiento). Al habilitarlas, Playwright inicia un servidor nuevo (no reutiliza un dev server potencialmente conectado a otra DB) y fuerza demo/URL local con esa conexión aislada. Verificado sin habilitar escrituras: el test de registro se omite en desktop y mobile. Tests unitarios cubren consentimiento explícito, endpoint igual con password/options distintos y URLs inválidas. Los tests visuales y simulados no quedan condicionados. Falta probar el camino habilitado con una DB aislada real y corregir sus aserciones obsoletas antes de dar por terminada la suite.
- Incidente de QA de esta sesión: al intentar ejecutar la pasada visual de `account-advisor.spec.ts` sin filtrar el título, el primer test registró una cuenta QA aleatoria (`quilgym-qa-desktop-1791573545058@example.com`, nombre «Cliente QA») y se detuvo esperando un botón de checkout que ya no existe. No llegó a crear el pedido; el registro pudo persistir en la DB configurada. Tras descubrirlo, se interrumpió la suite, se añadió la protección anterior y no se repitieron tests de escritura. El usuario preguntó de dónde salió; se explicó que la genera el E2E. No borrar datos sin autorización explícita del titular.
- La pasada visual limitada por nombre de test para home/hero/marcas, galería de producto y asesor (API simulada), desktop y mobile: 22 pasan y 2 se omiten intencionalmente por viewport. No incluyó el test que registra cuentas.
- Después de actualizar selectores E2E de cuenta/checkout: lint, TypeScript, 120/120 unitarios y `git diff --check` vuelven a pasar. El test de registro continúa omitido por guard en ambos viewports; las rutas de escritura aún no se validaron funcionalmente en DB aislada.
- Los pendientes marcados en §§23–24 que dependen de negocio, titular o proveedor siguen abiertos y no son tareas que se puedan completar con cambios locales: credencial Neon nueva, env/DB de Preview y acceso firmado al webhook (Vercel respondió 401 antes del handler), datos fiscales/ARCA, email/remitente, cuenta receptora, precios/logística definitivos, stock, políticas, imágenes/logos oficiales y política de limpieza Blob. No copiar credenciales al chat ni usar Production para pruebas. Las fotos de producto no se inventan ni se sincronizan a Neon Production.
- El inventario de pendientes de frontend sigue abierto donde requiere assets oficiales o decisión del negocio (curaduría de 3 fotos por producto, logos monocromos, franja de beneficios) y donde requiere QA amplio (teclado manual y checkout/compra). El barrido axe de rutas públicas ya está cubierto en §25. La consolidación CSS general también permanece abierta: esta ronda quitó duplicaciones verificables, pero todavía necesita revisión manual/visual del resto. No se marcaron esos temas como completados.

## 25. Seguimiento de accesibilidad y seguridad — 9/10/2026

- Añadido `@axe-core/playwright` y `e2e/accessibility.spec.ts`: axe analiza inicio, catálogo, ficha de producto, búsqueda, comparador, carrito vacío, ingreso y asesor en los proyectos desktop/mobile. La ruta de reseñas se intercepta en el navegador para que este E2E no incremente su rate limit de Postgres. Primer barrido encontró bajo contraste en el saludo del asesor de home y las ayudas «ESC» de búsqueda; se corrigieron los selectores/colores, y la repetición ampliada pasó los 16 escenarios sin violaciones WCAG 2.1 A/AA. Esto no sustituye navegación manual por teclado ni el barrido de checkout, compra y rutas autenticadas.
- La inspección de seguridad de esta continuación confirmó en código: cookies de carrito HttpOnly, cálculo de precio/stock en servidor, sesión Better Auth con secreto mínimo requerido en producción, administración protegida por email verificado más vinculación Google, upload Blob restringido a admin/tipos MIME/tamaño/ruta, firma HMAC con tolerancia temporal en webhook, cron con Bearer secreto y límites de gasto/intentos. El único `dangerouslySetInnerHTML` encontrado es JSON-LD generado con `JSON.stringify` y `<` escapado como `\\u003c`; no se encontró `innerHTML`, `eval` ni `new Function`. Hallazgo operativo pendiente: el webhook Preview todavía debe hacerse alcanzable sin saltar la protección del sitio.
- `npm audit --audit-level=low` y `npm audit --omit=dev --audit-level=low`: 0 vulnerabilidades conocidas en el registro consultado durante esta revisión. `npm run lint`, `npm run typecheck`, `npm test -- --run` (19 archivos, 122/122) pasan.
- `npm run build`: repetido con conectividad para lecturas del catálogo; compilación y prerender limpios, 91 páginas generadas. La primera pasada restringida terminó con exit code 0 pero registró fallos de lectura de Neon; no tomarla como verificación válida. Se restauraron en `next-env.d.ts` las referencias del entorno dev después del build.
- Limpieza CSS puntual: retirado `.cart-items h2`, selector sin markup vigente (el drawer muestra `h3`). Se reforzó el selector del saludo de home porque la regla genérica `.advisor-banner p:not(.eyebrow)` tenía mayor especificidad que el color oscuro del globo; búsqueda ahora usa texto de ayuda/kbd con contraste suficiente. Se repitió el E2E axe ampliado: 16/16 pasan. Quedan checkout con pedido/confirmación y teclado manual, que necesitan fixture de datos aislado.
- El test de registro E2E genera una cuenta efímera en `/cuenta/registro` con nombre «Cliente QA» y correo `quilgym-qa-<proyecto>-<timestamp>@example.com`; la conexión destino es la que tenía `DATABASE_URL` al iniciar el servidor. Un intento anterior alcanzó a crear una cuenta en la base compartida configurada y se detuvo antes de crear pedido. El usuario preguntó su origen; se explicó que fue el test. **No borrar ni cambiar ese usuario/datos sin autorización expresa.** El guard actual impide nuevas escrituras E2E salvo consentimiento y `E2E_DATABASE_URL` aislada.
- La auditoría y los cambios locales no cierran los pendientes operativos de §§23–24: base Neon aislada y rotación del secreto expuesto, acceso de webhook Preview, pruebas reales TEST de Checkout Pro/Brick en entorno configurado, ARCA, correo, stock/precios/logística finales, activos oficiales de producto/marcas, franja de beneficios y limpieza completa de CSS. Requieren credenciales/datos/decisiones del titular o acceso externo; no inventarlos ni hacer pruebas contra Production.

### Verificación adicional del inventario y de los cuatro ajustes visuales (9/10/2026)

- Se agregó `npm run images:check` (`scripts/check-product-gallery.mjs`), diagnóstico local de solo lectura que compara la curaduría/manifiesto con los archivos públicos y sus dimensiones. No descarga archivos, no sincroniza Neon y no modifica assets. Corregida la resolución de rutas: las URLs `/assets/...` deben buscarse dentro de `public/`, no en la raíz del repo.
- Resultado actual del inventario: 59 productos no combo; 36 no alcanzan 2 fotos de producto, 13 no tienen rótulo nutricional y 70 fotos de producto son menores a 1200 px; 0 archivos ausentes/ilegibles entre los assets locales. El umbral y el mínimo corresponden al estándar de curaduría pendiente de §23, no significan que los assets existentes estén aprobados por marca. No se reemplazó ni sincronizó ninguna foto.
- Revisión npm actual: `npm audit --audit-level=low` y `npm audit --omit=dev --audit-level=low`, ambos 0 vulnerabilidades conocidas en la consulta del 9/10/2026.
- E2E actual de `e2e/home-hero.spec.ts` y `e2e/account-advisor.spec.ts`: 18 pasaron y 2 de registro/compra se omitieron por el guard de escrituras a DB. Se comprobaron chip ausente, franja oculta solo en mobile, control de pausa ausente y panel lateral del asesor oculto solo en mobile. `npm run lint` y `git diff --check` pasan. No se habilitaron E2E de escritura ni se tocó Neon.
- Sigue abierta la consolidación general de CSS; esta verificación no autoriza borrar reglas globales por coincidencia textual. `CLAUDE.md` continúa excluido por `.gitignore`; incluirlo en un commit requiere `git add -f CLAUDE.md`.
- Barrido estático adicional de clases CSS vs. TS/TSX (9/10): los candidatos sin coincidencia literal son clases construidas dinámicamente (`objective--${tone}`, `cart-feedback--${tone}`, `purchase-status--${status}`, `advisor-entry--${role}`, `account-avatar--${size}`, `payment-mark--${kind}`, estados de pasos y estados del admin); el falso candidato `.tsx` proviene de un comentario de `combos.css`. No se encontró una regla inequívocamente huérfana con este barrido. La auditoría CSS completa sigue abierta porque el análisis estático no prueba cascada, variantes de runtime ni corrección visual.
- Se integró la franja de beneficios como banda translúcida dentro del hero en desktop/tablet, antes de la cinta de marcas, y sigue oculta hasta 768 px para no recargar mobile. `e2e/home-hero.spec.ts` ahora valida presencia/visibilidad y 5 beneficios por viewport; E2E home: 8/8 pasan. El barrido axe completo volvió a pasar 16/16 rutas/viewports. También pasan lint, typecheck y `git diff --check`.

### Cierre de auditoría y traspaso (9/10/2026)

- Los cuatro ajustes solicitados en capturas quedan implementados: chip del hero fuera en ambos tamaños; franja de confianza oculta solo en mobile; control visible de pausa de marcas eliminado; panel lateral gris del asesor oculto en mobile y conservado en escritorio. La franja de beneficios se integró aparte dentro del hero en escritorio/tablet, no se muestra en mobile. Verificaciones: `e2e/home-hero.spec.ts` (8/8) y `e2e/accessibility.spec.ts` (16/16), además de lint/typecheck/diff check.
- Seguridad: los dos `npm audit` (completo y producción) dieron 0 vulnerabilidades conocidas. La revisión de código documentada arriba no equivale a pentest; siguen pendientes rotación de Neon, aislamiento de Preview, acceso del webhook y pruebas de compra aisladas. No ejecutar pruebas de escritura sobre Neon Production.
- Imagen de Beast Blood: se verificó como fuente oficial la ficha https://bodyadvancenutrition.com/product/beast-blood-pre-entreno-uva-2/ y su imagen https://bodyadvancenutrition.com/wp-content/uploads/2021/10/PRE-WORK-UVA.png (PNG 1600×900, etiqueta UVA/280 g, coincide con el producto actual). **Aún no se incorporó al repo**: el archivo solo se descargó temporalmente para inspección. Siguiente paso seguro: recortar/optimizar a WebP, revisar visualmente el resultado y actualizar `public/assets/products/preentreno-beast-blood/01.webp`, `data/product-images.json` y `data/product-gallery-curation.json`; no sincronizar Neon hasta aprobación y despliegue de assets.
- Inventario al cierre: `npm run images:check` informa 59 productos no combo; 36 con menos de 2 fotos de producto, 13 sin rótulo nutricional, 70 fotos de producto por debajo de 1200 px y 0 archivos locales ausentes/ilegibles. Mantener fuente oficial y sabor/tamaño correctos; no inventar ni reescribir rótulos.
- Al cierre, `rg -c "^- \\[ \\]" CLAUDE.md` daba 30 ítems sin marcar. Ver §§10 y 23–25 para la lista completa. Los que requieren datos/decisiones del socio o dueño incluyen stock, promociones, logística final, logos oficiales, ficha Google Business, datos fiscales y ARCA. Los que requieren configuración externa incluyen Resend/Places, DB aislada y variables de Preview, secreto Neon y receptor webhook. Los pendientes de desarrollo local incluyen panel de órdenes, newsletter real, pipeline de imágenes con `--dry-run`, limpieza segura de fotos antiguas de combos, CSS completo y E2E/teclado en entorno aislado.
- No se modificó Neon ni se ejecutó un pago con esta auditoría; no hubo commit ni deploy. `CLAUDE.md` está ignorado por `.gitignore`; para entregarlo al socio en Git, agregarlo explícitamente con `git add -f CLAUDE.md`.

## 26. Sesión 9/10/2026 (tarde): pendientes en curso — TRABAJO A MEDIAS, SIN VERIFICAR

El usuario pidió hacer todos los pendientes de CLAUDE.md + problemas visuales detectados + un problema de login (sin la auditoría manual de teclado). Se repartió en áreas con agentes en paralelo; **la sesión se cortó por capacidad y los agentes se detuvieron antes de terminar**. Los cambios están en el working tree (≈59 archivos, sin commit) y **no pasaron lint/typecheck/tests/build ni revisión**. Antes de seguir: `git status`, `git diff`, y correr `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Puede haber archivos con ediciones incompletas.

**Diagnóstico de login (confirmado):** Better Auth responde 403 `INVALID_ORIGIN` a cualquier Origin distinto de `BETTER_AUTH_URL` (local = `http://localhost:3000`): falla al probar desde el celular por la IP de red del dev server y en Vercel Preview (hostname por deployment / alias de rama). `auth-form.tsx` mostraba «Email o contraseña incorrectos» para ese 403. Better Auth 1.7 no vincula Google implícitamente si el email local no está verificado (`requireLocalEmailVerified` default true): sin riesgo de toma de cuenta por pre-registro.

**Problemas visuales detectados (a corregir/verificar):** (1) banner del asesor en home desktop: círculo gris claro enorme a la derecha, CTA blanco encima y leyenda gris sobre gris; (2) pestañas de categorías del catálogo cortadas a 1440 sin indicio de scroll; (3) ficha desktop: columna de compra mucho más baja que la galería (hueco); (4) flotantes (WhatsApp/asesor) tapan el borde derecho de tarjetas/franja a 1440 y la cinta de marcas en el hero mobile; (5) /asesor mobile: 3.ª sugerencia cortada por el composer y aviso legal de ~6 líneas. Copy a consultar con Lorenzo: «Te orientamos en 3 minutos» / «para que logres alcanzar tu objetivo» roza la regla de no prometer resultados.

**Áreas y archivos tocados (estado parcial):**
- *Vidriera:* `app/page.tsx`?, `app/styles/{home,catalog,product,account-advisor}.css`, `components/{advisor-launcher,advisor-chat,catalog-view}.tsx`, `app/productos/[slug]/page.tsx`.
- *Auth:* `lib/auth.ts`, nuevos `lib/auth-origins.ts`, `lib/auth-errors.ts`, `lib/auth-email.ts` (reset/verificación vía Resend solo si hay `RESEND_API_KEY`+`EMAIL_FROM`), `components/auth-form.tsx`, páginas nuevas `app/cuenta/recuperar` y `app/cuenta/restablecer`, `app/styles/auth.css` (importado en `app/layout.tsx`).
- *Panel de pedidos:* nuevo `app/admin/pedidos/**`, `components/admin-orders-*.tsx`, `lib/admin-orders*.ts` (+ test), cambios en `lib/mercadopago.ts`, `lib/order-email.ts`, `app/admin/layout.tsx`, `app/styles/admin-orders.css` (importado en el layout admin). Objetivo: listar/filtrar, confirmar efectivo/transferencia, cancelar, tracking/estado de envío, reembolso registrado y alerta de pago aprobado sobre pedido cancelado.
- *Admin de catálogo:* `app/admin/productos/**` (nuevos `categorias/`, `marcas/`), `components/admin-product-form.tsx`, `components/admin-catalog-{nav,taxonomy}.tsx`, `lib/admin-{actions,catalog}.ts`, **`lib/db/schema.ts` + migración nueva `drizzle/0007_admin_stock_history.sql` (+ `_journal.json`, snapshot) NO aplicada** — verificar que el código no consulte la tabla nueva sin la migración antes de desplegar; no aplicar en Neon Production sin autorización.
- *Comparador:* `app/comparar/page.tsx`, `lib/compare.ts` (+ test), `components/compare-picker*.tsx`, `app/styles/compare.css` (importado), `e2e/compare.spec.ts`. Objetivo: hasta 3 productos en `?p=slug1,slug2,slug3`.
- *Checkout:* `components/checkout-form.tsx`, `app/styles/checkout.css` (pasada visual, axe de carrito/checkout, E2E actualizados y E2E guardados de link firmado/vencimiento — probablemente incompleto).
- *Fotos:* `scripts/fetch-official-photos.mjs`, `scripts/lib/`, `scripts/build-product-images.mjs` (pipeline v2 desde fuentes oficiales en `data/product-photo-sources/<marca>.json`); falta `db:sync-images` (dry-run por defecto, `--apply` explícito), Beast Blood (fuente oficial en §25), revisar 2.ª foto de STAR 2 lb, logos monocromos oficiales, preparar limpieza `combo-*`. La curaduría completa por marca quedó para otra sesión.

**Verificado al cortar (9/10):** typecheck 0 errores (se corrigió un tipo de `process.env` en `lib/admin-catalog.ts`); lint limpio (se corrigió un setState síncrono en `components/advisor-launcher.tsx`); `npx vitest run` 21 archivos / 147 tests OK; rutas `/`, `/productos`, ficha, `/comparar` (con y sin `?p=`), `/asesor`, `/cuenta/{ingresar,registro,recuperar,restablecer}`, `/carrito`, `/buscar` responden 200 en dev y `/admin/pedidos` redirige (307) sin sesión. **Login corregido y probado:** `POST /api/auth/sign-in/email` con Origin `http://192.168.x.x:3000` ahora da 401 (credenciales) en vez de 403; un origen ajeno sigue en 403 `INVALID_ORIGIN`, y `lib/auth-errors.ts` muestra un mensaje específico para ese caso. Falta: build, E2E, capturas 1440/390, revisión de cada área y probar el login en un Preview real.

`package-lock.json` tenía cambios previos solo de flags `"peer"` (diferencia de versión de npm): descartable. No se escribió en Neon, no hubo commit ni deploy.

**Para retomar (orden sugerido):** 1) verificar compilación y tests; 2) por área, revisar el diff, completar y corregir (una revisión por área alcanza); 3) build, E2E de solo lectura y capturas 1440/390 con gstack; 4) actualizar esta sección con el estado final.

### 26.1 Avance verificado a mano (9/10, sin agentes)

- **Problemas visuales 1–5: resueltos y verificados con capturas.** Banner del asesor (anillo sutil, CTA y leyenda legibles); pestañas del catálogo con degradé y flecha de scroll a 1440; ficha desktop equilibrada (entrega + franja de confianza en la columna de compra); flotantes sin tapar contenido a 1440; en mobile se ocultan sobre la cinta de marcas del hero (`data-covering`; se agregó `ResizeObserver` + `load` porque el cálculo inicial corría antes del layout) y reaparecen al bajar; `/asesor` mobile con las 3 sugerencias visibles y aviso legal compacto con «Más info».
- **Comparador:** link «Comparar con otras {categoría}» en la ficha (no en combos) → `/comparar?p=<slug>&categoria=<cat>`; columnas con tope de 340 px en desktop para que 1–2 productos no se estiren. Pendiente menor: con 1–2 productos la caja blanca de la tabla sigue a ancho completo y la cabecera «Atributos» muestra un «HASTA 3» suelto.
- **Migración `0007` (historial de stock):** el código consulta `to_regclass('public.product_stock_changes')` antes de leer/escribir; sin migración el historial queda desactivado y el guardado funciona. Aplicarla en Neon solo con autorización.
- gstack browse se cae seguido en esta máquina («Server crashed twice»): para verificaciones puntuales sirve un script Playwright suelto en el scratchpad.
- **Checkout:** recorrido revisado hasta el paso de pago (390, sin enviar): checkbox, notas y CTA con total correctos. «Efectivo» deshabilitado ahora explica el motivo («Solo al retirar en el local» / «No disponible por ahora», clase `.payment-unavailable`). Comparador: se quitó el «HASTA 3» suelto.
- **E2E de solo lectura (9/10):** home-hero, auth-layout, compare, accessibility (axe), floating-buy-catalog, search, cart-layout, product-photos y mobile-header → 58 pasaron, 6 omitidos (guard de escrituras / viewport), 2 fallos del comparador: uno era un bug del test (calculaba el slug esperado antes de quitar; corregido) y el de mobile fue intermitente por compilación del dev server (pasa aislado). Lint y typecheck limpios; 147 unitarios OK.
- **Build de producción (9/10):** limpio, 93 páginas; se restauró `next-env.d.ts` al estado dev.
- **Fotos (estado al cortar):** existen `scripts/fetch-official-photos.mjs` (baja y valida fuentes de `data/product-photo-sources/<marca>.json` a `.cache/official-photos/`, con `--brand`, `--only`, `--refresh`), `scripts/lib/product-photos.mjs` y cambios en `scripts/build-product-images.mjs` (sintaxis OK, **no ejecutado**). **Faltan:** la carpeta `data/product-photo-sources/` (ningún JSON cargado), los scripts npm `images:official:*`, el script `db:sync-images` (dry-run por defecto), Beast Blood, la revisión de la 2.ª foto de STAR 2 lb, los logos monocromos y la limpieza de `combo-*`. `npm run images:check` sin cambios: 59 productos, 36 sin 2.ª foto, 13 sin rótulo, 70 fotos < 1200 px. Antes de correr `images:build`, revisar el diff de `build-product-images.mjs` para que no pise las fotos actuales.
- **Sin QA visual con sesión admin:** el panel de pedidos (`/admin/pedidos`) y las mejoras del admin de catálogo (marcas, categorías, variantes, filtros, limpieza Blob) compilan, pasan lint/typecheck y sus tests unitarios (incluidos en los 147), pero no se revisaron en pantalla ni con un revisor. Probarlos con la cuenta `quilgym@gmail.com` en local antes de commitear.
- **Pendiente menor del comparador:** con 1–2 productos, las cajas blancas de tarjetas y tabla siguen a ancho completo (el fondo no lo pone `.compare-products`/`.compare-table`; buscar el contenedor real en `app/styles/product.css`/`compare.css`).

### 26.2 Pendientes para continuar (checklist de traspaso)

Todo lo de §26 quedó commiteado en `mp-sandbox` (sin push). Al retomar, empezar por acá:

- [ ] **Panel de pedidos** (`/admin/pedidos`): probar en local con `quilgym@gmail.com` (Google vinculado) listado, filtros, detalle, confirmar efectivo/transferencia, cancelar, tracking/estado de envío, reembolso registrado y alerta de pago aprobado sobre pedido cancelado. Revisar el código con una pasada de revisión (no tuvo revisor).
- [ ] **Admin de catálogo:** probar filtros/orden/paginación, alta/edición de marcas y categorías, variantes secundarias, aviso de guardado y limpieza de Blob huérfanos. Sin revisor todavía.
- [ ] **Migración `0007_admin_stock_history`:** aplicar en Neon solo con autorización (el código funciona sin ella).
- [ ] **Login en Vercel Preview:** desplegar `mp-sandbox` y probar ingreso/registro en el hostname del deployment y en el alias de rama (`lib/auth-origins.ts`). Google OAuth queda deshabilitado en Preview salvo que `BETTER_AUTH_URL` coincida con el host.
- [ ] **Recuperación de contraseña y verificación de email:** listas en código (`lib/auth-email.ts`, `/cuenta/recuperar`, `/cuenta/restablecer`); se activan con `RESEND_API_KEY` + `EMAIL_FROM`. Probar con correo real cuando exista Resend.
- [ ] **Fotos:** crear `data/product-photo-sources/<marca>.json`, scripts npm `images:official:*`, script `db:sync-images` (dry-run por defecto, `--apply` explícito), incorporar Beast Blood (fuente en §25), revisar la 2.ª foto de STAR 2 lb, logos monocromos oficiales (Body Advance, One Fit, Gold) y limpiar `combo-*` tras el sync. Revisar el diff de `scripts/build-product-images.mjs` antes de correrlo.
- [ ] **Comparador:** con 1–2 productos, las cajas blancas siguen a ancho completo (detalle menor).
- [ ] **Checkout:** E2E de escritura (pedidos, link firmado `?t=`, vencimiento) solo con base Neon aislada (`E2E_ALLOW_DATABASE_WRITES=1` + `E2E_DATABASE_URL`).
- [ ] **Copy a revisar con Lorenzo:** banner del asesor «Te orientamos en 3 minutos» / «para que logres alcanzar tu objetivo» (roza la regla de no prometer resultados).
- [ ] **Seguir con §10:** datos del negocio (transferencia, Resend, stock real, promociones, logos, Google Business), rotar la contraseña de Neon, base aislada para Preview, webhook de Mercado Pago en Preview, ARCA, newsletter real, consolidación CSS de `globals.css`, transcripción de rótulos (validar con el negocio).
