@AGENTS.md

# QuilGym — contexto integral, estado actual y plan de producción

> Documento de traspaso técnico actualizado el 3 de octubre de 2026.
>
> Este archivo es la fuente de contexto para quien continúe el proyecto. Antes de modificar código, leer también `AGENTS.md`, revisar este documento completo y contrastar las decisiones visuales con `design-reference/`.

## 1. Propósito del proyecto

QuilGym es un e-commerce argentino de suplementos deportivos. La experiencia busca ayudar a descubrir y comparar productos, entender ingredientes y presentaciones, recibir orientación según la rutina y completar una compra con envío o retiro en Quilmes.

El tono debe ser claro, responsable y comercial, sin promesas médicas ni resultados garantizados. El comparador y el asesor deben orientar, no diagnosticar ni declarar un producto universalmente superior.

La implementación actual reproduce con alta fidelidad las referencias visuales, pero sigue siendo un prototipo frontend: navegación e interacciones locales funcionan; catálogo, carrito, pagos, pedidos, stock, logística y usuarios todavía no están conectados a servicios reales.

El objetivo final es convertir esta base en una tienda productiva manteniendo el lenguaje visual y añadiendo datos administrables, persistencia, pagos, logística, seguridad, pruebas y operación comercial.

## 2. Restricciones y decisiones iniciales

- Se trabajó directamente en la raíz de `QuilGym`.
- `design-reference/` y `public/` debían conservarse sin modificar ni eliminarse. Siguen intactas.
- El proyecto no existía al inicio: se creó con Next.js App Router, TypeScript y Tailwind CSS.
- La primera etapa implementó solo la home. La segunda agregó catálogo, búsqueda, producto, comparador, asesor, carrito, checkout y confirmación.
- `public/assets/` está vacío; no había fotografías individuales ni recursos oficiales.
- Para aproximar las pantallas, `ReferenceCrop` muestra recortes de las capturas de `design-reference/`. Es una solución temporal que debe reemplazarse por assets reales.
- No hay un repositorio Git inicializado en esta carpeta al redactar este documento.

## 3. Stack verificado

- Next.js 16.3.8 con App Router.
- React/React DOM 19.3.0.
- TypeScript 5.9.3.
- Tailwind CSS 4.3.3.
- ESLint 9.39.5 y `eslint-config-next` 16.3.8.
- Desarrollo y build configurados con Webpack.

Comandos:

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm run start
```

El desarrollo se abre en `http://localhost:3000`.

## 4. Referencias y rutas

| Referencia | Ruta |
| --- | --- |
| `01-home.png` | `/` |
| `02-catalogo.png` | `/productos` y tarjetas |
| `03.1-busqueda.png` | `/buscar`, estado inicial |
| `03.2-busqueda.png`, `03.3-busqueda.png` | `/buscar`, resultados |
| `03.4-busqueda.png` | `/buscar`, sin resultados |
| `04-comparador.png` | `/comparar` |
| `05-producto.png` | `/productos/[slug]` |
| `06-asesor.png` | `/asesor` |
| `07-carrito.png` | `/carrito` |
| `08-checkout.png` | `/checkout` |
| `09-confirmacion.png` | `/checkout/confirmacion` |
| `10-recomendaciones.png` | `/asesor/recomendaciones` |

## 5. Trabajo realizado

### 5.1 Análisis y planificación

Antes de programar se revisaron todas las capturas y se definieron:

1. Las rutas necesarias para cubrir descubrimiento, evaluación y compra.
2. Los patrones reutilizables: header, footer, tarjeta, botones, beneficios, imágenes, confianza y formularios.
3. Tokens compartidos de color, radios, sombras, contenedor y breakpoints.
4. La falta de recursos gráficos individuales en `public/assets/`.

### 5.2 Inicialización

Se creó la estructura App Router, configuración TypeScript, ESLint y PostCSS/Tailwind, scripts y metadata global. `app/layout.tsx` define idioma español y la indicación de scroll suave solicitada por Next.js.

### 5.3 Home

Se construyó `/` con:

- header sticky y franja de envío gratis;
- hero y llamados a la acción;
- beneficios;
- navegación por seis objetivos;
- productos destacados;
- banner del asesor;
- combos;
- marcas;
- reseñas;
- artículos educativos;
- comunidad;
- newsletter y footer.

### 5.4 Flujo de tienda

