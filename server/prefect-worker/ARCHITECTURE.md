# 🏗️ Arquitectura del Sistema de Workflows con Prefect

## 📐 Vista General

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Workflows   │  │  Databases   │  │  Dashboards  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/workflow/:id/execute
                              │ { inputs: {...} }
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    NODE.JS SERVER (Express)                         │
│                         Port: 3001                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Workflow Execution Endpoint                                  │  │
│  │                                                              │  │
│  │ 1. Recibe solicitud del frontend                            │  │
│  │ 2. Intenta delegar a Prefect Service                        │  │
│  │ 3. Si Prefect no disponible → ejecuta localmente            │  │
│  │ 4. Retorna executionId inmediatamente                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Request
                              │ POST /api/workflows/execute
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                 PREFECT SERVICE (FastAPI + Python)                  │
│                         Port: 8000                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ API Service (api_service.py)                                 │  │
│  │                                                              │  │
│  │ 1. Crea registro de ejecución en DB                         │  │
│  │ 2. Programa ejecución con BackgroundTasks                   │  │
│  │ 3. Retorna inmediatamente (usuario puede cerrar navegador)  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              │ background_tasks.add_task()          │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Prefect Flow (flows/workflow_flow.py)                       │  │
│  │                                                              │  │
│  │ 1. Carga workflow de DB                                     │  │
│  │ 2. Encuentra nodos iniciales                                │  │
│  │ 3. Ejecuta nodos recursivamente                             │  │
│  │ 4. Maneja branching condicional                             │  │
│  │ 5. Actualiza estado en cada paso                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              │ Ejecuta tasks                        │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Prefect Tasks (tasks/node_handlers.py)                      │  │
│  │                                                              │  │
│  │ • handle_trigger()     - Inicio                             │  │
│  │ • handle_http()        - Peticiones HTTP                    │  │
│  │ • handle_llm()         - OpenAI/GPT                         │  │
│  │ • handle_condition()   - If/Else branching                  │  │
│  │ • handle_join()        - Unión de datos                     │  │
│  │ • ... y más                                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Actualiza estado
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      SQLITE DATABASE                                │
│                                                                     │
│  ┌───────────────────────┐  ┌──────────────────────────────────┐  │
│  │ workflow_executions    │  │ execution_logs                   │  │
│  ├───────────────────────┤  ├──────────────────────────────────┤  │
│  │ • id (executionId)    │  │ • executionId                    │  │
│  │ • workflowId          │  │ • nodeId, nodeType, nodeLabel    │  │
│  │ • status              │  │ • status, duration               │  │
│  │ • currentNodeId       │  │ • inputData, outputData          │  │
│  │ • createdAt           │  │ • timestamp                      │  │
│  │ • startedAt           │  │                                  │  │
│  │ • completedAt         │  │                                  │  │
│  │ • nodeResults         │  │                                  │  │
│  │ • error               │  │                                  │  │
│  └───────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              ↑
                              │ Polling (cada 5s)
                              │ GET /api/workflow/execution/:execId
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
│                                                                     │
│  Usuario ve progreso en tiempo real:                               │
│  • Estado: pending → running → completed/failed                    │
│  • Progreso: 50% (5/10 nodos completados)                          │
│  • Nodo actual: "HTTP Request"                                     │
│  • Logs detallados de cada paso                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Ejecución Detallado

### 1️⃣ Usuario Inicia Workflow

```
Frontend (React)
│
├─ Usuario hace clic en "Run Workflow"
│
├─ Se abre modal con inputs (si el workflow los requiere)
│
├─ POST /api/workflow/:id/execute
│  Body: { inputs: { node_id_1: "value1", ... } }
│
└─ Recibe respuesta inmediata:
   {
     "success": true,
     "executionId": "abc123def456",
     "status": "pending",
     "backgroundExecution": true,
     "usingPrefect": true
   }
```

**💡 Usuario puede cerrar el navegador aquí!**

---

### 2️⃣ Backend Node.js Procesa

```
Node.js Server (index.js)
│
├─ Recibe POST /api/workflow/:id/execute
│
├─ Verifica si Prefect está disponible
│  └─ prefectClient.isAvailable()
│
├─ Si Prefect disponible:
│  │
│  ├─ Delega a Prefect Service
│  │  └─ POST http://localhost:8000/api/workflows/execute
│  │     Body: { workflowId, inputs, organizationId }
│  │
│  └─ Retorna executionId inmediatamente
│
└─ Si Prefect NO disponible:
   │
   ├─ Ejecuta localmente con WorkflowExecutor
   │  └─ (Modo síncrono, bloquea hasta completar)
   │
   └─ Retorna resultado completo
```

---

### 3️⃣ Prefect Service Orquesta

