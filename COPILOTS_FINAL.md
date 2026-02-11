# Copilots Multi-Agente - Arquitectura Final

## 🎯 Concepto

**Chats como entidad principal + Agentes como templates compartidos**

Los **Chats** son conversaciones independientes, y pueden usar opcionalmente un **Agente** (template compartido con configuración predefinida, conocimiento y contexto de la empresa).

```
Chats (principal):
├─ Chat: Análisis producción Q1 (usa Agente Industrial 🏭)
├─ Chat: Inventario 2024 (usa Agente Logística 🍷)
├─ Chat: Presupuesto 2024 (usa Agente Finanzas 💰)
└─ Chat: Consulta general (sin agente, configuración manual)

Librería de Agentes (templates compartidos):
├─ 🏭 Agente Industrial (producción, seguridad, normativas)
├─ 🍷 Agente Logística (distribución, inventario, exportaciones)
├─ 💰 Agente Finanzas (análisis financiero, presupuestos)
└─ 📊 Agente Marketing (campañas, métricas, audiencia)
```

---

## 🏗️ Flujo de Usuario

### 1. Vista Principal: Chats
- Sidebar con lista de chats
- Crear nuevo chat → modal con selector de agente opcional
- Header muestra badge del agente asignado (si existe)

### 2. Librería de Agentes
- Botón "Librería de Agentes" en sidebar
- Grid de cards con templates compartidos
- Cada card muestra: icon, nombre, descripción, # entidades, # carpetas knowledge
- Acciones: "Usar", "Configurar", "Eliminar"

### 3. Crear Chat con Agente
1. Click "Nuevo Chat"
2. (Opcional) Click "Seleccionar agente de la librería"
3. Elige template → se pre-configura con:
   - Instrucciones base del agente
   - Entidades permitidas
   - Knowledge base (carpetas de docs)
   - Prompts personalizados (Orchestrator, Analyst, Specialist, Synthesis)
4. Chat hereda configuración del agente

### 4. Chat sin Agente
- Configuración manual: nombre, instrucciones, entidades
- Usa prompts base del sistema (sin personalización)

---

## 📊 Modelo de Datos

### `copilot_agents` (Templates compartidos)
```sql
CREATE TABLE copilot_agents (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  name TEXT NOT NULL,                  -- ej. "Agente Industrial"
  description TEXT,                    -- Descripción breve
  icon TEXT DEFAULT '🤖',              -- Emoji identificador
  instructions TEXT,                   -- Instrucciones base compartidas
  allowedEntities TEXT,                -- JSON array: entidades accesibles
  folderIds TEXT,                      -- JSON array: carpetas de conocimiento
  orchestratorPrompt TEXT,             -- Prompt personalizado del orquestador
  analystPrompt TEXT,                  -- Prompt personalizado del analista
  specialistPrompt TEXT,               -- Prompt personalizado del especialista
  synthesisPrompt TEXT,                -- Prompt personalizado de síntesis
  sortOrder INTEGER DEFAULT 0,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY(organizationId) REFERENCES organizations(id)
)
```

**Los agentes son templates compartidos a nivel organizacional.**
- Múltiples chats pueden usar el mismo agente
- Cambiar el agente actualiza la configuración de todos los chats que lo usan
- Los agentes son **compartidos** → cambios afectan a toda la organización

---

### `copilot_chats` (Conversaciones)
```sql
-- Ya existe, solo se añadió:
ALTER TABLE copilot_chats ADD COLUMN agentId TEXT;  -- FK opcional a copilot_agents
```

**Cada chat puede:**
- Tener un `agentId` → hereda configuración del template
- No tener `agentId` → configuración manual tradicional

---

## 🔧 Backend

### Services

#### `agentService.js` (sin cambios)
```javascript
list(db, orgId)        // Lista templates de agentes
get(db, id, orgId)     // Obtiene un template
create(db, orgId, payload)  // Crea nuevo template
update(db, id, orgId, payload)  // Actualiza template
remove(db, id, orgId)  // Elimina template
seedDefaults(db, orgId)  // Crea "Asistente General" por defecto
```

