# Operación y recuperación de QuilGym

Este documento es el runbook para detectar incidentes, reducir su impacto y recuperar el servicio sin improvisar. No contiene secretos. Las acciones destructivas o que cambian Production requieren autorización del responsable del negocio, una copia o rama de recuperación y una persona a cargo del rollback.

## Estado comprobado el 20/10/2026

- Vercel Production está en el plan Hobby. Observability está disponible, pero las alertas automáticas de anomalías requieren Pro/Enterprise con Observability Plus.
- En la ventana inspeccionada de 12 horas, Vercel Functions informó `0 %` de errores y `0 %` de timeouts.
- Los cuatro crons de Production están desplegados y registraron una ejecución: emails, vencimiento de pedidos, limpieza de carritos/límites y sincronización de envíos.
- Los endpoints de cron exigen `Authorization: Bearer <CRON_SECRET>` y las operaciones están diseñadas para poder repetirse sin duplicar el efecto comercial.
- Resend tiene `send.quilgym.com` verificado y un envío real de prueba fue recibido.
- La base de Preview es `quilgym_preview`; Production usa `neondb`. Las migraciones `0000` a `0011` están confirmadas en Preview.
- Neon usa el plan Free. La rama predeterminada que sirve Production se llama `production`; contiene `neondb` y `quilgym_preview` dentro del mismo proyecto y tenía una única rama antes del simulacro.
- La ventana real de historial/PITR es de **6 horas**. Este es el RPO máximo disponible por historial: un incidente descubierto después de esa ventana no puede recuperarse con PITR salvo que exista un snapshot anterior útil.
- El 20/10/2026 17:41:01 UTC se creó un snapshot manual de `production`. No vence, no había snapshots previos y el plan alcanzó con él su límite de un snapshot manual; la programación automática requiere upgrade.
- Ese snapshot se restauró mediante `Multi-step restore` en una rama aislada, sin alterar `production` ni sus conexiones. Neon informó 0,73 segundos para crearla. Se validaron en modo lectura el esquema, datos y las tablas incorporadas por las migraciones `0010`/`0011`; no se migraron conexiones ni se ejecutaron escrituras.
- La rama de simulacro `branch_from_snapshot_Oct 20, 2026 2:41 PM GMT-3` contiene una copia de datos productivos. Por decisión de Lorenzo se conserva para referencia; ningún deployment apunta a ella. Limitar el acceso y eliminarla cuando ya no sea necesaria.

## Revisión operativa

### Todos los días hábiles (5 minutos)

1. En Vercel → QuilGym → Observability, seleccionar `Production` y las últimas 24 horas.
2. Confirmar que `Vercel Functions` no muestre errores o timeouts nuevos.
3. Abrir `Cron Jobs` y verificar una invocación de cada ruta:
   - `/api/internal/order-emails`
   - `/api/internal/expire-orders`
   - `/api/internal/expire-carts`
   - `/api/internal/sync-shipments`
4. Si una invocación falla, abrir sus logs filtrados por `requestPath`. Vercel no reintenta automáticamente un cron fallido.
5. En Resend → Logs, revisar rechazos o rebotes. Nunca copiar direcciones de clientes a tickets públicos.
6. En Mercado Pago, comparar cualquier pago reclamado con el pedido del panel. La vuelta del navegador no acredita pagos; la fuente válida es la conciliación del servidor con Mercado Pago.

En Hobby no hay alertas automáticas de anomalías. Hasta contratar Observability Plus o un monitor externo, el control diario es obligatorio. Un monitor futuro debe consultar una ruta de salud dedicada; no debe recibir `CRON_SECRET`, credenciales de base ni datos de clientes.

### Antes de cada deploy a Production

1. Verificar que el commit pasó lint, typecheck, tests y build en Preview.
2. Ejecutar `npm run operations:check -- --env=.env.preview.local` para revisar la declaración local sin abrir la base.
3. Confirmar en Vercel que el deployment de Preview pertenece al commit esperado.
4. Probar login, catálogo, carrito y acceso al pedido. Para pagos usar solamente cuentas y credenciales TEST en el entorno autorizado.
5. Si el cambio incluye una migración, crear antes un snapshot o punto recuperable confirmado en Neon y anotar hora, commit y responsable.
6. Desplegar en una ventana en la que se puedan observar Vercel, Mercado Pago, Resend y el panel durante al menos 30 minutos.

### Una vez por mes

1. Registrar la ventana de restauración que muestra Neon. Actualmente es de 6 horas; si el negocio necesita recuperar incidentes detectados más tarde, evaluar un plan con mayor retención o snapshots programados.
2. Comprobar la fecha del snapshot manual. En Free solo hay uno y no vence: antes de reemplazarlo, acordar qué punto histórico conviene conservar.
3. Hacer un simulacro **aislado**: restaurar el snapshot o un punto del historial en una rama nueva, nunca encima de Production.
4. En esa rama, ejecutar solo consultas de lectura y confirmar: migraciones, cantidades aproximadas de pedidos/productos, último pedido y acceso de un usuario QA sin exponer PII.
5. Eliminar la rama del simulacro únicamente después de documentar el resultado y confirmar que ninguna variable de Vercel la utiliza.

El simulacro del 20/10/2026 confirmó que el mecanismo funciona, pero no midió el RTO completo de la tienda: faltaría incluir la decisión humana, validaciones y conciliación de pagos. No usar los 0,73 segundos de creación de rama como promesa de recuperación integral.

## Clasificación e intervención

