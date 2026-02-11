# Plan: Copilots como Sistema Multi-Agente Orgánico

> Arquitectura propuesta para que la página de Copilots evolucione hacia un sistema donde múltiples agentes/Inteligencias se comunican entre sí, formando un organismo vivo de conocimiento.

---

## 1. Situación actual

- **Un solo agente por chat**: Usuario ↔ Copilot (GPT-4) con instrucciones y entidades.
- **Flujo**: `User message → /api/database/ask → single LLM → response`.
- **Límite**: No hay cooperación entre agentes ni especialización distribuida.

---

## 2. Visión: Organismo de inteligencias

El sistema pasa de **un chat con un asistente** a **una red de agentes que cooperan**:

```
                    ┌─────────────┐
                    │   Usuario   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Orquestador │  ← Decide qué agentes activar y cómo coordinar
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌─────▼─────┐      ┌────▼────┐
   │ Analista│◄──────►│ Especialista│◄───►│ Síntesis│
   │  Datos  │        │  Dominio   │      │ Final   │
   └────┬────┘        └─────┬─────┘      └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │ Memoria /   │  ← Contexto compartido, histórico de decisiones
                    │ Conocimiento│
                    └────────────┘
```

---

## 3. Arquitectura propuesta

### 3.1 Tipos de agentes

| Agente | Rol | Conocimiento | Se activa cuando |
|--------|-----|--------------|------------------|
| **Orquestador** | Interpreta la intención, decide qué agentes usar y el flujo de conversación | Todo el contexto del usuario | Siempre (primer punto de entrada) |
| **Analista de Datos** | Consulta entidades, hace agregaciones, cruces | `allowedEntities` del chat, schema | "¿Cuántos X?", "Lista los Y", "Relaciona A con B" |
| **Especialista de Dominio** | Interpreta negocio, mejores prácticas, reglas | Instrucciones del copilot, KB (folders) | Preguntas conceptuales, recomendaciones |
| **Síntesis** | Integra respuestas de varios agentes en una sola respuesta coherente | Outputs de otros agentes | Siempre al final del ciclo |
| **Memoria** | Guarda decisiones, preferencias, patrones | Historial de conversaciones | "Recuerda que...", contextos largos |

### 3.2 Flujo de comunicación entre agentes

```
1. Usuario: "¿Qué clientes tenemos que no han pedido desde hace 6 meses?"

2. Orquestador → Analista de Datos:
   "Lista records de Clientes con última Order > 6 meses"
   
3. Analista → Orquestador:
   { clientes: [...], count: 12, entitiesUsed: ["Clientes", "Orders"] }

4. Orquestador → Especialista de Dominio:
   "Dados estos 12 clientes inactivos, sugiere estrategia de reenganche"

5. Especialista → Orquestador:
   "Propuesta: email personalizado, descuento 15%, llamada de bienvenida..."

6. Orquestador → Síntesis:
   "Combina: datos (12 clientes) + estrategia del experto en 1 respuesta amigable"

7. Síntesis → Usuario:
   "Hay 12 clientes sin pedidos en 6+ meses. Te propongo..."
```

### 3.3 Protocolo de mensajes entre agentes

Cada mensaje inter-agente lleva:

```typescript
interface AgentMessage {
  from: string;           // agentId
  to: string;              // agentId | "user"
  type: "query" | "response" | "handoff";
  content: string;
  data?: Record<string, unknown>;
  context?: {
    entitiesUsed?: string[];
    reasoning?: string;
  };
}
```

---

## 4. Modelo de datos

### 4.1 Agentes (nuevas tablas)

```sql
-- Define los agentes disponibles en la organización
CREATE TABLE copilot_agents (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,        -- orchestrator | analyst | specialist | synthesis | memory
  systemPrompt TEXT,
  allowedEntities TEXT,     -- JSON array
  createdAt TEXT,
  updatedAt TEXT
);

-- Registro de conversaciones inter-agentes (para debugging y mejora)
CREATE TABLE agent_conversations (
  id TEXT PRIMARY KEY,
  chatId TEXT NOT NULL,
  turnIndex INTEGER,
  fromAgent TEXT,
  toAgent TEXT,
  content TEXT,
  metadata TEXT,            -- JSON
  createdAt TEXT
);
```

