# Prefect Workflow Execution Setup

Este documento describe cómo configurar y probar el sistema de ejecución de workflows con Prefect.

## Arquitectura

```
┌─────────────┐     WebSocket      ┌─────────────┐     HTTP Poll     ┌─────────────┐
│   Frontend  │◀──────────────────▶│   Node.js   │◀─────────────────▶│   Python    │
│   (React)   │                    │   Backend   │                   │   Prefect   │
└─────────────┘                    └─────────────┘                   └─────────────┘
     :3000                              :3001                             :8000
```

## Requisitos

- Node.js 18+
- Python 3.10+
- pip (gestor de paquetes Python)

## Setup Inicial

### 1. Instalar dependencias de Node.js

```bash
npm install
```

### 2. Instalar dependencias de Python

```bash
npm run prefect:install
# o manualmente:
cd server/prefect-worker && pip install -r requirements.txt
```

### 3. Configurar variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Backend
PORT=3001
JWT_SECRET=your-secret-key

# OpenAI (para nodos LLM)
OPENAI_API_KEY=sk-...

# Prefect Service
PREFECT_SERVICE_URL=http://localhost:8000

# Opcional: Twilio (para SMS)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# Opcional: Climatiq (para emisiones)
CLIMATIQ_API_KEY=...
```

## Levantar los Servicios

### Opción A: Tres terminales separadas

```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend Node.js
npm run server

# Terminal 3 - Backend Python/Prefect
npm run prefect
```

### Opción B: Usar tmux o screen

```bash
# En tmux
tmux new-session -d -s frontend 'npm run dev'
tmux new-session -d -s backend 'npm run server'
tmux new-session -d -s prefect 'npm run prefect'
```

## Verificar que Funciona

### 1. Health Check del servicio Prefect

```bash
curl http://localhost:8000/
# Debería responder: {"service":"Workflow Orchestration Service","status":"running",...}
```

### 2. Ejecutar un workflow

1. Abrir http://localhost:3000
2. Ir a Workflows
3. Crear o abrir un workflow existente
4. Click en "Run" (Play button)
5. El modal debería mostrar progreso en tiempo real

### 3. Ver ejecuciones activas (debug)

```bash
curl http://localhost:3001/api/executions/polling/active -H "Cookie: token=..."
```

## Flujo de Ejecución

1. **Frontend** hace POST a `/api/workflow/:id/execute`
2. **Node.js** delega a Prefect service (POST `/api/workflows/execute`)
3. **Prefect** ejecuta workflow en background (paralelo por capas)
4. **Node.js** hace polling cada 2s a Prefect para obtener status
5. **Node.js** envía updates via WebSocket al frontend
6. **Frontend** actualiza UI en tiempo real

## Handlers Disponibles

### Básicos
- `trigger` - Inicio de workflow
- `manualInput` - Entrada manual
- `output` - Salida final
- `comment` - Comentario (no-op)
- `webhook` - Recibir datos externos

### Datos
- `fetchData` - Obtener registros de entidad
- `excelInput` - Cargar Excel/CSV
- `pdfInput` - Cargar PDF
- `saveRecords` - Guardar a base de datos

### Lógica
- `condition` - Condicional/branching
- `join` - Unir datos de múltiples fuentes
- `addField` - Añadir campo a registros
- `splitColumns` - Dividir columnas en dos outputs

### Integraciones
- `http` - Peticiones HTTP
- `llm` - OpenAI/LLM
- `mysql` - Consultas MySQL
- `sendEmail` - Enviar email (SMTP)
- `sendSMS` - Enviar SMS (Twilio)
- `esios` - Datos ESIOS (mercado eléctrico)
- `climatiq` - Datos de emisiones
- `python` - Ejecutar código Python

### OT/Industrial (simulados)
- `opcua` - OPC UA
- `mqtt` - MQTT
- `modbus` - Modbus
- `scada` - SCADA
- `mes` - MES
- `dataHistorian` - Historian
- `timeSeriesAggregator` - Agregación time-series

## Troubleshooting

### El servicio Prefect no arranca

```bash
# Verificar versión de Python
python3 --version  # Debe ser 3.10+

# Reinstalar dependencias
cd server/prefect-worker
pip install -r requirements.txt --force-reinstall
```

### Error "Connection refused" al ejecutar workflow

Verificar que el servicio Prefect está corriendo en el puerto 8000:

```bash
lsof -i :8000
# o
curl http://localhost:8000/
```

### No se ven actualizaciones en tiempo real

1. Verificar que el WebSocket está conectado (ver consola del navegador)
2. Verificar que el polling está activo:
   ```bash
   curl http://localhost:3001/api/executions/polling/active
   ```

### Error en handler específico

Ver logs del servicio Prefect para detalles:

```bash
# Los logs aparecen en la terminal donde se ejecutó npm run prefect
```

## Desarrollo

### Añadir un nuevo handler

1. Editar `server/prefect-worker/tasks/node_handlers.py`
2. Añadir la función con decorador `@task`
3. Registrar en el diccionario `NODE_HANDLERS`
4. También implementar en `server/workflowExecutor.js` para fallback

### Modificar el polling interval

Editar `server/executionPolling.js`:

```javascript
this.pollInterval = 2000; // milisegundos
```