```
Prefect Service (api_service.py)
│
├─ Recibe POST /api/workflows/execute
│
├─ Crea registro en DB:
│  INSERT INTO workflow_executions
│  (id, workflowId, status='pending', inputs, createdAt)
│
├─ Programa ejecución en background:
│  background_tasks.add_task(execute_workflow_background, ...)
│
└─ Retorna inmediatamente:
   {
     "executionId": "abc123",
     "status": "pending"
   }

--------------------------------------------------

Background Task (ejecuta en paralelo)
│
├─ Llama a Prefect Flow:
│  await execute_workflow_flow(
│    workflow_id,
│    execution_id,
│    inputs,
│    organization_id
│  )
│
└─ Flow se ejecuta independientemente...
```

---

### 4️⃣ Prefect Flow Ejecuta

```
Prefect Flow (workflow_flow.py)
│
├─ @flow(name="execute_workflow")
│
├─ 1. Load workflow from DB
│     └─ db.get_workflow(workflow_id)
│
├─ 2. Parse workflow data
│     ├─ nodes = workflow_data["nodes"]
│     └─ connections = workflow_data["connections"]
│
├─ 3. Find starting nodes
│     ├─ Priority 1: trigger node
│     ├─ Priority 2: webhook node
│     └─ Priority 3: root nodes (sin incoming connections)
│
├─ 4. Update status to "running"
│     └─ db.update_execution(execution_id, status="running")
│
├─ 5. Execute nodes recursively
│     │
│     ├─ await execute_node(start_node, input_data)
│     │   │
│     │   ├─ Update DB: currentNodeId = node.id
│     │   │
│     │   ├─ Execute node handler (Prefect Task)
│     │   │  └─ result = await handle_http(node, input_data)
│     │   │
│     │   ├─ Log to DB:
│     │   │  INSERT INTO execution_logs
│     │   │  (executionId, nodeId, status='completed', outputData, ...)
│     │   │
│     │   └─ Get next nodes and execute them
│     │      └─ for next_node in next_nodes:
│     │          await execute_node(next_node, result.outputData)
│     │
│     └─ (Recursión continúa hasta completar todos los nodos)
│
├─ 6. Mark as completed
│     └─ db.update_execution(
│          execution_id,
│          status="completed",
│          completedAt=now,
│          finalOutput=node_results
│        )
│
└─ 7. Return results
      {
        "executionId": "abc123",
        "status": "completed",
        "results": { ... }
      }
```

---

### 5️⃣ Prefect Tasks Ejecutan Nodos

```
Prefect Task (node_handlers.py)
│
├─ @task(name="http_request", retries=2)
│  async def handle_http(node: Dict, input_data: Optional[Dict]):
│
│     ├─ Obtener configuración del nodo
│     │  config = node.get("config", {})
│     │  url = config.get("httpUrl")
│     │  method = config.get("httpMethod", "GET")
│     │
│     ├─ Hacer petición HTTP
│     │  async with httpx.AsyncClient() as client:
│     │    response = await client.request(method, url, json=input_data)
│     │
│     ├─ Procesar respuesta
│     │  data = response.json()
│     │
│     └─ Retornar resultado
│        return {
│          "success": True,
│          "message": "HTTP GET http://api.example.com - Status 200",
│          "outputData": data,
│          "statusCode": 200
│        }
│
└─ (Cada tipo de nodo tiene su propio handler similar)
```

---

### 6️⃣ Frontend Hace Polling

```
Frontend (React)
│
├─ Usuario regresa (o nunca cerró el navegador)
│
├─ Inicia polling cada 5 segundos:
│  setInterval(async () => {
│
│    ├─ GET /api/workflow/execution/:execId
│    │
│    ├─ Recibe respuesta:
│    │  {
│    │    "executionId": "abc123",
│    │    "status": "running",
│    │    "currentNodeId": "node_5",
│    │    "progress": {
│    │      "totalNodes": 10,
│    │      "completedNodes": 5,
│    │      "percentage": 50
│    │    },
│    │    "logs": [...]
│    │  }
│    │
│    ├─ Actualiza UI:
│    │  ├─ Barra de progreso: 50%
│    │  ├─ "Ejecutando nodo: HTTP Request"
│    │  └─ Lista de logs
│    │
│    └─ Si status === 'completed' || status === 'failed':
│       ├─ Detiene polling: clearInterval()
│       └─ Muestra resultados finales
│
│  }, 5000)
│
└─ Usuario ve ejecución en tiempo real sin bloquear UI
```

---

## 🎨 Ejemplo de Workflow Ejecutándose

### Workflow: "API Data Processor"

```
┌─────────────┐
│   Trigger   │  ← Usuario hace clic "Run"
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ HTTP Request│  ← Fetch data from API
│ GET api.com │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Condition  │  ← Check if status == 200
└──┬───────┬──┘
   │       │
   ↓       ↓
 true    false
   │       │
   ↓       ↓
┌──────┐ ┌──────┐
│ LLM  │ │Error │
│Process│ │Output│
└───┬──┘ └──────┘
    │
    ↓
┌────────┐
│ Output │  ← Final result
└────────┘
```

### Timeline de Ejecución

