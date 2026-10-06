# QuilGym

E-commerce de suplementos deportivos construido con Next.js, TypeScript y Postgres. La experiencia incluye catálogo con filtros, búsqueda predictiva, fichas de producto, comparador, asesor conversacional y un recorrido de compra.

> Estado actual: catálogo (68 productos), carrito, pedidos de prueba, cuentas y favoritos funcionan contra Postgres. El asesor tiene chat de texto libre conectado directamente a Gemini; requiere una API key de Google AI Studio. Pagos reales, Google OAuth y reseñas esperan sus credenciales; no se activaron cobros.

## Funcionalidades

- Home con destacados, combos y marcas leídos de la base.
- Catálogo con categorías, filtros por marca, precio y stock, orden y paginación; todo en la URL para poder compartirlo.
- Búsqueda predictiva sin distinción de acentos, por varias palabras, con historial privado en Postgres para clientes conectados y local para visitantes.
- Fichas de producto estáticas con revalidación cada 5 minutos y datos estructurados `Product`.
- Carrito persistente (cookie HttpOnly + Postgres): agregar desde tarjetas o ficha, cantidades, cupones, contador en el header y drawer accesible. Precio, stock y cupón se recalculan siempre en el servidor y avisan si algo cambió.
- Checkout con el resumen real del carrito; bloquea el pago si hay productos sin stock o precios sin confirmar.
- Asesor conversacional: texto libre, preguntas según el contexto, historial durante la visita y sugerencias del catálogo con motivos. Sin opciones múltiples ni preguntas obligatorias de edad. No prescribe dosis ni exige comprar; requiere conexión a IA.
- Botón flotante gris del asesor con bienvenida y acceso a la conversación completa.
- Registro con nombre, email y contraseña; sesión persistente y revocable de 30 días con Better Auth. Acceso con Google preparado (requiere credenciales).
- Favoritos por usuario en tarjetas y fichas, con filtros por categoría en `/cuenta/favoritos`.
- Cuenta con menú desplegable («Ver perfil», compras, historial, favoritos y configuración), compras con filtros y detalle, historial de búsqueda por usuario y siete avatares de temática deportiva más iniciales. El resumen del perfil muestra solo sus tarjetas; las demás páginas conservan la navegación lateral. Tras ingresar o registrarse se vuelve al inicio, salvo que una acción previa tenga un destino concreto. Aún no se envían campañas.
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

### Conectar el asesor a una IA real

