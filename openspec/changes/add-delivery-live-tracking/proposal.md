## Why

El mapa actual muestra destinos estáticos. Operadores y clientes necesitan ver el progreso real de una entrega y el domiciliario necesita controlar cuándo comparte su ubicación.

## What Changes

- Compartir/pausar GPS explícitamente en la vista DELIVERY, con errores de permiso, red y turno identificables.
- Vista interna de tracking por sucursal con marcador actualizado sin reiniciar el mapa, rumbo, precisión, frescura y recorrido reciente.
- Página pública sin login por enlace protegido en fragmento, con estado del pedido, ubicación durante la entrega y ETA cuando existe ruta calculada.
- Crear/copiar/renovar/revocar enlace desde el pedido y enviarlo únicamente por Evolution con preview.
- SignalR con recuperación y consultas de respaldo; proveedor de teselas configurable y avisos al fallar mapa o rutas.

## Capabilities

### New Capabilities

- `delivery-live-tracking`: captura GPS, mapa interno y seguimiento público.

### Modified Capabilities

Ninguna: se añaden vistas y controles al flujo existente.

## Impact

Feature orders, rutas públicas/privadas, i18n español/inglés y cliente SignalR. Depende de los nuevos contratos backend y conserva Leaflet 1.9.4 y las variables de teselas existentes. El navegador puede suspender GPS al bloquearse; no se presenta como rastreo nativo garantizado en segundo plano.
