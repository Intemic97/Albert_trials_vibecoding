# Arquitectura Copilots Multi-Agente

## Concepto Central

**Agentes → Chats** (jerarquía invertida)

Los **Agentes** son ahora los contenedores principales (equipos/workspaces especializados), y los **Chats** son conversaciones que viven dentro de cada agente.

```
Agente Repsol 🏭
├─ Chat: Análisis producción Q1
├─ Chat: Optimización refinería
└─ Chat: Seguridad planta Barcelona

Agente Vallformosa 🍷
├─ Chat: Cosecha 2024
├─ Chat: Control calidad
└─ Chat: Exportaciones

Agente Finanzas 💰
├─ Chat: Presupuesto 2024
└─ Chat: Análisis cashflow
```

---

## Modelo de Datos

### `copilot_agents` (Contenedor Principal)
```sql
CREATE TABLE copilot_agents (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  name TEXT NOT NULL,                  -- ej. "Agente Repsol"
  description TEXT,                    -- Descripción breve
  icon TEXT DEFAULT '🤖',              -- Emoji identificador
  instructions TEXT,                   -- Instrucciones base para todos los chats
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

**Cada agente configura sus 4 roles internos:**
- **Orchestrator**: decide qué agentes usar
- **Analyst**: consulta datos/entidades
- **Specialist**: aporta expertise del dominio
- **Synthesis**: combina outputs

Si los prompts están vacíos, usa defaults del sistema (`ROLE_BASES` en `agentPromptBuilder.js`).

---

### `copilot_chats` (Conversaciones dentro del agente)
```sql
ALTER TABLE copilot_chats ADD COLUMN agentId TEXT;
```

Cada chat pertenece a un agente. El agentId se usa para:
1. Filtrar chats en la UI
2. Cargar configuración del agente al hacer ask

---

### `agent_conversations` (Log inter-agente)
Sin cambios. Registra mensajes entre roles (orchestrator → analyst → specialist → synthesis) por turnIndex.

---

## Backend

### Services

#### `agentService.js`
```javascript
list(db, orgId)        // Lista agentes del org
get(db, id, orgId)     // Obtiene un agente
create(db, orgId, payload)  // Crea nuevo agente
update(db, id, orgId, payload)  // Actualiza agente
remove(db, id, orgId)  // Elimina agente (y sus chats)
seedDefaults(db, orgId)  // Crea "Asistente General" por defecto
```

**Seed default**: cuando un org no tiene agentes, crea:
```javascript
{
  name: 'Asistente General',
  description: 'Tu copiloto para consultas generales sobre entidades y datos',
  icon: '💬',
  instructions: 'Ayuda al usuario a navegar sus entidades...'
}
```

---

#### `agentOrchestrator.js`
```javascript
process(db, { agentId, userMessage, chatId, conversationHistory, ... })
```

**Cambio principal**: ahora recibe `agentId` (requerido). Carga el agente y usa sus prompts personalizados:

```javascript
const agent = await agentService.get(db, agentId, orgId);

// Construye config para cada rol con el prompt custom o default
const orchAgentConfig = {
  role: 'orchestrator',
  systemPrompt: agent.orchestratorPrompt,  // custom o null → usa ROLE_BASES
  temperature: 0.3,
  maxTokens: 1500
};

const orchPrompt = buildPrompt(orchAgentConfig, context);
const result = await callLLM(orchAgentConfig, messages);
```

Igual para `analystConfig`, `specialistConfig`, `synthesisConfig`.

---

#### `agentPromptBuilder.js`
Sin cambios significativos. `buildPrompt()` ahora recibe un `agentConfig` con `systemPrompt` opcional.

Si `systemPrompt` está vacío, usa `ROLE_BASES[agentConfig.role]`.

---

### Endpoints

#### Agentes
```
GET    /api/copilot/agents          → lista agentes del org
GET    /api/copilot/agents/:id      → detalle de agente
POST   /api/copilot/agents          → crea agente { name, description, icon, instructions, ... }
PUT    /api/copilot/agents/:id      → actualiza agente
DELETE /api/copilot/agents/:id      → elimina agente (y sus chats)
```

#### Chats (modificado)
```
POST   /api/copilot/chats           → body incluye agentId
PUT    /api/copilot/chats/:chatId   → body incluye agentId
```

#### Ask (modificado)
```
POST   /api/copilot/ask
body: {
  question, conversationHistory, chatId,
  agentId,  // <-- nuevo: requerido
  instructions, allowedEntities, mentionedEntities, useMultiAgent
}
```

Si no hay `agentId` en body, intenta cargar de `chatId`. Si aún no hay, usa el primer agente del org como fallback.

---

## Frontend

### Flujo de Usuario

1. **Home: Lista de Agentes** (`AgentsList.tsx`)
   - Grid de cards con icono, nombre, descripción
   - Botón "Nuevo Agente"
   - Click en agente → setActiveAgent(id)

2. **Vista del Agente: Sidebar + Chats**
   - Breadcrumb: `[← Agentes] > [Agent icon + name] > [Configurar]`
   - Sidebar: chats filtrados por `agentId`
   - Botón "Nuevo Chat" crea chat con `agentId` actual
   - Main: conversación

3. **Configurar Agente** (`AgentConfigModal.tsx`)
   - Tabs: General, Orchestrator, Analyst, Specialist, Synthesis
   - **General**: name, icon, description, instructions, allowedEntities, folderIds
   - **Roles**: editar prompts personalizados (textarea) para cada rol
   - "Si está vacío, se usa el prompt base del rol"

---

### Componentes Nuevos

#### `AgentsList.tsx`
Props: `{ onSelectAgent, onCreateAgent }`

Muestra grid de agentes. Si no hay ninguno, botón "Crear primer agente".

---

#### `AgentConfigModal.tsx`
Props: `{ agent, onClose, onSave }`

Modal con 5 tabs:
- **General**: name, description, icon, instructions, allowedEntities, folderIds
- **Orchestrator**: textarea para `orchestratorPrompt`
- **Analyst**: textarea para `analystPrompt`
- **Specialist**: textarea para `specialistPrompt`
- **Synthesis**: textarea para `synthesisPrompt`

Al guardar → PUT `/api/copilot/agents/:id`

---

### `Copilots.tsx` (Refactorizado)

#### State
```tsx
const [agents, setAgents] = useState<Agent[]>([]);
const [activeAgent, setActiveAgent] = useState<string | null>(null);
const [chats, setChats] = useState<Chat[]>([]);
const [activeChat, setActiveChat] = useState<string | null>(null);
const [showAgentConfig, setShowAgentConfig] = useState(false);
```

#### Render Condicional
```tsx
if (!activeAgent) {
  return <AgentsList onSelectAgent={handleSelectAgent} onCreateAgent={handleCreateAgent} />;
}
// Else: render current chat view with sidebar filtered by activeAgent
```

#### Filtrado de Chats
```tsx
const filteredChats = chats
  .filter(chat => {
    if (activeAgent && chat.agentId !== activeAgent) return false;
    // ... search filter, tags filter
  })
