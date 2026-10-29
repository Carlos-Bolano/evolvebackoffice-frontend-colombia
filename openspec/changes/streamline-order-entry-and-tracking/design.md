## Context

Véase proposal.md. React Query y Zustand existentes; sesiones identifican usuario/tenant. El formulario reinicia estados al cerrar; long-poll reintenta silenciosamente.

## Goals / Non-Goals

**Goals:** guardar captura, evitar datos cruzados, reutilizar preview/outbox y respuestas verificadas.
**Non-Goals:** Desktop, envío automático de pruebas, datos personales persistidos entre sesiones, migración del router.

## Decisions

- Borrador versionado en sessionStorage con clave usuario/tenant/sucursal; descartable, se limpia en logout/creación. Recuperación revalida productos contra API antes de enviar.
- Preferencias/favoritos/recientes en localStorage solo IDs/configuración; filtros guardados no contienen texto de búsqueda personal. Query keys incluyen alcance y cancelación de búsqueda.
- Búsqueda de productos paginada con debounce; conservar selector accesible existente. Favoritos/recientes rehidratan precios.
- Cronología consume nuevo endpoint del backend; estados traducidos y tiempo local.
- Long-poll retorna estado/frescura y fuerza invalidación al recuperar conexión, abortable y con señales online/offline.
- Elegir un domiciliario desactiva el preset incompatible Listos sin asignar. Cambiar sede limpia solo el filtro de domiciliario; el borrador mantiene su clave de sede. Un ID guardado ausente de la lista se presenta mediante opción y aviso con acción para quitarlo, sin eliminar silenciosamente filtros históricos de domiciliarios inactivos.
- Asistente orienta pasos sobre la tarjeta existente, verifica estado desde servidor y abre aviso de pedido con autorización/preview/outbox existentes. Prueba completada solo con evidencia aceptada/entregada/leída, no al abrir diálogo.

## Risks / Trade-offs

- Storage bloqueado → mantener operación en memoria y avisar cuando no se puede guardar borrador.
- Productos eliminados/precios cambiados → revisión visible y bloqueo antes de enviar hasta revalidación.
- Falta de historial antiguo → explicar que se muestran eventos disponibles.
- Borrador contiene datos personales → sessionStorage y limpieza al salir; preferencias persistentes solo configuración e IDs.
