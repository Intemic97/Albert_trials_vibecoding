# Diseño: Entidades con Fuente Externa de Gobernanza

> Permite que las entidades no vivan solo en la plataforma: cada vez que se referencia una entidad, se puede leer desde una **fuente de gobernanza** externa (single source of truth).

---

## 1. Concepto

**Hoy**: Entidades y propiedades viven en `entities` y `properties` (SQLite local).

**Objetivo**: Poder definir entidades cuya **definición** (schema) viene de un sistema externo de gobernanza de datos. La plataforma Intemic resuelve el schema desde esa fuente en lugar de (o además de) la base local.

```
┌─────────────────────────────────────────────────────────────────┐
│  Plataforma Intemic                                              │
│                                                                  │
│   Referencia a Entidad "Extrusoras"                              │
│            │                                                     │
│            ▼                                                     │
│   ┌─────────────────────┐                                        │
│   │  Entity Resolver    │                                        │
│   │  source = ?         │                                        │
│   └─────────┬───────────┘                                        │
│             │                                                    │
│    ┌────────┴────────┐                                            │
│    ▼                 ▼                                           │
│  LOCAL            EXTERNAL                                       │
│  (SQLite)          (HTTP → Governance)                            │
│    │                    │                                        │
└────┼────────────────────┼────────────────────────────────────────┘
     │                    │
     │                    ▼
     │         ┌──────────────────────┐
     │         │  Sistema Gobernanza  │  ← Fuente única de verdad
     │         │  (Collibra, Alation, │     Datos armazenados y seguros
     │         │   Custom API, etc.)  │
     │         └──────────────────────┘
     │
     ▼
  Base de datos local
```

---

## 2. Modelo de datos propuesto

### 2.1 Extensión de `entities`

Añadir columnas para soportar fuente externa:

```sql
-- Migración
ALTER TABLE entities ADD COLUMN source TEXT DEFAULT 'local';  -- 'local' | 'external'
ALTER TABLE entities ADD COLUMN externalSourceId TEXT;        -- ID en el sistema externo
ALTER TABLE entities ADD COLUMN sourceConfig TEXT;            -- JSON: { url, authType, ... }
```

| source    | Significado                                                                 |
|-----------|-----------------------------------------------------------------------------|
| `local`   | Definición en platform (actual). Schema en `entities` + `properties`.       |
| `external`| Schema se obtiene desde la source configurada. Solo guardamos referencia.   |

### 2.2 Configuración de fuente a nivel organización (alternativa)

En lugar de por entidad, la org puede tener una "conexión de gobernanza" global:

```sql
CREATE TABLE entity_sources (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'rest' | 'collibra' | 'alation' | 'custom'
  baseUrl TEXT NOT NULL,
  authType TEXT,                -- 'none' | 'apiKey' | 'oauth2' | 'basic'
  authConfig TEXT,              -- JSON: { apiKeyHeader, apiKey } o similar
  entityIdMapping TEXT,         -- JSON: cómo mapear IDs externos ↔ internos
  cacheTtlSeconds INTEGER DEFAULT 300,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY(organizationId) REFERENCES organizations(id)
);

-- entities puede apuntar a una source
ALTER TABLE entities ADD COLUMN entitySourceId TEXT REFERENCES entity_sources(id);
```

---

## 3. Contrato de la API externa (source)

Para que una fuente externa sea válida, debe exponer al menos:

### 3.1 Obtener una entidad por ID

```
GET {baseUrl}/entities/{externalId}
Authorization: {según authConfig}
```

**Respuesta esperada** (ejemplo):

```json
{
  "id": "ext_extrusoras",
  "name": "Extrusoras",
  "description": "Líneas de extrusión de polietileno...",
  "properties": [
    { "name": "Nombre Línea", "type": "text", "unit": null },
    { "name": "Capacidad (ton/h)", "type": "number", "unit": "ton/h" },
    { "name": "Temp Operación", "type": "number", "unit": "°C" }
  ]
}
```

### 3.2 Listar entidades (opcional)

```
GET {baseUrl}/entities
```

Para poblar el selector de entidades en la UI sin tener que crearlas localmente.

---

## 4. Entity Resolver (abstracción)

Servicio central que devuelve el schema de una entidad desde local o externa:

```javascript
// server/services/entityResolver.js

async function getEntitySchema(db, orgId, entityId) {
  const entity = await db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [entityId, orgId]);
  if (!entity) return null;

  if (entity.source === 'local' || !entity.source) {
    return resolveLocal(db, entity);
  }

  if (entity.source === 'external') {
    return resolveExternal(db, entity);
  }

  return null;
}

async function resolveLocal(db, entity) {
  const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entity.id]);
  return { ...entity, properties };
}

async function resolveExternal(db, entity) {
  const config = JSON.parse(entity.sourceConfig || '{}');
  const cached = await getFromCache(entity.id, config.cacheTtlSeconds);
  if (cached) return cached;

  const response = await fetchFromGovernance(config, entity.externalSourceId);
  await setCache(entity.id, response, config.cacheTtlSeconds);
  return response;
}
```

