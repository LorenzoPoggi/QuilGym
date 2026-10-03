# QuilGym

E-commerce de suplementos deportivos construido con Next.js, TypeScript y Postgres. La experiencia incluye catálogo con filtros, búsqueda predictiva, fichas de producto, comparador, asesor guiado y un recorrido de compra.

> Estado actual: el catálogo (68 productos, precios y disponibilidad) se lee desde Postgres. Carrito, checkout, pagos, órdenes y logística todavía son demostrativos.

## Funcionalidades

- Home con destacados, combos y marcas leídos de la base.
- Catálogo con categorías, filtros por marca, precio y stock, orden y paginación; todo en la URL para poder compartirlo.
- Búsqueda predictiva sin distinción de acentos, por varias palabras, con historial local.
- Fichas de producto estáticas con revalidación cada 5 minutos y datos estructurados `Product`.
- Comparador, asesor, carrito, checkout y confirmación: interfaz completa, lógica pendiente.

## Stack

- Next.js 16 (App Router) y React 19
- TypeScript
- Tailwind CSS 4 y CSS propio en `app/globals.css`
- Postgres en Neon con Drizzle ORM
- Despliegue previsto en Vercel

Server Components por defecto; solo las zonas con estado del navegador son Client Components.

## Inicio rápido

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
cp .env.example .env.local   # completar DATABASE_URL
npm run db:migrate           # crea las tablas
npm run db:seed              # carga el catálogo inicial
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Uso |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm run start` | Build y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run db:generate` | Genera una migración a partir de `lib/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run db:seed` | Carga o actualiza el catálogo desde `data/tiendanube-catalog.json` |
| `npm run db:studio` | Explorador visual de la base |

## Datos

- `lib/db/schema.ts`: marcas, categorías, productos y variantes. Los importes se guardan en pesos enteros. `stock = null` significa que el inventario todavía no se controla y el producto se vende como disponible; `0` es sin stock.
- `lib/catalog.ts`: lecturas del catálogo, cacheadas con la etiqueta `catalog` (5 minutos).
- `lib/commerce.ts`: políticas visibles (cuotas sin interés, descuento por transferencia, envío gratis). Un valor en 0 o `null` oculta el mensaje.
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
| `/carrito` | Carrito |
| `/checkout` | Finalización de compra |
| `/checkout/confirmacion` | Confirmación simulada |

## Limitaciones actuales

- No hay fotos de producto: se muestra un placeholder con marca y categoría.
- Los botones “Agregar” todavía no actualizan el carrito.
- Carrito, checkout y confirmación usan importes y datos de ejemplo; no crean órdenes ni procesan pagos.
- No deben introducirse datos financieros reales en el formulario actual.
- Comparador y asesor muestran una selección fija.

## Próximos pasos

1. Carrito persistente con precios y stock recalculados en el servidor.
2. Checkout con Mercado Pago (tarjetas, cuotas, dinero en cuenta y efectivo en redes de cobranza), transferencia bancaria y efectivo solo para retiro en el local de Quilmes. Webhooks firmados e idempotencia.
3. Panel de administración de productos, precios, stock e imágenes.
4. Comparador y asesor conectados al catálogo.
5. Legales, accesibilidad WCAG 2.2 AA, seguridad, pruebas E2E y observabilidad.

## Reglas de contribución

- No modificar ni eliminar `design-reference/`.
- Reutilizar componentes y tokens antes de crear variantes.
- Mantener Server Components como opción predeterminada.
- No mostrar promociones, reseñas ni métricas que no sean reales.
- No almacenar números de tarjeta ni CVV.
- Ejecutar lint, typecheck y build después de cambios relevantes.

## Licencia

Proyecto privado. No se ha definido una licencia pública.