Se centralizó un catálogo de ocho productos y se añadieron todas las rutas interiores. Los componentes cliente se limitaron a las zonas con estado: catálogo, búsqueda, asesor, carrito y checkout.

### 5.5 Verificación

Se aprobaron:

- ESLint;
- TypeScript sin emitir archivos;
- build de producción;
- búsqueda con estado inicial, resultados y sin coincidencias;
- wizard completo del asesor;
- comparador;
- carrito → checkout → confirmación;
- inspección de errores y avisos del navegador;
- ausencia de overflow horizontal en las vistas inspeccionadas.

Se corrigieron claves React duplicadas en la tabla comparativa, la configuración de scroll del layout y la prioridad de imágenes visibles. El build final generó 20 páginas, incluidas ocho fichas SSG.

## 6. Arquitectura actual

### 6.1 Rutas

| Ruta | Render | Responsabilidad |
| --- | --- | --- |
| `/` | Estática | Home comercial |
| `/productos` | Estática + isla cliente | Catálogo/filtros locales |
| `/productos/[slug]` | SSG | Ficha de producto |
| `/buscar` | Dinámica | Lee `searchParams.q` y monta búsqueda |
| `/comparar` | Estática | Comparación de tres fixtures |
| `/asesor` | Estática + isla cliente | Wizard |
| `/asesor/recomendaciones` | Estática | Resultado visual |
| `/carrito` | Estática + isla cliente | Drawer de carrito |
| `/checkout` | Estática + isla cliente | Formulario simulado |
| `/checkout/confirmacion` | Estática | Confirmación simulada |

Las fichas usan `generateStaticParams`, `generateMetadata` y `notFound()`.

### 6.2 Datos locales

`lib/store-data.ts` define `StoreProduct`: slug, marca, nombre, categoría, objetivo, detalle, precios, badge, stock, coordenada de recorte, rating y reseñas.

Contiene cuatro creatinas, dos proteínas, un pre-entreno y un shaker. `getProduct(slug)` resuelve fichas. Son fixtures: no son precio, inventario ni disponibilidad en tiempo real.

### 6.3 Frontera servidor/cliente

Client Components:

- `CatalogView`: filtros/orden.
- `PredictiveSearch`: consulta instantánea.
- `AdvisorWizard`: pasos/respuestas.
- `CartDrawer`: cantidades/eliminación/cálculos.
- `CheckoutForm`: opciones, términos y navegación.

El resto permanece como Server Component o componente presentacional.

## 7. Sistema visual

Los estilos están en `app/globals.css`. Tailwind está habilitado, aunque la fidelidad se resolvió principalmente con clases semánticas y CSS.

### Tokens

```css
--ink: #1d2022;
--muted: #747b80;
--line: #d6dadd;
--soft: #f1f2f0;
--paper: #ffffff;
--radius-sm: 10px;
--radius-md: 16px;
--radius-lg: 24px;
--shadow: 0 12px 28px rgba(31, 35, 37, .08);
--container: 1296px;
```

### Tipografía

- General: `Inter` y fallbacks de sistema. Inter no se sirve todavía con `next/font`.
- Wordmark: Georgia serif.
- Títulos: pesos altos, tracking negativo y escalas con `clamp()`.

### Espaciado y responsive

- Contenedor máximo: 1296 px.
- Margen lateral: 24 px; 16 px bajo 768 px.
- Padding vertical de sección: 74/52/42 px.
- Breakpoints: 1100, 768 y 520 px.
- Productos: 4 columnas en escritorio, 2 en tablet y 1 en móvil.
- `prefers-reduced-motion` reduce animaciones y scroll suave.

Antes de producción debe elegirse la tipografía definitiva y servirse localmente con `next/font`.

## 8. Componentes compartidos y función real

### `Header`

Franja de envío, logo, navegación, búsqueda, cuenta y carrito. El formulario envía `q` a `/buscar`. La cuenta no tiene autenticación y el carrito muestra siempre `$0` porque no existe estado global.

### `Footer`

Bloque institucional, navegación y newsletter. Actualmente presentacional: varios enlaces y el formulario no tienen destino real.

### `ProductCard`

Muestra imagen, marca, nombre, rating, detalle, precio, financiación, stock y botón. Con `slug`, imagen y nombre enlazan a la ficha. `compact` adapta combos y `priority` prioriza imágenes LCP. El botón “Agregar” aún no modifica el carrito.

### `ReferenceCrop`

