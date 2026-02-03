# Documentación de Nodos OT/Industrial

Esta documentación describe los nodos de workflow diseñados para sistemas OT (Operational Technology) e industriales.

## Nodos Disponibles

### 1. OPC UA Input
**Tipo:** `opcua`

Conecta con servidores OPC UA para leer datos de PLCs, sensores y equipos industriales.

**Configuración:**
- **Connection ID**: ID de la conexión OPC UA configurada
- **Node IDs**: Lista de Node IDs OPC UA a leer (ej: `ns=2;s=Temperature`)
- **Polling Interval**: Intervalo de polling en milisegundos (mínimo 100ms)

**Ejemplo de uso:**
```
OPC UA Input → Time-Series Aggregator → Save Records
```

**Output:**
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "values": {
    "ns=2;s=Temperature": 25.5,
    "ns=2;s=Pressure": 1013.2
  },
  "raw": [
    {
      "nodeId": "ns=2;s=Temperature",
      "value": 25.5,
      "timestamp": "2026-01-31T10:00:00Z",
      "quality": "Good"
    }
  ]
}
```

---

### 2. MQTT Subscriber
**Tipo:** `mqtt`

Se suscribe a topics MQTT para recibir datos de sensores IoT en tiempo real.

**Configuración:**
- **Connection ID**: ID de la conexión MQTT configurada
- **Topics**: Lista de topics a suscribirse (soporta wildcards: `#` multi-level, `+` single-level)
- **QoS Level**: Nivel de calidad de servicio (0, 1, o 2)

**Ejemplo de uso:**
```
MQTT Subscriber → Condition (check threshold) → Send Alert
```

**Output:**
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "messages": [
    {
      "topic": "sensors/temperature/room1",
      "payload": "{\"value\": 22.5, \"timestamp\": \"2026-01-31T10:00:00Z\"}",
      "qos": 1,
      "timestamp": "2026-01-31T10:00:00Z"
    }
  ],
  "topicData": {
    "sensors/temperature/room1": 22.5
  }
}
```

---

### 3. Modbus Input
**Tipo:** `modbus`

Lee datos de dispositivos Modbus (PLCs, sensores) usando el protocolo Modbus.

**Configuración:**
- **Connection ID**: ID de la conexión Modbus configurada
- **Function Code**: Código de función Modbus (1-6)
  - 1: Read Coils
  - 2: Read Discrete Inputs
  - 3: Read Holding Registers (más común)
  - 4: Read Input Registers
  - 5: Write Single Coil
  - 6: Write Single Register
- **Addresses**: Lista de direcciones de registro a leer (ej: `40001`)

**Ejemplo de uso:**
```
Modbus Input → Add Field (convert units) → Save Records
```

**Output:**
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "registers": {
    "40001": 1234,
    "40002": 5678
  },
  "raw": [
    {
      "address": "40001",
      "value": 1234,
      "functionCode": 3,
      "timestamp": "2026-01-31T10:00:00Z"
    }
  ]
}
```

---

### 4. SCADA Data
**Tipo:** `scada`

Obtiene datos de sistemas SCADA (Supervisory Control and Data Acquisition).

**Configuración:**
- **Connection ID**: ID de la conexión SCADA configurada
- **Tags**: Lista de tags SCADA a leer (ej: `Tank01.Level`)
- **Polling Interval**: Intervalo de polling en milisegundos

**Ejemplo de uso:**
```
SCADA Data → Condition (quality check) → Send Alert
```

**Output:**
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "tags": {
    "Tank01.Level": 75.5,
    "Tank01.Temperature": 22.3
  },
  "raw": [
    {
      "tag": "Tank01.Level",
      "value": 75.5,
      "timestamp": "2026-01-31T10:00:00Z",
      "quality": "Good"
    }
  ]
}
```

---

### 5. MES Data
**Tipo:** `mes`

Obtiene datos de producción desde sistemas MES (Manufacturing Execution System).

**Configuración:**
- **Connection ID**: ID de la conexión MES configurada
- **Endpoint**: Endpoint de la API MES (ej: `/api/production/orders`)
- **Query**: Parámetros de consulta opcionales (ej: `status=active&date=today`)

**Ejemplo de uso:**
```
MES Data → Time-Series Aggregator → Data Visualization
```

**Output:**
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "productionOrder": "PO-1738320000",
  "quantity": 500,
  "status": "In Progress",
  "startTime": "2026-01-31T10:00:00Z",
  "equipment": "Line-01",
  "operator": "Operator-123",
  "query": "production-status"
}
```

---

### 6. Data Historian Query
**Tipo:** `dataHistorian`

Consulta datos históricos de time-series desde sistemas Data Historian (OSIsoft PI, Wonderware, InfluxDB, etc.).

**Configuración:**
- **Connection ID**: ID de la conexión Data Historian configurada
- **Tags**: Lista de tags a consultar
- **Start Time**: Fecha/hora de inicio de la consulta
- **End Time**: Fecha/hora de fin de la consulta
- **Aggregation**: Tipo de agregación (raw, avg, min, max, sum)

**Ejemplo de uso:**
```
Data Historian Query → Statistical Analysis → Output
```

