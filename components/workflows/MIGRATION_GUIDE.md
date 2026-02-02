# Workflows Module Migration Guide

Este documento explica cómo migrar gradualmente el código de `Workflows.tsx` (10,000+ líneas) a los módulos extraídos.

## Módulos Disponibles

### 1. Hooks

#### `useWorkflowState`
Reemplaza el estado core del workflow (nodes, connections, save/load).

```tsx
// Antes (en Workflows.tsx):
const [nodes, setNodes] = useState<WorkflowNode[]>([]);
const [connections, setConnections] = useState<Connection[]>([]);
const [workflowName, setWorkflowName] = useState('');
const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
const [isSaving, setIsSaving] = useState(false);

// Después:
import { useWorkflowState } from './workflows/hooks';

const {
    nodes, setNodes,
    connections, setConnections,
    workflowName, setWorkflowName,
    currentWorkflowId, setCurrentWorkflowId,
    isSaving,
    saveWorkflow,
    loadWorkflow,
} = useWorkflowState();
```

#### `useCanvasInteraction`
Maneja pan, zoom y drag & drop del canvas.

```tsx
import { useCanvasInteraction } from './workflows/hooks';

const canvasRef = useRef<HTMLDivElement>(null);
const {
    canvasOffset,
    canvasZoom,
    isPanning,
    draggingNodeId,
    handleWheel,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    resetView,
    zoomIn,
    zoomOut,
    fitToView,
} = useCanvasInteraction(canvasRef);
```

### 2. Vistas

#### `WorkflowsListView`
Reemplaza toda la vista de lista de workflows (líneas ~4270-4443).

```tsx
import { WorkflowsListView } from './workflows/views';

// En el render:
{currentView === 'list' ? (
    <WorkflowsListView
        workflows={savedWorkflows}
        searchQuery={workflowSearchQuery}
        onSearchChange={setWorkflowSearchQuery}
        selectedTagFilter={selectedTagFilter}
        onTagFilterChange={setSelectedTagFilter}
        allTags={allTags}
        currentPage={currentWorkflowPage}
        itemsPerPage={workflowsPerPage}
        onPageChange={setCurrentWorkflowPage}
        onOpenWorkflow={openWorkflow}
        onDeleteWorkflow={deleteWorkflow}
        onCreateNew={createNewWorkflow}
        onOpenTemplates={() => setShowTemplatesModal(true)}
    />
) : (
    // Canvas view...
)}
```

### 3. Modales

#### `TemplatesGalleryModal`
Reemplaza el modal de templates (líneas ~9737-10079).

```tsx
import { TemplatesGalleryModal } from './workflows/modals';

<TemplatesGalleryModal
    isOpen={showTemplatesModal}
    onClose={() => setShowTemplatesModal(false)}
    onCopyTemplate={copyTemplateToWorkflows}
    isCopying={isCopyingTemplate}
/>
```

#### `ExecutionHistoryModal`
Reemplaza el modal de historial de ejecuciones.

```tsx
import { ExecutionHistoryModal } from './workflows/modals';

<ExecutionHistoryModal
    isOpen={showExecutionHistory}
    onClose={() => setShowExecutionHistory(false)}
    workflowId={currentWorkflowId || ''}
    workflowName={workflowName}
    onRerun={(executionId) => console.log('Rerun:', executionId)}
/>
```

#### `WorkflowRunnerModal`
Reemplaza el modal de ejecución de workflows.

```tsx
import { WorkflowRunnerModal } from './workflows/modals';

<WorkflowRunnerModal
    isOpen={showRunnerModal}
    onClose={() => setShowRunnerModal(false)}
    workflowName={workflowName}
    nodes={nodes}
    onRun={async (inputs) => {
        // Execute workflow with inputs
    }}
/>
```

### 4. Utilidades

#### Node Helpers
Funciones de utilidad para nodos.

```tsx
import {
    getNodeColor,
    isNodeConfigured,
    getNodeTopTag,
    getNodeIconColorUtil,
    getCategoryColors,
} from './workflows/utils';

// Usar en lugar de las funciones inline
const nodeColor = getNodeColor(node.type, node.status);
const isConfigured = isNodeConfigured(node);
const topTag = getNodeTopTag(node);
```

## Plan de Migración Recomendado

### Fase 1: Modales (Bajo riesgo)
1. Reemplazar `showTemplatesModal` render con `<TemplatesGalleryModal />`
2. Reemplazar modal de historial con `<ExecutionHistoryModal />`
3. Reemplazar modal de runner con `<WorkflowRunnerModal />`

### Fase 2: Vista de Lista (Riesgo medio)
1. Reemplazar toda la sección `currentView === 'list'` con `<WorkflowsListView />`

### Fase 3: Hooks de Estado (Riesgo medio)
1. Reemplazar useState individuales con `useWorkflowState`
2. Reemplazar lógica de canvas con `useCanvasInteraction`

### Fase 4: Utilidades (Bajo riesgo)
1. Reemplazar funciones inline (`getNodeColor`, etc.) con importaciones

## Testing

Después de cada fase:
1. Verificar que la vista de lista funciona
2. Verificar que se puede crear/editar workflows
3. Verificar que los modales abren/cierran correctamente
4. Verificar que el canvas funciona (pan, zoom, drag)
5. Verificar que se pueden ejecutar workflows

## Notas

- Los módulos son **compatibles hacia atrás** - puedes usar ambos (inline y módulos) durante la migración
- Cada módulo está **auto-contenido** y no depende de otros módulos nuevos
- Los tipos TypeScript son los mismos que los existentes en `Workflows.tsx`
