# Sidebar Copilots - Organización Final

## 🎨 Estructura Visual

```
┌─────────────────────────────────┐
│ WORKSPACE                       │
├─────────────────────────────────┤
│                                 │
│ ▼ Tus chats (15)           [+] │
│   🔍 Search chats...            │
│   ⭐ Favorites  #tag1  #tag2    │
│   ─────────────────────────     │
│   💬 Análisis producción Q1     │
│   💬 Optimización refinería     │
│   💬 Seguridad planta           │
│   ...                           │
│                                 │
├─────────────────────────────────┤
│                                 │
│ ▼ Agentes (3)              [+] │
│   ─────────────────────────     │
│   🏭 Agente Producción     ⚙️  │
│      Producción industrial      │
│                                 │
│   🍷 Agente Distribución   ⚙️  │
│      Enología y cosecha         │
│                                 │
│   💰 Agente Finanzas       ⚙️  │
│      Análisis financiero        │
│                                 │
└─────────────────────────────────┘
```

---

## 📱 Interacciones

### Sección "Tus chats"
- **Toggle** (▼/►): colapsar/expandir lista
- **[+]** inline: abre modal de nuevo chat
- **🔍 Search**: filtra chats por nombre
- **⭐ Favorites** / **#tags**: filtros rápidos
- **Click en chat**: abre conversación

### Sección "Agentes"
- **Toggle** (▼/►): colapsar/expandir lista
- **[+]** inline: abre workflow de nuevo agente (4 pasos)
- **Click en card**: abre librería de agentes (vista completa)
- **⚙️ Config**: abre modal de configuración (5 tabs)

---

## 🎯 Workflow: Nuevo Agente

### Paso 1: Información básica
```
┌──────────────────────────────────┐
│ [🤖] ← input emoji 2 chars       │
│                                  │
│ Nombre:                          │
│ ┌──────────────────────────────┐│
│ │ Agente Producción            ││
│ └──────────────────────────────┘│
│                                  │
│ Descripción:                     │
│ ┌──────────────────────────────┐│
│ │ Especializado en producción  ││
│ │ industrial, seguridad y...   ││
│ └──────────────────────────────┘│
│                                  │
│ [Cancelar]      [•••○]  [Siguiente →]
└──────────────────────────────────┘
```

**Validación**: nombre no vacío

---

### Paso 2: Instrucciones y contexto
```
┌──────────────────────────────────┐
│ Instrucciones base:              │
│ ┌──────────────────────────────┐│
│ │ Eres un experto en plantas   ││
│ │ industriales. Tu objetivo es ││
│ │ ayudar con:                  ││
│ │ - Análisis de métricas       ││
│ │ - Optimización de procesos   ││
│ │ - Interpretación de datos    ││
│ │                              ││
│ │ Prioriza siempre la seguridad││
│ └──────────────────────────────┘│
│                                  │
│ ℹ️ Estas instrucciones se usarán│
│    como base para todas las      │
│    conversaciones.               │
│                                  │
│ [← Atrás]      [•●•○]  [Siguiente →]
└──────────────────────────────────┘
```

**Validación**: ninguna (opcional)

---

### Paso 3: Acceso a datos
```
┌──────────────────────────────────┐
│ 🗄️ Entidades permitidas (5)     │
│                                  │
│ [Seleccionar todas]              │
│                                  │
│ ☑️ 🗄️ Plantas                   │
│    15 campos                     │
│                                  │
│ ☑️ 🗄️ Producción                │
│    Métricas de output            │
│    23 campos                     │
│                                  │
│ ☐ 🗄️ Seguridad                  │
│    Registro de incidentes        │
│    12 campos                     │
│                                  │
│ ...                              │
│                                  │
│ [← Atrás]      [•●●○]  [Siguiente →]
└──────────────────────────────────┘
```

**Features**:
- Select/deselect all
- Preview: nombre, descripción, # campos
- Scroll si hay muchas entidades

---

### Paso 4: Base de conocimiento
```
┌──────────────────────────────────┐
│ 📁 Carpetas de conocimiento (2)  │
│                                  │
│ ☑️ 📁 Manuales técnicos          │
│                                  │
│ ☑️ 📁 Normativa ISO              │
│                                  │
│ ☐ 📁 Procedimientos internos     │
│                                  │
│ ...                              │
│                                  │
│ ℹ️ Los documentos de estas       │
│    carpetas estarán disponibles  │
│    para el agente.               │
│                                  │
│ [← Atrás]      [••••]  [✓ Crear Agente]
└──────────────────────────────────┘
```