---

## 5. Puntos de integración en la plataforma

| Punto                      | Hoy                               | Con source externa                             |
|----------------------------|-----------------------------------|------------------------------------------------|
| `buildDatabaseContext`     | `SELECT * FROM entities`          | Usar `entityResolver.getEntitySchema`          |
| `GET /api/entities`        | Lista desde DB                    | Merge local + entidades de source externa      |
| `GET /api/entities/:id`    | Desde DB                          | `entityResolver.getEntitySchema`               |
| Copilot / agentes         | Contexto desde DB                 | Idem, resolver por entidad                     |
| Workflows (fetchData)      | Consulta entities/records         | Schema desde resolver; records pueden seguir local |
| Dashboards                 | Widgets con entityId              | Resolver schema para configuración            |
| Use case import            | Crea entities en DB                | Puede crear referencias a externas (solo id + source) |

---

## 6. Datos: schema vs records

**Importante**: La gobernanza suele ser la fuente de verdad del **schema** (qué entidades existen, qué propiedades tienen). Los **records** (datos) pueden seguir viviendo en la plataforma o en otro sistema.

- **Schema (metadata)** → puede venir de governance
- **Records (datos)** → pueden ser:
  - Locales (actual) – la plataforma los almacena
  - Externos – si el governance o un data lake expone API de datos; requeriría otro contrato

Para el MVP, se recomienda:
- **Schema**: Resolver desde governance cuando `source=external`
- **Records**: Mantener en plataforma (tablas `records`, `record_values`). La relación sería: `entityId` en records es una referencia; el schema de esa entidad se resuelve desde la source.

---

## 7. Flujo de configuración (UX)

1. **Admin** entra en Ajustes → Gobernanza / Fuentes de datos
2. Crea una **Entity Source**: nombre, URL base, tipo de auth, opciones de cache
3. **Al crear/editar entidad**:
   - Opción "Definida en plataforma" (local) – comportamiento actual
   - Opción "Desde fuente de gobernanza" – selecciona source + ID externo (o picker si la source expone listado)
4. La entidad queda como **referencia**: `source=external`, `externalSourceId`, `entitySourceId` (o `sourceConfig` embebido)

---

## 8. Consideraciones de seguridad

- **Credenciales**: Nunca en frontend. `authConfig` en `entity_sources` cifrado o en variables de entorno por source
- **Validación de URL**: Solo permitir HTTPS para sources externas
- **Rate limiting**: Límites al llamar a APIs externas para no saturarlas
- **Cache**: Respetar `cacheTtlSeconds` para reducir llamadas y mejorar resiliencia si la source cae
- **Timeout**: Timeout en fetches para no bloquear la plataforma

---

## 9. Roadmap sugerido

### Fase 1 (MVP)
- [ ] Tabla `entity_sources` y migración en `entities`
- [ ] `entityResolver.getEntitySchema` con soporte local
- [ ] Integrar resolver en `buildDatabaseContext` para `source=external`
- [ ] Un adaptador REST genérico: `GET {baseUrl}/entities/{id}` → schema estándar

### Fase 2
- [ ] UI: Configuración de entity sources en Settings
- [ ] UI: Al crear entidad, opción "Desde gobernanza"
- [ ] Cache en Redis o en memoria con TTL
- [ ] Listar entidades desde source externa (si la API lo permite)

### Fase 3
- [ ] Adaptadores específicos: Collibra, Alation
- [ ] Records desde source externa (si aplica)
- [ ] Sincronización programada (schema puede cambiar en governance)

---

## 10. Ejemplo de `sourceConfig` (por entidad, modo simplificado)

```json
{
  "type": "rest",
  "baseUrl": "https://governance.empresa.com/api/v1",
  "authType": "apiKey",
  "apiKeyHeader": "X-API-Key",
  "entityPath": "/data-assets/{id}",
  "cacheTtlSeconds": 300
}
```

El `externalSourceId` en la entidad sería el ID del asset en ese sistema (ej. `asset-uuid-123`).

---

## Resumen

- **Entidades con source externa**: La definición (schema) se resuelve desde un sistema de gobernanza en cada uso.
- **Single source of truth**: El governance es quien define qué entidades y propiedades existen.
- **Implementación**: Entity Resolver + tabla `entity_sources` + integración en `buildDatabaseContext` y APIs de entidades.
- **Records**: En MVP se mantienen en plataforma; en fases posteriores se puede extender a datos externos.
