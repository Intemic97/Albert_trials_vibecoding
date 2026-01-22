# 🚀 Prompts de Features - Knowledge Base y Dashboards Conectados

## Feature 1: Knowledge Base Mejorada

### Objetivo
Expandir el Knowledge Base para que no solo contenga datos estructurados (entidades/tablas), sino también documentos de múltiples fuentes (Google Drive, uploads locales) que puedan ser consultados y analizados por IA.

### Requisitos Funcionales

#### 1. Gestión de Documentos
- **Subida de archivos**: PDF, Word (.docx), Excel (.xlsx), CSV, texto plano
- **Extracción de contenido**: Usar librerías para extraer texto de documentos
- **Almacenamiento**: Guardar archivos en servidor (uploads/) y metadatos en BD
- **Organización**: Categorizar documentos por tipo, fecha, fuente

#### 2. Integración con Google Drive
- **Autenticación OAuth2**: Conectar cuenta de Google Drive
- **Selección de archivos**: Elegir archivos/carpetas específicas de Drive
- **Sincronización**: Opción de sincronización automática o manual
- **Permisos**: Gestionar permisos de acceso a archivos compartidos

#### 3. Búsqueda y Consulta
- **Búsqueda semántica**: Buscar contenido dentro de documentos usando IA
- **Menciones en prompts**: Permitir mencionar documentos con @DocumentName
- **Contexto para IA**: Incluir contenido de documentos relevantes en consultas
- **Resumen automático**: Generar resúmenes de documentos largos

#### 4. Integración con Entidades Existentes
- **Relaciones**: Vincular documentos con entidades específicas
- **Extracción estructurada**: Extraer datos de documentos y crear registros en entidades
- **Referencias cruzadas**: Documentos pueden referenciar entidades y viceversa

### Arquitectura Técnica

#### Base de Datos
```sql
CREATE TABLE knowledge_documents (
  id TEXT PRIMARY KEY,
  organizationId TEXT,
  name TEXT NOT NULL,
  type TEXT, -- 'file', 'google_drive', 'url'
  source TEXT, -- 'upload', 'google_drive', 'external'
  filePath TEXT,
  googleDriveId TEXT,
  googleDriveUrl TEXT,
  mimeType TEXT,
  fileSize INTEGER,
  extractedText TEXT, -- Texto extraído del documento
  summary TEXT, -- Resumen generado por IA
  metadata TEXT, -- JSON con metadatos adicionales
  tags TEXT, -- Tags separados por comas
  relatedEntityIds TEXT, -- IDs de entidades relacionadas (JSON array)
  uploadedBy TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY(organizationId) REFERENCES organizations(id),
  FOREIGN KEY(uploadedBy) REFERENCES users(id)
);

CREATE TABLE knowledge_document_chunks (
  id TEXT PRIMARY KEY,
  documentId TEXT,
  chunkIndex INTEGER,
  content TEXT,
  embedding TEXT, -- Para búsqueda semántica futura
  FOREIGN KEY(documentId) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);
```

#### Endpoints Backend
- `POST /api/knowledge/documents` - Subir documento
- `GET /api/knowledge/documents` - Listar documentos
- `GET /api/knowledge/documents/:id` - Obtener documento
- `DELETE /api/knowledge/documents/:id` - Eliminar documento
- `POST /api/knowledge/documents/:id/extract` - Extraer contenido
- `POST /api/knowledge/google-drive/connect` - Conectar Google Drive
- `POST /api/knowledge/google-drive/sync` - Sincronizar archivos
- `GET /api/knowledge/search` - Buscar en documentos
- `POST /api/knowledge/documents/:id/relate` - Relacionar con entidad

#### Componentes Frontend
- `KnowledgeBase.tsx` - Vista principal del Knowledge Base
- `DocumentUpload.tsx` - Componente para subir archivos
- `GoogleDriveIntegration.tsx` - Integración con Google Drive
- `DocumentList.tsx` - Lista de documentos
- `DocumentViewer.tsx` - Visualizador de documentos
- `DocumentSearch.tsx` - Búsqueda en documentos

### Flujo de Usuario

1. **Subir Documento**:
   - Usuario hace clic en "Add Document"
   - Selecciona archivo o conecta Google Drive
   - Sistema extrae texto automáticamente
   - Genera resumen con IA
   - Documento disponible para búsqueda

2. **Buscar en Documentos**:
   - Usuario escribe pregunta en Database Assistant
   - Sistema busca en documentos y entidades
   - Retorna resultados relevantes con contexto

3. **Relacionar con Entidades**:
   - Usuario puede vincular documento a entidad
   - Sistema puede extraer datos estructurados del documento

---

## Feature 2: Dashboards Conectados a Workflows

### Objetivo
Permitir que los dashboards se conecten a outputs de workflows, mostrando datos en tiempo real con visualizaciones generadas por IA mediante prompts.

### Requisitos Funcionales

#### 1. Grid Layout para Dashboards
- **Sistema de grid**: Layout tipo grid con drag & drop
- **Tamaños de widgets**: Pequeño, mediano, grande, full-width
- **Responsive**: Adaptación automática a diferentes tamaños de pantalla
- **Persistencia**: Guardar posiciones y tamaños de widgets