1. Crear una clave en [Google AI Studio](https://aistudio.google.com/api-keys). Su nombre descriptivo no tiene que coincidir con la variable del proyecto. No hace falta Vercel AI Gateway ni desplegar el sitio para probarlo.
2. Revisar cuotas, restricciones de la clave y facturación del proyecto Google antes de compartir el chat: las consultas pueden tener costo. No activar facturación automáticamente sin aprobación del negocio.
3. Agregar a `.env.local`, sin borrar `DATABASE_URL` ni otras variables:

```env
GOOGLE_GENERATIVE_AI_API_KEY=tu_clave_privada_de_google
# Opcional; por defecto se usa este modelo gratuito, probado por API el 5/10/2026:
ADVISOR_MODEL=gemini-3.5-flash-lite
```

4. Reiniciar `npm run dev` y abrir `/asesor`. No publicar la clave, no pegarla en chats, no usar `NEXT_PUBLIC_`. `.env.local` permanece ignorado por Git. Consultar [la documentación de Google](https://ai.google.dev/gemini-api/docs/api-key) y los modelos disponibles para el proyecto.

Compatibilidad temporal: si la clave de Google quedó en `AI_GATEWAY_API_KEY`, el asesor la acepta como alias y la envía **solo a Google**, no a Vercel. Se recomienda renombrar esa variable a `GOOGLE_GENERATIVE_AI_API_KEY` conservando el mismo valor (no es necesario copiarlo ni crear otra clave). La variable Google tiene prioridad. El prefijo `google/` en ADVISOR_MODEL también se normaliza. Las claves de Vercel AI Gateway ya no sirven para este asesor.

Si Google rechaza la consulta, la UI distingue autorización, cuota, modelo no disponible y configuración inválida sin mostrar mensajes privados del proveedor. Consultar los límites en AI Studio si aparece 429; no siempre hace falta pagar, puede ser un límite temporal o de solicitudes/tokens del proyecto. Cambiar permisos/cuotas/facturación requiere intervención del dueño del proyecto.

El servidor usa AI SDK con salida estructurada; recibe el historial y el catálogo activo. Las tarjetas solo aceptan IDs existentes y disponibles, y toman nombres, precios, fotos y enlaces de Postgres. La IA redacta las explicaciones; eso no garantiza exactitud nutricional. Revisar recomendaciones con un profesional y hacer QA real con la clave antes del lanzamiento.

Sin clave se explica que falta conectar la IA, sin respuestas falsas. Timeout de 45 segundos, sin reintentos automáticos facturables; errores permiten reintentar conservando el mensaje. Límites atómicos en Postgres: 8 consultas/minuto por identificador firmado de navegador, 30/minuto y 200/día para todo el sitio. El límite global protege costos incluso si se borran cookies; no reemplaza el presupuesto del proveedor ni una protección anti-bots. Reutiliza `auth_rate_limits` con prefijo `advisor:`; no necesita migración. Pendiente limpieza periódica de identificadores vencidos.

La conversación vive únicamente en memoria del navegador y se envía al proveedor externo al consultar; no se guarda en la cuenta, base ni logs de QuilGym. El proveedor tiene sus propias políticas de procesamiento/retención: informarlas y revisar privacidad antes de producción. No enviar datos sensibles. Hasta 11 mensajes de cliente por conversación y 1.800 caracteres por mensaje. Las recomendaciones aparecen dentro del chat; `/asesor/recomendaciones` redirige al asesor nuevo.

### Cuentas y Google

El registro con email/contraseña funciona en desarrollo sin configurar Google. Las contraseñas se guardan con hash scrypt y las sesiones se verifican en Postgres mediante cookies HttpOnly; no se guarda el acceso en localStorage.

Para habilitar Google, hace falta un **cliente OAuth de aplicación web** en Google Cloud. La clave de Google AI Studio del asesor no sirve para iniciar sesión:

1. Entrar en [Google Auth Platform](https://console.cloud.google.com/auth/overview), elegir el proyecto y completar «Información de la marca»/«Público» con el nombre QuilGym y el correo de contacto. Elegir público externo si deben ingresar clientes con cualquier cuenta Google. Si queda en modo de prueba, agregar las cuentas Gmail que harán las pruebas a «Usuarios de prueba».
2. En la pantalla «Clientes», pulsar «+ Crear cliente» y seleccionar «Aplicación web». En «Orígenes JavaScript autorizados» agregar `http://localhost:3000` y el dominio HTTPS definitivo. En «URI de redirección autorizados» agregar **exactamente** `http://localhost:3000/api/auth/callback/google` y `https://TU-DOMINIO/api/auth/callback/google`. Usar el dominio real mostrado en Vercel, sin barra final.
3. Copiar el ID y secreto del **cliente OAuth** a `.env.local` (sin comillas si no contienen espacios):

```env
BETTER_AUTH_SECRET=secreto_aleatorio_de_al_menos_32_caracteres
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=id_del_cliente_oauth
GOOGLE_CLIENT_SECRET=secreto_del_cliente_oauth
```

4. Reiniciar `npm run dev` y probar con un Gmail autorizado. Para Vercel, cargar las cuatro variables en el proyecto: `BETTER_AUTH_URL` debe ser la URL **HTTPS de producción**, y el secreto debe ser privado y estable. Redesplegar luego de cambiarlas. Nunca pegar secretos en un chat ni subir `.env.local` a Git.

Crear el cliente OAuth para inicio de sesión básico no exige activar una API paga. No habilitar facturación, Identity Platform ni permisos de otros servicios de Google para este paso. Si la consola solicita aceptar un producto de pago o vincular una tarjeta para continuar, detenerse y revisar antes de seguir. Esta integración usa Better Auth y la base propia, no Firebase Authentication/Identity Platform. Ver [la guía oficial de configuración de Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) y [Google Auth Platform](https://support.google.com/cloud/answer/15548748).

En local, email/contraseña funciona aunque Google no esté configurado. El registro crea una cuenta nueva; para ingresar después hay que usar ese mismo email y contraseña. Google crea una cuenta al entrar por primera vez si ese email no existe. Si ya existe una cuenta de contraseña con ese email pero aún no está verificada, Better Auth **no** la vincula automáticamente: ingresá primero con la contraseña y usá «Configuración → Vincular mi cuenta con Google». Así se comprueban ambos accesos sin relajar la protección del email local. Las cuentas ya verificadas pueden vincularse automáticamente si Google confirma el mismo email.

En «Configuración» se puede eliminar la cuenta definitivamente. Se exige escribir `ELIMINAR` y, si hay contraseña, ingresarla. Las cuentas Google sin contraseña requieren una sesión reciente; si venció, hay que salir y volver a ingresar. Better Auth borra usuario, credenciales y sesiones; las relaciones en la base eliminan favoritos e historial. Los pedidos ya emitidos se conservan, pero se desvinculan del usuario y mantienen sus datos de compra para poder gestionarlos.

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
| `/asesor` | Chat con IA y sugerencias explicadas del catálogo |
| `/asesor/recomendaciones` | Redirige al chat (compatibilidad con enlaces anteriores) |
| `/api/advisor` | Conversación con el LLM, POST de mismo origen y sin caché |
| `/cuenta/ingresar` | Email/contraseña y acceso con Google configurable |
| `/cuenta/registro` | Registro de cliente |
| `/cuenta` | Resumen de la cuenta; requiere sesión |
| `/cuenta/compras` | Pedidos propios, búsqueda y filtros |
| `/cuenta/historial` | Búsquedas privadas del usuario, con opción de borrar |
| `/cuenta/favoritos` | Productos guardados, filtrables por categoría |
| `/cuenta/configuracion` | Nombre, avatar, preferencias y salida |
| `/carrito` | Carrito |
| `/checkout` | Finalización de compra |
| `/checkout/confirmacion/[orderId]` | Pedido real o demo, autorizado por carrito, cuenta o link firmado |
| `/api/auth/[...all]` | Endpoints de Better Auth |
| `/api/account/favorites` | Favoritos privados de la sesión; sin caché |
| `/api/account/history` | Historial privado de búsquedas, requiere sesión |
| `/api/reviews` | Datos de Google configurado o estado sin datos; sin caché |

## Limitaciones actuales

- La información nutricional se muestra como foto del rótulo (todavía no transcripta a texto accesible).
- Algunos productos no tienen rótulo disponible (combos, shakers, barras Mervick/Brava, Landerfit, Beast Blood, Body Advance 3 kg y magnesio, óxido nítrico y colágeno ENA).
- No hay cupones cargados: se crean en la tabla `coupons` (todavía sin panel).
- Las compras siguen en modo de prueba local: los pedidos demo no consumen stock, cupones ni envían emails. Las integraciones reales quedan deshabilitadas hasta configurarlas y validarlas en sandbox.
- Google OAuth requiere sus credenciales. Verificación de email y recuperación de contraseña pendientes antes de producción.
- El carrito sigue ligado al navegador; no se sincroniza entre dispositivos. Los favoritos y los nuevos pedidos del usuario sí son propios de su cuenta. No se asignan compras históricas por coincidencia de email.
- Los pedidos asociados a una cuenta requieren su sesión (o un enlace firmado válido); cerrar sesión corta el acceso mediante la cookie del carrito. Los pedidos de invitado mantienen su autorización por carrito.
- El asesor requiere una clave de Google AI Studio (`GOOGLE_GENERATIVE_AI_API_KEY`, con alias anterior temporal). Los tests automáticos usan respuestas simuladas; las cuotas/permisos del proyecto pueden impedir una consulta real. No es una evaluación nutricional; no fuerza productos si falta contexto, stock o hay riesgos, y no conoce certificaciones ni alérgenos de todo el catálogo.
- Las reseñas auténticas dentro del carrusel siguen pendientes de acceso a su fuente; el enlace a Google Maps está activo.
- Comparador fijo y panel de administración pendientes.

## Próximos pasos

1. Conectar y probar el asesor con una clave de IA, fijar presupuesto, revisar sus criterios/privacidad; configurar Google OAuth y la fuente autorizada de reseñas.
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
