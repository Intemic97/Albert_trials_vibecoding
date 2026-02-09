# Implementación Ops Data Platform

## Arquitectura Propuesta

Basado en el diagrama de arquitectura industrial, esta es la estrategia de implementación:

### 1. **Conexiones OT/Industrial** (Connections)

#### Nuevas conexiones a añadir:
- **SCADA** (Supervisory Control and Data Acquisition)
- **DCS** (Distributed Control Systems)
- **MES** (Manufacturing Execution System)
- **LIMS** (Laboratory Information Management System)
- **Data Historian** (Time-series database)
- **PLC** (Programmable Logic Controller) - OPC UA protocol
- **IoT Gateway** (MQTT/OPC UA)
- **OPC UA Server** (Protocolo estándar industrial)

#### Implementación:
```typescript
// Añadir a Connections.tsx
{
    id: 'scada',
    name: 'SCADA',
    type: 'OT System',
    category: 'ot',
    description: 'Connect to SCADA systems via OPC UA or Modbus',
    config: {
        protocol: 'OPC UA' | 'Modbus',
        endpoint: string,
        credentials: {...}
    }
}
```

### 2. **Workflows de Ingesta Continua**

#### Templates de Workflows:

**A. Ingesta desde Shopfloor (IoT/PLC)**
```
[Schedule Trigger] → [OPC UA Input] → [Data Transform] → [Time-Series Storage] → [Entity Update]
```

**B. Ingesta desde OT Systems**
```
[Schedule Trigger] → [SCADA/MES Connection] → [Data Validation] → [Normalize] → [Entity Update]
```

**C. Ingesta desde ERP (SAP)**
```
[Schedule Trigger] → [SAP RFC/API] → [Transform] → [Entity Update]
```

**D. Data Historian Sync**
```
[Schedule Trigger] → [Data Historian Query] → [Batch Process] → [Entity Update]
```

### 3. **Nuevos Tipos de Nodos para Workflows**

#### Nodos OT/Industrial:
- **OPC UA Input Node** - Conecta a servidores OPC UA
- **Modbus Input Node** - Lee datos Modbus
- **MQTT Subscriber** - Suscribe a topics MQTT
- **Data Historian Query** - Consulta time-series data
- **Time-Series Aggregator** - Agrega datos temporales (avg, min, max por intervalo)
- **Data Validator** - Valida calidad de datos industriales
- **Anomaly Detector** - Detecta anomalías en streams
- **PLC Reader** - Lee directamente de PLCs

#### Nodos de Transformación:
- **Normalize Units** - Normaliza unidades (ºC → ºF, bar → psi)
- **Calculate KPIs** - Calcula KPIs industriales (OEE, MTBF, etc.)
- **Data Enrichment** - Enriquece con datos de referencia
- **Data Quality Check** - Verifica calidad (rangos válidos, outliers)

### 4. **Time-Series Data Storage**

#### Nueva Entity Type: `timeseries`
```typescript
interface TimeSeriesEntity extends Entity {
    type: 'timeseries';
    properties: {
        timestamp: Property; // Siempre presente
        value: Property;
        quality?: Property; // Good/Bad/Uncertain
        source?: Property; // Origen del dato
    };
    config: {
        retention: number; // Días de retención
        aggregation: 'raw' | '1min' | '5min' | '1hour' | '1day';
    };
}
```

#### Nuevo endpoint:
```
POST /api/entities/:id/timeseries
Body: { timestamp: string, value: number, quality?: string }
```

### 5. **Scheduling Mejorado**

#### Tipos de triggers:
- **Continuous** - Polling cada X segundos/minutos
- **Event-driven** - Webhooks desde sistemas OT
- **Time-based** - Cron expressions
- **Conditional** - Basado en valores de datos

### 6. **Data Quality & Monitoring**

