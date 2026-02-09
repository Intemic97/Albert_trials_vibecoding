# Implementación de Conexiones OT Reales

## Resumen

Se han implementado conexiones reales para protocolos industriales OT (Operational Technology) usando librerías nativas de Node.js. Esto reemplaza las simulaciones anteriores con conexiones funcionales a dispositivos industriales reales.

## Librerías Añadidas

Se han añadido las siguientes dependencias al `server/package.json`:

- **`node-opcua`** (^2.115.0) - Cliente OPC UA para conectar con servidores OPC UA
- **`mqtt`** (^5.10.1) - Cliente MQTT para suscripciones a brokers MQTT
- **`modbus-serial`** (^8.0.19) - Cliente Modbus para leer registros de dispositivos Modbus

## Arquitectura

### Módulo OT Connections Manager (`server/utils/otConnections.js`)

Se ha creado un gestor centralizado de conexiones OT que:

- **Cachea conexiones**: Reutiliza conexiones existentes para mejorar rendimiento
- **Maneja reconexiones**: Detecta conexiones perdidas y las recrea automáticamente
- **Timeouts configurables**: Todas las operaciones tienen timeouts para evitar bloqueos
- **Manejo de errores robusto**: Captura y reporta errores de forma descriptiva

### Funcionalidades Implementadas

#### OPC UA
- Conexión a servidores OPC UA con autenticación opcional
- Lectura de múltiples nodos en una sola operación
- Soporte para diferentes modos de seguridad y políticas
- Cacheo de clientes y sesiones

#### MQTT
- Conexión a brokers MQTT (TCP/TLS)
- Suscripción a múltiples topics simultáneamente
- Recolección de mensajes con timeout configurable
- Soporte para QoS levels (0, 1, 2)
- Reconexión automática

#### Modbus
- Conexión TCP/IP y RTU (serial)
- Lectura de registros (Holding, Input)
- Lectura de coils y discrete inputs
- Soporte para diferentes function codes
- Manejo de errores por registro individual

## Integración con Workflow Executor

Los handlers en `workflowExecutor.js` ahora:

1. **Obtienen configuración real** desde la base de datos usando `getConnection()`
2. **Usan conexiones reales** a través del `OTConnectionsManager`
3. **Fallback a simulación** si la conexión real falla (para desarrollo/testing)
4. **Reportan errores** con información detallada en los metadatos

### Handlers Actualizados

- `handleOpcua()` - Lee nodos OPC UA reales
- `handleMqtt()` - Suscribe a topics MQTT reales
- `handleModbus()` - Lee registros Modbus reales

## Tests de Conexión

El endpoint `/api/data-connections/:id/test` ahora:

- **OPC UA**: Crea una sesión real y la cierra para verificar conectividad
- **MQTT**: Conecta al broker y verifica la conexión
- **Modbus**: Conecta y lee un registro de prueba

Todos los tests tienen timeouts de 10 segundos por defecto.

## Configuración de Conexiones

### OPC UA
```json
{
  "endpoint": "opc.tcp://server:4840",
  "securityMode": "None",
  "securityPolicy": "None",
  "username": "optional",
  "password": "optional"
}
```

### MQTT
```json
{
  "broker": "mqtt.example.com",
  "port": 1883,
  "protocol": "mqtt",
  "username": "optional",
  "password": "optional",
  "clientId": "optional"
}
```

### Modbus
```json
{
  "host": "192.168.1.100",
  "port": 502,
  "type": "TCP",
  "unitId": 1
}
```

Para RTU:
```json
{
  "type": "RTU",
  "serialPort": "/dev/ttyUSB0",
  "baudRate": 9600,
  "unitId": 1
}
```

## Manejo de Errores

### Timeouts
- OPC UA: 10 segundos por defecto (configurable)
- MQTT: 5 segundos para recolección de mensajes (configurable)
- Modbus: 10 segundos por defecto (configurable)

### Fallback a Simulación
Si una conexión real falla, el sistema automáticamente:
1. Registra el error en los metadatos
2. Genera datos simulados para continuar el workflow
3. Marca `simulated: true` en los metadatos para indicar que son datos de prueba

## Próximos Pasos

1. **Implementar escritura**: Añadir capacidad de escribir valores a dispositivos OT
2. **Monitoreo de conexiones**: Health checks periódicos para detectar desconexiones
3. **Métricas**: Tracking de latencia, tasa de éxito, etc.
4. **Pool de conexiones**: Gestión más avanzada de múltiples conexiones simultáneas
5. **Compresión de datos**: Para reducir ancho de banda en conexiones lentas

## Notas de Instalación

Después de añadir las dependencias, ejecutar:

```bash
cd server
npm install
```

Las librerías pueden requerir compilación nativa, especialmente `node-opcua` y `modbus-serial`, por lo que se necesitan herramientas de build de Node.js instaladas.

## Troubleshooting

### Error: "Failed to connect to OPC UA server"
- Verificar que el endpoint sea accesible desde el servidor
- Comprobar firewall y configuración de red
- Verificar credenciales si se requiere autenticación

### Error: "MQTT connection timeout"
- Verificar que el broker esté accesible
- Comprobar puerto y protocolo (mqtt/mqtts)
- Verificar credenciales si se requiere autenticación

### Error: "Modbus read timeout"
- Verificar que el dispositivo Modbus esté en la red
- Comprobar dirección IP y puerto (502 por defecto)
- Verificar que el unitId sea correcto