| Nivel | Ejemplos | Primera acción |
| --- | --- | --- |
| SEV-1 | cobros con importe incorrecto, fuga de datos, pérdida/corrupción amplia de pedidos | detener el flujo afectado, conservar evidencias, avisar al responsable y no hacer cambios manuales irreversibles |
| SEV-2 | checkout, login o panel caído; webhooks o crons fallando; emails acumulados | identificar primer error y último deploy, evaluar rollback y comprobar proveedores |
| SEV-3 | error visual o función secundaria degradada sin pérdida de datos | registrar, reproducir en Preview y corregir por PR |

Para cualquier incidente anotar: hora de detección en UTC y Argentina, URL/ruta afectada, deployment y commit, primer/último error, proveedor involucrado, alcance conocido, responsable y cada acción realizada.

## Recuperación de un deploy

1. Determinar si el problema es solo código o también modificó datos/esquema.
2. Si es solo código, promover un deployment anterior conocido o hacer un revert por Git. Verificar después login, checkout y APIs afectadas.
3. Revisar los cron después del rollback: un Instant Rollback de Vercel no actualiza por sí solo la configuración activa de cron.
4. Si hubo migración o escrituras incorrectas, no asumir que el rollback de código repara la base. Pasar al procedimiento de Neon.

## Recuperación de Neon

### Regla principal

Primero investigar en una rama restaurada y aislada. Restaurar directamente la rama productiva puede causar una breve desconexión y descartar operaciones válidas posteriores al punto elegido.

### Procedimiento

1. Declarar el incidente y pausar únicamente las operaciones que puedan agravar el daño.
2. Identificar el instante anterior al error con logs de Vercel, auditoría del panel y operaciones de Mercado Pago. Usar UTC para evitar ambigüedad.
3. En Neon → Backup & Restore/Restore, confirmar la rama productiva y la ventana disponible.
4. Usar Time Travel o crear una rama desde el instante elegido. No pulsar todavía restaurar sobre Production.
5. Validar en la rama aislada con consultas de solo lectura: tablas esperadas, migraciones, stock, pedidos y pagos alrededor del incidente. No enviar emails ni llamar proveedores desde esa rama.
6. Elegir la recuperación menos destructiva:
   - reparación puntual y transaccional si hay pocas filas afectadas y pueden identificarse con certeza;
   - restauración de rama si el daño es amplio y el negocio acepta perder o reconstruir las operaciones posteriores.
7. Antes de cambiar Production, crear un snapshot del estado dañado para investigación/rollback y registrar el punto de restauración elegido.
8. Ejecutar la restauración durante una ventana coordinada. No cambiar simultáneamente `DATABASE_URL` y credenciales salvo que el procedimiento elegido lo requiera.
9. Verificar conexión, migraciones, login, catálogo, panel y un pedido sin cobrar. Luego reconciliar por ID de proveedor todos los pagos ocurridos después del punto restaurado antes de reabrir cobros.
10. Revisar la outbox de emails: no reenviar a ciegas. Resend conserva idempotencia por un período limitado y la aplicación limita los reintentos.
11. Mantener el estado anterior hasta cerrar la validación. Documentar RPO real (datos perdidos/reconstruidos) y RTO real (tiempo hasta recuperar servicio).

## Rotación coordinada de la credencial de Neon

La URL de una base apareció en una salida previa de diagnóstico y su contraseña debe considerarse expuesta. La rotación se hace sin dejar a Vercel apuntando a una credencial revocada:

1. Confirmar un snapshot/punto recuperable y quién hará el rollback.
2. Crear una credencial/rol nuevo con los permisos mínimos necesarios; mantener temporalmente la anterior.
3. Actualizar primero Preview y los archivos locales privados, desplegar y comprobar conexión/migraciones de solo lectura.
4. Actualizar `DATABASE_URL` de Production en Vercel y hacer un redeploy controlado.
5. Verificar logs, login, catálogo, panel y preparación de checkout sin efectuar un cobro real.
6. Recién entonces revocar la credencial anterior y confirmar que no quedan deployments o herramientas usándola.
7. Si falla, restaurar temporalmente la credencial anterior, investigar en Preview y repetir. Nunca guardar ambas URLs en Git, documentación o chats.

La rotación de `ORDER_ACCESS_SECRET` es distinta: invalida los enlaces legacy de pedidos. Debe hacerse después de la ventana de compatibilidad, con comunicación y una prueba de enlaces nuevos.

## Pentest externo posterior

No se contrata ni inicia un pentest sin autorización escrita. El alcance recomendado es un Preview fijo con base aislada, cuentas y pagos TEST, límites de horario y contactos de emergencia.

Debe incluir autenticación/autorización, panel, pedidos, checkout, webhooks, uploads y rate limits. Debe excluir denegación de servicio, ingeniería social, credenciales reales, cobros reales, scraping de clientes y pruebas sobre terceros (Mercado Pago, Google, Resend, Neon o Vercel) fuera de sus programas autorizados. El entregable debe contener evidencia mínima, severidad, reproducción segura, impacto, corrección y retest.

## Cierre de un incidente

- Servicio y datos validados por dos personas.
- Pagos conciliados con el proveedor.
- Emails pendientes revisados sin duplicados.
- Credenciales temporales revocadas.
- Rama/snapshot de investigación retenido o eliminado según la política acordada.
- Causa raíz y acción preventiva incorporadas a una PR.
- Fechas, RPO y RTO reales añadidos a este runbook.
