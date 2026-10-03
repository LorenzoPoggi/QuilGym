# QuilGym

E-commerce de suplementos deportivos construido con Next.js, TypeScript y Tailwind CSS. La experiencia incluye descubrimiento de productos, búsqueda predictiva, comparación, asesor guiado y un recorrido completo de compra.

> Estado actual: prototipo frontend navegable. La interfaz y las interacciones locales están implementadas, pero todavía no existen backend comercial, persistencia, pagos reales, inventario ni logística integrada.

## Funcionalidades implementadas

- Home comercial responsive.
- Catálogo con filtros visuales y ordenamiento por precio.
- Búsqueda predictiva con estados inicial, resultados y sin coincidencias.
- Ocho fichas de producto generadas estáticamente.
- Comparador de tres productos.
- Asesor interactivo de seis pasos.
- Página de recomendaciones.
- Carrito con cantidades, eliminación, cupón y totales locales.
- Checkout con entrega, retiro, medios de pago y validación básica.
- Confirmación de compra simulada.
- Componentes compartidos para header, footer, tarjetas, botones, imágenes y confianza.
- Layouts responsive para escritorio, tablet y móvil.

## Stack

- Next.js 16 con App Router
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint

El proyecto utiliza Server Components por defecto. Solo las interfaces que necesitan estado en el navegador están marcadas como Client Components.

## Inicio rápido

Requisitos:

- Node.js compatible con Next.js 16.
- npm.

Instalar dependencias:

```bash
npm install
```

Iniciar el servidor de desarrollo:

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

Crear y ejecutar un build de producción:

```bash
npm run build
npm run start
```

## Comprobaciones

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Estas tres comprobaciones pasaban correctamente al finalizar la implementación documentada.

## Rutas

| Ruta | Descripción |
| --- | --- |
| `/` | Página principal |
| `/productos` | Catálogo |
| `/productos/[slug]` | Ficha de producto |
| `/buscar` | Búsqueda predictiva |
| `/comparar` | Comparador |
| `/asesor` | Asesor guiado |
| `/asesor/recomendaciones` | Recomendaciones del asesor |
| `/carrito` | Carrito |
| `/checkout` | Finalización de compra |
| `/checkout/confirmacion` | Confirmación simulada |

Ejemplos de productos:

- `/productos/creatina-star-300-g`
- `/productos/creatina-gold-250-g`
- `/productos/creatina-micronizada-ena-300-g`
- `/productos/whey-protein-star-2-lb`

## Estructura principal

```text
QuilGym/
├── app/
│   ├── page.tsx
│   ├── globals.css
│   ├── productos/
│   ├── buscar/
│   ├── comparar/
│   ├── asesor/
│   ├── carrito/
│   └── checkout/
├── components/
│   ├── header.tsx
│   ├── footer.tsx
│   ├── product-card.tsx
│   ├── catalog-view.tsx
│   ├── predictive-search.tsx
│   ├── advisor-wizard.tsx
│   ├── cart-drawer.tsx
│   └── checkout-form.tsx
├── lib/
│   └── store-data.ts
├── design-reference/
├── public/
├── AGENTS.md
└── claude.md
```

## Datos y estado

El catálogo actual vive en `lib/store-data.ts` y contiene datos demostrativos de ocho productos.

Las siguientes funciones trabajan solo en memoria:

- filtros y orden del catálogo;
- respuestas del asesor;
- cantidades del carrito;
- opciones del checkout.

Al recargar la página esos estados pueden perderse. Precios, stock, promociones, reseñas, información de clientes, pedidos y fechas son fixtures.

## Diseño y assets

Los diseños originales están en `design-reference/` y no deben modificarse ni eliminarse.

`public/assets/` está vacío. Para conservar fidelidad visual durante el prototipo, el componente `ReferenceCrop` recorta fragmentos de las capturas de referencia mediante `next/image`.

Antes de producción hay que sustituir esos recortes por:

- fotografías reales por producto y variante;
- logos autorizados;
- recursos del hero;
- imágenes de comunidad;
- thumbnails y videos;
- Open Graph y favicon definitivos;
- tipografía oficial servida mediante `next/font`.

## Limitaciones importantes

- Los botones “Agregar” de las tarjetas todavía no actualizan el carrito.
- El carrito comienza con productos de ejemplo y no persiste.
- Solo algunos filtros afectan realmente el catálogo.
- La paginación y varios enlaces son visuales.
- Las recomendaciones del asesor no cambian según las respuestas.
- El comparador usa tres productos preseleccionados.
- El checkout no crea una orden ni procesa un pago.
- No deben introducirse datos financieros reales en el formulario actual.
- La confirmación contiene datos ficticios y no demuestra que exista un pago aprobado.

## Próximos pasos para producción

Prioridad recomendada:

1. Elegir plataforma de comercio/backend, proveedor de pagos y logística.
2. Incorporar catálogo, variantes, imágenes, precios y stock reales.
3. Implementar carrito persistente y cálculos server-side.
4. Conectar checkout, órdenes, pagos tokenizados y webhooks firmados.
5. Implementar cotización de envío, retiro y tracking.
6. Volver dinámicos el comparador y el asesor.
7. Añadir autenticación, historial de pedidos y favoritos si se aprueban.
8. Completar SEO, accesibilidad WCAG 2.2 AA, seguridad y legales.
9. Añadir pruebas unitarias, integración, E2E y regresión visual.
10. Configurar staging, CI/CD, observabilidad, backups y rollback.

El detalle completo, los riesgos y los criterios de salida por fase están documentados en [claude.md](./claude.md).

## Reglas de contribución

- Leer `AGENTS.md` y la documentación local de la versión instalada de Next.js antes de modificar código.
- No modificar ni eliminar `design-reference/`.
- Reutilizar componentes y tokens antes de crear nuevas variantes.
- Mantener Server Components como opción predeterminada.
- No tratar fixtures como datos comerciales reales.
- No almacenar números de tarjeta ni CVV.
- Ejecutar lint, TypeScript y build después de cambios relevantes.
- Actualizar `claude.md` cuando cambie el estado funcional o la arquitectura.

## Documentación extendida

Consultar [claude.md](./claude.md) para:

- contexto completo del proyecto;
- explicación detallada de cada pantalla y componente;
- decisiones de arquitectura y diseño;
- limitaciones actuales;
- modelo de datos sugerido;
- plan de pagos, órdenes y logística;
- seguridad, privacidad, SEO y accesibilidad;
- roadmap hasta producción;
- Definition of Done.

## Licencia

Proyecto privado. No se ha definido una licencia pública.