### 4.2 Estructura de un mensaje en el chat

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'agent';  // 'agent' para mensajes inter-agentes visibles
  content: string;
  agentId?: string;         // Si role === 'agent'
  agentConversation?: AgentMessage[];  // Sub-mensajes entre agentes (colapsable)
  timestamp: Date;
}
```

---

## 5. UX: Cómo se ve para el usuario

### 5.1 Vista principal: conversación fluida

- El usuario solo ve su mensaje y la respuesta final.
- Opción **"Ver razonamiento"** para expandir el hilo de conversación entre agentes.

### 5.2 Vista expandida: organismo en acción

```
┌─────────────────────────────────────────────────────────────┐
│ Tu mensaje: "¿Qué clientes están inactivos?"                 │
└─────────────────────────────────────────────────────────────┘

  ┌─ Orquestador ─────────────────────────────────────────┐
  │ Interpretando: consulta datos + estrategia negocio     │
  └───────────────────────────────────────────────────────┘
       │
       ├─► Analista de Datos
       │   └─ "12 clientes sin Orders en 6+ meses"
       │
       ├─► Especialista
       │   └─ "Sugiero: email personalizado, descuento..."
       │
       └─► Síntesis
           └─ "Respuesta final generada"

┌─────────────────────────────────────────────────────────────┐
│ Respuesta: Hay 12 clientes inactivos. Te recomiendo...      │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Nodos de red (opcional, avanzado)

Vista de grafo donde cada nodo es un agente y las aristas son mensajes, para ver el "organismo" pensar en tiempo real.

---

## 6. Backend: endpoints y servicios

### 6.1 Nuevos endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/copilot/ask` | Sustituye/amplía `database/ask` con orquestación multi-agente |
| GET | `/api/copilot/agents` | Lista agentes de la org (con posibilidad de crear/editar) |
| POST | `/api/copilot/agents` | Crear agente personalizado |
| GET | `/api/copilot/chats/:id/agent-conversation` | Historial de mensajes inter-agentes para un turno |

### 6.2 Servicio de orquestación

```javascript
// server/services/agentOrchestrator.js

class AgentOrchestrator {
  async process(userMessage, chatContext) {
    const agentsToUse = await this.decideAgents(userMessage);
    const agentResults = {};
    
    for (const agentId of agentsToUse) {
      agentResults[agentId] = await this.invokeAgent(agentId, userMessage, agentResults);
    }
    
    const finalAnswer = await this.synthesize(agentResults);
    return { answer: finalAnswer, agentConversation: [...] };
  }
}
```

---

## 7. Fases de implementación

### Fase 1: Orquestador + especialización (MVP)
- Orquestador que decide entre Analista de Datos vs Especialista.
- Reutilizar lógica actual de `database/ask` para Analista.
- Especialista con instrucciones del copilot.
- UX: respuesta única, sin vista expandida.

### Fase 2: Mensajes entre agentes visibles
- Endpoint que devuelve `agentConversation`.
- UI para expandir "Ver razonamiento" con el hilo de agentes.
- Tabla `agent_conversations` para persistir.

### Fase 3: Agentes personalizables
- CRUD de agentes por org.
- Roles configurables (analyst, specialist, synthesis, memory).
- Asignar agentes a chats o plantillas.

### Fase 4: Memoria y contexto
- Agente Memoria que resume conversaciones largas.
- Preferencias y patrones reutilizables entre sesiones.
- Integración con Knowledge Base (folders) como fuente de verdad.

### Fase 5: Vista organismo
- Grafo de nodos (agentes) y aristas (mensajes) en tiempo real.
- Streaming de mensajes inter-agentes.
- Animación de "pensamiento" del organismo.

---

## 8. Consideraciones técnicas

| Aspecto | Decisión |
|---------|----------|
| **Llamadas LLM** | Una por agente por turno; Orquestador + N agentes + Síntesis ≈ 3–5 llamadas |
| **Coste** | Aumento de tokens; mitigar con modelos más baratos (gpt-4o-mini) para análisis interno |
| **Latencia** | Paralelizar cuando los agentes no dependan entre sí (ej. Analista + Especialista en paralelo) |
| **Streaming** | Empezar con respuesta final; luego stream por agente |
| **Estado** | Mantener `copilot_chats`; añadir `agent_conversations` por turno |

---

## 9. Resumen ejecutivo

1. **Orquestador** central que interpreta la intención y coordina agentes.
2. **Analista**, **Especialista**, **Síntesis** (y opcional **Memoria**) como roles base.
3. **Mensajes entre agentes** estructurados y persistidos para trazabilidad.
4. **UX**: respuesta única por defecto, con "Ver razonamiento" para el hilo entre agentes.
5. **Fases**: MVP especializado → visibilidad del organismo → agentes configurables → memoria → vista organismo.

Si quieres, el siguiente paso es concretar la Fase 1 en tareas de implementación y endpoints concretos.
