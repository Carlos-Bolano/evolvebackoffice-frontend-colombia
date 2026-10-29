# Publicar el frontend de seguimiento

La rama `feat/delivery-live-tracking-frontend` contiene la UI. Requiere que el backend desplegado incluya la rama correspondiente de tracking y las funcionalidades previas de pedidos/Evolution.

En el entorno de build del host (el repositorio incluye `vercel.json`), configurar:

```dotenv
VITE_API_URL=https://api.example.com
VITE_MAP_TILE_URL=https://tiles.example.com/{z}/{x}/{y}.png
VITE_MAP_TILE_ATTRIBUTION=Attribution required by your tile provider
```

Los dominios son ejemplos, no servicios operativos. Usar un proveedor de teselas con permiso/cuota para seguimiento público; cumplir su atribución. Las variables `VITE_*` son públicas y se incluyen durante el build. Reconstruir el frontend al cambiarlas; no poner credenciales privadas en ellas.

El backend debe configurar `DELIVERY_TRACKING_PUBLIC_BASE_URL` con el origen HTTPS de este frontend y permitirlo en CORS. `DeliveryTracking:RoutingBaseUrl` pertenece al servidor; el navegador no llama directamente a OSRM. El backend incluye un overlay Docker de OSRM privado opcional y un ejemplo nginx para WebSockets, documentados en `docs/delivery-tracking-deployment.md` de ese repositorio.

Conservar el rewrite SPA existente para que `/track#TOKEN` funcione al abrir el enlace directamente. Verificar desde un navegador sin sesión que el dominio elegido sea accesible al cliente: una protección de previews del hosting puede impedirlo aunque la aplicación no exija login.

Antes de activar el flujo, hacer un piloto HTTPS con teléfono real: consentimiento GPS, movimiento, pausa, permisos denegados, red intermitente, enlace renovado/revocado y pedido entregado. Verificar WebSocket 101 en el origen/proxy, además del respaldo periódico. El envío real por Evolution requiere un destinatario de prueba autorizado y permiso de contacto.

La evidencia local está en `docs/delivery-live-tracking-verification.md`. GPS, teselas y OSRM se simularon en las pruebas de navegador; esas pruebas no validan cobertura/calidad del mapa real ni captura con pantalla bloqueada.
