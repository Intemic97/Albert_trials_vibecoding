# Use Case Package (genérico)

Cada vez que **subes un package** (por API o por script), se importa como use case: entidades, registros, workflow, simulación Lab y opcionalmente dashboard.

## Flujo recomendado (siempre)

1. Exporta tu package a `.json`
2. Valida el package
3. Ejecuta import en `dryRun`
4. Importa definitivo

Este flujo evita errores en despliegue y te da una forma repetible de mover casos de uso entre entornos.

## JSON correcto para importar entidades

El importador `Import Package` de la app es de **Use Case**, no de Knowledge Base.

- JSON valido para este importador: `entities`, `records`, `workflow`, `simulation`, `dashboard`
- JSON NO valido para este importador: `folders`, `documents` (eso es formato KB)

### Checklist rapido (para que importe de verdad)

1. El JSON debe incluir `entities` con al menos 1 entidad.
2. Si quieres registros, incluir `records` con `entityId` + `values`.
3. Si en UI esta activado `dryRun`, no se escribe nada en DB.
4. Para import real, desactivar `dryRun` y usar `Importar package`.

### Archivos de ejemplo en este repo

- `server/repsol-entities-package.json` (entities base)
- `server/repsol-knowledge-use-case-package.json` (knowledge mapeado como entities/records)
- `server/repsol-knowledge-use-case-package-v2.json` (version minima de prueba)

## Troubleshooting

### Error: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

Significa que el frontend esperaba JSON y el backend devolvio HTML (login, 404 o ruta mal resuelta).

Revisar:

1. Sesion autenticada en la app.
2. Endpoint correcto (`/api/use-case/import` o `/api/use-case/validate`).
3. Configuracion de `API_BASE` y proxy en el entorno.

## Cómo exportar

### 1. Export rápido de entities Repsol (script incluido)

```bash
npm run export-repsol-entities
```

Genera por defecto:

```bash
server/repsol-entities-package.json
```

También puedes definir ruta/nombre de salida:

```bash
node server/export-repsol-entities.js ./exports/repsol-entities-2026-02-09.json
```

### 2. Estructura del JSON exportado

El export de este script genera un package importable con:

- `name`
- `version`
- `exportedAt`
- `entities`
- `records` (vacío por defecto en este export)

## Cómo subir / importar

### 1. Por API (siempre que subas un package)

- **JSON en el body** (Content-Type: application/json):
  ```bash
  curl -X POST http://localhost:3001/api/use-case/import \
    -H "Content-Type: application/json" \
    -H "Cookie: ..." \
    -d @use-case-package.json
  ```
  Dry run:
  ```bash
  curl -X POST "http://localhost:3001/api/use-case/import?dryRun=true" \
    -H "Content-Type: application/json" \
    -H "Cookie: ..." \
    -d @use-case-package.json
  ```
- **Archivo .json** (multipart, field name `package`):
  ```bash
  curl -X POST http://localhost:3001/api/use-case/import-file \
    -H "Cookie: ..." \
    -F "package=@use-case-package.json"
  ```
  Dry run con archivo:
  ```bash
  curl -X POST "http://localhost:3001/api/use-case/import-file?dryRun=true" \
    -H "Cookie: ..." \
    -F "package=@use-case-package.json"
  ```

- **Validación sin importar**:
  ```bash
  curl -X POST http://localhost:3001/api/use-case/validate \
    -H "Content-Type: application/json" \
    -H "Cookie: ..." \
    -d @use-case-package.json
  ```

Requiere autenticación (misma org del usuario). El package se importa en la organización del usuario.

### 2. Por script en el deploy

```bash
# Con ruta explícita
node server/import-use-case.js path/to/use-case-package.json

# Sin argumentos: busca en este orden
#   use-case-package.json
#   server/data/use-case-package.json
#   server/use-case-package.json
node server/import-use-case.js
```

Usa la primera organización de la base de datos. Asegura tener ya `npm run seed` o una org creada.

Atajo con npm script:

```bash
npm run import-use-case -- ./exports/mi-package.json
```

## Validar antes de importar (recomendado)

### API de validación

```bash
curl -X POST http://localhost:3001/api/use-case/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d @use-case-package.json
```

### Dry run de import

```bash
curl -X POST "http://localhost:3001/api/use-case/import?dryRun=true" \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d @use-case-package.json
```

## Ejemplo end-to-end (export -> validate -> import)

```bash
# 1) Exportar entities Repsol
npm run export-repsol-entities

# 2) Validar package
curl -X POST http://localhost:3001/api/use-case/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d @server/repsol-entities-package.json

# 3) Probar import sin escribir en DB
curl -X POST "http://localhost:3001/api/use-case/import?dryRun=true" \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d @server/repsol-entities-package.json

# 4) Import real
curl -X POST http://localhost:3001/api/use-case/import \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d @server/repsol-entities-package.json
```

## Estructura del JSON

