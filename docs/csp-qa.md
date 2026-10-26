# CSP y QA de integraciones

La política vive en `lib/security-headers.ts` y se aplica desde `next.config.ts`.
Restringe scripts, conexiones, frames, imágenes, fuentes y formularios. En Production
`unsafe-eval` no está permitido. Se conserva `unsafe-inline` para scripts porque Next
emite bootstrap/RSC inline y el sitio usa generación estática/ISR; pasar a nonces en
Next vuelve dinámicas las páginas y desactiva esa caché. La política permite los
orígenes de Mercado Pago, Maps, OpenStreetMap, Blob y fotos de reseñas que usa QuilGym.

## QA automatizado

En una base Preview aislada, ejecutar:

```bash
npm test -- lib/security-headers.test.ts
npm run test:e2e:csp
```

El E2E revisa que la respuesta incluya las directivas base, que la app hidrate y que
el navegador no registre bloqueos CSP en la home. La suite de navegador usa desktop
y mobile. No completa compras ni escribe en la base. Usa un config dedicado que carga
solo `.env.preview.local`, comprueba que su base se llame `quilgym_preview` y falla
cerrado si falta o apunta a otra base; ignora `.env.local`.

## QA manual en Preview antes del merge

Usar un deployment de Preview de `security/fase-2`, con la base aislada y credenciales
TEST únicamente. Abrir DevTools → Console y Network, filtrar por `CSP`/`blocked`, y
recorrer ambos viewports. El E2E local no cubre las integraciones de terceros:

1. Home, catálogo, búsqueda y ficha: hidratar, buscar y cargar imágenes del catálogo.
2. Ingreso/registro: revisar que el botón Google habilitado redirija y vuelva al
   callback de Preview. Si Google no está habilitado en ese deployment, registrar
   ese caso como no probado; no habilitar callbacks temporales sin revisar Google.
3. Ubicación/retiro: cargar el iframe de Google Maps y, en un pedido de prueba,
   revisar el mapa de seguimiento OpenStreetMap.
4. Checkout de tarjeta: abrir un pedido generado con cuenta de QA y credenciales
   TEST; verificar que cargue el SDK/Brick y completar, aprobar o rechazar el pago
   solo en el entorno de prueba. No usar credenciales productivas.
5. Galería/avatar de Blob y reseñas Google, si las variables de Preview están
   disponibles.

Un bloqueo CSP debe investigarse por directiva y origen. Agregar solo el host exacto
que el flujo requiere; no sumar `*`, `https:` ni `unsafe-eval` a Production. Después
de cualquier ajuste, repetir la suite automatizada y todo flujo manual afectado.
No mergear hasta que no haya bloqueos en los flujos disponibles y quede anotado
cualquier flujo que no pudo probarse por falta de credenciales.