#### `agentOrchestrator.js`
```javascript
process(db, { agentId, userMessage, chatId, ... })
```

**Si el chat tiene `agentId`:**
1. Carga el template del agente
2. Usa `orchestratorPrompt`, `analystPrompt`, `specialistPrompt`, `synthesisPrompt` del template
3. Usa `allowedEntities` y `folderIds` del template para construir contexto
4. Si prompts están vacíos, usa defaults del sistema

**Si el chat NO tiene `agentId`:**
- Usa configuración manual del chat (instructions, allowedEntities)
- Usa prompts base del sistema

---

### Endpoints

#### Agentes (Templates)
```
GET    /api/copilot/agents          → lista templates
GET    /api/copilot/agents/:id      → detalle de template
POST   /api/copilot/agents          → crea template
PUT    /api/copilot/agents/:id      → actualiza template
DELETE /api/copilot/agents/:id      → elimina template
```

#### Chats
```
POST   /api/copilot/chats           → body incluye agentId opcional
PUT    /api/copilot/chats/:chatId   → body incluye agentId opcional
```

#### Ask
```
POST   /api/copilot/ask
body: {
  question, conversationHistory, chatId,
  agentId,  // <-- opcional: si está, usa template del agente
  instructions, allowedEntities, mentionedEntities, useMultiAgent
}
```

---

## 🎨 Frontend

### Componentes Principales

#### `Copilots.tsx` (Refactorizado)
- Vista principal: sidebar de chats + conversación
- Header: badge con icono/nombre del agente (si está asignado)
- Sidebar: botón "Librería de Agentes"
- Modal de crear/editar chat: selector de agente opcional

