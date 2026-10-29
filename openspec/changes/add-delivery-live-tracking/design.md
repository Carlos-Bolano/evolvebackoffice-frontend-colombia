## Context

Ver propuesta. `DeliveryMap` actual reconstruye el mapa al cambiar destinos; crear un componente vivo separado evita afectar selección de zonas y rutas existentes. La vista DELIVERY conoce turno y pedidos propios. Los detalles ya integran el diálogo Evolution.

## Goals / Non-Goals

**Goals:** GPS opt-in, mapa móvil legible, navegación estable, consulta pública independiente de sesión e i18n completa.

**Non-Goals:** servicio nativo de geolocalización de fondo, envío por Desktop/wa.me, geocodificación y tráfico real.

## Decisions

- Hook GPS inicia sesión de servidor y watchPosition solo tras acción explícita, publica como máximo cada 5 s y conserva la última muestra reciente para reintentar sin reproducir un historial offline. El sessionId impide que una pestaña vieja detenga una sesión nueva. clearWatch al pausar, desmontar, logout o perder turno. Los errores de envío no se etiquetan como éxito.
- Cliente SignalR sin JWT en query; suscripciones por ticket de sucursal o token público en mensajes. Avisos invalidan queries; reconexión y respaldo periódico vuelven a consultar. Claves de caché aisladas por usuario/tenant/sucursal; cliente público separado no agrega JWT ni X-Tenant-Id, ni guarda respuesta privada al revocar.
- `LiveTrackingMap` mantiene instancia y capas; mueve marcadores con interpolación corta y respeta reducción de movimiento. Orientación con heading opcional, precisión y polilíneas de recorrido/ruta diferentes. Encuadre inicial o acción Centrar; mover mapa desactiva seguimiento. Reutiliza variables existentes de teselas y atribución; errores dejan datos textuales disponibles.
- Ruta pública `/track` fuera de PublicRoute que redirige autenticados: funciona también para un usuario con sesión administrativa, sin que esa sesión influya. Token del fragmento solo en memoria/cuerpo POST. Página sin PII, sin otros pedidos ni breadcrumbs privados.
- Controles del enlace en detalle de pedido, confirmación de renovar/revocar y copia recuperable. Plantilla manual DeliveryTracking en diálogo Evolution; permiso, preview e idempotencia existentes.

## Risks / Trade-offs

- GPS en segundo plano no garantizado → aviso visible y frescura con reloj; no prometer rastreo permanente.
- Varias pestañas/dispositivos → sesión del servidor distingue propietario y errores detienen productores antiguos.
- Error de proveedor → no perder estado/ubicación; ETA no disponible y teselas configurables.
- Enlace expirado/revocado → quitar inmediatamente la respuesta anterior, sin mantener coordenadas en una pantalla de error.
