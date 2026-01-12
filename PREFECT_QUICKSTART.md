# 🚀 Guía de Inicio Rápido - Microservicio de Prefect

## ✨ ¿Qué es esto?

Un **microservicio completamente desacoplado** para ejecutar workflows en background usando Prefect como orquestador.

### 🎯 Ventajas Principales

1. **✅ Zero Dependencia del Frontend**
   - El usuario hace clic en "Run Workflow"
   - El usuario puede **cerrar el navegador** y **tomar café** ☕
   - El workflow sigue ejecutándose en el backend
   - Cuando vuelve, ve los resultados actualizados

2. **📈 Escalabilidad Independiente**
   - Frontend y workers escalan por separado
   - Múltiples workers en paralelo
   - Procesamiento distribuido

3. **🛡️ Resiliencia**
   - Si el frontend crashea → workflows continúan
   - Reintentos automáticos (configurable)
   - Logs persistentes en base de datos

4. **⏱️ Workflows de Larga Duración**
   - Workflows pueden correr **horas o días**
   - Sin timeouts del navegador
   - Ejecución completamente persistente

---

## 📦 Instalación

### Paso 1: Instalar Python y Dependencias

```bash
# Navegar al directorio del worker
cd server/prefect-worker

# Crear entorno virtual (si no existe)
python -m venv venv

# Activar entorno virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

### Paso 2: Configurar Variables de Entorno

Crear archivo `server/prefect-worker/.env`:

```env
# API Configuration
API_PORT=8000
API_HOST=0.0.0.0

# Database
DATABASE_PATH=../database.sqlite

# External Services (opcional - para nodos específicos)
OPENAI_API_KEY=your_openai_key_here
CLIMATIQ_API_KEY=your_climatiq_key_here
```

También agregar en `server/.env`:

```env
# Prefect Worker Service URL
PREFECT_SERVICE_URL=http://localhost:8000
```

---

## 🏃 Ejecutar el Servicio

### Opción 1: Script de Inicio (Recomendado)

```bash
cd server/prefect-worker

# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh
```

### Opción 2: Manual

```bash
cd server/prefect-worker
source venv/bin/activate  # o venv\Scripts\activate en Windows
python start_service.py
```

El servicio estará disponible en **http://localhost:8000**

---

## 🔧 Cómo Funciona

### Arquitectura

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Frontend   │────────▶│  Node.js Server  │────────▶│ Prefect Service │
│  (React)    │         │  (Express)       │         │  (FastAPI)      │
└─────────────┘         └──────────────────┘         └─────────────────┘
      │                         │                             │
      │                         ▼                             ▼
      │                   ┌──────────┐                ┌─────────────┐
      └──────────────────▶│ SQLite   │◀───────────────│  Workflows  │
        (Polling)         │ Database │                │  Execution  │
                          └──────────┘                └─────────────┘
```

### Flujo de Ejecución

1. **Usuario inicia workflow** desde el frontend
   ```javascript
   const response = await executeWorkflow(workflowId, inputs);
   // Usuario recibe executionId inmediatamente
   ```

2. **Backend Node.js** delega al servicio Prefect
   ```javascript
   // En server/index.js - ahora usa Prefect automáticamente
   POST /api/workflow/:id/execute
   ```

3. **Servicio Prefect** crea registro y programa ejecución
   ```python
   # En server/prefect-worker/api_service.py
   execution_id = create_execution()
   background_tasks.add_task(execute_workflow_flow)
   return {"executionId": execution_id}
   ```

4. **Usuario puede cerrar el navegador** ☕
   - El workflow sigue ejecutándose en el backend
   - Estado se guarda en SQLite

5. **Frontend hace polling** (cada 5 segundos) para ver progreso
   ```javascript
   const status = await fetch(`/api/workflow/execution/${executionId}`);
   // Muestra: 50% completado, nodo actual, etc.
   ```

6. **Usuario vuelve** y ve los resultados
   ```javascript
   if (status === 'completed') {
     showResults(execution.finalOutput);
   }
   ```

---

## 📡 API Endpoints

### Node.js Server (Puerto 3001)

#### Ejecutar Workflow
```bash
POST /api/workflow/:id/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "inputs": {
    "node_id_1": "value1"
  },
  "usePrefect": true  # Por defecto es true
}

Response:
{
  "success": true,
  "executionId": "abc123",
  "status": "pending",
  "message": "Workflow execution started in background",
  "usingPrefect": true,
  "backgroundExecution": true
}
```

