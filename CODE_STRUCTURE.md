# Estructura del Código

Este documento describe la organización del código del proyecto.

## Arquitectura General

```
├── components/           # Componentes React
│   ├── ui/              # Componentes UI reutilizables
│   ├── workflows/       # Módulo de editor de workflows
│   └── *.tsx            # Componentes de páginas
│
├── hooks/               # Hooks compartidos
├── utils/               # Funciones utilitarias
├── context/             # Contextos de React
├── config/              # Configuración
└── types.ts             # Tipos globales
```

---

## 📦 Componentes UI (`/components/ui/`)

Biblioteca de componentes reutilizables con soporte para dark mode.

### Importación

```typescript
import { Button, Card, Input, Modal, Badge } from '@/components/ui';
```

### Componentes Disponibles

| Componente | Descripción |
|------------|-------------|
| `Button` | Botones con variantes (primary, secondary, ghost, danger) |
| `Card` | Contenedores con CardHeader y CardFooter |
| `Input` | Campos de formulario (Input, Textarea, Select) |
| `Modal` | Diálogos modales y ConfirmDialog |
| `Badge` | Etiquetas, StatusBadge y Tags |
| `EmptyState` | Estados vacíos con iconos |
| `Skeleton` | Loaders para diferentes layouts |
| `Toast` | Notificaciones animadas |
| `Tooltip` | Información contextual al hover |
| `Dropdown` | Menús desplegables y Select |
| `Tabs` | Navegación por pestañas |

---

## 🔧 Hooks (`/hooks/`)

Hooks reutilizables para toda la aplicación.

### Importación

```typescript
import { useDebounce, useLocalStorage, useNotifications } from '@/hooks';
```

### Hooks Disponibles

| Hook | Descripción |
|------|-------------|
| `useLocalStorage` | Persistencia en localStorage con sync entre tabs |
| `useSessionStorage` | Persistencia en sessionStorage |
| `useNotifications` | Sistema de notificaciones/toasts |
| `useDebounce` | Valor debounceado |
| `useDebouncedCallback` | Callback con debounce |
| `useThrottledCallback` | Callback con throttle |
| `useAsync` | Manejo de operaciones async |
| `usePrevious` | Valor anterior de un estado |
| `useClickOutside` | Detectar clicks fuera de un elemento |
| `useKeyboardShortcut` | Atajos de teclado |
| `useCollaborativeCursors` | Cursores colaborativos en tiempo real |

---

## 🛠 Utilidades (`/utils/`)

Funciones utilitarias para formateo y manejo de datos.

### Importación

```typescript
import { formatNumber, formatDate, generateUUID, handleError } from '@/utils';
```

### Funciones Disponibles

#### Formateo de Fechas
- `formatTimeAgo(date)` - "5m ago", "2h ago"
- `formatDateFull(date)` - "30/01/2024, 10:30:00"
- `formatDateShort(date)` - "30 ene 2024"
- `formatDuration(ms)` - "500ms", "5.0s"
- `formatCardDate(date)` - "30 Jan 2024"

#### Formateo de Números y Strings
- `formatNumber(num, decimals)` - "1,234,567"
- `formatPercent(value)` - "75%"
- `formatBytes(bytes)` - "1.5 MB"
- `formatCurrency(amount)` - "1.234,56 €"
- `truncateString(str, maxLength)` - "Hello..."
- `capitalize(str)` - "Hello world"
- `getInitials(name)` - "JD"
- `pluralize(count, word)` - "5 items"

#### API y Errores
- `apiFetch`, `apiGet`, `apiPost`, `apiPut`, `apiDelete`
- `handleError`, `handleApiError`
- `AppError`, `ApiError`, `ValidationError`, `AuthError`

#### Otros
- `generateUUID()` - Genera UUIDs únicos
- `logger` - Sistema de logging

---

## 🔄 Módulo Workflows (`/components/workflows/`)

Sistema completo para el editor de workflows.

### Estructura

