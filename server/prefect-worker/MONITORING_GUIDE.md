# 📊 Guía de Monitoreo de Ejecuciones

Una vez que el servicio de Prefect está corriendo, tienes varias formas de monitorear las ejecuciones de workflows.

## 🚀 Métodos de Monitoreo

### 1. 🌐 API REST (Navegador o curl)

El método más simple para consultas rápidas:

#### Health Check
```bash
http://localhost:8000/
```

#### Estado de una ejecución específica
```bash
http://localhost:8000/api/executions/{executionId}
```

Ejemplo de respuesta:
```json
{
  "executionId": "abc123",
  "status": "running",
  "workflowId": "workflow_xyz",
  "progress": {
    "totalNodes": 10,
    "completedNodes": 5,
    "percentage": 50
  },
  "currentNodeId": "node_5",
  "logs": [...]
}
```

#### Logs detallados de una ejecución
```bash
http://localhost:8000/api/executions/{executionId}/logs
```

#### Todas las ejecuciones de un workflow
```bash
http://localhost:8000/api/workflows/{workflowId}/executions?limit=20
```

### 2. 🐍 Script Python (Base de Datos)

Consulta directamente la base de datos SQLite:

```bash
# Ver últimas 10 ejecuciones
py view_executions.py

# Ver últimas N ejecuciones
py view_executions.py 20

# Ver solo ejecuciones activas (pending/running)
py view_executions.py active

# Ver logs detallados de una ejecución
py view_executions.py logs <execution_id>
```

**Ventajas:**
- ✅ Acceso directo a la base de datos
- ✅ Formato legible con emojis
- ✅ No requiere que la API esté corriendo

### 3. 🖥️ Monitor Interactivo (Windows)

Script batch con menú interactivo:

```bash
monitor.bat
```

Opciones:
1. Ver últimas ejecuciones
2. Ver ejecuciones activas (running/pending)
3. Ver logs de una ejecución específica
4. Monitoreo en tiempo real (actualiza cada 5s)

### 4. 🧪 Test de API (Menú Interactivo)

Script Python para consultar la API:

```bash
# Menú interactivo
py test_api_executions.py

# Comandos directos
py test_api_executions.py status <execution_id>
py test_api_executions.py logs <execution_id>
py test_api_executions.py workflow <workflow_id>
```

**Ventajas:**
- ✅ Valida que la API funcione
- ✅ Mismo formato que usará el frontend
- ✅ Útil para debugging

## 📝 Ejemplos de Uso

### Escenario 1: Ejecutar y monitorear un workflow

```bash
# 1. Ejecutar workflow desde frontend o API
POST http://localhost:8000/api/workflows/execute
{
  "workflowId": "my_workflow",
  "inputs": { "data": "test" }
}

# Respuesta:
{
  "executionId": "abc123",
  "status": "pending"
}

# 2. Monitorear progreso
# Opción A: API
http://localhost:8000/api/executions/abc123

# Opción B: Script Python
py view_executions.py logs abc123

# Opción C: Monitor en tiempo real
monitor.bat → Opción 4
```

### Escenario 2: Debugging de un workflow que falló

```bash
# 1. Ver ejecuciones recientes
py view_executions.py 10

# 2. Identificar la ejecución fallida
# Output:
# 1. ❌ FAILED
#    ID: abc123
#    Error: Node 'process_data' failed...

# 3. Ver logs detallados
py view_executions.py logs abc123

# 4. Ver qué nodo falló específicamente
# O usar la API:
http://localhost:8000/api/executions/abc123/logs
```

### Escenario 3: Ver todas las ejecuciones de un workflow específico

```bash
# Opción A: API (navegador)
http://localhost:8000/api/workflows/my_workflow_id/executions

# Opción B: Script interactivo
py test_api_executions.py
→ Opción 3: Ver ejecuciones de un workflow
→ Introducir: my_workflow_id
```

## 🎯 Estados de Ejecución

| Estado | Emoji | Descripción |
|--------|-------|-------------|
| `pending` | ⏳ | Ejecución creada, esperando a comenzar |
| `running` | 🔄 | Ejecución en progreso |
| `completed` | ✅ | Ejecución completada exitosamente |
| `failed` | ❌ | Ejecución falló con error |

## 📊 Información de Progreso

Cada ejecución incluye información de progreso:

```json
{
  "progress": {
    "totalNodes": 10,        // Total de nodos en el workflow
    "completedNodes": 7,     // Nodos completados
    "failedNodes": 1,        // Nodos que fallaron
    "percentage": 70         // Porcentaje completado
  }
}
```

## 🔍 Logs de Nodos

Cada nodo ejecutado genera un log con:

```json
{
  "nodeId": "node_1",
  "nodeType": "http",
  "status": "completed",
  "duration": 150,          // ms
  "timestamp": "2026-01-15T10:30:00Z",
  "outputData": "{...}",    // Datos de salida
  "error": null             // Error si falló
}
```

## 🛠️ Herramientas Adicionales

### Consulta SQL directa

Si necesitas consultas personalizadas:

```bash
sqlite3 ../database.sqlite

# Ver todas las ejecuciones
SELECT * FROM workflow_executions ORDER BY createdAt DESC LIMIT 10;

# Ver logs de una ejecución
SELECT * FROM execution_logs WHERE executionId = 'abc123' ORDER BY timestamp;

# Estadísticas
SELECT 
  status, 
  COUNT(*) as count 
FROM workflow_executions 
GROUP BY status;
```

### Curl para testing

```bash
# Health check
curl http://localhost:8000/

# Estado de ejecución
curl http://localhost:8000/api/executions/abc123

# Ejecutar workflow
curl -X POST http://localhost:8000/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "my_workflow",
    "inputs": {"key": "value"}
  }'
```

## 💡 Tips

1. **Polling desde Frontend**: El frontend debería hacer polling cada 3-5 segundos para actualizar el estado
2. **Logs en Tiempo Real**: Para workflows de larga duración, usa el monitoreo en tiempo real
3. **Debugging**: Siempre revisa los logs detallados cuando una ejecución falle
4. **Performance**: La API usa índices en la base de datos para consultas rápidas

## 🔗 Integración con Frontend

Ejemplo de código React para monitorear una ejecución:

```typescript
// Ejecutar workflow
const { executionId } = await fetch('http://localhost:8000/api/workflows/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ workflowId, inputs })
}).then(r => r.json());

// Polling para ver progreso
const pollExecution = async () => {
  const response = await fetch(`http://localhost:8000/api/executions/${executionId}`);
  const data = await response.json();
  
  console.log(`Progress: ${data.progress.percentage}%`);
  console.log(`Current node: ${data.currentNodeId}`);
  
  if (data.status === 'completed') {
    console.log('✅ Workflow completed!');
    return;
  }
  
  if (data.status === 'failed') {
    console.error('❌ Workflow failed:', data.error);
    return;
  }
  
  // Continuar polling
  setTimeout(pollExecution, 5000);
};

pollExecution();
```

## 📚 Próximos Pasos

- [ ] Implementar WebSocket para actualizaciones en tiempo real
- [ ] Dashboard web para monitoreo visual
- [ ] Alertas por email/Slack cuando un workflow falle
- [ ] Métricas de performance (tiempo promedio, tasa de éxito, etc.)

¡Disfruta monitoreando tus workflows! 🚀

