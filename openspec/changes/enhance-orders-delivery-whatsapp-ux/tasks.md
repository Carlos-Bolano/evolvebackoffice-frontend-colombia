## 1. Órdenes, Cierre, Domicilios, Zonas y Notificaciones

- [x] 1.1 Actualizar tipos y cliente `orders.service.ts` + `use-orders.ts` con nuevos filtros (`search`, `fulfillmentType`, `origin`, `paymentState`, `syncAlert`) y campos enriquecidos de `OrderListItemDto`.
- [x] 1.2 Implementar barra de subnavegación unificada (`OrdersSubnav`), barra de filtros avanzados, alternancia Kanban/Tabla, botón de siguiente estado en 1 clic y menú rápido de estados/cancelación (`Restocked`/`Waste`).
- [x] 1.3 Corregir `cancelOrderFromClosing` en `order-closings.service.ts` para enviar `{ reason, cancellationType }`, actualizar `ClosingResolveTable` y añadir conciliación rápida en 1 clic, filtros y resumen imprimible en `OrderClosingPage`.
- [x] 1.4 Mejorar `CourierPickerDialog` (sugerencia de menor carga e inicio rápido de turno), `DeliveryOperationsPage`, `DeliveryRoutesPage` y `DeliveryMap` (círculo en vivo, eliminar zona, simulador de cotización, clic en marcador para parada) y `CourierMobilePage` (botones rápidos de efectivo e incidencias).
- [x] 1.5 Añadir centro de notificaciones en tiempo real con historial de sesión, contador de no leídas, silencio/prueba de sonido y alertas operativas.

## 2. Integración WhatsApp Evolution API en Backoffice

- [x] 2.1 Crear servicio tipado `whatsapp.service.ts` para canal por sucursal (`/api/branches/{branchId}/whatsapp*`) y notificaciones por pedido (`/api/orders/{orderId}/whatsapp/*`) con soporte de `Idempotency-Key`.
- [x] 2.2 Añadir tarjeta y modal de configuración/QR de canal WhatsApp en la configuración de sucursal.
- [x] 2.3 Integrar pestaña/panel de notificaciones WhatsApp Evolution API (consentimiento, preview, envío, historial, retry y resend, exclusivamente Evolution API) en el detalle del pedido.
- [x] 2.4 Ejecutar pruebas unitarias Vitest, `bun run check`, `graphify update .` y `openspec validate --all --strict --no-interactive`.

## 3. Regresión de navegación en navegador visible

- [x] 3.1 Conservar la sucursal efectiva de la primera visita de Órdenes al navegar a Zonas y Turnos; traducir el selector sin sucursal en español/inglés.
- [x] 3.2 Verificar navegación con almacenamiento limpio en escritorio y móvil, ejecutar suite Chromium visible y controles del frontend. Chromium visible: 37/37 + 2/2 regresiones en 1440px y 390px; `bun run check` 83/83, OpenSpec 11/11 y grafo actualizado.

## 4. Usabilidad y canal exclusivo Evolution API

- [x] 4.1 Corregir cobro en cancelados/reembolsados y unificar medios, importes y referencias operativas.
- [x] 4.2 Proteger/recuperar borradores WhatsApp por usuario/tenant/sucursal, sin sobrescribir por refetch, con aviso y descarte.
- [x] 4.3 Eliminar WhatsApp Desktop y dejar preview, autorización, envío e historial solo Evolution; mostrar bloqueo y configuración desde el inicio.
- [x] 4.4 Compactar navegación/filtros/cabecera móvil, conservar sucursal legible y ampliar acciones táctiles.
- [x] 4.5 Simplificar creación recoger/domicilio, ubicación en mapa y pie con total/confirmación visible.
- [x] 4.6 Priorizar turnos y separar configuración WhatsApp; diferenciar salidas de configuración de zonas.
- [x] 4.7 Separar activos/históricos y alinear contadores con órdenes visibles.
- [x] 4.8 Añadir regresiones significativas y verificar bun check/build, Playwright visible, OpenSpec y graphify.