#### Features:
- **Data Quality Dashboard** - Monitorea calidad de datos
- **Missing Data Alerts** - Alerta cuando falta data
- **Anomaly Detection** - Detecta valores fuera de rango
- **Data Lineage** - Trazabilidad de datos (de dónde viene cada dato)

### 7. **Visualizaciones Industriales**

#### Nuevos tipos de gráficos:
- **Trend Charts** - Time-series con múltiples series
- **Process Flow** - Diagramas de flujo de proceso
- **Alarm Timeline** - Timeline de alarmas/eventos
- **Heat Maps** - Mapas de calor por área/equipo
- **Gauge Clusters** - Múltiples gauges agrupados

## Plan de Implementación por Fases

### Fase 1: Fundación (Sprint 1-2)
1. ✅ Añadir conexiones OT a Connections
2. ✅ Crear nodos básicos: OPC UA Input, MQTT Subscriber
3. ✅ Implementar time-series storage básico
4. ✅ Mejorar scheduling para polling continuo

### Fase 2: Ingesta (Sprint 3-4)
1. ✅ Templates de workflows para ingesta
2. ✅ Nodos de transformación industrial
3. ✅ Data validation y quality checks
4. ✅ Error handling y retry logic

### Fase 3: Procesamiento (Sprint 5-6)
1. ✅ Time-series aggregation
2. ✅ KPI calculation nodes
3. ✅ Anomaly detection
4. ✅ Data enrichment

### Fase 4: Visualización (Sprint 7-8)
1. ✅ Gráficos industriales específicos
2. ✅ Dashboards operacionales
3. ✅ Alarm management
4. ✅ Data lineage visualization

## Estructura de Datos Propuesta

### Time-Series Entity Example:
```json
{
    "id": "entity-temp-sensor-001",
    "name": "Temperature Sensor - Line 1",
    "type": "timeseries",
    "properties": [
        { "id": "prop-timestamp", "name": "timestamp", "type": "datetime" },
        { "id": "prop-value", "name": "temperature", "type": "number" },
        { "id": "prop-quality", "name": "quality", "type": "text" },
        { "id": "prop-source", "name": "source", "type": "text" }
    ],
    "config": {
        "retention": 90,
        "aggregation": "1min"
    }
}
```

### Workflow Template: Continuous Data Ingestion
```json
{
    "name": "SCADA Data Ingestion - Line 1",
    "nodes": [
        {
            "type": "schedule",
            "config": { "interval": "1min" }
        },
        {
            "type": "opcua-input",
            "config": {
                "connectionId": "scada-connection-1",
                "nodeIds": ["ns=2;s=Temperature", "ns=2;s=Pressure"]
            }
        },
        {
            "type": "data-validator",
            "config": {
                "rules": [
                    { "field": "temperature", "min": -50, "max": 200 },
                    { "field": "pressure", "min": 0, "max": 10 }
                ]
            }
        },
        {
            "type": "entity-update",
            "config": {
                "entityId": "entity-temp-sensor-001",
                "mode": "append" // Para time-series
            }
        }
    ]
}
```

## Consideraciones Técnicas

### Protocolos Industriales:
- **OPC UA** - Estándar moderno, seguro
- **Modbus TCP/RTU** - Ampliamente usado
- **MQTT** - Para IoT
- **REST APIs** - Para sistemas modernos (MES, LIMS)

### Performance:
- **Batch Processing** - Agrupar múltiples lecturas
- **Async Processing** - No bloquear UI durante ingesta
- **Caching** - Cachear conexiones y queries frecuentes
- **Compression** - Comprimir datos históricos

### Seguridad:
- **Credential Management** - Almacenar credenciales de forma segura
- **Network Isolation** - Soporte para redes OT aisladas
- **Audit Logging** - Log de todas las operaciones

## Próximos Pasos

1. **Añadir conexiones OT** a Connections.tsx
2. **Crear nodos OPC UA y MQTT** en workflows
3. **Implementar time-series storage** en backend
4. **Crear templates de workflows** para casos comunes
5. **Añadir visualizaciones industriales** específicas