Recibe una captura y coordenadas, calcula escala/posición y muestra el fragmento dentro de un contenedor. Usa `next/image`. Solo sirve para prototipado; no debe sobrevivir como catálogo visual productivo.

### `TrustStrip`

Banda reutilizada de originalidad, pago, entrega y soporte.

### `CatalogView`

Gestiona tabs, chips, checkboxes y orden. Menor/mayor precio funciona. Solo el filtro `Creatina` modifica realmente el dataset; los restantes reproducen estado visual. La paginación y tabs son visuales.

### `PredictiveSearch`

Usa `useDeferredValue` y `useMemo`. Desde dos caracteres filtra localmente nombre, marca y categoría. Implementa estado inicial, coincidencias, links laterales y estado vacío con sugerencia. La query inicial llega desde `/buscar?q=...`.

Las búsquedas recientes son fijas. Los textos sobre ESC/flechas/ENTER aún no corresponden a manejadores reales. Categorías, marcas y contenidos laterales son estáticos.

### `AdvisorWizard`

Seis pasos: objetivo, experiencia, frecuencia, tipo de entrenamiento, preferencias y presupuesto. Permite responder, avanzar, volver y reiniciar. Al terminar navega a recomendaciones.

Las respuestas solo viven en memoria y no cambian la recomendación: la salida siempre muestra los mismos tres productos.

### `CartDrawer`

Parte de dos productos con tres unidades totales. Permite incrementar, reducir (mínimo 1) y eliminar. Recalcula subtotal y aplica un 10% local. Contiene envío gratis, cupón, ahorro y cuotas.

No recibe artículos desde tarjetas, no persiste, no sincroniza con servidor y algunos importes textuales son fijos.

### `CheckoutForm`

Permite alternar entrega/retiro y tres medios visuales de pago. Incluye dirección, envío, campos de tarjeta, cuotas, resumen y aceptación de términos. El botón queda deshabilitado hasta aceptar.

El submit únicamente navega a confirmación. No crea orden ni procesa pagos. Los inputs de tarjeta son demostrativos y nunca deben enviarse directamente a un backend propio.

## 9. Estado y limitaciones por pantalla

### Home `/`

Completa visualmente. Pendientes:

- dataset distinto del catálogo en algunos destacados;
- varios `href="#"`;
- banner del asesor sin enlace a `/asesor`;
- objetivos, combos y marcas sin filtros reales;
- comunidad con placeholders;
- newsletter sin backend;
- reseñas/métricas de ejemplo.

### Catálogo `/productos`

Tiene tabs, chips, sidebar, ocho tarjetas, orden y paginación. Pendientes:

- filtros completos;
- URL con filtros;
- consulta/paginación de servidor;
- conteos reales (hoy se usa un multiplicador artificial);
- categorías reales en lugar de una página titulada solo “Creatinas”.

### Búsqueda `/buscar`

Funciona contra fixtures. Pendientes:

- índice real, ranking, sinónimos, acentos y tolerancia a errores;
- historial persistente;
- resultados reales de contenido/categorías;
- analytics de consultas;
- atajos de teclado y patrón combobox accesible;
- sincronización de URL durante la consulta.

### Producto `/productos/[slug]`

Hay ocho URLs estáticas con galería, variantes, precio, cuotas, envío, detalles, nutrición, FAQ, reseñas y relacionados. Pendientes:

- imágenes distintas por variante;
- video real;
- selectores de sabor/presentación funcionales;
- cantidad y favoritos;
- agregar al carrito;
- cálculo de envío;
- contenido nutricional específico por producto;
- stock, promociones, reseñas y SKU reales.

Actualmente varios productos reutilizan textos propios de creatina.

### Comparador `/comparar`

Compara tres productos fijos en doce atributos. La tabla puede desplazarse horizontalmente. Pendientes:

- seleccionar, quitar y reemplazar;
- entrada desde tarjetas/fichas;
- persistencia en URL;
- atributos reales por variante;
- diferencias calculadas;
- compra desde comparación.

### Asesor y recomendaciones

La interacción de seis pasos funciona. Pendientes:

- reglas versionadas;
- scoring por respuestas;
- presupuesto/stock/restricciones reales;
- pasar y editar respuestas;
- guardar selección;
- conectar carrito/comparador;
- revisión profesional de afirmaciones de salud.

### Carrito `/carrito`

Cantidad, eliminación y estado vacío funcionan durante la vida del componente. Pendientes:

