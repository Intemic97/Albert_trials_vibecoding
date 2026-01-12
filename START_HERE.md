# 🚀 EMPIEZA AQUÍ - Microservicio de Prefect

## ✨ ¿Qué se ha implementado?

Un **microservicio completamente desacoplado** para ejecutar workflows en background.

**Ventaja principal**: El usuario puede **cerrar el navegador** mientras los workflows se ejecutan ☕

---

## 📦 Instalación Rápida (5 minutos)

### 1. Instalar Python y Dependencias

```bash
# Navegar al directorio del worker
cd server/prefect-worker

# Crear entorno virtual (si no existe)
python -m venv venv

# Activar entorno virtual
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt
```

### 2. Configurar Variables de Entorno

Crear archivo `server/prefect-worker/.env`:

```env
API_PORT=8000
API_HOST=0.0.0.0
DATABASE_PATH=../database.sqlite
OPENAI_API_KEY=tu_clave_aqui
```

Agregar en `server/.env` (backend Node.js):

```env
PREFECT_SERVICE_URL=http://localhost:8000
```

---

## 🏃 Ejecutar (2 comandos)

### Terminal 1: Backend Node.js

```bash
cd server
npm start
```

### Terminal 2: Servicio Prefect

```bash
cd server/prefect-worker
start.bat          # Windows
# ./start.sh       # Linux/Mac
```

**¡Listo!** Los servicios están corriendo:
- Node.js: http://localhost:3001
- Prefect: http://localhost:8000

---

## 🧪 Probar que Funciona

### Opción 1: Test Automático

```bash
cd server/prefect-worker
python test_service.py
```

### Opción 2: Test Manual

1. Abrir el frontend en el navegador
2. Crear un workflow simple (Trigger → HTTP → Output)
3. Ejecutar el workflow (click "Run Workflow")
4. **Cerrar el navegador** ☕
5. Esperar 1 minuto
6. Abrir el navegador de nuevo
7. ✅ Ver que el workflow terminó!

---

## 🎯 Cómo Funciona

```
Usuario hace clic "Run Workflow"
          ↓
Backend delega a Prefect
          ↓
Prefect ejecuta en background
          ↓
Usuario puede cerrar navegador ☕
          ↓
Workflow sigue ejecutándose
          ↓
Usuario vuelve y ve resultados ✅
```

---

## 📡 Endpoints Disponibles

### Desde el Frontend

```javascript
// Ejecutar workflow (automáticamente usa Prefect)
POST /api/workflow/:id/execute
{
  "inputs": { ... }
}

// Ver progreso
GET /api/workflow/execution/:execId

// Ver logs
GET /api/workflow/execution/:execId/logs

// Verificar salud de Prefect
GET /api/prefect/health
```

---

## 📚 Documentación Completa

1. **Inicio Rápido**: `PREFECT_QUICKSTART.md`
   - Guía paso a paso
   - Ejemplos de código
   - Integración con frontend

2. **Arquitectura**: `server/prefect-worker/ARCHITECTURE.md`
   - Diagramas detallados
   - Flujo de ejecución
   - Cómo funciona internamente

3. **Resumen de Implementación**: `PREFECT_IMPLEMENTATION_SUMMARY.md`
   - Lista de archivos creados
   - Estado de implementación
   - Próximas mejoras

4. **README del Worker**: `server/prefect-worker/README.md`
   - Documentación técnica
   - API endpoints
   - Troubleshooting

---

## 🎨 Tipos de Nodos Soportados

✅ **Implementados**:
- `trigger` - Inicio de workflow
- `manualInput` - Entrada manual
- `output` - Salida final
- `http` - Peticiones HTTP
- `llm` - OpenAI/GPT
- `condition` - If/Else
- `addField` - Transformación
- `join` - Unión de datos
- `webhook` - Recibir webhooks
- `comment` - Comentarios

🔄 **Pendientes** (fáciles de agregar):
- `fetchData`, `saveRecords`, `mysql`, `sendEmail`, etc.

---

## 🔧 Troubleshooting

### El servicio Prefect no arranca

```bash
# Verificar puerto 8000 no esté en uso
netstat -ano | findstr :8000  # Windows
# lsof -i :8000               # Linux/Mac

# Reinstalar dependencias
pip install -r requirements.txt
```

### Los workflows se ejecutan localmente

```bash
# Verificar que Prefect está corriendo
curl http://localhost:8000/

# Verificar variable de entorno
echo $PREFECT_SERVICE_URL  # Linux/Mac
# set PREFECT_SERVICE_URL   # Windows

# Verificar salud desde Node.js
curl http://localhost:3001/api/prefect/health
```

---

## 💡 Próximos Pasos

### Para Empezar:

1. ✅ Instalar dependencias
2. ✅ Configurar .env
3. ✅ Arrancar servicios
4. ✅ Ejecutar un workflow
5. ✅ Cerrar navegador ☕
6. ✅ Ver resultados

### Mejoras Futuras:

- Implementar nodos faltantes (`fetchData`, `mysql`, etc.)
- WebSockets en lugar de polling
- Notificaciones push
- Dashboard de administración

---

## 📁 Estructura de Archivos

```
server/prefect-worker/
├── api_service.py       # API FastAPI
├── start_service.py     # Script de inicio
├── config.py            # Configuración
├── database.py          # DB utils
├── requirements.txt     # Dependencias
├── start.bat / .sh      # Scripts
├── test_service.py      # Tests
├── flows/
│   └── workflow_flow.py # Flow principal
├── tasks/
│   └── node_handlers.py # Handlers
└── venv/                # Entorno virtual
```

---

## 🎉 Resultado Final

Ahora tienes un sistema donde:

✅ Workflows corren en background  
✅ Usuario puede cerrar navegador  
✅ Progreso en tiempo real (polling)  
✅ Logs persistentes en DB  
✅ Escalable y resiliente  
✅ Fácil de extender  

**¡Disfruta ejecutando workflows mientras tomas café!** ☕🚀

---

## 🆘 Ayuda

Si algo no funciona:

1. Lee `PREFECT_QUICKSTART.md` (guía detallada)
2. Revisa `server/prefect-worker/README.md` (troubleshooting)
3. Ejecuta `python test_service.py` (diagnóstico)

¿Todo bien? **¡A ejecutar workflows!** 🚀