#### 2. Conexión con Workflows
- **Selección de workflow**: Elegir workflow y nodo específico
- **Selección de ejecución**: Usar última ejecución o ejecución específica
- **Output mapping**: Mapear outputs del workflow a datos del widget
- **Actualización automática**: Refrescar cuando se ejecuta el workflow

#### 3. Visualización por Prompt
- **Prompt de visualización**: Describir cómo visualizar los datos
- **Generación automática**: IA genera tipo de gráfico y configuración
- **Múltiples widgets**: Crear varios widgets desde un solo prompt
- **Edición manual**: Ajustar visualización después de generación

#### 4. Datos en Tiempo Real
- **Polling**: Consultar ejecuciones recientes periódicamente
- **WebSocket**: Actualizaciones en tiempo real cuando workflow se ejecuta
- **Historial**: Mostrar evolución de datos en el tiempo
- **Filtros temporales**: Filtrar por rango de fechas de ejecuciones

### Arquitectura Técnica

#### Base de Datos
```sql
CREATE TABLE dashboard_workflow_connections (
  id TEXT PRIMARY KEY,
  dashboardId TEXT,
  widgetId TEXT,
  workflowId TEXT,
  nodeId TEXT, -- Nodo específico del workflow
  executionId TEXT, -- Ejecución específica (opcional, null = última)
  outputPath TEXT, -- Path JSON para acceder a datos específicos (ej: "results.node1.outputData")
  refreshMode TEXT DEFAULT 'manual', -- 'manual', 'auto', 'realtime'
  refreshInterval INTEGER, -- Segundos para polling (si auto)
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY(dashboardId) REFERENCES dashboards(id) ON DELETE CASCADE,
  FOREIGN KEY(widgetId) REFERENCES widgets(id) ON DELETE CASCADE,
  FOREIGN KEY(workflowId) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Actualizar tabla widgets para soportar grid
ALTER TABLE widgets ADD COLUMN gridX INTEGER DEFAULT 0;
ALTER TABLE widgets ADD COLUMN gridY INTEGER DEFAULT 0;
ALTER TABLE widgets ADD COLUMN gridWidth INTEGER DEFAULT 1;
ALTER TABLE widgets ADD COLUMN gridHeight INTEGER DEFAULT 1;
ALTER TABLE widgets ADD COLUMN dataSource TEXT; -- 'entity', 'workflow', 'manual'
ALTER TABLE widgets ADD COLUMN workflowConnectionId TEXT;
```

#### Endpoints Backend
- `GET /api/workflows/:workflowId/executions` - Listar ejecuciones
- `GET /api/workflows/:workflowId/executions/:executionId` - Obtener ejecución específica
- `GET /api/workflows/:workflowId/executions/latest` - Última ejecución
- `POST /api/dashboards/:dashboardId/widgets/:widgetId/connect-workflow` - Conectar widget a workflow
- `GET /api/dashboards/:dashboardId/widgets/:widgetId/data` - Obtener datos del widget
- `PUT /api/widgets/:widgetId/grid` - Actualizar posición/tamaño en grid
- `POST /api/dashboards/:dashboardId/generate-widget-from-workflow` - Generar widget desde workflow output

#### Componentes Frontend
- `DashboardGrid.tsx` - Componente de grid con drag & drop
- `WorkflowDataSelector.tsx` - Selector de workflow y nodo
- `WidgetGridItem.tsx` - Item de widget en grid
- `WorkflowWidgetGenerator.tsx` - Generador de widgets desde workflow outputs
- `RealTimeDataUpdater.tsx` - Hook para actualización en tiempo real

### Flujo de Usuario

1. **Crear Widget desde Workflow**:
   - Usuario selecciona dashboard
   - Hace clic en "Add Widget from Workflow"
   - Selecciona workflow y nodo
   - Describe visualización con prompt: "Gráfico de barras mostrando ventas por mes"
   - Sistema genera widget con datos del workflow
   - Widget aparece en grid

2. **Conectar Widget Existente**:
   - Usuario selecciona widget existente
   - Hace clic en "Connect to Workflow"
   - Selecciona workflow y mapea outputs
   - Widget se actualiza con datos del workflow

3. **Actualización Automática**:
   - Cuando workflow se ejecuta, widgets conectados se actualizan
   - Usuario puede ver datos en tiempo real
   - Historial disponible para análisis temporal

### Tipos de Visualización Soportados
- Gráficos de barras
- Gráficos de líneas
- Gráficos de pastel
- Tablas de datos
- Métricas/KPIs
- Mapas de calor
- Gráficos de dispersión

---

## Prioridades de Implementación

### Fase 1: Knowledge Base Básico
1. Tabla de documentos en BD
2. Upload de archivos
3. Extracción de texto básica (PDF, texto)
4. Lista de documentos en UI
5. Búsqueda básica

### Fase 2: Knowledge Base Avanzado
1. Integración Google Drive
2. Extracción avanzada (Word, Excel)
3. Búsqueda semántica con IA
4. Relaciones con entidades

### Fase 3: Dashboards Grid
1. Sistema de grid layout
2. Drag & drop
3. Persistencia de posiciones

### Fase 4: Conexión Workflows
1. Conexión widget-workflow
2. Obtención de datos de ejecuciones
3. Generación de widgets desde prompts

### Fase 5: Tiempo Real
1. Polling de ejecuciones
2. WebSocket para actualizaciones
3. Historial temporal
