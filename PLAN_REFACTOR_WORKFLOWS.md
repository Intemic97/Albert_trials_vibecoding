# Plan de Refactorización de Workflows

> Plan para terminar la refactorización de workflows y conseguir que todo funcione correctamente.

## Estado actual

### Arquitectura

| Componente | Ubicación | Estado |
|------------|-----------|--------|
| **Workflows.tsx** | `components/Workflows.tsx` | Editor monolítico (~11.7k líneas), rutas principales `/workflows`, `/workflow/:id` |
| **WorkflowEditor** | `components/workflows/WorkflowEditor.tsx` | Editor modular (~464 líneas), rutas alternativas `/workflows-v2`, `/workflows-v2/:id` |
| **Módulo workflows** | `components/workflows/` | Tipos, hooks, modales, NodePalette, WorkflowCanvas, NodeConfigPanels |

### Rutas en App.tsx

- `/workflows` → **Workflows** (lista)
- `/workflow/:workflowId` → **Workflows** (editor)
- `/workflows-v2` → **WorkflowEditor** (lista) ← no existe ruta de lista para v2
- `/workflows-v2/:workflowId` → **WorkflowEditor** (editor)

---

## 1. Bugs críticos a corregir

### 1.1 WorkflowEditor – Ruta de ejecución incorrecta

**Archivo:** `components/workflows/WorkflowEditor.tsx` (línea ~212)

**Problema:** Llama a `POST /api/workflows/${id}/execute` (plural).

**Servidor:** Expone `POST /api/workflow/:id/execute` (singular).

**Solución:** Cambiar a:
```ts
fetch(`${API_BASE}/workflow/${workflow.id}/execute`, ...)
```

---

### 1.2 WorkflowEditor – Navegación tras guardar workflow nuevo

**Archivo:** `components/workflows/WorkflowEditor.tsx` (línea ~186)

**Problema:** Navega a `/workflows/${data.id}` (ruta del editor antiguo). WorkflowEditor está montado en `/workflows-v2/:workflowId`.

**Solución:** Usar la ruta del editor actual:
```ts
navigate(`/workflows-v2/${data.id}`, { replace: true });
```
*(Cuando se migre a editor principal, cambiar a `/workflow/${data.id}`.)*

---

### 1.3 WorkflowEditor – Ruta de retorno al listado

**Archivo:** `components/workflows/WorkflowEditor.tsx` (línea ~238)

**Problema:** Navega a `/workflows` (lista del editor antiguo). Si WorkflowEditor tendrá su propia lista, sería `/workflows-v2`.

**Estado:** Actualmente OK para consistencia con sidebar (todo lleva a /workflows).

---

### 1.4 useWorkflowState – Rutas API sin prefijo `/api`

**Archivo:** `components/workflows/hooks/useWorkflowState.ts` (líneas ~80, 114)

**Problema:** Usa `${API_BASE}/workflows/${id}`. Si `API_BASE = '/api'`, la URL sería `/api/workflows/xxx`, que está bien.

**Estado:** Verificar que `API_BASE` incluya `/api` en todos los entornos.

---

## 2. Paridad de funcionalidad: WorkflowEditor vs Workflows.tsx

### 2.1 Ejecución real de nodos

| Aspecto | Workflows.tsx | WorkflowEditor |
|---------|---------------|----------------|
| Ejecución backend | `POST /api/workflow/:id/execute` | Bug: usa `/workflows/:id/execute` |
| Ejecución local (feedback visual) | `executeNode()` con lógica por tipo de nodo | Simulación simple (`setTimeout` con datos mock) |
| Nodos soportados | 40+ tipos (fetchData, python, LLM, sendEmail, etc.) | Solo simulación genérica |

**Tarea:** WorkflowEditor debe usar la misma API de ejecución y, si se quiere feedback visual, reutilizar o adaptar la lógica de `executeNode` de `Workflows.tsx`.

---

### 2.2 Paneles de configuración de nodos

| WorkflowEditor (NodeConfigPanels) | Workflows (NodeConfigSidePanel + modales) |
|-----------------------------------|------------------------------------------|
| fetchData, condition, llm, python, http, email, join + GenericConfig | ~40 tipos con modales específicos (HttpConfigModal, LLMConfigModal, etc.) |

**Tareas:**
- Ampliar `NodeConfigPanels` para delegar en los modales existentes cuando haya panel específico.
- O integrar los modales (`ConditionConfigModal`, `LLMConfigModal`, etc.) en lugar de implementaciones inline.

---

### 2.3 Funcionalidades ausentes en WorkflowEditor

- Cursors colaborativos en tiempo real (WebSocket).
- Autoguardado con debounce.
- Undo/Redo (Workflows.tsx usa `useWorkflowHistory`; WorkflowEditor no).
- Webhook URL / configuración de webhook.
- Integración con `WorkflowRunnerModal` real (ejecución con inputs). *WorkflowEditor lo importa pero no lo renderiza.*
- Vista lista de workflows integrada (ahora solo hay lista en Workflows.tsx).
- Integración con `ExecutionHistoryModal` (WorkflowEditor sí lo usa, pero depende de la API correcta).

