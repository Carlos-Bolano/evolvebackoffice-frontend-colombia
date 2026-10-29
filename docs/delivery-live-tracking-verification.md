# Verificación de seguimiento de domicilios

Implementado para despacho interno y cliente final. Cambios en ramas `feat/delivery-live-tracking-frontend` y `feat/delivery-live-tracking-backend`; sin despliegue ni envíos reales de WhatsApp.

## Evidencia local — 22 de octubre de 2026

| Comprobación                                             | Resultado                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| Playwright Chromium visible, backend y PostgreSQL reales | 6/6, sin omisiones ni reintentos, 1.2 min                            |
| `bun run check`                                          | Formato, TypeScript, ESLint y 89/89 pruebas aprobados                |
| `bun run build`                                          | Aprobado; avisos existentes de imports i18n estáticos/dinámicos      |
| Backend sin Integration                                  | 1141/1141 aprobadas, incluye CORS Production para SignalR            |
| Tracking y regresión PostgreSQL WhatsApp                 | 20/20 aprobadas; incluye 17 unitarias de tracking y 3 de integración |
| OpenSpec estricto                                        | Backend 16/16; frontend 13/13                                        |

`tests/delivery-tracking.spec.ts` crea y elimina su propio tenant local. Comprueba creación de enlace desde el pedido, Evolution bloqueado sin canal, consentimiento GPS, movimiento de mapas interno/público, SignalR conectado, primer encuadre con repartidor visible, conservación del zoom elegido, pausa, renovación/revocación con cliente abierto, permiso denegado, roles, ausencia de PII y cabeceras de administrador, respaldo HTTP cuando SignalR no conecta, frescura y entrega finalizada. La frescura visual adelanta el reloj del navegador; la caducidad del servidor se prueba aparte con TimeProvider en backend.

Geolocalización sintética y teselas interceptadas: no se generó carga de pruebas sobre OSM. OSRM usa una simulación Postman local basada en su contrato; se verifican HTTP correcto, 502, timeout, datos inválidos y ausencia de ruta. La geometría de prueba no demuestra navegación real por calles. No se enviaron mensajes ni se vinculó un número de WhatsApp.

Informe local: `playwright-report/delivery-live-tracking-final/index.html`. Capturas: `test-results/tracking-public-mobile.png` y `test-results/tracking-operator.png` (artefactos ignorados en Git).

## Uso y configuración

1. Despacho abre **Órdenes → Seguimiento en vivo** y selecciona sucursal/domiciliario.
2. El domiciliario abre `/delivery` durante su turno y pulsa **Compartir ubicación**. Puede pausarla; se muestran precisión, última recepción y recuperación de permisos/conexión.
3. Desde el detalle del pedido se crea/copia el enlace, o se previsualiza su envío por Evolution API. Renovar y revocar piden confirmación y retiran el acceso anterior.
4. El cliente abre `/track#TOKEN` sin login. Solo ve ese pedido; el GPS se muestra durante la entrega con sesión consentida y muestra reciente. Sin datos vigentes no se presenta ETA.

Frontend: `VITE_MAP_TILE_URL` y `VITE_MAP_TILE_ATTRIBUTION`. Backend: `DeliveryTracking:PublicBaseUrl`, `DeliveryTracking:RoutingBaseUrl` (vacío = sin rutas), tiempos de frescura/retención/expiración documentados en `docs/delivery-live-tracking-api.md` del repositorio backend. Aplicar la migración tenant `AddDeliveryLiveTracking` y persistir las llaves DataProtection.

GPS web requiere HTTPS y permiso. El navegador puede suspenderlo al bloquear el teléfono; no garantiza captura en segundo plano. La ETA no incluye tráfico y se omite si hay otras entregas pendientes. Para producción, configurar un proveedor de teselas y OSRM propio/proveedor compatible. Varias réplicas necesitan backplane SignalR para avisos inmediatos entre nodos; existe respaldo periódico de 10 s público/15 s interno.
