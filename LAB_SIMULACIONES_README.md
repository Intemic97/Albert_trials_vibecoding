# Labs - Simulaciones Reales con Workflows

## Estado Actual

Lab ahora ejecuta workflows REALES, no simulaciones ficticias. Los cambios implementados:

### Fixes aplicados en `components/Lab.tsx`:

1. **URL corregida**: `/api/workflows/` → `/api/workflow/` (singular)
2. **Campo body corregido**: `{ inputData }` → `{ inputs }`  
3. **Mapeo por nodeId**: Usa `param.nodeId` en vez de `param.variableName`
4. **Polling**: Soporta ejecuciones background con polling automático
5. **Aplanado de resultados**: Extrae `outputData` de nodos para visualizaciones

## Workflow Creado: "Simulación Producción Plástico O&G"

### Entidades con datos reales:
- **Extrusoras** (5): EXT-001 HDPE Film, EXT-002 PP Sheet, etc.
- **Materia Prima** (6): Resinas SABIC, LyondellBasell, ExxonMobil, aditivos BASF
- **Producción Diaria** (10 registros): Datos realistas de producción
- **Órdenes** (6): Clientes reales - Pemex, Repsol, Shell, Saudi Aramco, CEPSA

### Workflow actual:
- **3 Manual Inputs**: Precio resina, Capacidad target, Eficiencia
- **1 Fetch Data**: Obtiene datos reales de extrusoras desde la DB
- **1 Join**: Combina inputs con datos
- **1 Output**: Devuelve resultados

### Estado:
✅ **Ejecuta workflows reales** (no demo)  
✅ **Obtiene datos reales** de la base de datos  
✅ **Los parámetros se pasan correctamente** vía `inputs[nodeId]`  
⚠️ **Limitación**: Cálculos complejos requieren Prefect con Python

## Para Cálculos Complejos (P&L, Proyecciones)

El workflow original tenía un nodo Python con cálculos financieros completos, pero:

- **Nodo Python** solo funciona con Prefect (microservicio Python)
- **Prefect** no está corriendo actualmente
- **Executor local** (Node.js) solo soporta nodos básicos

### Opciones:

#### Opción 1: Iniciar Prefect (recomendado para prod)

```bash
cd server/prefect-worker
python start_service.py
```

Luego restaura el nodo Python en el workflow que calcula:
- Producción mensual = capacidad × eficiencia × días
- Costos = resina + energía + mano obra + mantenimiento  
- Beneficio = ingresos - costos
- Proyección 12 meses con factor estacional
- Desglose de costos

#### Opción 2: Usar nodo LLM (requiere OpenAI API key)

El nodo LLM puede hacer cálculos usando GPT-4, pero:
- Más lento que Python
- Cuesta dinero por ejecución
- Requiere `OPENAI_API_KEY` en `.env`

#### Opción 3: Mantener workflow simple

El workflow actual demuestra que Lab ejecuta workflows reales:
- Los inputs se pasan correctamente
- Los datos se obtienen de la DB real
- Las visualizaciones pueden mostrar datos reales

Para cálculos, el usuario puede usar el chat de Lab con lenguaje natural.

## Cómo Verificar que Funciona

1. Abre la app y ve a **Lab**
2. Selecciona "Producción Plástico O&G"
3. Ajusta los sliders (Precio Resina, Capacidad, Eficiencia)
4. Click "Run"
5. Verifica que el output muestre datos reales de extrusoras (no datos demo ficticios)
6. Los datos mostrarán las 5 líneas de extrusión con sus capacidades, eficiencias, estados, etc.

## Diferencia vs Demo

| Aspecto | Demo (ficticio) | Real (actual) |
|---|---|---|
| Ejecuta | `runDemoSimulation()` client-side | API `/api/workflow/:id/execute` |
| Datos | Hardcoded en frontend | Obtenidos de SQLite |
| Parámetros | Solo afectan cálculo local | Se pasan al workflow backend |
| Resultados | Mock calculado con fórmula simple | Output real del workflow |

## Scripts Creados

- `server/seed-plastics-plant.js` - Crea entidades, datos y simulación
- `server/update-plastics-workflow.js` - Actualiza workflow (obsoleto)
- `server/fix-plastics-workflow-passthrough.js` - Versión passthrough (obsoleto)
- `server/fix-plastics-workflow-simple.js` - Versión con addField (obsoleto)
- `server/create-simple-plastics-workflow.js` - Versión simplificada (obsoleto)

Ejecutar seed con:
```bash
node server/seed-plastics-plant.js
```

## Siguiente Paso

Para tener la experiencia completa con cálculos de P&L y proyecciones:

1. Iniciar Prefect: `cd server/prefect-worker && python start_service.py`
2. Restaurar nodo Python en el workflow (ver `server/seed-plastics-plant.js` líneas 45-150 para el código Python completo)
3. Quitar visualizaciones hardcodeadas que esperan campos específicos (produccion_mensual, ingresos, etc.) hasta que el nodo Python los genere

O contactar al desarrollador para implementar cálculos en el executor local de Node.js.
