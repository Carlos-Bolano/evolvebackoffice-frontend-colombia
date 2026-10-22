## Why

La captura pierde datos al cerrar y exige repetir clientes/productos. La operación necesita conexión visible, historial y acceso rápido a vistas frecuentes. El usuario autorizó las siete mejoras.

## What Changes

- Cliente por teléfono con selección explícita y opción ocasional.
- Productos por nombre/SKU/barras en servidor, favoritos y recientes por usuario/tenant/sucursal.
- Borrador automático recuperable y descartable de pedido.
- Indicador de conexión y última respuesta, recuperación con refresco de datos.
- Cronología unificada en detalle.
- Vistas rápidas y guardadas con filtros/presentación persistidos.
- Coherencia de filtros al elegir domiciliario, cambiar sucursal o recuperar un domiciliario que dejó de estar disponible.
- Asistente de configuración Evolution con conexión, prueba autorizada y automatizaciones.

## Capabilities

### New Capabilities

- `order-entry-tracking`: captura persistida y seguimiento visible.

### Modified Capabilities

Ninguna.

## Impact

Órdenes, domicilios, servicios de catálogo/clientes y configuración WhatsApp. Depende de search del catálogo y cronología aditivos del backend. Sin Desktop, commits, despliegues ni mensajes reales de prueba.