- store global/persistencia;
- agregar desde otras páginas;
- variantes, máximos y stock;
- cálculos server-side;
- promociones reales;
- envío por CP;
- badge del header;
- sincronización invitado/cuenta;
- semántica de diálogo, foco atrapado y Escape.

### Checkout `/checkout`

La interfaz y validación HTML básica funcionan. Los datos de Martina Ruiz son ficticios. Pendientes críticos:

- carrito real de servidor;
- captura real de contacto;
- ocultar dirección al elegir retiro;
- grupos de radio correctos para envío;
- campos según medio de pago;
- validación con esquema compartido;
- tokenización del proveedor;
- precio/envío/descuento recalculado en servidor;
- reserva de stock, idempotencia y control de doble submit;
- manejo de carga y errores.

### Confirmación `/checkout/confirmacion`

Toda la información es fija: cliente, email, dirección, fecha, orden `QG-2026-18472`, tarjeta, productos y total. En producción debe cargar una orden autorizada y nunca inferir pago aprobado por llegar a la URL.

## 10. Assets faltantes

`public/assets/` está vacío. Se necesitan:

- fotos reales por producto y variante en WebP/AVIF;
- thumbnails y videos;
- logos autorizados de marcas;
- hero separado del texto;
- fotos de comunidad con permiso;
- iconografía definitiva si se reemplazan los SVG;
- favicon/OG image;
- tipografía y licencias;
- logos de pagos/logística cuando corresponda.

No continuar usando capturas completas como productos: pesan más, impiden optimización correcta y no son mantenibles.

## 11. Funciones necesarias para producción

### Plataforma y modelo de datos

Primero decidir una única fuente comercial:

1. plataforma headless existente; o
2. backend propio con base relacional y panel.

No implementar ambos caminos a la vez. Un backend propio mínimo necesita:

- Product, ProductVariant, SKU, categoría, marca y objetivo;
- Inventory;
- precios/promociones con vigencia;
- Cart y CartItem;
- Customer, Address y consentimientos;
- Order/OrderItem con snapshot comercial;
- Payment e intentos;
- Shipment y tracking;
- Coupon/Promotion;
- Review moderada;
- contenido editorial y FAQ.

### Catálogo/administración

- Panel o CMS para publicar y discontinuar.
- Importación real de SKU/EAN, variantes, peso, medidas, nutrición y fotos.
- Separar datos comerciales, nutricionales y advertencias.
- Historial de precios y stock.
- Promociones con vigencia, medio de pago y límite de uso.
- Importación/exportación CSV si la operación lo necesita.

### Carrito

- Estado cliente para feedback inmediato más carrito persistido en servidor.
- Cookie segura con ID opaco para invitados y fusión al iniciar sesión.
- Mutaciones por ID de variante, nunca por precio/nombre del cliente.
- Recalcular precio, descuento, stock y envío en servidor.
- Agregar, actualizar, eliminar, aplicar cupón y vaciar.
- Sincronizar header/drawer.
- Informar cambios de precio o falta de stock.

### Búsqueda/filtros

- Filtros en `searchParams` para URLs compartibles.
- Consultas paginadas de servidor.
- Índices o motor de búsqueda según volumen.
- Normalizar acentos y soportar sinónimos.
- Ranking por relevancia, stock y popularidad.
- Debounce/abort para red.
- Medir búsquedas sin resultado sin retener PII.
- Navegación de teclado completa.

### Comparador

- Acción “Comparar” en tarjetas/ficha.
- Máximo de tres IDs persistidos en URL/storage.
- Atributos estructurados desde backend.
- Quitar/reemplazar/compartir.
- Encabezados sticky y tabla accesible.

### Asesor

- Respuestas tipadas.
- Reglas auditables/versionadas, no diagnóstico generativo.
- Filtros duros por restricción, stock y presupuesto.
- Scoring por objetivo/rutina/formato.
- Razones basadas en atributos reales.
- Guardar versión de reglas.
- Editar respuestas sin reiniciar.
- Descargo y derivación profesional cuando corresponda.

### Pagos/órdenes

Definir proveedor final para Argentina (por ejemplo Mercado Pago) y usar su SDK/tokenización:

- nunca almacenar tarjeta completa ni CVV;
- tokenizar con campos seguros;
- crear orden/intento en servidor;
- claves de idempotencia;
- validar monto, moneda y stock en servidor;
- verificar firmas de webhook;
- actualizar orden desde webhook, no desde redirect;
- soportar pendiente, aprobado, rechazado, cancelado y reembolso;
- evitar doble cobro;
- conciliar transferencias;
- confirmación dinámica con ID público seguro.

