## ADDED Requirements

### Requirement: Filtros avanzados y transiciones rápidas de pedidos

El listado de pedidos SHALL enviar al backend los filtros opcionales `search`, `fulfillmentType`, `origin`, `paymentState` y `syncAlert`, y la interfaz SHALL permitir avanzar el pedido a su siguiente estado válido con un clic desde una vista únicamente Kanban, incluido el historial de estados finales.

#### Scenario: Buscar pedido por texto y filtrar por estado de pago

- **WHEN** el operador escribe un término de búsqueda y selecciona un filtro de estado de pago
- **THEN** `getOrders` incluye `search` y `paymentState` en la consulta a `/api/orders`.

#### Scenario: Avanzar estado desde la tarjeta

- **WHEN** el operador pulsa la acción primaria de siguiente estado en una tarjeta de pedido
- **THEN** se invoca el cambio al siguiente estado del flujo (o el selector de domiciliario si pasa a `Shipped` en un domicilio sin asignar).

### Requirement: Cancelación con disposición de inventario desde el cierre y conciliación rápida

El servicio de cierres SHALL enviar `{ reason, cancellationType }` en el cuerpo JSON de `POST /api/orders/{id}/cancel` al cancelar un pedido sin estado final, y la tabla del cierre SHALL permitir conciliar en un clic el medio de pago declarado.

#### Scenario: Cancelar pedido olvidado desde el cierre como merma o devolución

- **WHEN** el operador cancela un pedido desde la tabla de resolución indicando motivo y `Waste` o `Restocked`
- **THEN** `cancelOrderFromClosing` envía `{ reason, cancellationType }` en el cuerpo de `POST /api/orders/{id}/cancel`.

#### Scenario: Conciliar en un clic con el medio declarado

- **WHEN** el operador pulsa la confirmación rápida de pago en un pedido con medio mapeado
- **THEN** se registra el pago por el total del pedido sin requerir abrir el diálogo manual de desglose.

### Requirement: Notificaciones WhatsApp por pedido vía Evolution API

El detalle del pedido SHALL permitir gestionar la autorización de contacto, previsualizar el mensaje, solicitar el envío con `Idempotency-Key`, consultar el historial paginado y ejecutar `retry` o `resend` (con confirmación de riesgo de duplicado en `UnknownOutcome`), usando exclusivamente Evolution API y sin apertura de aplicaciones externas.

#### Scenario: Previsualizar y enviar notificación de pedido

- **WHEN** el operador previsualiza una plantilla autorizada y confirma su envío
- **THEN** el servicio envía `previewVersion` e `Idempotency-Key` a `POST /api/orders/{orderId}/whatsapp/notifications` y actualiza el historial del pedido.

### Requirement: Coherencia de cobro y presentación de pedidos

La interfaz SHALL indicar no cobrar pedidos cancelados/reembolsados y mostrar medios traducidos, importes locales y referencias operativas consistentes. SHALL diferenciar pedidos activos e históricos con contadores correspondientes.

#### Scenario: Abrir cancelado desde Kanban o notificación

- **WHEN** se abre un pedido Cancelled o Refunded
- **THEN** no aparece una instrucción de cobrar y se identifica el estado terminal.

#### Scenario: Encontrar pedidos cancelados

- **WHEN** existen pedidos cancelados fuera de las columnas activas
- **THEN** se puede abrir el historial y sus contadores corresponden a los pedidos mostrados.

### Requirement: Creación de pedido y operación móvil

El formulario SHALL diferenciar recoger y domicilio, mostrar cliente fuera de envío, ofrecer mapa para ubicación y mantener el total y confirmar visibles. La operación móvil SHALL priorizar tarjetas y acciones táctiles de al menos 44px sin perder la identificación de sucursal.

#### Scenario: Crear pedido para recoger

- **WHEN** el usuario elige para recoger
- **THEN** no necesita recorrer campos de envío y no se envía dirección ni tarifa de domicilio.

#### Scenario: Operar desde móvil

- **WHEN** el usuario abre Domicilios a 390px con un pedido listo
- **THEN** ve la primera tarjeta en el viewport inicial y las acciones Asignar/Enviar ofrecen un área táctil de al menos 44px.

#### Scenario: Avisar mediante canal no disponible

- **WHEN** se abre Avisar al cliente con canal deshabilitado
- **THEN** se presenta el motivo y un acceso a configuración, sin alternativa Desktop ni enlace externo, y el envío permanece bloqueado.
