## Purpose

Ofrecer seguimiento visual de entregas para operadores y clientes, con control explícito del GPS y estados honestos de conexión, frescura y ruta.

## ADDED Requirements

### Requirement: Captura GPS voluntaria

La interfaz SHALL pedir permiso de geolocalización solo al pulsar Compartir ubicación. SHALL permitir pausar, mostrar permiso denegado, falta de HTTPS, red y última publicación; cerrar sesión o perder el turno detiene el observador local.

#### Scenario: Permiso denegado

- **WHEN** el usuario deniega el permiso del navegador
- **THEN** no se anuncia ubicación compartida y se ofrece recuperación sin bloquear entregas

### Requirement: Mapa interno estable

La interfaz SHALL mostrar por sucursal la ubicación y frescura del domiciliario, rumbo si existe y recorrido reciente. Actualizar coordenadas SHALL conservar el zoom y encuadre salvo seguimiento activado por el operador.

#### Scenario: Nueva muestra con mapa desplazado

- **WHEN** llega una muestra y el operador desplazó el mapa
- **THEN** el marcador se actualiza sin restablecer el mapa y el operador puede volver a centrarlo

### Requirement: Página pública de entrega

La página pública SHALL funcionar sin login mediante el token del enlace y mostrar solo el pedido autorizado. SHALL retirar ubicación y ETA al finalizar, vencer la muestra o invalidarse el enlace. SHALL evitar guardar el token en almacenamiento persistente o enviarlo al proveedor de teselas.

#### Scenario: Revocación durante una consulta activa

- **WHEN** el operador revoca el enlace y la página recibe el cambio o vuelve a consultar
- **THEN** muestra enlace no disponible y retira los datos de ubicación anteriores

### Requirement: Rutas y recuperación honestas

La interfaz SHALL distinguir ruta estimada de ubicación real y datos antiguos. Si no existe ruta, red o mapa base SHALL mostrar el estado disponible sin presentar ETA inventada. La reconexión SHALL refrescar datos y las consultas periódicas respaldan los avisos en vivo.

#### Scenario: Mapa base no disponible

- **WHEN** fallan las teselas
- **THEN** muestra un aviso y conserva los datos textuales de estado y última actualización

### Requirement: Compartir enlace controlado

El operador SHALL poder crear/copiar, renovar y revocar el enlace por pedido y previsualizar su envío por Evolution. Renovar o revocar SHALL ser acciones explícitas y recuperables ante error.

#### Scenario: Renovación confirmada

- **WHEN** el operador confirma renovar un enlace
- **THEN** obtiene un enlace nuevo y el anterior deja de permitir seguimiento
