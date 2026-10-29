# Propuesta: Mejoras integrales de Órdenes, Domicilios, Cierre/Conciliación, Zonas, Notificaciones y WhatsApp Evolution API

## Problema

1. La vista de órdenes (`src/features/business/orders/pages/orders-page.tsx`) carece de búsqueda textual, filtros rápidos por rango de fechas, entrega, domiciliario, estado de pago y sincronización, así como de vista compacta tabular y acciones directas de 1 clic para avanzar el estado o cancelar eligiendo disposición de inventario (`Restocked` vs `Waste`).
2. En el cierre de órdenes (`src/features/business/orders/services/order-closings.service.ts`), `cancelOrderFromClosing` envía cuerpo nulo y `áreason=` por query string, incumpliendo el contrato `POST /api/orders/{id}/cancel` del backend (`CancelOrderDto { reason, cancellationType }`). Además, conciliar pedidos con un solo medio declarado requiere abrir un diálogo por cada fila.
3. Las páginas de operaciones y rutas de domicilios usan `<select>` nativos en vez del selector de sucursal compartido, el mapa de zonas no muestra previsualización en vivo del radio ni permite eliminar zonas o simular cotizaciones, y la vista móvil del domiciliario carece de botones rápidos de denominaciones de efectivo y reporte de incidencias.
4. Las notificaciones en tiempo real solo disparan toasts efímeros sin centro de historial ni alertas operativas, y falta la interfaz de vinculación de canal WhatsApp Evolution API por sucursal y envío/seguimiento de notificaciones WhatsApp por pedido.

## Resultado observable

- Barra de filtros avanzados en Órdenes, tarjetas Kanban enriquecidas con botón primario de siguiente estado de 1 clic, menú rápido de estados, diálogo de cancelación con `Restocked`/`Waste`, alternancia Kanban/Tabla y subnavegación unificada.
- Corrección del contrato `cancelOrderFromClosing` con selección `Restocked`/`Waste`, conciliación rápida de 1 clic individual y masiva, filtros y resumen imprimible en Cierre de Órdenes.
- Mejoras UX en Domicilios, Operaciones, Zonas (círculo en vivo, eliminar zona, simulador de cotización, clic en marcador para parada de ruta) y App Móvil de Domiciliario (botones de efectivo y reporte de incidencia).
- Centro de notificaciones en sesión con historial, contador de no leídas, silencio/prueba de sonido y alertas proactivas.
- Configuración de canal WhatsApp Evolution API por sucursal (estado, QR, eventos automáticos y plantillas) y panel de notificaciones WhatsApp por pedido (consentimiento, vista previa, envío idempotente, historial y recuperación `retry`/`resend`, exclusivamente mediante Evolution API).

## Alcance y capacidades afectadas

- `order-management`: filtros avanzados, transiciones de 1 clic, corrección de cancelación en cierre, conciliación rápida, centro de notificaciones y avisos WhatsApp por pedido.
- `delivery-operations`: sugerencia de domiciliario, mapa interactivo de zonas con eliminación y cotizador, y mejoras en vista móvil del domiciliario.
- `branch-settings`: configuración de canal WhatsApp Evolution API por sucursal.

## Revisión de usabilidad del 22/10/2026

Implementar los ocho hallazgos de la auditoría: coherencia de cobro en cancelados/reembolsados, borradores protegidos, operación móvil compacta, creación recoger/domicilio con pie visible, WhatsApp solo Evolution, turnos antes de configuración, acceso a históricos y presentación consistente.
