# Workflow Migration Guide

Este documento muestra cómo migrar `Workflows.tsx` de 169 useState a usar los nuevos stores de Zustand y hooks modulares.

## Resumen de Cambios

| Antes | Después | Beneficio |
|-------|---------|-----------|
| 169 useState | 2 stores + hooks | Estado centralizado |
| 10,380 líneas | ~2,000 líneas | Más mantenible |
| Re-renders masivos | Selectores optimizados | Mejor rendimiento |
| Lógica dispersa | Hooks reutilizables | Código testeable |

## Ejemplo de Migración

### ANTES: Estado disperso en Workflows.tsx

```tsx
// 169 useState dispersos...
const [nodes, setNodes] = useState<WorkflowNode[]>([]);
const [connections, setConnections] = useState<Connection[]>([]);
const [canvasZoom, setCanvasZoom] = useState(1);
const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
const [isRunning, setIsRunning] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [workflowName, setWorkflowName] = useState('Untitled Workflow');
// ... 160 más
```

### DESPUÉS: Stores centralizados

```tsx
import { useWorkflowStore, useNodeConfigStore } from '../../stores';
import { 
  useCanvasPanZoom, 
  useNodeDrag, 
  useConnectionDrag 
} from './hooks';

const WorkflowEditor = ({ entities }) => {
  // =============================================
  // STORE: Estado central del workflow
  // =============================================
  const {
    nodes,
    connections,
    workflow,
    addNode,
    updateNode,
    deleteNode,
    addConnection,
    deleteConnection,
    selectNode,
    hasUnsavedChanges,
  } = useWorkflowStore();
  
  // =============================================
  // STORE: Configuración de nodos
  // =============================================
  const {
    configuringNodeId,
    openConfig,
    closeConfig,
    getCurrentConfig,
  } = useNodeConfigStore();
  
  // =============================================
  // HOOK: Pan & Zoom del canvas
  // =============================================
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    scale,
    offsetX,
    offsetY,
    isPanning,
    handleWheel,
    handleMouseDown: handlePanStart,
    handleMouseMove: handlePanMove,
    handleMouseUp: handlePanEnd,
    zoomIn,
    zoomOut,
    resetView,
    screenToCanvas,
  } = useCanvasPanZoom({
    onScaleChange: (scale) => console.log('Zoom:', scale),
  });
  
  // =============================================
  // HOOK: Drag de nodos
  // =============================================
  const {
    draggingNodeId,
    isDragging,
    handleNodeMouseDown,
    handleMouseMove: handleNodeDrag,
    handleMouseUp: handleNodeDragEnd,
  } = useNodeDrag({
    nodes,
    scale,
    offsetX,
    offsetY,
    onNodeMove: (nodeId, x, y) => {
      updateNode(nodeId, { x, y });
    },
  });
  
  // =============================================
  // HOOK: Drag de conexiones
  // =============================================
  const {
    connectionDrag,
    isConnecting,
    startConnection,
    updateConnection,
    endConnection,
    cancelConnection,
  } = useConnectionDrag({
    nodes,
    connections,
    scale,
    offsetX,
    offsetY,
    onConnectionCreate: (conn) => {
      addConnection({ ...conn, id: generateUUID() });
    },
  });
  
  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="flex-1 flex">
      {/* Sidebar */}
      <NodePalette onDragStart={handlePaletteDrag} />
      
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={(e) => {
          handlePanStart(e);
          if (isConnecting) cancelConnection();
        }}
        onMouseMove={(e) => {
          handlePanMove(e);
          if (isDragging && canvasRef.current) {
            handleNodeDrag(e, canvasRef.current.getBoundingClientRect());
          }
          if (isConnecting && canvasRef.current) {
            updateConnection(e, canvasRef.current.getBoundingClientRect());
          }
        }}
        onMouseUp={(e) => {
          handlePanEnd();
          handleNodeDragEnd();
          if (isConnecting) cancelConnection();
        }}
      >
        {/* Transform container */}
        <div
          style={{
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Connections SVG */}
          <ConnectionsLayer
            connections={connections}
            nodes={nodes}
            connectionDrag={connectionDrag}
          />
          
          {/* Nodes */}
          {nodes.map(node => (
            <WorkflowNode
              key={node.id}
              node={node}
              isSelected={workflow.selectedNodeId === node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onConnectorMouseDown={(e, type) => startConnection(e, node.id, type)}
              onConnectorMouseUp={(e, port) => endConnection(node.id, port)}
              onClick={() => selectNode(node.id)}
              onConfigure={() => openConfig(node.id, node.type, node.config)}
            />
          ))}
        </div>
      </div>
      
      {/* Config Modal */}
      {configuringNodeId && (
        <NodeConfigModal
          nodeId={configuringNodeId}
          onSave={(config) => {
            updateNode(configuringNodeId, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      )}
    </div>
  );
};
```

## Selectores Optimizados

Para evitar re-renders innecesarios, usa selectores:

```tsx
// ❌ MAL: Re-render en cualquier cambio del store
const store = useWorkflowStore();

// ✅ BIEN: Solo re-render cuando cambian los nodos
const nodes = useWorkflowStore(state => state.nodes);

// ✅ MEJOR: Selector memoizado para datos derivados
const triggerNodes = useWorkflowStore(
  useCallback(state => state.nodes.filter(n => n.type === 'trigger'), [])
);
```

## Pasos de Migración

### Fase 1: Stores (COMPLETADO ✅)
- [x] `stores/workflowStore.ts` - Estado central
- [x] `stores/nodeConfigStore.ts` - Configuración de nodos

### Fase 2: Hooks (COMPLETADO ✅)
- [x] `useCanvasPanZoom` - Pan y zoom
- [x] `useNodeDrag` - Drag de nodos
- [x] `useConnectionDrag` - Crear conexiones

### Fase 3: Componentes (PENDIENTE)
- [ ] Extraer `WorkflowCanvas.tsx` (~1,500 líneas)
- [ ] Extraer `WorkflowSidebar.tsx` (~500 líneas)
- [ ] Extraer `AIAssistantPanel.tsx` (~400 líneas)
- [ ] Extraer `ConfigModals/` (ya existen parcialmente)

### Fase 4: Integración
- [ ] Actualizar `Workflows.tsx` para usar stores
- [ ] Eliminar useState redundantes
- [ ] Añadir tests

## Archivos Creados

```
stores/
├── index.ts
├── workflowStore.ts      # Estado central (~400 líneas)
└── nodeConfigStore.ts    # Config de nodos (~500 líneas)

components/workflows/hooks/
├── useCanvasPanZoom.ts   # Pan & zoom (~230 líneas)
├── useNodeDrag.ts        # Drag nodos (~120 líneas)
└── useConnectionDrag.ts  # Drag conexiones (~200 líneas)
```

## Beneficios

1. **Rendimiento**: Selectores evitan re-renders innecesarios
2. **Testabilidad**: Stores y hooks se pueden testear independientemente
3. **Mantenibilidad**: Código organizado por responsabilidad
4. **DevTools**: Zustand integra con Redux DevTools
5. **TypeScript**: Tipos estrictos en toda la cadena