```

#### Breadcrumb Header
```
[← Agentes]  |  [🤖 Agente Repsol]  |  [Configurar agente]
```

#### API Call con agentId
```tsx
fetch(`${API_BASE}/copilot/ask`, {
  body: JSON.stringify({
    question,
    agentId: activeAgent,  // <-- nuevo
    chatId,
    ...
  })
})
```

---

## Caso de Uso: Repsol

1. **Crear Agente Repsol**:
   - Name: "Agente Repsol"
   - Icon: 🏭
   - Description: "Especializado en producción, refinería y seguridad industrial"
   - Instructions: "Eres un experto en plantas industriales. Prioriza seguridad, normativas y eficiencia."
   - allowedEntities: [Plantas, Producción, Seguridad, Mantenimiento]
   - folderIds: [Manuales técnicos, Normativa ISO]

2. **Configurar Prompts**:
   - **Analyst**: "Cuando analices producción, incluye métricas de seguridad y menciona siempre las unidades de medida."
   - **Specialist**: "Al sugerir optimizaciones, considera normativa de seguridad vigente. Menciona impacto en KPIs clave."
   - **Orchestrator/Synthesis**: defaults

3. **Crear Chats**:
   - "Análisis producción Q1"
   - "Optimización refinería Barcelona"
   - "Incidentes seguridad enero"

4. **Usuario pregunta**: "¿Cuántos incidentes tuvimos el mes pasado en la planta de Barcelona?"
   - Orchestrator → Analyst (datos) + Specialist (contexto de seguridad)
   - Analyst consulta entidad Seguridad
   - Specialist aporta: "3 incidentes, 2 menores y 1 moderado. Cumplimos normativa pero recomiendo reforzar protocolo X."
   - Synthesis combina → respuesta final

---

## Caso de Uso: Vallformosa (Bodega)

1. **Crear Agente Vallformosa**:
   - Name: "Agente Vallformosa"
   - Icon: 🍷
   - Description: "Especializado en enología, cosecha y exportaciones"
   - Instructions: "Eres un experto en vinos. Habla de temperatura, acidez, variedades de uva, crianza."
   - allowedEntities: [Vinos, Cosechas, Barricas, Exportaciones]
   - folderIds: [Catas históricas, Fichas técnicas]

2. **Configurar Prompts**:
   - **Analyst**: "Al analizar cosechas, menciona variedades de uva, clima y rendimiento."
   - **Specialist**: "Al recomendar crianza, considera perfil del vino y mercado objetivo. Sugiere maridajes."

3. **Chats**:
   - "Cosecha 2024 Cabernet"
   - "Control calidad lote A"
   - "Exportaciones Q1"

---

## Migración de Datos Existentes

**Chats sin agentId**: el sistema crea un "Asistente General" por defecto. Los chats antiguos quedan sin `agentId`, pero el frontend filtra: si `activeAgent` y `chat.agentId !== activeAgent` → no se muestra.

Para migrar chats antiguos a un agente:
```sql
UPDATE copilot_chats SET agentId = 'agent_default_xxx' WHERE agentId IS NULL;
```

---

## Beneficios del Nuevo Flujo

1. **Especialización**: cada agente tiene contexto específico (entidades, knowledge, prompts)
2. **Claridad**: user sabe qué "equipo" está usando
3. **Escalabilidad**: fácil añadir agentes nuevos (ej. Agente Legal, Agente Marketing)
4. **Personalización**: prompts editables por rol → adapta comportamiento sin cambiar código
5. **Organización**: chats agrupados por agente → menos clutter

---

## Próximos Pasos (Opcional)

- **Templates de agentes**: Galería de agentes pre-configurados ("Agente de Finanzas", "Agente de Producción")
- **Compartir agentes**: copiar config de agente entre orgs
- **Analytics por agente**: métricas de uso (cuántos chats, consultas más comunes)
- **Memory agent**: agente de memoria persistente (recordar preferencias del user)
- **Multi-agente en paralelo**: orchestrator llama analyst + specialist en paralelo (Promise.all)
