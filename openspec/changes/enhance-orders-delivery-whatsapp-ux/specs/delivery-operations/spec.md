## ADDED Requirements

### Requirement: Gestión interactiva de zonas y simulador de cotización

La vista de zonas y rutas SHALL mostrar en el mapa el círculo de la zona en edición, permitir eliminar zonas mediante `DELETE /api/delivery-enhancements/zones/{id}` y consultar cotizaciones de envío por coordenadas.

#### Scenario: Eliminar una zona de entrega

- **WHEN** el administrador confirma la eliminación de una zona
- **THEN** el servicio envía `DELETE /api/delivery-enhancements/zones/{id}` y refresca las zonas de la sucursal.

### Requirement: Denominaciones rápidas e incidencias en vista móvil del domiciliario

La vista móvil del domiciliario SHALL ofrecer botones rápidos de monto recibido en efectivo y permitir reportar una incidencia de entrega no completada.

#### Scenario: Reportar incidencia desde la vista móvil

- **WHEN** el domiciliario registra un motivo de no entrega en un pedido en camino
- **THEN** el servicio envía el motivo al endpoint de incidencias y actualiza el listado móvil.

## REMOVED Requirements

### Requirement: Borrador local de WhatsApp

**Reason**: El usuario exige un canal exclusivo Evolution API; se retiran enlaces a WhatsApp Desktop y sus utilidades.
**Migration**: Usar Avisar al cliente/domiciliario, autorización, preview y envío idempotente del servidor.