#### `AgentLibrary.tsx` (Nuevo)
Modal con:
- Grid de cards de templates (icon, nombre, descripción, # entidades/folders)
- Botón "Nuevo Agente" → modal de creación simple (icon, nombre, descripción)
- Botón "Usar" → asigna template al chat actual
- Botón "Configurar" → abre `AgentConfigModal`
- Botón "Eliminar" → borra template (chats que lo usan siguen funcionando)

#### `AgentConfigModal.tsx` (Ya existente)
Modal con 5 tabs:
- **General**: name, icon, description, instructions, allowedEntities, folderIds
- **Orchestrator**: textarea para `orchestratorPrompt`
- **Analyst**: textarea para `analystPrompt`
- **Specialist**: textarea para `specialistPrompt`
- **Synthesis**: textarea para `synthesisPrompt`

---

## 💡 Casos de Uso

### Ejemplo 1: Agente Industrial (Producción)

**Crear template:**
```
Name: Agente Industrial
Icon: 🏭
Description: Especializado en producción, refinería y seguridad industrial
Instructions: Eres un experto en plantas industriales. Prioriza seguridad, normativas EU y eficiencia.
AllowedEntities: [Plantas, Producción, Seguridad, Mantenimiento]
FolderIds: [Manuales técnicos, Normativa ISO]

Prompts personalizados:
- Analyst: "Cuando analices producción, incluye métricas de seguridad. Menciona unidades de medida."
- Specialist: "Al sugerir optimizaciones, considera normativa vigente y impacto en KPIs."
```

**Usar en chats:**
- Usuario crea "Chat: Análisis producción Q1" → selecciona Agente Industrial
- Usuario crea "Chat: Incidentes seguridad" → selecciona Agente Industrial
- Usuario crea "Chat: Optimización planta A" → selecciona Agente Industrial

Todos los chats comparten el contexto y configuración del Agente Industrial. Si se actualiza el agente (ej. añadir nueva carpeta de docs), afecta a todos.

---

### Ejemplo 2: Agente Logística (Distribución)

**Crear template:**
```
Name: Agente Logística
Icon: 🍷
Description: Especializado en distribución, inventario y exportaciones
Instructions: Eres un experto en logística. Habla de almacenamiento, rutas, tiempos de entrega.
AllowedEntities: [Productos, Almacenes, Pedidos, Exportaciones]
FolderIds: [Políticas logística, Fichas técnicas]

Prompts:
- Analyst: "Al analizar inventario, menciona rotación, stock y puntos de reorden."
- Specialist: "Al recomendar rutas, considera costos, tiempos y capacidad. Sugiere optimizaciones."
```

**Usar en chats:**
- "Chat: Inventario Q1" → Agente Logística
- "Chat: Control calidad lote A" → Agente Logística
- "Chat: Exportaciones regionales" → Agente Logística

---

## 🔄 Diferencia vs Arquitectura Anterior (Revertida)

### Antes (Revertido):
```
Agentes (contenedores principales)
└─ Chats dentro de cada agente
```
- Navegación: Home → Seleccionar Agente → Ver chats del agente
- Problema: forzaba a usuarios a pensar en "equipos" primero

### Ahora (Final):
```
Chats (principal)
└─ Opcionalmente usan Agente (template compartido)
```
- Navegación: Home → Chats (como siempre)
- Botón opcional: "Librería de Agentes" para templates
- Más natural: usuario piensa en "quiero un chat" → opcionalmente elige template

---

## 🚀 Beneficios

1. **Flexibilidad**: chats pueden usar agente o no
2. **Compartido**: agentes son templates reutilizables (no contenedores)
3. **Consistencia**: múltiples chats con misma configuración
4. **Escalabilidad**: fácil crear nuevos templates (ej. Agente Legal, Agente Marketing)
5. **Mantenibilidad**: actualizar agente → afecta a todos los chats que lo usan
6. **Conocimiento empresarial**: agentes tienen contexto, PDFs, normativas pre-cargadas

---

## 🎯 Flujo Completo

### Crear Agente Template:
1. Sidebar → "Librería de Agentes"
2. Grid de templates → "Nuevo Agente"
3. Introducir: icon 🏭, nombre "Agente Industrial", descripción
4. Click en card "Agente Industrial" → "Configurar"
5. Tab "General": seleccionar entidades, carpetas de knowledge
6. Tab "Analyst": escribir prompt personalizado
7. Tab "Specialist": escribir prompt personalizado
8. Guardar → template queda en librería

### Usar Agente en Chat:
1. Sidebar → "Nuevo Chat"
2. Modal: escribir nombre "Análisis producción Q1"
3. Sección "Agente Especializado" → "Seleccionar agente de la librería"
4. Grid modal → click "Usar" en "Agente Repsol"
5. Chat se crea con configuración del agente
6. Header muestra badge: 🏭 Agente Repsol

### Chat sin Agente:
1. Sidebar → "Nuevo Chat"
2. Modal: escribir nombre, instrucciones manuales, seleccionar entidades
3. NO seleccionar agente
4. Chat usa configuración manual tradicional

---

## 📝 Notas Técnicas

- Los agentes son **inmutables para chats existentes**: si cambias un agente, los chats que ya lo usan NO se actualizan automáticamente en sus mensajes guardados, pero SÍ usan la config actualizada para nuevas preguntas.
- Si eliminas un agente, los chats que lo usan siguen funcionando pero con prompts base (ya no tienen acceso a la config del agente eliminado).
- `seedDefaults` crea un "Asistente General" por defecto cuando un org no tiene agentes.
- Los agentes son **organizacionales**: todos los usuarios de una org ven los mismos templates.

---

## 🔮 Próximos Pasos (Opcional)

- **Templates predefinidos**: Galería de agentes pre-configurados por industria (Producción, Legal, Marketing, Finanzas, etc.)
- **Compartir agentes entre orgs**: Exportar/importar templates
- **Versioning de agentes**: historial de cambios en templates
- **Analytics**: métricas de uso de cada agente (cuántos chats, consultas más comunes)
- **Memory agent**: agente persistente que recuerda preferencias del usuario
- **Auto-suggest agent**: sugerir agente basado en la pregunta del usuario
