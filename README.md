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
   
   Create or edit the `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your-openai-api-key-here
   ```

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

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run server` - Start backend API server
- `npm run seed` - Seed database with initial data

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI reporting | Yes (for AI features) |

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

## 📄 License

This project was created for manufacturing data management and AI-powered reporting.

## 🔗 Links

View your app in AI Studio: https://ai.studio/apps/drive/11yoKyjD9IBH8WKiPezuVSGERIgV0ESb-

---

**Built with ❤️ using React, TypeScript, and AI**