```json
{
  "name": "Planta Plástico Repsol",
  "version": "1.0",
  "entities": [ ... ],
  "records": [ ... ],
  "workflow": { ... },
  "simulation": { ... },
  "dashboard": { ... }
}
```

- **name**, **version**: metadatos (opcionales).
- **entities**: obligatorio.
- **records**: obligatorio (puede ser `[]`).
- **workflow**: obligatorio para tener simulación en Lab.
- **simulation**: obligatorio para el caso de uso Lab.
- **dashboard**: opcional.

---

### `entities`

Array de entidades. Cada elemento:

```json
{
  "id": "ent_extrusoras",
  "name": "Extrusoras",
  "description": "Líneas de extrusión...",
  "author": "System",
  "lastEdited": "Today",
  "properties": [
    {
      "id": "p_ext_nombre",
      "name": "Nombre Línea",
      "type": "text",
      "defaultValue": "",
      "relatedEntityId": null,
      "unit": null
    }
  ]
}
```

- **id**: único en el paquete.
- **properties**: cada una con `id`, `name`, `type` (`text`, `number`, `relation`, etc.), y opcionalmente `defaultValue`, `relatedEntityId`, `unit`.

---

### `records`

Array de registros. Cada elemento:

```json
{
  "id": "r_ext_1",
  "entityId": "ent_extrusoras",
  "values": {
    "p_ext_nombre": "EXT-001 HDPE Film",
    "p_ext_capacidad": "4.5"
  }
}
```

- **entityId** debe coincidir con `entities[].id`.
- **values**: mapa `propertyId` → valor (string o número; relaciones como array de IDs en JSON string si aplica).

---

### `workflow`

```json
{
  "id": "wf_plastics_sim",
  "name": "Simulación Producción Plástico O&G",
  "tags": ["simulación", "plástico", "oil-gas"],
  "data": {
    "nodes": [
      { "id": "n_trigger", "type": "trigger", "label": "Iniciar", "x": 80, "y": 300 },
      { "id": "n_fetch", "type": "fetchData", "config": { "entityId": "ent_produccion", "entityName": "Producción Diaria" }, ... }
    ],
    "connections": [
      { "id": "c1", "fromNodeId": "n_trigger", "toNodeId": "n_fetch" }
    ]
  }
}
```

- **id**: único.
- **data.nodes** y **data.connections**: mismo formato que usa el editor de workflows en la app.

---

### `simulation`

Experimento en Lab vinculado al workflow.

```json
{
  "id": "sim_plastics_prod",
  "name": "Producción Plástico O&G",
  "description": "Simulación P&L planta...",
  "workflowId": "wf_plastics_sim",
  "workflowName": "Simulación Producción Plástico O&G",
  "parameters": [
    {
      "id": "sp_precio_resina",
      "nodeId": "n_precio_resina",
      "variableName": "precio_resina",
      "label": "Precio Resina",
      "description": "...",
      "controlType": "slider",
      "config": { "min": 800, "max": 2500, "step": 10, "unit": "USD/ton", "defaultValue": 1350 },
      "order": 0
    }
  ],
  "visualizations": [
    { "id": "v_prod", "type": "kpi", "title": "Producción Mensual", "dataMapping": { "source": "produccion_mensual", "format": "number" }, "position": { "x": 0, "y": 0, "w": 1, "h": 1 }, "color": "#256A65" }
  ],
  "savedScenarios": [
    { "id": "sc_base", "name": "Escenario Base", "description": "...", "parameterValues": { "sp_precio_resina": 1350, ... }, "createdAt": "2026-02-09T..." }
  ],
  "calculationCode": "// JavaScript opcional para cálculo en el cliente; si no se pone, se usa el workflow."
}
```

- **workflowId** debe ser el **id** del objeto `workflow` del mismo JSON.
- **parameters[].nodeId** debe existir en `workflow.data.nodes`.
- **calculationCode**: opcional; si está definido, Lab puede usarlo para ejecutar la simulación en el cliente sin depender del backend.

---

### `dashboard` (opcional)

```json
{
  "id": "dash_plastics_repsol",
  "name": "Dashboard Planta Plástico Repsol",
  "description": "KPIs y tendencias",
  "widgets": [
    {
      "id": "w1",
      "title": "Producción Mensual",
      "description": "",
      "config": { "type": "kpi", "entityId": "ent_produccion", ... },
      "gridX": 0,
      "gridY": 0,
      "gridWidth": 4,
      "gridHeight": 3
    }
  ]
}
```

- **widgets**: mismo formato que espera la API de dashboards (config depende del tipo de widget).

---

## Orden de creación en el import

1. Entidades (y propiedades)
2. Registros (y record_values)
3. Workflow
4. Simulación (Lab)
5. Dashboard y widgets (si vienen en el JSON)

Todo se asocia a la **primera organización** existente en la base de datos. Asegúrate de tener ya usuarios y organización (por ejemplo con `npm run seed`).
