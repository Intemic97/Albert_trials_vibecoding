# Workflow Orchestration Service con Prefect

Microservicio independiente para ejecutar workflows en background usando Prefect como orquestador.

## 🎯 Arquitectura Desacoplada

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Frontend   │────────▶│  API Service     │────────▶│ Prefect Worker  │
│  (React)    │         │  (FastAPI)       │         │  (Background)   │
└─────────────┘         └──────────────────┘         └─────────────────┘
      │                         │                             │
      │                         ▼                             ▼
      │                   ┌──────────┐                ┌─────────────┐
      └──────────────────▶│ SQLite   │◀───────────────│  Workflows  │
        (Polling/WS)      │ Database │                │  Execution  │
                          └──────────┘                └─────────────┘
```

### Flujo de Ejecución

1. **Usuario inicia workflow** desde el frontend
2. **Frontend** envía POST a `/api/workflows/execute`
3. **API Service** crea registro de ejecución y devuelve `executionId`
4. **Usuario puede cerrar el navegador** ☕ - el workflow sigue ejecutándose
5. **Prefect Worker** ejecuta el workflow en background
6. **Frontend puede hacer polling** a `/api/executions/{id}` para ver progreso

## 🚀 Instalación

### 1. Crear entorno virtual (si no existe)

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

Crea un archivo `.env`:

```env
# API Configuration
API_PORT=8000
API_HOST=0.0.0.0

# Database
DATABASE_PATH=../database.sqlite

# External Services
OPENAI_API_KEY=your_openai_key_here
```

## 🏃 Ejecutar el Servicio

### Opción 1: Script de inicio (Recomendado)

```bash
# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh
```

### Opción 2: Manual

```bash
# Activar entorno virtual
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate.bat  # Windows

# Iniciar servicio
python start_service.py
```

El servicio estará disponible en `http://localhost:8000`

## 📡 API Endpoints

### Ejecutar Workflow

```bash
POST /api/workflows/execute
Content-Type: application/json

{
  "workflowId": "abc123",
  "inputs": {
    "node_id_1": "value1",
    "node_id_2": "value2"
  },
  "organizationId": "org123"
}

Response:
{
  "success": true,
  "executionId": "exec789",
  "status": "pending",
  "message": "Workflow execution started in background"
}
```

### Obtener Estado de Ejecución

```bash
GET /api/executions/{executionId}

Response:
{
  "executionId": "exec789",
  "status": "running",
  "progress": {
    "totalNodes": 10,
    "completedNodes": 5,
    "percentage": 50
  },
  "currentNodeId": "node_5",
  "logs": [...]
}
```

### Obtener Logs Detallados

```bash
GET /api/executions/{executionId}/logs

Response:
{
  "executionId": "exec789",
  "logs": [
    {
      "nodeId": "node1",
      "nodeType": "http",
      "status": "completed",
      "duration": 150,
      "timestamp": "2026-01-12T10:30:00Z"
    },
    ...
  ]
}
```

## 🔧 Integración con Frontend

### Ejecutar workflow desde React

```typescript
// Ejecutar workflow
const response = await fetch('http://localhost:8000/api/workflows/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: workflow.id,
    inputs: formData,
    organizationId: currentOrg.id
  })
});

const { executionId } = await response.json();

// Usuario puede cerrar el navegador aquí ✅
// El workflow seguirá ejecutándose

// Polling para ver progreso
const interval = setInterval(async () => {
  const status = await fetch(`http://localhost:8000/api/executions/${executionId}`);
  const data = await status.json();
  
  console.log(`Progress: ${data.progress.percentage}%`);
  
  if (data.status === 'completed' || data.status === 'failed') {
    clearInterval(interval);
  }
}, 5000); // Check every 5 seconds
```

## 🎨 Tipos de Nodos Soportados

- ✅ `trigger` - Inicio de workflow
- ✅ `manualInput` - Entrada manual de datos
- ✅ `output` - Salida final
- ✅ `http` - Peticiones HTTP
- ✅ `llm` - Llamadas a OpenAI/LLMs
- ✅ `condition` - Lógica condicional
- ✅ `addField` - Transformación de datos
- ✅ `join` - Unión de datos
- ✅ `webhook` - Recepción de webhooks
- ✅ `comment` - Comentarios (sin acción)

## 🔌 Añadir Nuevos Tipos de Nodos

1. Crear handler en `tasks/node_handlers.py`:

```python
@task(name="my_custom_node")
async def handle_custom_node(node: Dict, input_data: Optional[Dict]) -> Dict:
    config = node.get("config", {})
    
    # Tu lógica aquí
    result = do_something(config, input_data)
    
    return {
        "success": True,
        "message": "Custom node executed",
        "outputData": result
    }
```

2. Registrar en `NODE_HANDLERS`:

```python
NODE_HANDLERS = {
    ...
    "customNode": handle_custom_node,
}
```

## 🏗️ Estructura del Proyecto

```
prefect-worker/
├── api_service.py       # FastAPI service - recibe solicitudes
├── start_service.py     # Script de inicio
├── config.py            # Configuración
├── database.py          # Utilidades de base de datos
├── requirements.txt     # Dependencias Python
├── flows/
│   ├── __init__.py
│   └── workflow_flow.py # Flow principal de Prefect
├── tasks/
│   ├── __init__.py
│   └── node_handlers.py # Handlers para cada tipo de nodo
└── venv/                # Entorno virtual
```

## 🎯 Ventajas de Esta Arquitectura

### 1. ✅ Zero Dependencia del Frontend
- Usuario puede cerrar el navegador
- Workflow sigue ejecutándose
- Ver resultados al volver

### 2. 📈 Escalabilidad
- Escalar frontend y workers independientemente
- Múltiples workers en paralelo
- Procesamiento distribuido

### 3. 🛡️ Resiliencia
- Si frontend crashea → workflows continúan
- Reintentos automáticos (configurables en Prefect)
- Logs persistentes

### 4. ⏱️ Workflows de Larga Duración
- Workflows pueden correr horas o días
- Sin timeouts del navegador
- Ejecución persistente

## 🐛 Debugging

### Ver logs del servicio

```bash
# Los logs aparecen en la consola donde se ejecuta start_service.py
```

### Verificar estado de ejecución

```bash
# En base de datos
sqlite3 ../database.sqlite
SELECT * FROM workflow_executions WHERE id = 'exec_id';
SELECT * FROM execution_logs WHERE executionId = 'exec_id';
```

## 📊 Monitoreo

### Health Check

```bash
GET /
```

### Verificar ejecuciones de un workflow

```bash
GET /api/workflows/{workflowId}/executions
```

## 🔄 Actualizar el Servicio

```bash
# Detener el servicio (Ctrl+C)
# Actualizar código
git pull

# Reinstalar dependencias si es necesario
pip install -r requirements.txt

# Reiniciar
python start_service.py
```

## 📝 Notas

- El servicio usa SQLite del proyecto principal
- No requiere Prefect Cloud (ejecuta localmente)
- Compatible con Windows, Linux y Mac
- Puerto por defecto: 8000 (configurable)

## 🚀 Próximos Pasos

1. **Arrancar el servicio**: `start.bat` o `./start.sh`
2. **Actualizar frontend** para usar el nuevo endpoint
3. **Probar ejecución**: Crear workflow y ejecutarlo
4. **Cerrar navegador**: Ver que sigue ejecutándose
5. **Volver y ver resultados**: Polling muestra progreso

¡Disfruta de workflows que corren en background! ☕🚀

