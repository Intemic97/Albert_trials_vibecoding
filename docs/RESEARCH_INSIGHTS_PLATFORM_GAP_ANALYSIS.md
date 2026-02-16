# Análisis de Gaps: Research IA → Plataforma Intemic

> Relación entre los insights del informe de desarrollo con IA y el estado actual de la plataforma. Qué tenemos y qué mejorar para posicionarnos en industrias reguladas (pharma, food, industrial).

---

## 1. Lo que ya tenemos ✅

### 1.1 Multi-agente coordinado (Trend: Agentes → equipos multi-agente)

**Implementado en `agentOrchestrator.js`:**

| Componente | Estado | Detalle |
|------------|--------|---------|
| Orquestador | ✅ | Decide qué agentes invocar (analyst, specialist, synthesis) |
| Analista de datos | ✅ | Consulta entidades, schema, hace cruces |
| Especialista de dominio | ✅ | Usa instrucciones + Knowledge Base (folders) |
| Síntesis | ✅ | Combina outputs en respuesta coherente |
| agent_conversations | ✅ | Persiste mensajes entre agentes para trazabilidad |
| Prompts configurables por agente | ✅ | orchestratorPrompt, analystPrompt, specialistPrompt, synthesisPrompt |

**Gap vs. Research:** El informe habla de agentes trabajando **días autónomamente** (Rakuten: 7h sobre 12.5M líneas). Nosotros: **ciclos de minutos** por turno de chat, sin ejecución autónoma extendida.

---

### 1.2 Compliance y reportes regulatorios

| Componente | Estado | Detalle |
|------------|--------|---------|
| Report Editor | ✅ | Plantillas con secciones, generación por IA |
| Audit trail en reportes | ✅ | `report_section_audit`, acciones (create, update, generate_content, etc.) |
| Templates compliance | ✅ | "Regulatory compliance reporting", "Product Specification Certificate", REACH/ISO |
| Workflow human approval | ✅ | Nodo `humanApproval` para aprobación de manager |
| Scope 3 emissions, wineries, renewable assets | ✅ | Plantillas de workflows para reporting automatizado |

**Gap vs. Research:** Compliance **automatizado** acelerado. Tenemos generación asistida y plantillas, pero el flujo end-to-end (auditoría doc regulatoria → generación → validación → envío) no está completamente orquestado por agentes autónomos.

---

### 1.3 Domain experts empoderados (no técnicos)

| Componente | Estado | Detalle |
|------------|--------|---------|
| Workflows visuales | ✅ | Editor arrastrar-soltar, nodos configurables |
| Templates sectoriales | ✅ | Compliance, Reporting, Quality Assurance, Planning |
| Agentes con plantillas | ✅ | Librería de agentes con instrucciones predefinidas (datos, mantenimiento, documentación) |
| Formularios públicos | ✅ | PublicWorkflowForm para disparar workflows sin entrar a la app |
| Human approval asignable | ✅ | `assignedUserId` en nodo humanApproval |

**Gap vs. Research:** El trend 7 habla de auditores, técnicos de calidad y compliance creando **sus propias** automatizaciones. Tenemos workflows y agentes, pero la curva para un perfil no técnico sigue siendo alta (configurar entidades, nodos LLM, etc.).

---

### 1.4 Trazabilidad y auditoría

| Componente | Estado | Detalle |
|------------|--------|---------|
| audit_logs | ✅ | userId, action, resourceType, resourceId, details, createdAt |
| Activity Log | ✅ | UI con filtros por action, resourceType, userId |
| Report audit trail | ✅ | Historial por sección (create, update, generate_content, comments) |
| agent_conversations | ✅ | fromAgent, toAgent, type, content por turno |
| Workflow execution logs | ✅ | log_node_execution en Prefect, workflow_executions |

**Gap vs. Research:** En industrias reguladas se requiere **audit trails robustos** y validación humana. Tenemos base sólida; falta **integrar audit específico de IA** (qué prompt, qué modelo, qué tokens) y **validación humana explícita** en ciclos de agente.

---

### 1.5 Autonomía y ejecución en segundo plano

| Componente | Estado | Detalle |
|------------|--------|---------|
| WorkflowScheduler | ✅ | Ejecución periódica (intervalMs), workflow_schedules |
| JobQueue workflows | ✅ | workflow:execute en background |
| Prefect background | ✅ | execute_workflow_background, usuario puede cerrar navegador |
| Ejecución paralela | ✅ | DAG Prefect, nodos independientes en paralelo |

**Gap vs. Research:** Tenemos scheduling por intervalo, pero no agentes que **deciden solos** qué tareas hacer durante horas/días sobre un codebase o corpus de docs. El orquestador actual responde a **una pregunta del usuario**, no a un “objetivo abierto”.

---

## 2. Lo que podríamos mejorar 🚀

### 2.1 Prioridad alta

#### A) Audit trail específico de IA (compliance industrial)

**Problema:** audit_logs registra acciones genéricas; no hay registro detallado de:
- prompts enviados
- modelo usado
- tokens consumidos
- respuestas crudas antes de síntesis

