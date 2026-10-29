# Mejoras de usabilidad y WhatsApp exclusivamente Evolution API

Se implementaron los ocho hallazgos de la revisión del 22/10/2026. El transporte
WhatsApp Desktop fue retirado por instrucción del usuario.

## Cambios

1. **Cobro coherente con el estado.** Cancelados y reembolsados indican no cobrar,
   incluso si conservan flags de pago. Sus detalles y menús no ofrecen cambios operativos.
2. **Plantillas protegidas.** Borradores por usuario, tenant y sucursal en
   sessionStorage. Se avisa antes de salir por enlaces o cerrar pestaña; volver,
   recargar o cambiar de sucursal recupera el borrador. Navegación programática o
   atrás conserva el borrador aunque no pase por la confirmación de enlaces.
   Se puede descartar. Los refetch del canal y la respuesta de un guardado anterior
   no reemplazan una edición nueva. Logout limpia los borradores.
3. **Operación móvil.** Subnavegación de una fila, cabeceras compactas, filtros
   secundarios plegables y selector de sucursal con nombre completo. Primera
   tarjeta de Domicilios visible al entrar a 390 × 844; Asignar/Enviar tienen
   área táctil de al menos 44 px.
4. **Creación de pedido.** Tipo Para recoger/A domicilio explícito. Cliente fuera
   de envío, dirección antes de ubicación y selección en mapa opcional. Pie
   visible con total y confirmación. Recoger no envía dirección, coordenadas ni
   tarifa aunque se hayan editado antes.
5. **Evolution API exclusivo.** Avisar al cliente/domiciliario presenta
   disponibilidad al abrir, motivo de bloqueo y enlace a configurar el canal.
   Conserva autorización, previsualización explícita antes de enviar, clave
   idempotente e historial con recuperación segura. Se eliminaron el componente
   Desktop, enlaces de protocolo, utilidades y pruebas de transporte manual.
6. **Turnos primero.** Iniciar/liquidar turnos precede al panel plegable de
   WhatsApp, que resume conexión y pausa. Zonas y tarifas se identifica como
   configuración separada de la preparación de salidas.
7. **Activos e historial.** Entregados, cancelados y reembolsados se encuentran
   en Historial. Los contadores por plataforma corresponden al grupo visible;
   las operaciones por lote siguen limitadas a órdenes elegibles.
8. **Presentación consistente.** Estados y medios conocidos traducidos, importes
   por formato local y referencia operativa POSCO con ocho caracteres significativos,
   común a tablero, domicilios y cierre. El detalle permite copiar la referencia
   completa. Los nombres de medios personalizados se conservan.

## Verificación

- `bun run check`: formato, TypeScript, ESLint y **81/81 pruebas Vitest**.
- `bun run build`: aprobado. Se mantienen avisos de Vite sobre imports i18n
  estáticos/dinámicos y tiempos de plugins.
- OpenSpec: **11/11 frontend y 14/14 backend**.
- `graphify update .`: aprobado, grafo frontend de **2.415 nodos**.
- Playwright Chromium visible: **44 escenarios únicos verificados**. La ejecución completa terminó con 42 aprobados, una expectativa heredada del editor Desktop fallida y el escenario siguiente omitido por serialización. Tras adaptar esa expectativa al preview API se repitieron los dos casos Cluvi: **2/2 aprobados**. No queda ningún escenario sin comprobar.

Las regresiones nuevas cubren no cobrar cancelados, borrador al cancelar/salir/recargar,
envío sin datos de domicilio para recoger, primera tarjeta y tamaño de acciones
móviles y orden de la configuración respecto a iniciar turno. Las unitarias
añaden refetch de canal, aislamiento entre sucursales, respuesta de guardado
atrasada y prioridades de cobro en terminales.

## Evidencia y alcance

El backend y PostgreSQL de QA son reales. Las pruebas de Cluvi utilizan un servidor
HTTP simulado; Evolution local real valida aprovisionamiento/QR. No se vinculó
teléfono ni se enviaron mensajes reales: esta ejecución no acredita entrega o
lectura en un dispositivo.

Informes: [ejecución completa](../playwright-report/usability-fixes/index.html) y [repetición Cluvi aprobada](../playwright-report/usability-fixes-cluvi/index.html). Capturas privadas adicionales
en el backend: `.tools/evolution-local/usability-fixes-20261022/`.

No se cambiaron contratos ni código del backend para estas mejoras; sí se alineó
su planificación con la decisión de eliminar Desktop. No se publicaron recursos,
no se desplegó y no se hicieron commits. Las suites crean y limpian tenants
propios; la revisión visual posterior no creó nuevos pedidos en el piloto.