**Features**:
- Multi-select carpetas
- Preview: nombre
- Botón final: "Crear Agente" (con loading)

---

## 🎨 Estados de UI

### Toggle Cerrado
```
► Tus chats (15)           [+]
```

### Toggle Abierto
```
▼ Tus chats (15)           [+]
  🔍 Search chats...
  ⭐ Favorites  #tag1  #tag2
  ─────────────────────────
  💬 Chat 1
  💬 Chat 2
  ...
```

### Agente Card (Hover)
```
┌─────────────────────────────┐
│ 🏭  Agente Producción  [⚙️] │ ← gear visible on hover
│     Producción industrial   │
└─────────────────────────────┘
```

### Estado Vacío (Agentes)
```
▼ Agentes (0)              [+]
  
  No hay agentes creados.
  
  [Crear primer agente]
```

---

## 🔗 Flujos de Navegación

### Crear Chat con Agente
1. Click [+] en "Tus chats"
2. Modal: llenar nombre, instrucciones
3. Sección "Agente Especializado"
4. Click "Seleccionar agente de la librería"
5. Librería modal → grid de agentes
6. Click "Usar" en agente → asignado
7. Badge verde muestra agente seleccionado
8. Click "Create Copilot"

### Crear Nuevo Agente
1. Click [+] en "Agentes"
2. Workflow 4 pasos:
   - Paso 1: Información básica
   - Paso 2: Instrucciones
   - Paso 3: Entidades
   - Paso 4: Knowledge
3. Progress bar visual (•••○)
4. Click "Crear Agente"
5. Agente aparece en lista

### Configurar Agente Existente
1. Hover sobre agente en lista
2. Click [⚙️] config
3. `AgentConfigModal` (5 tabs):
   - General
   - Orchestrator
   - Analyst
   - Specialist
   - Synthesis
4. Editar prompts
5. Guardar

### Ver Todos los Agentes
1. Click en cualquier card de agente
2. Abre `AgentLibrary` (modal fullscreen)
3. Grid completo de agentes
4. Acciones: Usar, Configurar, Eliminar

---

## 📐 Especificaciones Técnicas

### Componentes Nuevos
- `NewAgentWorkflow.tsx`: wizard de 4 pasos
- Sección toggle "Tus chats" en sidebar
- Sección toggle "Agentes" en sidebar

### Estado Compartido
```tsx
const [showChatsSection, setShowChatsSection] = useState(true);
const [showAgentsSection, setShowAgentsSection] = useState(true);
const [showNewAgentModal, setShowNewAgentModal] = useState(false);
const [showAgentConfig, setShowAgentConfig] = useState(false);
const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
```

### Iconos Usados
- `CaretDown` / `CaretRight`: toggles
- `Plus`: crear nuevo (inline)
- `Robot`: agentes
- `Sparkle`: nuevo chat
- `GearSix`: configurar
- `Database`: entidades
- `Folder`: knowledge
- `ArrowLeft` / `ArrowRight`: navegación wizard
- `Check`: completado
- `SpinnerGap`: loading

---

## ✅ Ventajas de esta Organización

1. **Clara separación**: chats vs agentes
2. **Colapsable**: ahorra espacio visual
3. **Inline actions**: botones [+] y [⚙️] accesibles
4. **Preview rico**: cards de agentes con descripción
5. **Workflow guiado**: 4 pasos claros para nuevo agente
6. **Progreso visual**: progress bar + dots
7. **Validación por paso**: no avanza si falta info
8. **Flexibilidad**: puede colapsar secciones que no usa

---

## 🎯 Casos de Uso

### Usuario nuevo (sin agentes)
1. Ve "Agentes (0)" colapsado
2. Click [+] → workflow
3. Crea primer agente paso a paso
4. Agente aparece en lista

### Usuario avanzado (muchos agentes)
1. Colapsa sección "Agentes" si no la necesita
2. Focus en "Tus chats" expandido
3. Quick access a crear chat

### Usuario gestionando agentes
1. Expande "Agentes"
2. Hover → [⚙️] config
3. Edita prompts fácilmente
4. Cambios afectan a todos los chats que usan ese agente

---

## 🔮 Futuro

- **Drag & drop** para reordenar agentes
- **Search** en sección de agentes
- **Favoritos** para agentes más usados
- **Templates** de agentes predefinidos por industria
- **Compartir** agentes entre organizaciones
- **Duplicar** agente existente como base
- **Import/Export** de configuraciones de agentes