```
workflows/
├── index.ts              # Exports centralizados
├── types.ts              # Tipos TypeScript
├── constants.ts          # Constantes (DRAGGABLE_ITEMS, etc.)
│
├── hooks/                # Hooks especializados
│   ├── useWorkflowCanvas.ts
│   ├── useWorkflowNodes.ts
│   ├── useWorkflowExecution.ts
│   ├── useWorkflowAutosave.ts
│   └── useWorkflowHistory.ts
│
├── nodes/                # Definiciones de nodos
│   ├── nodeDefinitions.ts
│   └── nodeUtils.ts
│
└── [UI Components]       # Componentes visuales
    ├── NodePalette.tsx
    ├── WorkflowNode.tsx
    ├── ConnectionLine.tsx
    ├── CanvasControls.tsx
    └── WorkflowToolbar.tsx
```

### Importación

```typescript
import { 
  // Types
  WorkflowNode, Connection, NodeType,
  // Hooks
  useWorkflowNodes, useWorkflowCanvas,
  // Components
  NodePalette, ConnectionLine
} from '@/components/workflows';
```

### Hooks de Workflows

| Hook | Descripción |
|------|-------------|
| `useWorkflowCanvas` | Zoom, pan, conversión de coordenadas |
| `useWorkflowNodes` | CRUD de nodos y conexiones |
| `useWorkflowExecution` | Start, pause, stop, resume |
| `useWorkflowAutosave` | Guardado automático con debounce |
| `useWorkflowHistory` | Undo/redo con historial |

### Utilidades de Nodos

- `getNodeDefinition(type)` - Obtener metadata del nodo
- `validateNodeConfig(node)` - Validar configuración
- `isValidConnection(from, to)` - Validar conexión
- `getNodeSummary(node)` - Resumen para UI
- `getExecutionOrder(nodes, connections)` - Orden topológico
- `cloneNode(node, newId)` - Duplicar nodo

---

## 📁 Estructura de Archivos

```
Albert_trials_vibecoding/
│
├── components/
│   ├── ui/                      # 1850 líneas
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Dropdown.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Skeleton.tsx
│   │   ├── TabsUI.tsx
│   │   ├── Toast.tsx
│   │   ├── Tooltip.tsx
│   │   └── index.ts
│   │
│   ├── workflows/               # 3500+ líneas
│   │   ├── hooks/
│   │   ├── nodes/
│   │   ├── *.tsx
│   │   └── index.ts
│   │
│   └── [Page Components]        # Componentes de páginas
│       ├── Dashboard.tsx
│       ├── Workflows.tsx
│       ├── Settings.tsx
│       └── ...
│
├── hooks/                       # 1129 líneas
│   ├── useCollaborativeCursors.ts
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useNotifications.ts
│   └── index.ts
│
├── utils/                       # 961 líneas
│   ├── apiHelpers.ts
│   ├── dateFormatters.ts
│   ├── errorHandler.ts
│   ├── formatters.ts
│   ├── logger.ts
│   ├── uuid.ts
│   └── index.ts
│
├── context/
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
│
├── config/
│   └── constants.ts
│
└── types.ts
```

---

## 🎨 Sistema de Temas

El proyecto usa CSS variables para soportar light/dark mode.

### Variables Principales

```css
--bg-primary       /* Fondo principal */
--bg-secondary     /* Fondo secundario */
--bg-tertiary      /* Fondo terciario */
--bg-card          /* Fondo de cards */
--text-primary     /* Texto principal */
--text-secondary   /* Texto secundario */
--text-tertiary    /* Texto terciario */
--border-light     /* Bordes claros */
--border-medium    /* Bordes medios */
```

### Uso en Componentes

```tsx
<div className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
  Content
</div>
```

---

## 📊 Métricas

| Módulo | Líneas |
|--------|--------|
| Workflows | ~3500 |
| UI Components | ~1850 |
| Hooks | ~1129 |
| Utils | ~961 |
| **Total código modular** | **~7440** |
