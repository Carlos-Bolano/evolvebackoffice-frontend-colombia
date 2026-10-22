## Contexto

El frontend (`src/features/business/orders/` y `src/features/business/branches/`) se comunica con BackendPOS mediante el cliente Axios compartido (`src/config/axios.config.ts`). Este cambio alinea los contratos HTTP y mejora la experiencia operativa de órdenes, cierres, domicilios, zonas, notificaciones y WhatsApp Evolution API.

## Decisiones

1. **Filtros y vistas de órdenes (`orders.service.ts`, `use-orders.ts`, `orders-page.tsx`, `orders-kanban.tsx`)**:
   - Enviar `search`, `fulfillmentType`, `origin`, `paymentState`, `syncAlert`, `from`, `to` y `courierId` a `GET /api/orders`.
   - Soportar vista Kanban y vista Tabla compacta compartiendo selección por lote y acciones rápidas de transición de estado.
   - Añadir subnavegación unificada (`OrdersSubnav`) entre Tablero, Domicilios, Zonas y Rutas, Operaciones y Cierre.
2. **Cierre y conciliación (`order-closings.service.ts`, `closing-resolve-table.tsx`, `closing-orders-table.tsx`, `order-closing-page.tsx`)**:
   - `cancelOrderFromClosing(orderId, reason, cancellationType)` enviará `{ reason, cancellationType }` en el cuerpo JSON de `POST /api/orders/{id}/cancel`.
   - Añadir botón de conciliación en 1 clic cuando el pedido tiene medio de pago mapeado/declarado y acción masiva para pedidos seleccionados.
3. **Domicilios, zonas y vista móvil (`delivery-routes-page.tsx`, `delivery-map.tsx`, `delivery-operations-page.tsx`, `courier-mobile-page.tsx`)**:
   - Unificar el selector de sucursal con `localStorage('business.orders.branchId')`.
   - Renderizar previsualización en vivo del radio de la zona editada, permitir eliminar zonas (`DELETE /api/delivery-enhancements/zones/{id}`) y simular cotizaciones (`GET /api/delivery-enhancements/quote`).
   - En `/delivery`, añadir botones rápidos de efectivo (_Exacto_, _$20.000_, _$50.000_, _$100.000_) y reporte de incidencia (`POST /api/delivery-operations/orders/{id}/incident`).
4. **Canal y notificaciones WhatsApp Evolution API (`whatsapp.service.ts`, `branch-whatsapp-card.tsx`, `order-detail-dialog.tsx`)**:
   - Consumir los endpoints `/api/branches/{branchId}/whatsapp*` y `/api/orders/{orderId}/whatsapp/*` enviando `Idempotency-Key` en operaciones mutantes sin enlaces ni alternativa WhatsApp Desktop.

## Decisiones de la revisión de usabilidad

- Centralizar referencia operativa, traducción del medio y estado de cobro; cancelados y reembolsados nunca indican cobrar.
- Mantener borradores de configuración WhatsApp por usuario/tenant/sucursal en sessionStorage; avisar al salir con cambios pendientes y al cerrar pestaña; recuperar borrador al volver y ofrecer descartar. Un refetch de estado no reemplaza la edición.
- Eliminar componente, utilidades, traducciones y pruebas de enlaces WhatsApp Desktop. El diálogo API consulta preview al abrir para exponer elegibilidad, mantiene preview explícito antes de enviar, autorización e idempotencia.
- Agrupar navegación/filtros secundarios en móvil, sucursal con nombre legible y acciones táctiles de al menos 44px. Priorizar turnos; configuración WhatsApp en panel colapsado con estado.
- Crear pedido con tipo recoger/domicilio explícito; datos de cliente fuera de envío, dirección antes de mapa/coordenadas, total y confirmar en pie fijo del diálogo. Sin envío en pickup.
- Separar activos de históricos en órdenes, preservando todos los registros y haciendo coincidir contadores con la vista. Presentar dinero e identificadores de forma consistente en tablero, domicilios y cierre.