#### Obtener Estado de Ejecución
```bash
GET /api/workflow/execution/:execId
Authorization: Bearer <token>

Response:
{
  "executionId": "abc123",
  "status": "running",
  "currentNodeId": "node_5",
  "progress": {
    "totalNodes": 10,
    "completedNodes": 5,
    "percentage": 50
  },
  "startedAt": "2026-01-12T10:00:00Z",
  "logs": [...]
}
```

#### Verificar Salud del Servicio Prefect
```bash
GET /api/prefect/health
Authorization: Bearer <token>

Response:
{
  "available": true,
  "serviceUrl": "http://localhost:8000",
  "message": "Prefect service is running - background execution enabled"
}
```

### Prefect Service (Puerto 8000)

#### Ejecutar Workflow Directamente
```bash
POST /api/workflows/execute
Content-Type: application/json

{
  "workflowId": "abc123",
  "inputs": {},
  "organizationId": "org123"
}
```

#### Obtener Estado con Progreso Detallado
```bash
GET /api/executions/:executionId

Response:
{
  "executionId": "abc123",
  "status": "running",
  "progress": {
    "totalNodes": 10,
    "completedNodes": 5,
    "failedNodes": 0,
    "percentage": 50
  },
  "logs": [...]
}
```

---

## 💻 Integración Frontend

### Ejecutar Workflow con Background Execution

```typescript
// En tu componente de React
async function runWorkflow(workflowId: string, inputs: any) {
  try {
    // Ejecutar workflow (va a Prefect automáticamente)
    const response = await fetch(`/api/workflow/${workflowId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ inputs })
    });

    const { executionId, backgroundExecution } = await response.json();

    if (backgroundExecution) {
      console.log('✅ Workflow corriendo en background!');
      console.log('💡 Puedes cerrar el navegador');
      
      // Iniciar polling para ver progreso
      startPolling(executionId);
    }

    return executionId;

  } catch (error) {
    console.error('Error ejecutando workflow:', error);
  }
}

