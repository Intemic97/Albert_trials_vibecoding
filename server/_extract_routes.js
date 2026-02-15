/**
 * Helper script to extract route sections from index.js into modular route files.
 * Run once, then delete this file.
 */
const fs = require('fs');
const path = require('path');

const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const lines = indexContent.split('\n');

// Utility: extract lines from index.js (1-indexed)
function extractLines(start, end) {
    return lines.slice(start - 1, end).join('\n');
}

// Replace 'app.' with 'router.' in route definitions
function convertRoutes(code) {
    return code
        .replace(/^app\.(get|post|put|patch|delete)\(/gm, 'router.$1(')
        .replace(/^    app\.(get|post|put|patch|delete)\(/gm, '    router.$1(')
        // Remove '/api' prefix from route paths
        .replace(/router\.(get|post|put|patch|delete)\('\/api\//g, "router.$1('/");
}

const routesDir = path.join(__dirname, 'routes');
if (!fs.existsSync(routesDir)) {
    fs.mkdirSync(routesDir, { recursive: true });
}

// ============================================================
// ADMIN ROUTES (lines 1233-1700)
// ============================================================
const adminCode = convertRoutes(extractLines(1265, 1698));
fs.writeFileSync(path.join(routesDir, 'admin.js'), `/**
 * Admin & Audit Log Routes
 * 
 * Handles: audit logs, AI audit logs, admin stats, user management.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../auth');
const { generateId, logActivity } = require('../utils/helpers');

module.exports = function({ db }) {

${adminCode}

    return router;
};
`);
console.log('Created routes/admin.js');

// ============================================================
// FILES ROUTES (lines 1700-2192)
// ============================================================
const filesHelpers = extractLines(1920, 1941); // parseCSVLine
const filesHelpers2 = extractLines(2131, 2172); // extractFileContent
const filesRoutes = convertRoutes(extractLines(1700, 1919));
const filesGCS = convertRoutes(extractLines(1943, 2128));
const filesContent = convertRoutes(extractLines(2174, 2191));

fs.writeFileSync(path.join(routesDir, 'files.js'), `/**
 * File Upload, Parse & GCS Routes
 * 
 * Handles: file uploads, spreadsheet/PDF parsing, GCS storage,
 * file content extraction.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const { authenticateToken } = require('../auth');
const { gcsService } = require('../gcsService');

module.exports = function({ db, upload, uploadsDir }) {

    // Helper function to parse CSV lines (handles quoted values with commas)
${filesHelpers}

    // Helper function to extract text from files
${filesHelpers2}

${filesRoutes}

${filesGCS}

${filesContent}

    return router;
};
`);
console.log('Created routes/files.js');

// ============================================================
// ENTITIES ROUTES (lines 2193-2612)
// ============================================================
const entitiesHelper = extractLines(2323, 2376); // resolveRelationValue
const entitiesRoutes = convertRoutes(extractLines(2193, 2322) + '\n' + extractLines(2377, 2612));

fs.writeFileSync(path.join(routesDir, 'entities.js'), `/**
 * Entity & Record Routes
 * 
 * Handles: entities CRUD, properties, records CRUD, entity audit trail.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');
const { openDb } = require('../db');

module.exports = function({ db }) {

    // Helper to resolve relation values
${entitiesHelper}

${entitiesRoutes}

    return router;
};
`);
console.log('Created routes/entities.js');

// ============================================================
// COPILOT ROUTES (lines 2613-3582)
// ============================================================
const copilotHelper = extractLines(3198, 3206); // mergeEntitiesForAsk
const copilotRoutes = convertRoutes(extractLines(2613, 3197) + '\n' + extractLines(3207, 3582));

fs.writeFileSync(path.join(routesDir, 'copilot.js'), `/**
 * Copilot & Database Assistant Routes
 * 
 * Handles: database assistant, copilot chats, agents, AI ask, text generation.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireOrgAdmin } = require('../auth');
const { generateId } = require('../utils/helpers');
const agentOrchestrator = require('../services/agentOrchestrator');
const agentService = require('../services/agentService');

module.exports = function({ db, aiRateLimit }) {

    // Helper: merge entity lists for ask
${copilotHelper}

${copilotRoutes}

    return router;
};
`);
console.log('Created routes/copilot.js');

// ============================================================
// AI ROUTES (lines 3583-4889)
// ============================================================
const aiHelper = extractLines(4262, 4336); // sanitizeWidgetConfig
const aiRoutes = convertRoutes(extractLines(3583, 4261) + '\n' + extractLines(4337, 4889));

fs.writeFileSync(path.join(routesDir, 'ai.js'), `/**
 * AI & Code Execution Routes
 * 
 * Handles: Python execution, Franmit, debug, code generation,
 * widget generation, workflow generation, workflow assistant.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');

module.exports = function({ db }) {

    // Helper: sanitize widget config from LLM output
${aiHelper}

${aiRoutes}

    return router;
};
`);
console.log('Created routes/ai.js');

// ============================================================
// DASHBOARDS ROUTES (lines 4890-5185, 6274-6485, 6973-7000, 7800-7931)
// ============================================================
const dashRoutes1 = convertRoutes(extractLines(4890, 5185));
const dashRoutes2 = convertRoutes(extractLines(6274, 6485));
const dashRoutes3 = convertRoutes(extractLines(6973, 7000));
const dashRoutes4 = convertRoutes(extractLines(7800, 7931));

fs.writeFileSync(path.join(routesDir, 'dashboards.js'), `/**
 * Dashboard & Widget Routes
 * 
 * Handles: dashboards CRUD, widgets CRUD, dashboard-workflow connections,
 * widget grid, overview stats.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');

module.exports = function({ db }) {

${dashRoutes1}

    // ==================== DASHBOARD-WORKFLOW CONNECTION ====================

${dashRoutes2}

    // ==================== WIDGET GRID ====================

${dashRoutes3}

    // ==================== OVERVIEW STATS ====================

${dashRoutes4}

    return router;
};
`);
console.log('Created routes/dashboards.js');

// ============================================================
// SIMULATIONS ROUTES (lines 5186-5703)
// ============================================================
const simRoutes = convertRoutes(extractLines(5186, 5703));

fs.writeFileSync(path.join(routesDir, 'simulations.js'), `/**
 * Simulations & Use Case Import Routes
 * 
 * Handles: use case package import/validation, simulations CRUD,
 * simulation chat, shared links.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');
const { importUseCasePackage, validateUseCasePackage } = require('../useCaseImporter');

module.exports = function({ db }) {

${simRoutes}

    return router;
};
`);
console.log('Created routes/simulations.js');

// ============================================================
// KNOWLEDGE ROUTES (lines 5704-6273)
// ============================================================
const knowledgeRoutes = convertRoutes(extractLines(5704, 6273));

fs.writeFileSync(path.join(routesDir, 'knowledge.js'), `/**
 * Knowledge Base Routes
 * 
 * Handles: knowledge documents, folders, search, entity extraction.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');
const { extractStructuredFromText } = require('../services/langExtractService');

module.exports = function({ db }) {

    // Configure multer for knowledge uploads
    const knowledgeUpload = multer({ 
        dest: 'server/uploads/knowledge/',
        limits: { fileSize: 50 * 1024 * 1024 }
    });

${knowledgeRoutes}

    return router;
};
`);
console.log('Created routes/knowledge.js');

// ============================================================
// DATA CONNECTIONS ROUTES (lines 6486-6972)
// ============================================================
const dcRoutes = convertRoutes(extractLines(6486, 6972));

fs.writeFileSync(path.join(routesDir, 'dataConnections.js'), `/**
 * Standards & Data Connections Routes
 * 
 * Handles: compliance standards, OT/IT data connections, connection testing.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');
const { getConnectionHealthChecker } = require('../utils/otConnections');

module.exports = function({ db }) {

${dcRoutes}

    return router;
};
`);
console.log('Created routes/dataConnections.js');

// ============================================================
// WORKFLOWS ROUTES (lines 7001-7195, 7196-7407, 7408-7948, 7932-8070)
// ============================================================
const wfRoutes = convertRoutes(extractLines(7001, 8070));

fs.writeFileSync(path.join(routesDir, 'workflows.js'), `/**
 * Workflow Routes
 * 
 * Handles: workflows CRUD, webhooks, public forms, execution,
 * execution history, Prefect health, approvals.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');
const { WorkflowExecutor } = require('../workflowExecutor');
const { prefectClient } = require('../prefectClient');
const { getPollingService } = require('../executionPolling');

module.exports = function({ db, broadcastToOrganization }) {

${wfRoutes}

    return router;
};
`);
console.log('Created routes/workflows.js');

// ============================================================
// INTEGRATIONS ROUTES (lines 8071-8308, 10330-10628)
// ============================================================
const intRoutes1 = convertRoutes(extractLines(8071, 8308));
const slackHelper = extractLines(10333, 10357); // sendSlackMessage
const intRoutes2 = convertRoutes(extractLines(10358, 10628));

fs.writeFileSync(path.join(routesDir, 'integrations.js'), `/**
 * Integrations & External Services Routes
 * 
 * Handles: HTTP proxy, MySQL queries, email/SMS/WhatsApp sending,
 * node feedback, Slack integration.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../auth');
const { generateId } = require('../utils/helpers');

module.exports = function({ db }) {

${intRoutes1}

    // ==================== SLACK INTEGRATION ====================

    // Helper function to send messages to Slack
${slackHelper}

${intRoutes2}

    return router;
};
`);
console.log('Created routes/integrations.js');

// ============================================================
// BILLING ROUTES (lines 8309-8482, 10205-10329)
// ============================================================
const billingRoutes1 = convertRoutes(extractLines(8309, 8482));
const billingRoutes2 = convertRoutes(extractLines(10205, 10329));

fs.writeFileSync(path.join(routesDir, 'billing.js'), `/**
 * Billing & Stripe Routes
 * 
 * Handles: subscription management, checkout sessions, portal sessions,
 * quotation requests, Stripe webhooks.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');

module.exports = function({ db, stripe, STRIPE_PRICES }) {

${billingRoutes1}

    // ==================== STRIPE WEBHOOK ====================

${billingRoutes2}

    return router;
};
`);
console.log('Created routes/billing.js');

// ============================================================
// REPORTS ROUTES (lines 8483-10204)
// ============================================================
const reportsHelpers = extractLines(8485, 8662); // normalizeTemplateGenerationResult + buildFlatTemplateSections
const reportsRoutes = convertRoutes(extractLines(8663, 10204));

fs.writeFileSync(path.join(routesDir, 'reports.js'), `/**
 * Reports & Report Templates Routes
 * 
 * Handles: report templates, reports CRUD, report sections,
 * comments, AI assistant for reports.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticateToken } = require('../auth');
const { generateId } = require('../utils/helpers');

module.exports = function({ db }) {

    // Helper functions for report templates
${reportsHelpers}

    // Configure storage for AI assistant files
    const aiAssistantStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '..', 'uploads', 'ai-assistant');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + '-' + file.originalname);
        }
    });
    const aiUpload = multer({ storage: aiAssistantStorage });

${reportsRoutes}

    return router;
};
`);
console.log('Created routes/reports.js');

// ============================================================
// Create routes/index.js
// ============================================================
fs.writeFileSync(path.join(routesDir, 'index.js'), `/**
 * Routes Index
 * 
 * Centralized export of all route modules.
 * Each module is a factory function that receives dependencies
 * and returns an Express Router.
 */

module.exports = {
    authRoutes: require('./auth'),
    notificationRoutes: require('./notifications'),
    adminRoutes: require('./admin'),
    fileRoutes: require('./files'),
    entityRoutes: require('./entities'),
    copilotRoutes: require('./copilot'),
    aiRoutes: require('./ai'),
    dashboardRoutes: require('./dashboards'),
    simulationRoutes: require('./simulations'),
    knowledgeRoutes: require('./knowledge'),
    dataConnectionRoutes: require('./dataConnections'),
    workflowRoutes: require('./workflows'),
    integrationRoutes: require('./integrations'),
    billingRoutes: require('./billing'),
    reportRoutes: require('./reports'),
};
`);
console.log('Created routes/index.js');

console.log('\n✅ All route files created successfully!');
console.log('Total route files: 15 + index');

