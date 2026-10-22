## ADDED Requirements

### Requirement: Configuración de canal WhatsApp por sucursal

La configuración de sucursal SHALL permitir consultar el estado del canal WhatsApp Evolution API, guardar eventos automáticos y plantillas, iniciar la conexión por código QR con expiración visible y desconectar la sesión.

#### Scenario: Conectar canal WhatsApp y consultar QR

- **WHEN** el administrador solicita conectar el canal WhatsApp de la sucursal
- **THEN** el servicio envía `POST /api/branches/{branchId}/whatsapp/connect` con `Idempotency-Key` y consulta `GET /api/branches/{branchId}/whatsapp/qr` para mostrar el QR vigente.

### Requirement: Protección de configuración sin guardar

La configuración WhatsApp SHALL advertir sobre ediciones pendientes, permitir descartarlas y recuperar el borrador al volver, aislado por usuario, tenant y sucursal. Una actualización del estado del canal SHALL conservar la edición.

#### Scenario: Navegar con plantilla editada

- **WHEN** se edita una plantilla sin guardar y se navega a otra pantalla
- **THEN** se advierte al usuario y, si decide salir, se recupera el borrador al volver.

#### Scenario: Priorizar tareas de turno

- **WHEN** el usuario abre Turnos y Cluvi
- **THEN** iniciar turno aparece antes que el panel de configuración WhatsApp.
