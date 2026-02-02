# Estado de Migración: Workflows.tsx → WorkflowEditor

## Resumen

| Métrica | Workflows.tsx | WorkflowEditor |
|---------|--------------|----------------|
| Líneas | ~10,380 | ~370 |
| useState | 169 | 2 (via stores) |
| Funcionalidades | 100% | ~40% |

## Funcionalidades Migradas ✅

### Canvas
- [x] Pan & Zoom (useCanvasPanZoom)
- [x] Drag nodes (useNodeDrag)
- [x] Create connections (useConnectionDrag)
- [x] Keyboard shortcuts (Delete, Escape, Zoom)
- [x] Dotted background responsive
- [x] Empty state con quick actions

### UI
- [x] Toolbar básico (Save, Run, Back)
- [x] Zoom controls
- [x] Node palette sidebar

### State Management
- [x] Zustand store para workflow
- [x] Zustand store para node config
- [x] Unsaved changes tracking

### Modals
- [x] ExecutionHistoryModal (integrado)
- [x] TemplatesGalleryModal (integrado)

---

## Funcionalidades Pendientes ⏳

### Alta Prioridad

#### 1. AI Assistant Panel
**Archivo:** Líneas ~3481-3750 en Workflows.tsx
```tsx
// Funciones a migrar:
- handleGenerateWorkflow()      // Generar workflow con IA
- handleSendWorkflowAiMessage() // Chat con IA
- handleAcceptWorkflowSuggestion()
- handleRejectWorkflowSuggestion()

// Estado:
- workflowAiMessages
- isGeneratingWorkflow
- suggestedNodes/suggestedConnections
```

**Acción:** Crear `AIAssistantPanel.tsx`

#### 2. Ejecución Real de Nodos
**Archivo:** Líneas ~3404-3480 en Workflows.tsx
```tsx
// Función principal:
- handleRunNode(nodeId) 
- executeNode() con lógica por tipo de nodo
- WebSocket para progreso en tiempo real

// Tipos de nodos que ejecutar:
- fetchData: Llamada a API de entidades
- llm: Llamada a OpenAI/Claude
- python: Ejecución de código
- http: Llamadas HTTP configurables
- condition: Evaluación de condiciones
- excel/pdf: Procesamiento de archivos
```

**Acción:** Completar `useWorkflowExecution` hook

#### 3. Node Configuration Modals
**Archivo:** Líneas ~4200-8000 en Workflows.tsx
```tsx
// Modales por tipo de nodo:
- Condition config (líneas ~4200-4500)
- LLM config (líneas ~4500-5000)
- Python editor (líneas ~5000-5500)
- HTTP config (líneas ~5500-6000)
- Excel/PDF upload (líneas ~6000-6500)
- Join/Split columns (líneas ~6500-7000)
- Manual input (líneas ~7000-7500)
- ESIOS/MySQL/SAP integrations (líneas ~7500-8000)
```

**Acción:** Conectar modales existentes con nodeConfigStore

#### 4. Data Preview Panel
**Archivo:** Líneas ~8000-9000 en Workflows.tsx
```tsx
// Funcionalidades:
- Preview inline de datos de cada nodo
- Vista tabular con paginación
- Expandir/colapsar
- Ver datos de entrada vs salida
```

**Acción:** Integrar `DataPreviewPanel.tsx` existente

### Media Prioridad

#### 5. Collaboration (WebSocket)
```tsx
// Ya existe:
- useCollaborativeCursors hook
- remoteCursors state
- sendNodeMove/sendCursorPosition

// Integrar en WorkflowCanvas
```

#### 6. Autosave
```tsx
// Ya existe:
- useWorkflowAutosave hook
- Debounced save

// Integrar en WorkflowEditor
```

#### 7. Undo/Redo
```tsx
// Ya existe:
- useWorkflowHistory hook
- Ctrl+Z / Ctrl+Shift+Z

// Integrar con workflowStore
```

### Baja Prioridad

#### 8. Node Context Menu
- Opciones: Run, View Data, Duplicate, Delete, Configure
- Ya está parcialmente en WorkflowNode

#### 9. Connection Delete
- Hover sobre conexión para mostrar botón delete
- Ya implementado en ConnectionLine

#### 10. Workflow List View
- Ya existe como componente separado
- Solo necesita routing

---

## Próximos Pasos Recomendados

### Fase 1: AI Assistant (Impacto alto)
1. Crear `components/workflows/AIAssistantPanel.tsx`
2. Extraer estado de IA a store dedicado
3. Integrar en WorkflowEditor con sidebar toggle

### Fase 2: Ejecución Completa
1. Completar `useWorkflowExecution` con todos los tipos de nodo
2. Añadir WebSocket para progreso real
3. Integrar con backend `/api/workflows/:id/execute`

### Fase 3: Modales de Configuración
1. Conectar todos los modales con `nodeConfigStore`
2. Abrir modal correcto según tipo de nodo
3. Guardar config en nodo

### Fase 4: Polish
1. Data preview panel
2. Collaboration cursors
3. Autosave
4. Undo/Redo

---

## Cómo Probar

```bash
# Navegar a la versión nueva
http://localhost:5173/workflows-v2

# Comparar con la versión original
http://localhost:5173/workflows
```

## Archivos Creados

```
stores/
├── workflowStore.ts      ✅
└── nodeConfigStore.ts    ✅

components/workflows/
├── hooks/
│   ├── useCanvasPanZoom.ts   ✅
│   ├── useNodeDrag.ts        ✅
│   └── useConnectionDrag.ts  ✅
├── WorkflowCanvas.tsx    ✅
├── WorkflowEditor.tsx    ✅
└── MIGRATION_STATUS.md   ✅ (este archivo)
```