---

## 3. Integración y migración

### Opción A: Migrar a WorkflowEditor como editor principal

1. Corregir bugs de rutas (ejecución y navegación).
2. Hacer que las rutas `/workflows` y `/workflow/:id` usen **WorkflowEditor** en lugar de **Workflows**.
3. Integrar la lista de workflows (`WorkflowsListView`) en WorkflowEditor (o redirigir `/workflows` al listado).
4. Portar ejecución real (backend + feedback visual) desde Workflows.tsx.
5. Ampliar NodeConfigPanels para cubrir todos los tipos de nodo.
6. Portar colaboración (WebSocket), autoguardado y undo/redo.
7. Deprecar Workflows.tsx y eliminarlo cuando todo funcione.

---

### Opción B: Mantener Workflows.tsx y mejorar módulo

1. Extraer más lógica de `Workflows.tsx` a hooks y componentes del módulo `workflows/`.
2. Reducir tamaño de Workflows.tsx usando `WorkflowCanvas`, `NodePalette`, modales, etc.
3. Mantener WorkflowEditor como versión experimental en `/workflows-v2`.

---

## 4. Tareas técnicas concretas

### Fase 1 – Bugs inmediatos

- [x] **F1.1** Corregir ruta de ejecución en WorkflowEditor: `/api/workflow/:id/execute`.
- [x] **F1.2** Corregir navegación tras crear workflow: `/workflows-v2/${id}`.
- [x] **F1.3** Comprobar que ExecutionHistoryModal usa `${API_BASE}/workflow/:id/executions` correctamente.

### Fase 2 – API y datos

- [ ] **F2.1** Unificar formato de payload entre WorkflowEditor y servidor (ej. `nodes`, `connections` vs `data.nodes`, `data.connections`).
- [ ] **F2.2** Verificar que WorkflowEditor persiste todos los campos del workflow (description, tags, isPublic, etc.).

### Fase 3 – Ejecución

- [x] **F3.1** WorkflowEditor: usar API real de ejecución en lugar de simulación (nodo individual vía execute-node cuando workflow guardado).
- [ ] **F3.2** Añadir feedback visual de ejecución (estados running/completed/error por nodo).
- [ ] **F3.3** Integrar `WorkflowRunnerModal` para workflows con inputs.

### Fase 4 – Configuración de nodos

- [x] **F4.1** Mapear cada tipo de nodo a su modal de configuración.
- [x] **F4.2** Reutilizar modales existentes en NodeConfigPanels (LLMConfigModal, PythonConfigModal, ConditionConfigModal, SaveRecordsConfigModal).
- [ ] **F4.3** Probar configuración de nodos críticos: fetchData, condition, llm, python, http, saveRecords, sendEmail, etc.

### Fase 5 – UX y estabilidad

- [x] **F5.1** Undo/Redo en WorkflowEditor usando `useWorkflowHistory`.
- [ ] **F5.2** Autoguardado con debounce.
- [ ] **F5.3** WebSocket para cursors colaborativos (si está en scope).
- [ ] **F5.4** Webhook URL y configuración en WorkflowEditor.

### Fase 6 – Migración (si se elige Opción A)

- [ ] **F6.1** Añadir WorkflowsListView a WorkflowEditor para `/workflows`.
- [ ] **F6.2** Cambiar rutas en App.tsx para usar WorkflowEditor.
- [ ] **F6.3** Pruebas end-to-end: crear, editar, guardar, ejecutar workflow.
- [ ] **F6.4** Deprecar y eliminar Workflows.tsx.

---

## 5. Rama refactor-workflows-febrero

La rama tiene cambios más amplios (servidor con repositories, rutas modulares, eliminación de UseCaseImport, etc.). No se debe mergear directamente sin:

1. Revisar el impacto en el resto de la app (Dashboard, Lab, Reporting).
2. Validar que los nuevos endpoints y rutas son compatibles con el frontend actual.
3. Resolver conflictos con `main` si hay cambios recientes en workflows, dashboard o servidor.

---

## 6. Orden recomendado de ejecución

1. **Inmediato:** F1.1, F1.2 (bugs de WorkflowEditor).
2. **Corto plazo:** F2.1, F2.2 (formato de datos).
3. **Medio plazo:** F3.1, F3.2 (ejecución real).
4. **Después:** F4.x (configuración de nodos) y F5.x (UX).
5. **Opcional:** F6.x (migración completa).

---

## 7. Checklist de verificación final

Antes de dar por cerrada la refactorización:

- [ ] Crear workflow nuevo, guardar, ejecutar.
- [ ] Editar workflow existente, guardar.
- [ ] Configurar nodos de cada tipo crítico (fetchData, condition, llm, python, etc.).
- [ ] Ver historial de ejecuciones en ExecutionHistoryModal.
- [ ] Templates gallery funcional.
- [ ] AI Assistant funcional.
- [ ] Sin errores en consola ni warnings relevantes al usar workflows.
