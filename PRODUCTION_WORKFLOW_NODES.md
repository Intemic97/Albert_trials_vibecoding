# Diagnóstico: Nodos de Workflow en Producción

> Documento que resume qué nodos funcionan, cuáles usan datos simulados y qué configuración requieren.

---

## Resumen

| Estado | Descripción |
|--------|-------------|
| ✅ Real | Usa datos/APIs reales, requiere config (API keys, credenciales) |
| ⚠️ Simulado | Siempre devuelve datos fake – TODO implementar conexión real |
| ❌ Falla | Sin config correcta lanza error |

---

## Nodos con datos REALES (requieren config)

### fetchData
- **Estado:** ✅ Real  
- **Requisitos:** `entityId` configurado, entidades en BD  
- **Producción:** Funciona si la BD tiene las mismas entidades.

### LLM / AI Generation
- **Estado:** ✅ Real  
- **Requisitos:** `OPENAI_API_KEY` en variables de entorno del servidor  
- **Producción:** Sin key → error "OpenAI API key not configured"

### HTTP Request
- **Estado:** ✅ Real  
- **Requisitos:** URL válida, endpoint accesible (CORS si es cross-origin)  
- **Producción:** Depende de la URL de destino.

### Python Code
- **Estado:** ✅ Real (según modo)  
- **Requisitos:**  
  - Local: Python + numpy/pandas en servidor  
  - Lambda: `USE_LAMBDA_FOR_PYTHON=true`, `AWS_ACCESS_KEY_ID`, `LAMBDA_FUNCTION_NAME`  
- **Producción:** Comprobar que el modo configurado exista en el deploy.

### sendEmail
- **Estado:** ✅ Real  
- **Requisitos:** Credenciales SMTP en config del nodo (`emailSmtpUser`, `emailSmtpPass`) o Resend  
- **Producción:** SMTP/Resend deben estar accesibles.

### MySQL
- **Estado:** ✅ Real  
- **Requisitos:** `mysqlHost`, `mysqlDatabase`, `mysqlUsername`, `mysqlPassword`, `mysqlQuery` en config  
- **Producción:** El servidor debe poder alcanzar el MySQL.

### saveRecords
- **Estado:** ✅ Real  
- **Requisitos:** `entityId` configurado  
- **Producción:** Funciona con la BD del backend.

### Climatiq
- **Estado:** ✅ Real  
- **Requisitos:** `CLIMATIQ_API_KEY` en env  
- **Producción:** Sin key → falla.

### Google Sheets
- **Estado:** ✅ Real  
- **Requisitos:** `GOOGLE_API_KEY` o `googleApiKey` en config  
- **Producción:** Sin key → falla.

### Condition, Join, addField, splitColumns
- **Estado:** ✅ Real (transforman datos en memoria)  
- **Producción:** Funcionan si reciben datos correctos de nodos previos.

---

## Nodos con datos SIMULADOS (fake data)

### MES
- **Estado:** ⚠️ Siempre simulado  
- **Ubicación:** `workflowExecutor.js` handleMes, `node_handlers.py` handle_mes  
- **Comportamiento:** Devuelve datos ficticios (`productionOrder`, `quantity`, etc.)  
- **TODO:** Implementar llamada real a la API del MES.

### Data Historian (OSIsoft PI)
- **Estado:** ⚠️ Siempre simulado  
- **Ubicación:** `workflowExecutor.js` handleDataHistorian  
- **Comportamiento:** Genera series temporales aleatorias  
- **TODO:** Implementar consulta real a PI Web API / InfluxDB / etc.

### SCADA
- **Estado:** ⚠️ Siempre simulado (Node.js)  
- **Ubicación:** `workflowExecutor.js` handleScada  
- **Comportamiento:** Devuelve tags con valores aleatorios  
- **TODO:** Implementar conexión real (OPC UA, Modbus, API).

### OPC UA, MQTT, Modbus
- **Estado:** ⚠️ Intenta conexión real, si falla → datos simulados  
- **Ubicación:** `workflowExecutor.js` handleOpcUa, handleMqtt, handleModbus  
- **Comportamiento:** Si la conexión falla, usa `simulated: true` en la respuesta  
- **Producción:** Requieren conexiones OT configuradas; sin ellas → simulación.

---

## Cambios realizados para producción

### ExecutionHistoryModal
- **Antes:** En error de API, usaba datos mock (historial falso)  
- **Ahora:** En error, muestra mensaje explícito de fallo y lista vacía (sin datos falsos)

---

## Variables de entorno

Ver `server/.env.example` para la lista completa. Copia a `server/.env` y rellena con valores reales.

| Variable | Uso |
|----------|-----|
| `OPENAI_API_KEY` | LLM, copilots |
| `RESEND_API_KEY` | sendEmail |
| `CLIMATIQ_API_KEY` | Climatiq |
| `GOOGLE_API_KEY` | Google Sheets |
| `VITE_API_BASE` | Build frontend (opcional, por defecto `/api`) |

---

## Comprobaciones en producción

1. **Variables de entorno**
   - `OPENAI_API_KEY` – LLM
   - `CLIMATIQ_API_KEY` – Climatiq
   - `GOOGLE_API_KEY` – Google Sheets
   - `VITE_API_BASE` – Debe apuntar al API en el build (ej. `/api` si hay proxy)

2. **Proxy / reverse proxy**
   - Rutas `/api/*` deben dirigirse al servidor Node.js (pm2)

3. **Base de datos**
   - Misma SQLite/DB para frontend/backend y para workflows programados

4. **Prefect (opcional)**
   - `PREFECT_SERVICE_URL` – Debe ser accesible si se usa Prefect en producción
