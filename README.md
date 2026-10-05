# QuilGym

E-commerce de suplementos deportivos construido con Next.js, TypeScript y Postgres. La experiencia incluye catálogo con filtros, búsqueda predictiva, fichas de producto, comparador, asesor guiado y un recorrido de compra.

> Estado actual: catálogo (68 productos), carrito, pedidos de prueba, cuentas y favoritos funcionan contra Postgres. El asesor explica opciones según las respuestas. Las integraciones de pagos reales, Google OAuth y reseñas esperan sus credenciales; no se activaron cobros.

## Funcionalidades

- Home con destacados, combos y marcas leídos de la base.
- Catálogo con categorías, filtros por marca, precio y stock, orden y paginación; todo en la URL para poder compartirlo.
- Búsqueda predictiva sin distinción de acentos, por varias palabras, con historial local.
- Fichas de producto estáticas con revalidación cada 5 minutos y datos estructurados `Product`.
- Carrito persistente (cookie HttpOnly + Postgres): agregar desde tarjetas o ficha, cantidades, cupones, contador en el header y drawer accesible. Precio, stock y cupón se recalculan siempre en el servidor y avisan si algo cambió.
- Checkout con el resumen real del carrito; bloquea el pago si hay productos sin stock o precios sin confirmar.
- Asesor guiado: experiencia, tiempo entrenando, objetivo, rutina, alimentación, restricciones y presupuesto. Reglas versionadas con motivos por producto, stock y precio actuales; no prescribe dosis ni exige comprar.
- Botón flotante gris del asesor con bienvenida y acceso a la conversación completa.
- Registro con nombre, email y contraseña; sesión persistente y revocable de 30 días con Better Auth. Acceso con Google preparado (requiere credenciales).
- Favoritos por usuario en tarjetas y fichas, con sección propia en `/cuenta`.
- Cuenta con favoritos, pedidos realizados conectado y consentimiento opcional para novedades; aún no se envían campañas.
- Carrito offcanvas con animación de entrada/salida, foco modal, Escape y respeto por movimiento reducido.
- Ubicación clicable y acceso a opiniones originales de Google. Carrusel preparado para Google Places; sin API configurada muestra el enlace a Maps, sin reseñas ficticias.
- Checkout con cotización firmada, órdenes persistentes, idempotencia, confirmación dinámica y simulador local. Adaptadores de Mercado Pago, emails y crons listos para configurar.
- Comparador todavía con selección fija; panel administrativo pendiente.

## Stack

- Next.js 16 (App Router) y React 19
- TypeScript
- Tailwind CSS 4 y CSS propio en `app/globals.css`
- Postgres en Neon con Drizzle ORM
- Despliegue previsto en Vercel

Server Components por defecto; solo las zonas con estado del navegador son Client Components.

## Inicio rápido

Requisitos: Node.js 24 (ver `.nvmrc`) y npm. Si actualizaste el repositorio, sincronizá dependencias con `npm ci`.

```bash
npm ci
# Solo si no existe .env.local: crearlo según .env.example y completar DATABASE_URL.
npm run db:migrate           # aplica únicamente migraciones pendientes
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

No sobrescribir `.env.local`. El catálogo ya está cargado en la base compartida: **no ejecutar `db:seed`**, ya que reemplaza datos comerciales. Para una base nueva, usarlo una sola vez después de migrar.

Si faltan módulos después de actualizar el repositorio, ejecutar `npm ci`. Se detectaron copias repetidas del caché generado con nombres como `.next/dev/types/routes.d 2.ts`: TypeScript excluye esos archivos con espacios, únicamente dentro de `.next`, manteniendo las definiciones originales y el chequeo del código fuente.

### Cuentas y Google

El registro con email/contraseña funciona en desarrollo sin configurar Google. Las contraseñas se guardan con hash scrypt y las sesiones se verifican en Postgres mediante cookies HttpOnly; no se guarda el acceso en localStorage.

Para habilitar Google, completar `BETTER_AUTH_SECRET` (aleatorio, 32+ caracteres), `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. En Google Cloud, registrar el callback `http://localhost:3000/api/auth/callback/google` y el callback HTTPS del dominio cuando exista. Reiniciar el servidor después de cambiar variables. Sin credenciales, el botón aparece deshabilitado y explica su estado.

Producción requiere un secreto propio y una URL HTTPS; nunca utiliza el secreto exclusivo de desarrollo. Antes del lanzamiento hay que agregar verificación de email, recuperación de contraseña y políticas de privacidad con los datos del negocio.

### Reseñas de Google

La consulta pública desde este entorno devuelve una vista limitada sin los textos de las opiniones. No se copiaron reseñas ni se inventaron puntuaciones. El mapa y el enlace a todas las opiniones ya funcionan.

`GOOGLE_MAPS_API_KEY` y `GOOGLE_PLACE_ID` habilitan el adaptador oficial de Places (New), que devuelve **hasta cinco reseñas**, no todas. El carrusel conserva autor, puntuación, texto y enlace de origen, permite pausar, y no persiste ni cachea datos de Places. Para publicar todas se necesita una fuente autorizada del Perfil de Empresa y su integración, pendiente. No etiquetar opiniones de Maps como compras verificadas.

## Scripts

