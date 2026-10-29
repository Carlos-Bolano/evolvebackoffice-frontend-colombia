## Purpose

Reducir repetición y pérdidas durante la captura, y permitir comprender el estado operativo de cada pedido.

## ADDED Requirements

### Requirement: Cliente por teléfono

El formulario SHALL buscar coincidencias activas por teléfono y permitir seleccionar para completar datos o seguir como ocasional.

#### Scenario: Elegir cliente

- **WHEN** se selecciona una coincidencia
- **THEN** se completan nombre/dirección editables y se vincula su ID público.

### Requirement: Productos accesibles

El formulario SHALL buscar en servidor y ofrecer favoritos y recientes aislados por usuario, tenant y sucursal con precios actuales.

#### Scenario: Buscar código

- **WHEN** se busca un SKU fuera de la primera página
- **THEN** se puede agregar el producto sin descargar todo el catálogo.

### Requirement: Borrador recuperable

El formulario SHALL conservar el borrador durante la sesión, recuperarlo al reabrir y borrarlo al crear con éxito o descartarlo explícitamente.

#### Scenario: Cierre accidental

- **WHEN** se cierra y reabre un pedido sin guardar
- **THEN** se recuperan sus productos, cantidades y cliente y se informa de la recuperación.

### Requirement: Conexión visible

Las vistas SHALL mostrar última respuesta, reconexión y desconexión y refrescar datos tras recuperar conexión.

#### Scenario: API sin respuesta

- **WHEN** falla el seguimiento
- **THEN** se muestra reconexión y se conserva la fecha de la última respuesta válida.

### Requirement: Cronología unificada

El detalle SHALL mostrar eventos ordenados de estado, responsable conocido, pagos, incidencias y WhatsApp con carga y error recuperable.

#### Scenario: Ver historial

- **WHEN** se abre el detalle
- **THEN** aparece cronología del pedido con fecha y fuente sin inventar actores.

### Requirement: Vistas persistentes

Órdenes SHALL conservar filtros y presentación por usuario/tenant y permitir vistas rápidas, guardar, aplicar y eliminar vistas.

#### Scenario: Volver a órdenes

- **WHEN** se navega fuera y se vuelve
- **THEN** se restaura la configuración seleccionada sin mezclar usuarios.

#### Scenario: Elegir domiciliario desde una vista sin asignar

- **WHEN** se elige un domiciliario después de activar Listos sin asignar
- **THEN** el filtro elegido prevalece y la vista rápida incompatible deja de aparecer activa.

#### Scenario: Cambiar sucursal

- **WHEN** se cambia de sucursal con un domiciliario seleccionado
- **THEN** se quita ese filtro y se muestran los pedidos de la sucursal nueva, conservando cada borrador en su sede.

#### Scenario: Recuperar un filtro no disponible

- **WHEN** una vista guardada contiene un domiciliario ausente de la lista actual
- **THEN** el filtro sigue visible e identificado como guardado y se ofrece quitarlo explícitamente, incluso en móvil.

### Requirement: Asistente Evolution

La configuración SHALL guiar vinculación, verificación, prueba con un pedido y destinatario autorizado, y automatizaciones sin marcar un mensaje en cola como entregado.

#### Scenario: Prueba explícita

- **WHEN** se abre el paso de prueba
- **THEN** se exige pedido, permiso y vista previa antes de confirmar un envío por Evolution API.