**Output:**
```json
{
  "startTime": "2026-01-30T10:00:00Z",
  "endTime": "2026-01-31T10:00:00Z",
  "aggregation": "avg",
  "dataPoints": [
    {
      "tag": "Tank01.Level",
      "timestamp": "2026-01-30T10:00:00Z",
      "value": 75.2
    }
  ],
  "tags": {
    "Tank01.Level": [
      {
        "timestamp": "2026-01-30T10:00:00Z",
        "value": 75.2
      }
    ]
  }
}
```

---

### 7. Time-Series Aggregator
**Tipo:** `timeSeriesAggregator`

Agrega datos de time-series dentro de intervalos de tiempo especificados.

**Configuración:**
- **Aggregation Type**: Tipo de agregación (avg, min, max, sum, count)
- **Interval**: Intervalo de tiempo (formato: `5m`, `1h`, `30s`, `1d`)
- **Fields**: Campos opcionales a agregar (dejar vacío para todos los campos numéricos)

**Ejemplo de uso:**
```
OPC UA Input → Time-Series Aggregator (5m avg) → Save Records
```

**Output:**
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "interval": "5m",
  "temperature": 23.5,
  "pressure": 1012.8,
  "count": 300
}
```

---

## Templates de Workflows Disponibles

### 1. Ingesta Continua desde Shopfloor
Captura continua de datos desde PLCs y sensores industriales y almacenamiento en time-series.

**Nodos:**
- Schedule Trigger → OPC UA Input → Time-Series Aggregator → Save Records

### 2. Ingesta de Sensores IoT via MQTT
Suscripción a topics MQTT para capturar datos de sensores IoT.

**Nodos:**
- Manual Trigger → MQTT Subscriber → Save Records

### 3. Monitoreo de Calidad en Tiempo Real
Lectura de datos desde SCADA/MES, análisis de calidad y generación de alertas.

**Nodos:**
- Schedule Trigger → SCADA Data → Condition → Send Alert / Log Quality Data

### 4. Análisis de Producción desde MES
Extracción de datos de producción, agregación por turno/lote y generación de reportes.

**Nodos:**
- Schedule Trigger → MES Data → Time-Series Aggregator → Data Visualization → Save Analytics

### 5. Análisis Histórico desde Data Historian
Consulta de datos históricos, análisis estadístico y comparación con lotes de referencia.

**Nodos:**
- Manual Trigger → Data Historian Query → Statistical Analysis → Output

---

## Configuración de Conexiones

Antes de usar los nodos OT, es necesario configurar las conexiones en la página **Connections**:

1. **OPC UA**: Configurar servidor URL, Security Policy, Username, Password
2. **MQTT**: Configurar Broker URL, Port, Username, Password
3. **Modbus**: Configurar Protocol (TCP/RTU), Host/Serial Port, Port/Baud Rate
4. **SCADA**: Configurar Connection Type, Server Endpoint, Credentials
5. **MES**: Configurar API Endpoint, API Key/Token, MES System Type
6. **Data Historian**: Configurar Historian Type, Server URL, Credentials

---

## Mejores Prácticas

1. **Polling Intervals**: Usar intervalos apropiados según la criticidad de los datos
   - Datos críticos: 100ms - 1s
   - Datos normales: 5s - 1min
   - Datos históricos: 1min - 1h

2. **Agregación**: Usar Time-Series Aggregator para reducir volumen de datos antes de almacenar

3. **Error Handling**: Los nodos incluyen manejo de errores automático, pero es recomendable añadir nodos Condition para validar datos

4. **Time-Series Storage**: Los datos industriales se almacenan mejor como time-series. Considerar crear entidades con propiedades de tipo timestamp y valores numéricos.

5. **MQTT QoS**: 
   - QoS 0: Para datos no críticos que se pueden perder
   - QoS 1: Para datos importantes (recomendado)
   - QoS 2: Para datos críticos que no pueden duplicarse

---

## Implementación Backend

Los handlers están implementados tanto en Node.js (`server/workflowExecutor.js`) como en Python/Prefect (`server/prefect-worker/tasks/node_handlers.py`).

**Estado actual:** Los handlers generan datos simulados para pruebas. Para producción, se requiere:

- **OPC UA**: Integrar librería `node-opcua` (Node.js) o `asyncua` (Python)
- **MQTT**: Integrar librería `mqtt` (Node.js) o `aiomqtt` (Python)
- **Modbus**: Integrar librería `modbus-serial` (Node.js) o `pymodbus` (Python)
- **SCADA/MES/Data Historian**: Implementar clientes específicos según el sistema

---

## Troubleshooting

### Error: "No connection available"
- Verificar que la conexión esté configurada en la página Connections
- Verificar que el tipo de conexión coincida con el tipo de nodo

### Error: "Connection timeout"
- Verificar conectividad de red
- Verificar credenciales y configuración de la conexión
- Verificar que el servidor/dispositivo esté accesible

### Datos no se están guardando
- Verificar que el nodo Save Records esté correctamente conectado
- Verificar que la entidad de destino tenga las propiedades correctas
- Revisar los logs de ejecución del workflow

---

## Roadmap

- [ ] Integración real con librerías OPC UA, MQTT, Modbus
- [ ] Soporte nativo de time-series storage
- [ ] Visualizaciones específicas para datos industriales
- [ ] Alertas y notificaciones en tiempo real
- [ ] Dashboard de monitoreo industrial
- [ ] Análisis predictivo con ML