Una ruta apropiada sería `/checkout/confirmacion/[publicOrderId]`, autorizada por sesión o token firmado.

### Logística

- Validar CP/dirección.
- Cotizar por peso, zona, stock y calendario.
- Configurar retiro, horarios y capacidad.
- Crear etiqueta y tracking.
- Estados de preparación, despacho y entrega.
- Cambiar a retiro solo mientras la operación lo permita.

### Usuarios/comunicaciones

- Mantener checkout invitado salvo decisión contraria.
- Autenticación, recuperación, pedidos y direcciones.
- Favoritos si se conserva el corazón.
- Exportación/eliminación de datos.
- Emails de pedido, pago, preparación, envío y retiro.
- Newsletter con consentimiento adecuado.

### SEO/contenido

- Metadata dinámica, canonical, robots y sitemap.
- Open Graph con assets reales.
- JSON-LD Product/Offer/AggregateRating/Breadcrumb; solo datos reales.
- Categorías, marcas, objetivos y artículos reales.
- Estrategia para productos discontinuados.

### Accesibilidad

Objetivo WCAG 2.2 AA:

- teclado/foco visible;
- drawer como diálogo con foco atrapado, Escape y restauración;
- búsqueda como combobox/listbox;
- errores asociados a campos;
- contraste validado;
- alt text correcto;
- no depender solo de color;
- `aria-live` para carrito/pago;
- pruebas con lector de pantalla y zoom 200–400%.

### Seguridad/privacidad

- Secretos solo en servidor y fuera del repositorio.
- CSP, HSTS, `frame-ancestors`, referrer policy y headers.
- Validación/sanitización de servidor.
- Rate limiting en login, búsqueda, cupones, checkout y webhooks.
- Protección contra abuso y enumeración de órdenes.
- Cookies HttpOnly/Secure/SameSite.
- Logs sin PII/tokens.
- Auditoría de dependencias, backups y rotación de secretos.
- Consentimiento para analytics/cookies.

Variables probables, sin valores reales:

```dotenv
DATABASE_URL=
AUTH_SECRET=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_PAYMENT_PUBLIC_KEY=
PAYMENT_ACCESS_TOKEN=
PAYMENT_WEBHOOK_SECRET=
EMAIL_API_KEY=
EMAIL_FROM=
STORAGE_TOKEN=
```

### Legal/comercial en Argentina

Validar con profesionales:

- razón social, CUIT, domicilio y datos fiscales;
- términos, privacidad, cambios/devoluciones y contacto;
- precios finales, moneda, cuotas y costo financiero;
- derecho/botón de arrepentimiento;
- facturación;
- consentimiento de marketing/cookies;
- tratamiento de datos personales;
- rotulado y advertencias de suplementos;
- textos sin promesas terapéuticas;
- bases de promociones y stock.

Esta lista técnica no reemplaza asesoramiento jurídico.

### Rendimiento

- Reemplazar `ReferenceCrop` por assets optimizados.
- Definir `sizes` responsivos en `next/image`.
- Precargar solo el LCP real.
- Servir fuente con `next/font`.
- Medir Core Web Vitals.
- Cachear catálogo con invalidación explícita.
- Cargar SDK de pago solo en checkout.

### Pruebas/observabilidad

Agregar:

- unitarias: precios, descuentos, scoring, stock, validadores;
- componentes: filtros, búsqueda, cantidades y formularios;
- integración: carrito, orden y webhooks;
- E2E Playwright: búsqueda → producto → carrito → checkout → pago sandbox → confirmación;
- visuales en 390, 768, 1024 y 1440 px;
- axe + revisión manual;
- contratos con pago/logística;
- carga sobre búsqueda, carrito y webhooks.

En producción: errores cliente/servidor, logs estructurados sin PII, métricas con consentimiento, alertas de pagos/webhooks/stock/5xx, health checks y runbooks.

## 12. Orden recomendado de trabajo

### Fase 0 — decisiones y contenido

1. Elegir plataforma comercial, pagos, logística, facturación y autenticación.
2. Conseguir catálogo, stock, precios, textos aprobados y assets.
3. Definir promociones, envío y devolución.
4. Inicializar Git, CI y staging.

**Salida:** arquitectura aprobada y credenciales sandbox disponibles.

### Fase 1 — dominio y catálogo

