# Intemic Structure Manager

A modern data management application combining entity modeling, AI-powered reporting, and relational data structures for manufacturing and production environments.

![Intemic Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## 🌟 Features

### Entity & Data Management
- **Visual Entity Builder** - Create custom data structures with an intuitive interface
- **Property Types** - Support for text, numbers, URLs, and entity relations
- **Record Management** - Full CRUD operations for entity records
- **Relationship Mapping** - Link entities together with relational properties
- **Real-time Updates** - Instant synchronization across the application

### AI-Powered Reporting
- **Intelligent Report Generation** - AI-driven insights using OpenAI GPT-4
- **Smart Context** - Mention entities with `@EntityName` to include relevant data
- **Report Templates** - Pre-built templates for common GMP reports:
  - Production Summary Reports
  - Quality Control Reports
 - Batch Record Analysis
  - Equipment Utilization Reports
  - Deviation & CAPA Reports
- **PDF Export** - Download generated reports as formatted PDF documents
- **Markdown Formatting** - Beautiful report rendering with full Markdown support

### Data Visualization
- **Entity Cards** - Clean, organized view of entity metadata
- **Property Inspector** - Detailed view of entity properties and types
- **Record Tables** - Sortable and filterable data tables
- **Relational Navigation** - Click through related entities seamlessly

## 🚀 Getting Started

### Prerequisites
- **Node.js** v20.x or higher
- **npm** v10.x or higher

### Installation

1. **Clone or download the repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create or edit the `.env` file in the root directory (or `server/.env` for the API). Minimum for development:
   ```env
   OPENAI_API_KEY=your-openai-api-key-here
   ```
   For **production**, see **[docs/RUNBOOK.md](docs/RUNBOOK.md)** for required variables (JWT_SECRET, CORS_ORIGINS, ENCRYPTION_KEY) and the pre-deploy checklist.

4. **(Optional) Seed the database**
   
   To populate the database with sample data:
   ```bash
   npm run seed
   ```

### Running the Application

The application consists of two parts that need to run simultaneously:

#### 1. Start the Backend Server
```bash
npm run server
```
This starts the Express API server on `http://localhost:3001`

#### 2. Start the Frontend Dev Server
In a separate terminal:
```bash
npm run dev
```
This starts the Vite development server (typically on `http://localhost:5173`)

#### 3. Open the application
Navigate to the URL shown by Vite (usually `http://localhost:5173`)

## 📁 Project Structure

```
Albert_trials_vibecoding/
├── components/           # React components
│   ├── EntityCard.tsx   # Entity display component
│   ├── Reporting.tsx    # AI reporting interface
│   └── Sidebar.tsx      # Navigation sidebar
├── server/              # Backend API
│   ├── index.js         # Express server & API routes
│   ├── db.js            # SQLite database initialization
│   ├── seed.js          # Database seeding script
│   └── package.json     # Server dependencies
├── App.tsx              # Main application component
├── types.ts             # TypeScript type definitions
├── index.tsx            # Application entry point
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── database.sqlite      # SQLite database file
├── .env                 # Environment variables
└── package.json         # Project dependencies
```

## 🔧 Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icon library
- **React Markdown** - Markdown rendering
- **jsPDF & html2canvas** - PDF generation

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **SQLite3** - Embedded database
- **OpenAI API** - AI-powered report generation
- **CORS** - Cross-origin resource sharing

## 📊 Database Schema

The application uses SQLite with the following tables:

- **entities** - Entity definitions (name, description, author, etc.)
- **properties** - Entity properties and their types
- **records** - Individual entity records
- **record_values** - Property values for each record

## 🤖 AI Reporting

The AI reporting feature uses OpenAI's GPT-4 model to generate intelligent insights:

1. **Mention entities** using `@EntityName` syntax in your prompt
2. **Select templates** or write custom prompts
3. **Generate reports** with contextual data from your entities
4. **Export to PDF** for sharing and documentation

Example prompt:
```
Analyze the capacity of @Facilities/Factories and identify any bottlenecks in @Equipments
```

## 📝 Available Scripts

- `npm run dev` - Arrancar frontend (Vite)
- `npm run build` - Build para producción
- `npm run preview` - Vista previa del build
- `npm run server` - Arrancar API (Express)
- `npm run seed` - Poblar BD con datos iniciales
- `npm run migrate-tables` - Crear tablas faltantes (`data_connections`, `standards`, etc.)

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI reporting | Sí (para funciones AI) |
| `JWT_SECRET` | Secreto para JWTs (producción) | **Sí en producción** |
| `CORS_ORIGINS` | Orígenes permitidos (producción) | **Sí en producción** |
| `ENCRYPTION_KEY` | Clave para cifrado de campos sensibles | Si usas cifrado |

**Producción:** variables obligatorias, checklist pre-deploy y buenas prácticas → **[docs/RUNBOOK.md](docs/RUNBOOK.md)**.

## 📚 Documentación

| Documento | Contenido |
|-----------|-----------|
| **[RUNBOOK.md](docs/RUNBOOK.md)** | Variables de entorno obligatorias, checklist pre-deploy, revisión de rutas (auth + orgId). |
| **[UX_PATTERNS.md](docs/UX_PATTERNS.md)** | Patrones de UX: confirmaciones destructivas (ConfirmDialog), carga/error y reintentar en flujos críticos. |
| **[SECURITY_ROADMAP.md](docs/SECURITY_ROADMAP.md)** | Roadmap de seguridad (SOC 2, GDPR, ISO 27001), módulos en `server/security/`. |
| **[CONTEXTO_PLATAFORMA.md](docs/CONTEXTO_PLATAFORMA.md)** | Contexto general de la plataforma. |
| **[PROMPT_GPT_CREAR_PAQUETE_CASO_DE_USO.md](docs/PROMPT_GPT_CREAR_PAQUETE_CASO_DE_USO.md)** | Cómo crear paquetes de caso de uso para importar. |

## 📦 Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

## 🛠️ Development Tips

- **Hot Module Replacement (HMR)** is enabled by default in dev mode
- **TypeScript errors** are checked during development
- **Database changes** require server restart
- **Frontend changes** reload automatically via HMR

## 🐛 Troubleshooting

### Port already in use
If port 3001 is already in use, modify the `PORT` constant in `server/index.js`

### Database locked
Stop all running instances of the server before running `npm run seed`

### OpenAI API errors
Verify your API key is correctly set in the `.env` file and has sufficient credits

## 📋 Resumen del proyecto

**Qué es:** Aplicación de gestión de datos (entidades, propiedades, registros), Base de Conocimiento con carpetas/documentos, workflows, dashboards, reportes AI e integraciones. Multi-tenant por organización; autenticación JWT.

**Stack:** Frontend React 19 + TypeScript + Vite + Tailwind; backend Express + SQLite; seguridad en `server/security/` (RBAC, cifrado, GDPR, SSO).

**Mejoras recientes (seguridad y UX):**
- **Runbook:** Variables de entorno obligatorias en producción (JWT_SECRET, CORS_ORIGINS, ENCRYPTION_KEY), checklist pre-deploy y criterios de rutas (authenticateToken, filtro por organizationId).
- **Confirmaciones destructivas:** Unificadas con `ConfirmDialog` y hook `useDestructiveConfirm` (Knowledge Base: borrar carpeta, entidad, documento, borrado masivo).
- **Flujos críticos:** Patrón documentado en `docs/UX_PATTERNS.md` (spinner + mensaje, error + Reintentar). Aplicado en “Crear entidad” (loading, error, botón Reintentar).
- **Revisión de rutas:** RUNBOOK actualizado con estado de rutas (entities, knowledge, dataConnections, dashboards, workflows, ai con auth + orgId; excepciones webhook/run-public; recomendaciones para `/files/:filename` y properties).
- **i18n:** Español por defecto; claves `knowledgeBase.*` y `common.retry`; API client unificado en `api/` con tipos compartidos.

**Arranque rápido:** `npm install` → configurar `.env` (ver RUNBOOK para producción) → `npm run server` + `npm run dev`.

## 📄 License

This project was created for manufacturing data management and AI-powered reporting.

## 🔗 Links

View your app in AI Studio: https://ai.studio/apps/drive/11yoKyjD9IBH8WKiPezuVSGERIgV0ESb-

---

**Built with ❤️ using React, TypeScript, and AI**
