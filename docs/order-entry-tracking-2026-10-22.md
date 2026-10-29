# Captura y seguimiento de pedidos — 22/10/2026

Se implementaron las siete mejoras autorizadas. WhatsApp continúa exclusivamente por Evolution API.

| Mejora               | Resultado                                                                                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cliente por teléfono | Búsqueda normalizada de clientes activos, selección explícita y nombre/dirección editables. Envía IDs públicos al vincular. Editar nombre/teléfono permite continuar como ocasional sin modificar el directorio.                                                                                      |
| Productos            | Busca nombre, SKU o código de barras en toda la sucursal antes de paginar. Catálogo de 20 por página, hasta 20 favoritos y 12 recientes por usuario/tenant/sucursal; se guardan IDs y se consultan precios actuales.                                                                                  |
| Borrador             | Conserva productos, cantidades y cliente en sessionStorage por usuario/tenant/sucursal. Recupera al cerrar/recargar, permite descartar, se limpia al crear o cerrar sesión. Revalida estado y precios antes de enviar. Un guardado anterior no elimina ediciones posteriores.                         |
| Conexión             | Órdenes y domicilios muestran conexión, última respuesta, reconexión y modo sin conexión; al recuperar red refrescan consultas. El contador de segundos no se anuncia continuamente a lectores de pantalla.                                                                                           |
| Cronología           | Detalle reúne creación, cambios auditados con responsable conocido, pagos, incidencias registradas/resueltas y estado de mensajes. Tiene paginación, refresco y recuperación de errores.                                                                                                              |
| Vistas               | Accesos Listos sin asignar, Pendientes de cobro y Errores de sincronización. Guarda hasta 10 vistas y conserva filtros/presentación por usuario/tenant. La búsqueda personal se conserva solo durante la sesión.                                                                                      |
| Asistente Evolution  | Guía vínculo, verificación remota, prueba con destinatario autorizado de un pedido y eventos/plantillas. Incluye acceso a habilitación manual del canal. Exige preview y confirmación, usa outbox e idempotencia existentes, distingue cola de aceptación y permite configurar sin enviar una prueba. |

También se restauró `appearance:auto` en los radios del tipo de entrega: el reset global ocultaba los círculos aunque los controles respondían al teclado/clic. Vite ignora salidas de Playwright y graphify para evitar recargas durante pruebas o edición.

## Correcciones adicionales de filtros

- Elegir un domiciliario desactiva la vista rápida incompatible Listos sin asignar; la consulta usa el domiciliario seleccionado.
- Cambiar de sucursal limpia el filtro de domiciliario y conserva el borrador independiente de cada sede.
- Si un domiciliario guardado no aparece en la lista actual, se muestra una opción identificable y un aviso con botón para quitar el filtro. Se mantienen explícitos los filtros históricos de usuarios inactivos.
- Dos escenarios `UX3:` con backend real verifican dos sucursales, vistas guardadas, borradores y desactivación de un domiciliario. Pasaron 2/2 en 13,5 s; antes de la corrección se reprodujo el conflicto.
- Revisión móvil adicional a 390×844: filtro visible, acción de 44 px y sin desbordamiento horizontal.

## Validación

- `bun run check`: formato, TypeScript, ESLint y **84/84 Vitest** aprobados.
- `bun run build`: aprobado; permanecen avisos existentes de importación estática/dinámica de i18n y tiempos de plugins cuando se reportan.
- Backend: compilación de solución y **1123/1123** pruebas aprobadas (**1122 unitarias +1 integración nueva con PostgreSQL y HTTP de Postman**).
- Nuevos escenarios Chromium visible: **7/7** aprobados en 1,5 min y **1/1** adicional del asistente con transporte sintético aprobado en 10,7 s.
- Regresión completa final Chromium visible: **54/54 aprobados en una única corrida de 11,1 min**, sin omisiones ni reintentos. Incluye las dos regresiones nuevas de filtros y borradores por sucursal.
- Intentos anteriores: la corrida de continuación dio 44 aprobados, 1 timeout al pulsar Productos y 9 omitidos por ejecución serial en 9,9 min. El bloque UX2/UX3 pasó luego 10/10 en 1,7 min sin cambios de código, y la corrida final completa también pasó. No se atribuye una causa al timeout intermitente. La primera validación de 52 escenarios tuvo además un fixture de cronología compartido, que se aisló antes de esta continuación.
- OpenSpec: frontend 12/12 y backend 15/15 válidos en modo estricto. Grafos actualizados.
- Revisión visual adicional a 390×844: sin desbordamiento horizontal ni errores JavaScript; borrador de revisión descartado, sin crear pedido.

## Evidencia y alcance

- `playwright-report/order-entry-continuation-final/index.html`: **corrida completa final, 54/54 aprobados**.
- `playwright-report/order-entry-continuation-full/index.html`: intento anterior, 44 aprobados, 1 timeout y 9 omitidos.
- `playwright-report/order-entry-continuation-recheck/index.html`: bloque UX2/UX3, 10/10 aprobados sin cambios de código.
- `playwright-report/order-entry-branch-before/index.html`: reproducción del conflicto entre Listos sin asignar y un domiciliario seleccionado.
- `playwright-report/order-entry-branch-after/index.html`: las dos regresiones `UX3:` aprobadas tras la corrección.
- `playwright-report/order-entry-full/index.html`: corrida completa (49 aprobados y fallo de fixture descrito arriba).
- `playwright-report/order-entry-final-scenarios/index.html`: cronología y dos escenarios de asistente, 3/3 aprobados tras aislar el fixture.
- `playwright-report/order-entry-tracking-r6/index.html`: siete escenarios nuevos.
- `playwright-report/order-entry-simulated-r3/index.html`: cola → aceptación en el asistente, transporte sintético.
- Pruebas nuevas en `tests/orders-whatsapp.spec.ts` (`UX2:` y `UX3:`), `hooks/__tests__/use-manual-order-draft.test.ts` y backend `OrderEntryTrackingTests` / `WhatsAppConnectionVerificationIntegrationTests`.
- Capturas privadas locales: backend `.tools/evolution-local/order-entry-tracking/` (`capture-mobile-final.png`, `orders-mobile.png`, `evolution-assistant-mobile.png`). Solo datos de QA.
- Captura del filtro guardado ausente en móvil: backend `.tools/evolution-local/order-entry-continuation/unavailable-courier-mobile.png`.
- Contrato backend: `docs/order-entry-tracking-api.md`; nuevo cambio OpenSpec `streamline-order-entry-and-tracking` en ambos repositorios.

Las pruebas usan backend y PostgreSQL locales con tenants de QA creados y eliminados por las suites. Cluvi se simula por HTTP. La prueba del gateway de verificación usa el mock Evolution existente servido por Postman y registra GET de estado; no habilita el canal ni altera su generación. El recorrido de aceptación del asistente intercepta su transporte en Playwright; no llega a un teléfono.

No se vinculó un dispositivo ni se enviaron mensajes reales. La entrega real requiere un número vinculado y un destinatario autorizado. La cronología muestra la evidencia disponible: puede faltar auditoría antigua; incidencias vigentes sin evento histórico se etiquetan como estado actual con fecha de actualización del pedido. Aceptado por el proveedor aún no significa entregado.