| Script | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm run start` | Build y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm test` | Tests unitarios (Vitest) |
| `npm run test:e2e` | Navegador en 1440 y 390 px: checkout, cuentas, favoritos, asesor y carrito |
| `npm run checkout:check` | Diagnóstico del checkout sin exponer secretos |
| `npm run db:generate` | Genera una migración a partir de `lib/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Carga o actualiza el catálogo desde `data/tiendanube-catalog.json` |
| `npm run db:studio` | Explorador visual de la base |
| `npm run images:fetch` | Descarga las fotos de la tienda anterior a `.cache/` |
| `npm run images:build` | Genera las imágenes finales de producto según la curaduría |
| `npm run images:hero` | Genera la imagen del hero de la home |

## Datos

- `lib/db/schema.ts`: marcas, categorías, productos y variantes. Los importes se guardan en pesos enteros. `stock = null` significa que el inventario todavía no se controla y el producto se vende como disponible; `0` es sin stock.
- `lib/catalog.ts`: lecturas del catálogo, cacheadas con la etiqueta `catalog` (5 minutos).
- `lib/cart.ts` y `lib/cart-actions.ts`: lectura recalculada del carrito y Server Actions. El cliente solo envía IDs de variante y cantidades; nunca precios.
- `lib/pricing.ts`: reglas puras de cupones y cantidades, con tests.
- `lib/commerce.ts`: políticas visibles (cuotas sin interés, descuento por transferencia, envío gratis). Un valor en 0 o `null` oculta el mensaje.
- `data/product-content.json`: descripciones de los 68 productos (párrafos, `## ` subtítulos y `- ` listas; sin HTML).
- `data/product-gallery-curation.json`: qué fotos usa cada producto (tienda anterior o sitio oficial de la marca) y cuáles son rótulos nutricionales. `npm run images:build` la procesa a `public/assets/products/` y escribe `data/product-images.json`, que lee el seed.
- `data/tiendanube-catalog.json`: lista y precios relevados de la tienda anterior el 3/10/2026, con marca y categoría normalizadas.

## Rutas

| Ruta | Descripción |
| --- | --- |
| `/` | Página principal |
| `/productos` | Catálogo (`categoria`, `marca`, `precio`, `stock`, `q`, `orden`, `pagina`) |
| `/productos/[slug]` | Ficha de producto |
| `/buscar` | Búsqueda predictiva |
| `/comparar` | Comparador |
| `/asesor` | Asesor guiado |
| `/asesor/recomendaciones` | Recomendaciones del asesor |
| `/cuenta/ingresar` | Email/contraseña y acceso con Google configurable |
| `/cuenta/registro` | Registro de cliente |
| `/cuenta` | Favoritos, pedidos y preferencias; requiere sesión |
| `/carrito` | Carrito |
| `/checkout` | Finalización de compra |
| `/checkout/confirmacion/[orderId]` | Pedido real o demo, autorizado por carrito, cuenta o link firmado |
| `/api/auth/[...all]` | Endpoints de Better Auth |
| `/api/account/favorites` | Favoritos privados de la sesión; sin caché |
| `/api/reviews` | Datos de Google configurado o estado sin datos; sin caché |

## Limitaciones actuales

- La información nutricional se muestra como foto del rótulo (todavía no transcripta a texto accesible).
- Algunos productos no tienen rótulo disponible (combos, shakers, barras Mervick/Brava, Landerfit, Beast Blood, Body Advance 3 kg y magnesio, óxido nítrico y colágeno ENA).
- No hay cupones cargados: se crean en la tabla `coupons` (todavía sin panel).
- Las compras siguen en modo de prueba local: los pedidos demo no consumen stock, cupones ni envían emails. Las integraciones reales quedan deshabilitadas hasta configurarlas y validarlas en sandbox.
- Google OAuth requiere sus credenciales. Verificación de email y recuperación de contraseña pendientes antes de producción.
- El carrito sigue ligado al navegador; no se sincroniza entre dispositivos. Los favoritos y los nuevos pedidos del usuario sí son propios de su cuenta. No se asignan compras históricas por coincidencia de email.
- Los pedidos asociados a una cuenta requieren su sesión (o un enlace firmado válido); cerrar sesión corta el acceso mediante la cookie del carrito. Los pedidos de invitado mantienen su autorización por carrito.
- El asesor aplica reglas, no una IA generativa ni una evaluación nutricional. Puede devolver menos de tres productos o ninguno. No conoce certificaciones ni alérgenos de todo el catálogo.
- Las reseñas auténticas dentro del carrusel siguen pendientes de acceso a su fuente; el enlace a Google Maps está activo.
- Comparador fijo y panel de administración pendientes.

## Próximos pasos

1. Revisar esta etapa y configurar Google OAuth y la fuente autorizada de reseñas.
2. Completar comparador y panel de administración de productos, órdenes, precios, stock e imágenes.
3. Datos del negocio, staging, sandbox real de Mercado Pago y emails; sin habilitar pagos productivos antes de verificar el flujo.
4. Verificación de email, recuperación de contraseña, legales, accesibilidad, seguridad y observabilidad antes del lanzamiento.

## Reglas de contribución

- No modificar ni eliminar `design-reference/`.
- Reutilizar componentes y tokens antes de crear variantes.
- Mantener Server Components como opción predeterminada.
- No mostrar promociones, reseñas ni métricas que no sean reales.
- No almacenar números de tarjeta ni CVV.
- Ejecutar lint, typecheck y build después de cambios relevantes.

## Licencia

Proyecto privado. No se ha definido una licencia pública.