1. Esquema/migraciones o adaptador headless.
2. Sustituir `store-data.ts` por repositorio tipado.
3. Importar productos/variantes/assets.
4. Catálogo, filtros, paginación, búsqueda y fichas de servidor.
5. Metadata/structured data real.

**Salida:** catálogo administrable con precio/stock real.

### Fase 2 — carrito/promociones

1. Conectar todos los botones.
2. Persistir carrito invitado/autenticado.
3. Sincronizar header y drawer.
4. Promociones/cupones server-side.
5. Revalidar precio y stock antes del checkout.

**Salida:** carrito resistente a recargas que no confía en importes del cliente.

### Fase 3 — checkout/pago/logística

1. Contacto/dirección real con validación.
2. Cotización de envío/retiro.
3. Orden preliminar e idempotencia.
4. SDK de pago sandbox.
5. Webhooks firmados y máquina de estados.
6. Confirmación dinámica, email y tracking.

**Salida:** compra sandbox completa, trazable y resistente a doble submit.

### Fase 4 — comparador/asesor/cuenta

1. Comparador seleccionable y compartible.
2. Motor de reglas para asesor.
3. Resultados según respuestas, stock y presupuesto.
4. Cuenta, pedidos, favoritos y direcciones si se aprobaron.

**Salida:** herramientas conectadas al catálogo real.

### Fase 5 — lanzamiento

1. Legales, accesibilidad y contenido.
2. Tests y multidispositivo.
3. Seguridad, observabilidad, backups y alertas.
4. Rendimiento.
5. Staging, checklist y rollback.
6. Compra controlada punta a punta antes de pagos reales.

**Salida:** aprobación conjunta de negocio, técnica, legal y operación.

## 13. Definition of Done de producción

No considerar QuilGym productivo hasta que:

- catálogo y assets sean reales/administrables;
- precios, stock, descuentos y envío se calculen en servidor;
- carrito y órdenes persistan;
- pagos tengan tokenización, idempotencia y webhooks;
- confirmación refleje una orden autorizada;
- emails y tracking funcionen;
- legales estén publicados/revisados;
- el recorrido sea accesible por teclado/lector;
- E2E cubra pago aprobado, rechazado, pendiente y stock insuficiente;
- secretos, headers, logs y rate limits estén revisados;
- existan staging, monitoreo, backups y rollback;
- se eliminen del flujo los datos ficticios de Martina Ruiz y `QG-2026-18472`.

## 14. Archivos clave

- `app/layout.tsx`: layout/metadata.
- `app/globals.css`: tokens, UI y responsive.
- `app/page.tsx`: home.
- `app/productos/page.tsx`: catálogo.
- `app/productos/[slug]/page.tsx`: ficha SSG.
- `app/buscar/page.tsx`: entrada de búsqueda.
- `components/catalog-view.tsx`: filtros/orden.
- `components/predictive-search.tsx`: búsqueda.
- `components/advisor-wizard.tsx`: asesor.
- `components/cart-drawer.tsx`: carrito local.
- `components/checkout-form.tsx`: checkout simulado.
- `components/product-card.tsx`: tarjeta.
- `components/reference-crop.tsx`: recorte temporal.
- `lib/store-data.ts`: fixtures.
- `design-reference/`: fuente visual protegida.
- `public/assets/`: destino de assets reales; vacío.

## 15. Reglas para continuar

1. No modificar/eliminar `design-reference/`.
2. Reutilizar tokens/componentes antes de crear variantes.
3. No presentar fixtures como datos reales.
4. No activar pagos sin backend, idempotencia, webhook y validación server-side.
5. No almacenar tarjeta/CVV.
6. Server Components por defecto; `"use client"` solo para interacción.
7. Contratos tipados y props serializables.
8. Ejecutar lint, TypeScript, build y flujo afectado tras cambios materiales.
9. Probar escritorio, tablet, móvil, teclado y estados de error/vacío.
10. Actualizar este documento cuando cambie el estado real.

## 16. Resumen ejecutivo

La base visual y el recorrido completo ya existen. Se puede navegar, buscar fixtures, ordenar catálogo, abrir fichas, revisar comparación, completar el asesor, modificar cantidades, llenar checkout y llegar a una confirmación simulada. La aplicación compila sin errores.

La siguiente prioridad no es agregar más maquetación: es elegir la plataforma comercial, cargar activos/datos reales y construir el núcleo transaccional —carrito persistente, orden, pago, stock y logística— antes de profundizar funciones secundarias.