**Propuesta:** Nueva tabla `ai_audit_logs` (o extensión de audit_logs con `details` enriquecido):
```sql
-- Ejemplo
ai_audit_logs: chatId, turnIndex, agentRole, model, tokensIn, tokensOut, promptHash, responseHash, durationMs
```

**Impacto:** Diferenciador en pharma/food: "Cada decisión de IA es auditable".

---

#### B) Human-in-the-loop más visible en agentes

**Problema:** En workflows hay humanApproval, pero en **copilots** no hay puntos de validación humana. La respuesta va directa al usuario.

**Propuesta:**
- Modo "validación antes de enviar" para respuestas que afectan datos o reportes
- Botón "Aprobar y usar" vs "Revisar" que permita editar antes de aplicar
- Integrar con workflow humanApproval cuando el agente propone una acción (ej. crear orden de trabajo)

---

#### C) Agentes como "directores" con ejecución delegada

**Problema:** El orquestador coordina 3 sub-agentes en un único ciclo síncrono. No hay delegación a **tareas asíncronas** (workflows, reportes, etc.).

**Propuesta:**
- Que el orquestador pueda emitir "intenciones" que se traduzcan en jobs: `create_report`, `run_compliance_check`, `schedule_maintenance`
- Integración agente ↔ workflow: el agente propone, el workflow ejecuta, el agente resume

---

### 2.2 Prioridad media

#### D) Reducir fricción para domain experts (no técnicos)

- **Wizard guiado** para crear agentes: "¿Qué quieres que haga?" → sugerir plantilla + entidades automáticamente
- **Templates de workflows** más específicos por sector (pharma batch records, food HACCP, etc.)
- **Formularios inteligentes**: un técnico de calidad rellena un form → se dispara workflow + agente que genera borrador de informe

---

#### E) Vista "organismo" del sistema multi-agente

El PLAN_COPILOTS_MULTIAGENT ya contempla:
- Grafo de nodos (agentes) y aristas (mensajes) en tiempo real
- "Ver razonamiento" para el hilo entre agentes
- Streaming por agente

**Estado:** Diseñado, no implementado. Sería un diferencial visual y de confianza ("veo cómo llegó a esta conclusión").

---

#### F) Ejecución prolongada de agentes

Hoy: 1 turno → orquestador + analyst + specialist + synthesis → respuesta.

Futuro (alineado con Rakuten):
- Agente que recibe un "objetivo" (ej. "Audita la documentación de lotes del último trimestre")
- Trabaja en background durante minutos/horas
- Consulta KB, entidades, genera borradores, pide validación humana en puntos clave
- Entrega resumen + recomendaciones

Requiere: cola de jobs, estados persistentes por "misión", notificaciones cuando termina.

---

### 2.3 Prioridad baja (enfoque estratégico)

#### G) Seguridad dual-use

El research menciona que la IA es arma de doble filo. En plataforma:
- Control de acceso por rol a agentes/workflows
- Posible "modo auditoría" donde las acciones de IA se registran y no se ejecutan hasta aprobación
- Rate limits y cuotas por organización para evitar abuso

---

#### H) Onboarding a codebases

El informe destaca "onboarding colapsa de semanas a horas". Nosotros no somos un IDE; somos plataforma de datos + workflows + agentes. El equivalente sería:
- Onboarding a **use cases** y **datos**: "Importa tu paquete" (entities, records, workflow) y el agente ayuda a explorar
- Mejorar UseCaseImport y guías contextuales

---

## 3. Resumen ejecutivo

| Insight del Research | Lo que tenemos | Mejora prioritaria |
|---------------------|----------------|--------------------|
| Orquestar agentes vs. escribir código | ✅ Orquestador + Analyst + Specialist + Synthesis | Exponer "Ver razonamiento", delegar a workflows |
| Compliance automatizado | ✅ Reportes, audit trail, human approval en workflows | AI audit log específico, flujo end-to-end orquestado |
| Domain experts empoderados | ✅ Workflows, agentes, plantillas | Wizard guiado, templates sectoriales, menos fricción |
| Multi-agente coordinado | ✅ Arquitectura implementada | Vista organismo, ejecución prolongada |
| Trazabilidad y seguridad | ✅ audit_logs, report audit | AI audit logs, human-in-the-loop en copilots |
| Autonomía (días) | ⚠️ Scheduling de workflows | Agentes con "misiones" en background |

---

## 4. Bottom line

La plataforma está bien alineada con el territorio del research: **orquestación multi-agente, dominio industrial, compliance y reportes**. Los gaps principales son:

1. **Trazabilidad de IA** (audit específico) para diferenciarse en regulado.
2. **Human-in-the-loop explícito** en el flujo de agentes, no solo en workflows.
3. **Agentes que deleguen** a workflows/jobs en lugar de solo responder en el turno.
4. **Experiencia para no técnicos** para capturar el trend de domain experts autosuficientes.

Priorizar **AI audit + human-in-the-loop** refuerza la propuesta de valor para pharma/food y posiciona a Intemic en el mismo eje que el research: "orquestar sistemas multi-agente con supervisión humana inteligente en dominios especializados".