// Polling para ver progreso
function startPolling(executionId: string) {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/workflow/execution/${executionId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const execution = await response.json();
    
    console.log(`Progress: ${execution.progress?.percentage || 0}%`);
    console.log(`Current node: ${execution.currentNodeId}`);

    if (execution.status === 'completed') {
      console.log('✅ Workflow completado!', execution.finalOutput);
      clearInterval(interval);
      showResults(execution);
    } else if (execution.status === 'failed') {
      console.error('❌ Workflow falló:', execution.error);
      clearInterval(interval);
      showError(execution.error);
    }
  }, 5000); // Check cada 5 segundos

  return interval;
}
```

### Verificar si Prefect está Disponible

```typescript
async function checkPrefectHealth() {
  const response = await fetch('/api/prefect/health', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const health = await response.json();
  
  if (health.available) {
    console.log('🚀 Background execution habilitado');
  } else {
    console.log('⚠️ Usando ejecución local (síncrona)');
  }
}
```

---

## 🎨 Tipos de Nodos Soportados

### Nodos Implementados (v1.0)

- ✅ **trigger** - Inicio de workflow
- ✅ **manualInput** - Entrada manual de datos
- ✅ **output** - Salida final
- ✅ **http** - Peticiones HTTP (GET, POST, PUT, DELETE)
- ✅ **llm** - Llamadas a OpenAI/GPT
- ✅ **condition** - Lógica condicional (if/else)
- ✅ **addField** - Transformación de datos
- ✅ **join** - Unión de datasets
- ✅ **webhook** - Recepción de webhooks
- ✅ **comment** - Comentarios (sin acción)

### Nodos Pendientes (próxima versión)

Para los siguientes nodos, el sistema mostrará "Node type not implemented yet" pero pasará los datos sin error:

- 🔄 **fetchData** - Obtener datos de entidades
- 🔄 **excelInput** - Leer archivos Excel/CSV
- 🔄 **pdfInput** - Leer archivos PDF
- 🔄 **saveRecords** - Guardar en base de datos
- 🔄 **mysql** - Consultas MySQL
- 🔄 **sendEmail** - Enviar emails
- 🔄 **sendSMS** - Enviar SMS
- 🔄 **splitColumns** - Dividir columnas
- 🔄 **esios** - API de ESIOS
- 🔄 **climatiq** - API de Climatiq

---

## 🔌 Añadir Nuevos Tipos de Nodos

### Paso 1: Crear Handler

En `server/prefect-worker/tasks/node_handlers.py`:

```python
@task(name="my_custom_node", retries=2)
async def handle_my_custom_node(node: Dict, input_data: Optional[Dict] = None) -> Dict:
    config = node.get("config", {})
    
    # Tu lógica aquí
    result = do_something_awesome(config, input_data)
    
    return {
        "success": True,
        "message": "Custom node executed successfully",
        "outputData": result
    }
```

### Paso 2: Registrar Handler

En el mismo archivo, agregar al diccionario `NODE_HANDLERS`:

```python
NODE_HANDLERS = {
    ...
    "myCustomNode": handle_my_custom_node,
}
```

### Paso 3: Reiniciar Servicio

```bash
# Ctrl+C para detener
python start_service.py
```

---

## 🐛 Troubleshooting

### El servicio Prefect no arranca

```bash
# Verificar que el puerto 8000 no esté en uso
netstat -ano | findstr :8000  # Windows
lsof -i :8000                 # Linux/Mac

# Verificar que las dependencias están instaladas
pip install -r requirements.txt

# Ver logs de error
python start_service.py
```

### Los workflows se ejecutan localmente en lugar de con Prefect

```bash
# Verificar que el servicio Prefect está corriendo
curl http://localhost:8000/

# Verificar variable de entorno en server/.env
PREFECT_SERVICE_URL=http://localhost:8000

# Verificar salud del servicio desde Node.js
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/prefect/health
```

### Error: "Database locked"

```bash
# SQLite no permite múltiples escritores concurrentes
# Solución: Usar WAL mode (ya configurado) o migrar a PostgreSQL para producción
```

---

## 📊 Monitoreo y Logs

### Ver Logs del Servicio

```bash
# Los logs aparecen en la consola donde ejecutaste start_service.py
# Ejemplos de logs:
# 🚀 Starting workflow execution: Mi Workflow
# 📊 Workflow has 5 nodes and 4 connections
# ➡️  Node 'HTTP Request' → 2 next node(s)
# ✅ Workflow execution completed successfully
```

### Consultar Base de Datos

```bash
sqlite3 server/database.sqlite

# Ver ejecuciones recientes
SELECT id, workflowId, status, createdAt, completedAt 
FROM workflow_executions 
ORDER BY createdAt DESC 
LIMIT 10;

# Ver logs de una ejecución
SELECT nodeType, nodeLabel, status, duration, timestamp 
FROM execution_logs 
WHERE executionId = 'abc123' 
ORDER BY timestamp;
```

---

## 🚀 Próximos Pasos

### Para Empezar:

1. ✅ **Instalar dependencias**: `pip install -r requirements.txt`
2. ✅ **Configurar .env**: Variables de entorno necesarias
3. ✅ **Arrancar servicio**: `start.bat` o `./start.sh`
4. ✅ **Verificar health**: `GET /api/prefect/health`
5. ✅ **Ejecutar un workflow**: Desde el frontend
6. ✅ **Cerrar navegador**: ☕ Tomar café
7. ✅ **Volver y ver resultados**: El workflow terminó solo!

### Mejoras Futuras:

- 🔄 WebSockets en lugar de polling (tiempo real)
- 🔄 Implementar nodos faltantes (MySQL, Email, etc.)
- 🔄 Dashboard de Prefect UI (opcional)
- 🔄 Múltiples workers en paralelo
- 🔄 Rate limiting y colas de prioridad
- 🔄 Notificaciones push cuando un workflow termina

---

## 📚 Documentación Adicional

- **README del Worker**: `server/prefect-worker/README.md`
- **Documentación de Prefect**: https://docs.prefect.io/
- **FastAPI Docs**: https://fastapi.tiangolo.com/

---

## 🎉 ¡Listo!

Ahora tienes un sistema de **ejecución de workflows completamente desacoplado** donde:

- ✅ Los usuarios pueden cerrar el navegador
- ✅ Los workflows siguen ejecutándose
- ✅ Todo es escalable y resiliente
- ✅ Logs persistentes en base de datos
- ✅ Progreso en tiempo real (polling)

**¡Disfruta de workflows que corren solos mientras tomas café!** ☕🚀