```
T+0s:   Usuario hace clic "Run Workflow"
        └─ executionId generado: abc123
        └─ Status: pending

T+0.1s: Prefect programa ejecución en background
        └─ Usuario puede cerrar navegador aquí ✅

T+0.2s: Flow comienza ejecución
        └─ Status: running
        └─ currentNodeId: trigger_node

T+1s:   Ejecutando HTTP Request
        └─ currentNodeId: http_node
        └─ Progress: 33% (1/3 nodos)

T+2s:   HTTP completado, ejecutando Condition
        └─ currentNodeId: condition_node
        └─ Progress: 66% (2/3 nodos)

T+2.5s: Condition true, ejecutando LLM
        └─ currentNodeId: llm_node

T+5s:   LLM completado, ejecutando Output
        └─ currentNodeId: output_node
        └─ Progress: 100% (3/3 nodos)

T+5.1s: Workflow completado
        └─ Status: completed
        └─ finalOutput: { resultado: "..." }
```

---

## 🔀 Branching Condicional

### Ejemplo: If/Else con Condition Node

```
        ┌──────────┐
        │  Input   │
        └────┬─────┘
             │
             ↓
        ┌──────────┐
        │Condition │
        │ x > 100? │
        └─┬─────┬──┘
          │     │
        true   false
          │     │
          ↓     ↓
    ┌─────┐  ┌──────┐
    │Path │  │ Path │
    │  A  │  │  B   │
    └─────┘  └──────┘
```

### Cómo se Ejecuta

```python
# En workflow_flow.py

result = await execute_node(condition_node, input_data)
# result = {
#   "conditionResult": True,  # x > 100
#   "outputData": input_data
# }

next_nodes = await get_next_nodes(condition_node.id, connections, result)
# Filtra conexiones basado en conditionResult:
#   - Si True: solo conexiones con fromPort="true"
#   - Si False: solo conexiones con fromPort="false"

# Ejecuta solo Path A (porque conditionResult=True)
for node in next_nodes:
    await execute_node(node, result.outputData)
```

---

## 💾 Base de Datos

### Tabla: workflow_executions

```sql
CREATE TABLE workflow_executions (
    id TEXT PRIMARY KEY,           -- executionId (abc123)
    workflowId TEXT NOT NULL,      -- ID del workflow
    organizationId TEXT,           -- Organización del usuario
    status TEXT NOT NULL,          -- pending, running, completed, failed
    currentNodeId TEXT,            -- Nodo que se está ejecutando ahora
    inputs TEXT,                   -- JSON: inputs del usuario
    nodeResults TEXT,              -- JSON: resultados de todos los nodos
    finalOutput TEXT,              -- JSON: output final
    error TEXT,                    -- Error message si falló
    createdAt TEXT NOT NULL,       -- Timestamp de creación
    startedAt TEXT,                -- Timestamp de inicio
    completedAt TEXT               -- Timestamp de finalización
);
```

### Tabla: execution_logs

```sql
CREATE TABLE execution_logs (
    id TEXT PRIMARY KEY,           -- Log ID
    executionId TEXT NOT NULL,     -- FK a workflow_executions
    nodeId TEXT NOT NULL,          -- ID del nodo
    nodeType TEXT NOT NULL,        -- Tipo (http, llm, condition, ...)
    nodeLabel TEXT,                -- Label del nodo
    status TEXT NOT NULL,          -- running, completed, error
    inputData TEXT,                -- JSON: input del nodo
    outputData TEXT,               -- JSON: output del nodo
    error TEXT,                    -- Error message si falló
    duration REAL,                 -- Duración en ms
    timestamp TEXT NOT NULL        -- Timestamp del log
);
```

### Queries Útiles

```sql
-- Ver todas las ejecuciones de un workflow
SELECT id, status, createdAt, completedAt
FROM workflow_executions
WHERE workflowId = 'workflow123'
ORDER BY createdAt DESC
LIMIT 20;

-- Ver logs de una ejecución específica
SELECT nodeType, nodeLabel, status, duration, timestamp
FROM execution_logs
WHERE executionId = 'abc123'
ORDER BY timestamp ASC;

-- Ver ejecuciones en progreso
SELECT id, workflowId, currentNodeId, startedAt
FROM workflow_executions
WHERE status = 'running'
ORDER BY startedAt DESC;

-- Ver ejecuciones fallidas recientes
SELECT id, workflowId, error, completedAt
FROM workflow_executions
WHERE status = 'failed'
ORDER BY completedAt DESC
LIMIT 10;
```

---

## 🚀 Resumen

### Ventajas Clave

1. **Desacoplado**: Frontend y workers independientes
2. **Asíncrono**: Usuario no espera, puede cerrar navegador
3. **Escalable**: Múltiples workers en paralelo
4. **Resiliente**: Reintentos automáticos, logs persistentes
5. **Transparente**: Progreso y logs en tiempo real

### Flujo Simplificado

```
Usuario → Click "Run" → Node.js → Prefect → Background Execution
                                     ↓
                                  Database
                                     ↑
Usuario ← Polling (5s) ← Node.js ← Status Updates
```

**¡Eso es todo!** El usuario puede tomar café ☕ mientras los workflows se ejecutan solos 🚀

