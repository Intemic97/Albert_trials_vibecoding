const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const { initDb, openDb } = require('./db');
const { WorkflowExecutor, setBroadcastToOrganization } = require('./workflowExecutor');
const { prefectClient } = require('./prefectClient');
const { initPollingService } = require('./executionPolling');
const { getConnectionHealthChecker } = require('./utils/otConnections');
const workflowScheduler = require('./services/workflowScheduler');
const cookieParser = require('cookie-parser');

// Load environment variables
const envPath = path.join(__dirname, '.env');
console.log('[ENV] Attempting to load .env from:', envPath);
console.log('[ENV] File exists:', fs.existsSync(envPath));

const result1 = require('dotenv').config({ path: envPath });
if (result1.error) {
    console.error('[ENV] Error loading .env:', result1.error);
}
if (!process.env.OPENAI_API_KEY) {
    require('dotenv').config();
}

const openaiKey = process.env.OPENAI_API_KEY;
console.log('[ENV] OPENAI_API_KEY cargada:', openaiKey ? `✅ SÍ (length: ${openaiKey.length}, starts with: ${openaiKey.substring(0, 20)}...)` : '❌ NO - VARIABLE NO ENCONTRADA');
if (!openaiKey) {
    console.error('[ENV] ERROR: OPENAI_API_KEY no está configurada. Verifica el archivo .env');
    console.error('[ENV] Variables disponibles:', Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY')).join(', '));
}

// Stripe configuration
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const STRIPE_PRICES = {
    pro: process.env.STRIPE_PRICE_PRO || 'price_pro_15_eur',
    business: process.env.STRIPE_PRICE_BUSINESS || 'price_business_45_eur'
};

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// ==================== RATE LIMITER ====================

const AI_RATE_LIMIT = parseInt(process.env.AI_RATE_LIMIT_PER_MIN || '30', 10);
const aiRateLimitMap = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of aiRateLimitMap.entries()) {
        if (now - data.windowStart > 60000) aiRateLimitMap.delete(key);
    }
}, 60000);
function aiRateLimit(req, res, next) {
    const key = `${req.user?.sub || req.ip}-${req.user?.orgId || 'anon'}`;
    const now = Date.now();
    let data = aiRateLimitMap.get(key);
    if (!data || now - data.windowStart > 60000) {
        data = { count: 0, windowStart: now };
        aiRateLimitMap.set(key, data);
    }
    data.count++;
    if (data.count > AI_RATE_LIMIT) {
        return res.status(429).json({ error: `Límite de ${AI_RATE_LIMIT} preguntas por minuto alcanzado. Espera unos segundos.` });
    }
    next();
}

// ==================== WEBSOCKET SETUP ====================
const jwt = require('jsonwebtoken');
const WS_JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const wss = new WebSocketServer({ noServer: true });

// Authenticate WebSocket connections via JWT cookie on HTTP upgrade
server.on('upgrade', (request, socket, head) => {
    // Only handle /ws path
    if (request.url !== '/ws') {
        socket.destroy();
        return;
    }

    // Parse auth_token from cookie header
    const cookieHeader = request.headers.cookie || '';
    const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
        console.warn('[WS] Connection rejected: no auth_token cookie');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    jwt.verify(token, WS_JWT_SECRET, (err, user) => {
        if (err) {
            console.warn('[WS] Connection rejected: invalid JWT');
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
        }

        // Attach verified user to request for use in connection handler
        request.authenticatedUser = { ...user, id: user.sub };

        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });
});

// Track users per workflow: { workflowId: Map<socketId, { ws, user, cursor }> }
const workflowRooms = new Map();

// Track users by organization: { orgId: Set<ws> }
const organizationConnections = new Map();

// Generate unique socket ID
let socketIdCounter = 0;
const generateSocketId = () => `socket_${++socketIdCounter}_${Date.now()}`;

// Cursor colors for different users
const CURSOR_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4'
];

// Heartbeat to detect disconnected clients
const HEARTBEAT_INTERVAL = 10000;

setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('[WS] Terminating inactive connection');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws, request) => {
    const socketId = generateSocketId();
    let currentWorkflowId = null;
    let userData = null;
    
    // Verified user from JWT (set during upgrade handshake)
    const verifiedUser = request.authenticatedUser;
    
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'subscribe_ot_alerts': {
                    // Use verified orgId from JWT, ignore client-sent orgId
                    const verifiedOrgIdAlerts = verifiedUser.orgId;
                    if (!verifiedOrgIdAlerts) {
                        ws.send(JSON.stringify({ type: 'error', message: 'No organization in token' }));
                        return;
                    }
                    if (!organizationConnections.has(verifiedOrgIdAlerts)) {
                        organizationConnections.set(verifiedOrgIdAlerts, new Set());
                    }
                    organizationConnections.get(verifiedOrgIdAlerts).add(ws);
                    ws.send(JSON.stringify({ type: 'ot_alerts_subscribed', orgId: verifiedOrgIdAlerts }));
                    break;
                }
                
                case 'subscribe_ot_metrics': {
                    // Use verified orgId from JWT, ignore client-sent orgId
                    const verifiedOrgIdMetrics = verifiedUser.orgId;
                    if (!verifiedOrgIdMetrics) {
                        ws.send(JSON.stringify({ type: 'error', message: 'No organization in token' }));
                        return;
                    }
                    if (!organizationConnections.has(verifiedOrgIdMetrics)) {
                        organizationConnections.set(verifiedOrgIdMetrics, new Set());
                    }
                    organizationConnections.get(verifiedOrgIdMetrics).add(ws);
                    ws.send(JSON.stringify({ type: 'ot_metrics_subscribed', orgId: verifiedOrgIdMetrics }));
                    break;
                }
                
                case 'join': {
                    const { workflowId: rawWorkflowId, user } = message;
                    const workflowId = rawWorkflowId ? String(rawWorkflowId) : null;
                    // SECURITY: Use orgId from verified JWT, never from client message
                    const orgId = verifiedUser.orgId;
                    
                    console.log(`[WS] Join request - workflowId: "${workflowId}" (type: ${typeof rawWorkflowId}), user: ${verifiedUser.id}, org: ${orgId} (JWT-verified)`);
                    
                    if (!workflowId) {
                        console.log('[WS] REJECTED: Missing workflowId');
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing workflowId' }));
                        return;
                    }
                    
                    (async () => {
                        try {
                            // Directly query with org filter — no need for separate orgId check
                            const workflow = await db.get(
                                'SELECT id, organizationId FROM workflows WHERE id = ? AND organizationId = ?',
                                [workflowId, orgId]
                            );
                            
                            if (!workflow) {
                                console.log(`[WS] SECURITY: Workflow ${workflowId} not found or not in org ${orgId}`);
                                ws.send(JSON.stringify({ type: 'error', message: 'Workflow not found' }));
                                return;
                            }
                            
                            console.log(`[WS] SECURITY: User ${verifiedUser.id} validated for workflow ${workflowId} in org ${orgId} (JWT-verified)`);
                            
                            if (currentWorkflowId) {
                                leaveRoom(socketId, currentWorkflowId);
                            }
                            
                            currentWorkflowId = workflowId;
                            // Use JWT-verified id, but allow client to send display info (name, photo)
                            userData = { ...user, id: verifiedUser.id };
                            
                            if (!workflowRooms.has(workflowId)) {
                                workflowRooms.set(workflowId, new Map());
                            }
                            
                            const room = workflowRooms.get(workflowId);
                            const colorIndex = room.size % CURSOR_COLORS.length;
                            
                            room.set(socketId, {
                                ws,
                                workflowId,
                                user: {
                                    id: verifiedUser.id,
                                    name: verifiedUser.name || user?.name || verifiedUser.email?.split('@')[0] || 'Anonymous',
                                    color: CURSOR_COLORS[colorIndex],
                                    profilePhoto: user?.profilePhoto
                                },
                                cursor: null,
                                orgId: orgId
                            });

                            if (orgId) {
                                if (!organizationConnections.has(orgId)) {
                                    organizationConnections.set(orgId, new Set());
                                }
                                organizationConnections.get(orgId).add(ws);
                            }
                            
                            const existingUsers = [];
                            room.forEach((data, id) => {
                                if (id !== socketId && data.user?.id !== verifiedUser.id) {
                                    existingUsers.push({
                                        id,
                                        user: data.user,
                                        cursor: data.cursor
                                    });
                                }
                            });
                            
                            ws.send(JSON.stringify({
                                type: 'room_state',
                                workflowId,
                                users: existingUsers,
                                yourId: socketId,
                                yourColor: CURSOR_COLORS[colorIndex]
                            }));
                            
                            const newUserData = room.get(socketId);
                            broadcastToRoom(workflowId, {
                                type: 'user_joined',
                                id: socketId,
                                user: newUserData.user
                            }, socketId, verifiedUser.id);
                            
                        } catch (err) {
                            console.error('[WS] Error validating join:', err);
                            ws.send(JSON.stringify({ type: 'error', message: 'Server error during validation' }));
                        }
                    })();
                    
                    break;
                }
                
                case 'cursor_move': {
                    const { x, y, canvasX, canvasY } = message;
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        const room = workflowRooms.get(currentWorkflowId);
                        const userEntry = room.get(socketId);
                        if (userEntry) {
                            userEntry.cursor = { x, y, canvasX, canvasY };
                            broadcastToRoom(currentWorkflowId, {
                                type: 'cursor_update',
                                id: socketId,
                                cursor: { x, y, canvasX, canvasY }
                            }, socketId, userEntry.user?.id);
                        }
                    }
                    break;
                }
                
                case 'node_move': {
                    const { nodeId, x, y } = message;
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        broadcastToRoom(currentWorkflowId, {
                            type: 'node_update',
                            nodeId, x, y,
                            movedBy: socketId
                        }, socketId);
                    }
                    break;
                }
                
                case 'node_add': {
                    const { node } = message;
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        broadcastToRoom(currentWorkflowId, {
                            type: 'node_added',
                            node,
                            addedBy: socketId
                        }, socketId);
                    }
                    break;
                }
                
                case 'node_delete': {
                    const { nodeId } = message;
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        broadcastToRoom(currentWorkflowId, {
                            type: 'node_deleted',
                            nodeId,
                            deletedBy: socketId
                        }, socketId);
                    }
                    break;
                }
                
                case 'connection_add': {
                    const { connection } = message;
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        broadcastToRoom(currentWorkflowId, {
                            type: 'connection_added',
                            connection,
                            addedBy: socketId
                        }, socketId);
                    }
                    break;
                }
                
                case 'connection_delete': {
                    const { connectionId } = message;
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        broadcastToRoom(currentWorkflowId, {
                            type: 'connection_deleted',
                            connectionId,
                            deletedBy: socketId
                        }, socketId);
                    }
                    break;
                }
                
                case 'node_update_props': {
                    const { nodeId, updates } = message;
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        broadcastToRoom(currentWorkflowId, {
                            type: 'node_props_updated',
                            nodeId,
                            updates,
                            updatedBy: socketId
                        }, socketId);
                    }
                    break;
                }
                
                case 'workflow_run_start': {
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        broadcastToRoom(currentWorkflowId, {
                            type: 'workflow_running',
                            startedBy: socketId,
                            userName: userData?.name || 'Unknown'
                        }, socketId);
                    }
                    break;
                }
                
                case 'workflow_run_complete': {
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        broadcastToRoom(currentWorkflowId, {
                            type: 'workflow_completed',
                            completedBy: socketId,
                            userName: userData?.name || 'Unknown'
                        }, socketId);
                    }
                    break;
                }
                
                case 'leave': {
                    leaveRoom(socketId, currentWorkflowId);
                    currentWorkflowId = null;
                    userData = null;
                    break;
                }
            }
        } catch (err) {
            console.error('WebSocket message error:', err);
        }
    });
    
    ws.on('close', () => {
        console.log(`[WS] Connection closed for socket ${socketId}`);
        const userData = currentWorkflowId && workflowRooms.has(currentWorkflowId) 
            ? workflowRooms.get(currentWorkflowId).get(socketId) 
            : null;
        const orgId = userData?.orgId;
        
        leaveRoom(socketId, currentWorkflowId);
        
        if (orgId && organizationConnections.has(orgId)) {
            organizationConnections.get(orgId).delete(ws);
            if (organizationConnections.get(orgId).size === 0) {
                organizationConnections.delete(orgId);
            }
        }
    });
    
    ws.on('error', (err) => {
        console.error(`[WS] Error for socket ${socketId}:`, err);
        leaveRoom(socketId, currentWorkflowId);
    });
});

function broadcastToRoom(workflowId, message, excludeSocketId = null, excludeUserId = null) {
    if (!workflowId || !workflowRooms.has(workflowId)) return;
    
    const room = workflowRooms.get(workflowId);
    const messageWithWorkflow = { ...message, workflowId };
    const messageStr = JSON.stringify(messageWithWorkflow);
    
    room.forEach((data, id) => {
        if (id === excludeSocketId) return;
        if (excludeUserId && data.user && data.user.id === excludeUserId) return;
        if (data.workflowId && data.workflowId !== workflowId) {
            console.warn(`[WS] MISMATCH: User ${data.user?.id} in room ${workflowId} but has stored workflowId ${data.workflowId}`);
            return;
        }
        if (data.ws.readyState === 1) {
            data.ws.send(messageStr);
        }
    });
}

function leaveRoom(socketId, workflowId) {
    if (!workflowId || !workflowRooms.has(workflowId)) return;
    
    const room = workflowRooms.get(workflowId);
    if (room.has(socketId)) {
        const userData = room.get(socketId);
        const orgId = userData?.orgId;
        
        console.log(`[WS] User ${userData?.user?.name || socketId} left workflow ${workflowId} (${room.size - 1} users remaining)`);
        
        room.delete(socketId);
        
        if (orgId && organizationConnections.has(orgId)) {
            organizationConnections.get(orgId).delete(userData.ws);
            if (organizationConnections.get(orgId).size === 0) {
                organizationConnections.delete(orgId);
            }
        }
        
        broadcastToRoom(workflowId, {
            type: 'user_left',
            id: socketId
        });
        
        if (room.size === 0) {
            workflowRooms.delete(workflowId);
            console.log(`[WS] Room ${workflowId} closed (no users)`);
        }
    }
}

/**
 * Broadcast message to all users in an organization
 */
function broadcastToOrganization(orgId, message) {
    if (!orgId || !organizationConnections.has(orgId)) return;
    
    const connections = organizationConnections.get(orgId);
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    connections.forEach((ws) => {
        if (ws.readyState === 1) {
            try {
                ws.send(messageStr);
                sentCount++;
            } catch (error) {
                console.error('[WS] Error broadcasting to organization:', error);
            }
        }
    });
    
    return sentCount;
}

// ==================== END WEBSOCKET SETUP ====================

// Initialize execution polling service
initPollingService(broadcastToOrganization);

// ==================== MULTER SETUP ====================

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/json',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv'
        ];
        
        if (file.mimetype.startsWith('image/') || allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            console.log(`[Upload] Rejected file type: ${file.mimetype} for file: ${file.originalname}`);
            cb(new Error(`File type not allowed: ${file.mimetype}`), false);
        }
    }
});

// ==================== MIDDLEWARE ====================

// CORS origins from env var (comma-separated) with dev defaults
const DEFAULT_CORS_ORIGINS = 'http://localhost:5173,http://localhost:5174,http://localhost:5175';
const corsOrigins = (process.env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS)
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
console.log(`[CORS] Allowed origins: ${corsOrigins.join(', ')}`);

app.use(cors({
    origin: corsOrigins,
    credentials: true
}));

// Stripe webhook needs raw body - must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes - increased limit for large workflows with embedded data
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// ==================== GLOBAL RATE LIMITING FOR PUBLIC ENDPOINTS ====================

const AUTH_RATE_LIMIT_PER_MIN = parseInt(process.env.AUTH_RATE_LIMIT_PER_MIN || '20', 10);
const authRateLimitMap = new Map();

// Cleanup stale entries every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of authRateLimitMap.entries()) {
        if (now - data.windowStart > 120000) authRateLimitMap.delete(key);
    }
}, 120000);

function authRateLimit(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    let data = authRateLimitMap.get(ip);
    if (!data || now - data.windowStart > 60000) {
        data = { count: 0, windowStart: now };
        authRateLimitMap.set(ip, data);
    }
    data.count++;
    if (data.count > AUTH_RATE_LIMIT_PER_MIN) {
        console.warn(`[SECURITY] Auth rate limit exceeded for IP ${ip} on ${req.method} ${req.path}`);
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
}

// Apply rate limiting to all public auth endpoints
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/register', authRateLimit);
app.use('/api/auth/forgot-password', authRateLimit);
app.use('/api/auth/reset-password', authRateLimit);
app.use('/api/auth/resend-verification', authRateLimit);
app.use('/api/auth/register-with-invitation', authRateLimit);
// Slack public webhook
app.use('/api/slack/database-assistant', authRateLimit);

// ==================== DATABASE & SERVER START ====================

let db;

// Shared dependencies passed to all route modules
const getDeps = () => ({
    db,
    upload,
    uploadsDir,
    broadcastToOrganization,
    aiRateLimit,
    stripe,
    STRIPE_PRICES
});

// Import route modules
const {
    authRoutes,
    notificationRoutes,
    adminRoutes,
    fileRoutes,
    entityRoutes,
    copilotRoutes,
    aiRoutes,
    dashboardRoutes,
    simulationRoutes,
    knowledgeRoutes,
    dataConnectionRoutes,
    workflowRoutes,
    integrationRoutes,
    billingRoutes,
    reportRoutes,
} = require('./routes');

// Initialize DB and start server
initDb().then(database => {
    db = database;
    console.log('Database initialized');

    // Mount all route modules under /api
    const deps = getDeps();
    app.use('/api', authRoutes(deps));
    app.use('/api', notificationRoutes(deps));
    app.use('/api', adminRoutes(deps));
    app.use('/api', fileRoutes(deps));
    app.use('/api', entityRoutes(deps));
    app.use('/api', copilotRoutes(deps));
    app.use('/api', aiRoutes(deps));
    app.use('/api', dashboardRoutes(deps));
    app.use('/api', simulationRoutes(deps));
    app.use('/api', knowledgeRoutes(deps));
    app.use('/api', dataConnectionRoutes(deps));
    app.use('/api', workflowRoutes(deps));
    app.use('/api', integrationRoutes(deps));
    app.use('/api', billingRoutes(deps));
    app.use('/api', reportRoutes(deps));

    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
        
        // Start OT connection health checker (every 5 minutes)
        try {
            const healthChecker = getConnectionHealthChecker(db, broadcastToOrganization);
            healthChecker.start(5 * 60 * 1000);
            console.log('[OT] Connection health checker started');
        } catch (error) {
            console.error('[OT] Failed to start health checker:', error);
        }

        // Start workflow scheduler
        try {
            const executeScheduledWorkflow = async (workflowId, inputs, organizationId) => {
                try {
                    await prefectClient.executeWorkflow(workflowId, inputs || {}, organizationId);
                } catch (prefectErr) {
                    console.warn('[WorkflowScheduler] Prefect unavailable, using local executor');
                    const executor = new WorkflowExecutor(db, null, organizationId, null);
                    await executor.executeWorkflow(workflowId, inputs || {}, organizationId);
                }
            };
            workflowScheduler.start(executeScheduledWorkflow);
        } catch (error) {
            console.error('[WorkflowScheduler] Failed to start:', error);
        }
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});

// ==================== GRACEFUL SHUTDOWN ====================
let isShuttingDown = false;

async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[Shutdown] ${signal} received. Closing gracefully...`);

    // 1. Stop accepting new connections
    server.close(() => {
        console.log('[Shutdown] HTTP server closed');
    });

    // 2. Close all WebSocket connections
    wss.clients.forEach((ws) => {
        try {
            ws.close(1001, 'Server shutting down');
        } catch (_) { /* ignore */ }
    });
    console.log('[Shutdown] WebSocket connections closed');

    // 3. Stop background services
    try { workflowScheduler.stop(); } catch (_) { /* ignore */ }
    console.log('[Shutdown] Workflow scheduler stopped');

    try {
        const healthChecker = getConnectionHealthChecker(db, broadcastToOrganization);
        healthChecker.stop();
    } catch (_) { /* ignore */ }

    // 4. Close database
    try {
        if (db) await db.close();
        console.log('[Shutdown] Database closed');
    } catch (_) { /* ignore */ }

    console.log('[Shutdown] Cleanup complete. Exiting.');
    process.exit(0);
}

// Handle termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // kill command

// Windows: handle Ctrl+C on Windows terminal
if (process.platform === 'win32') {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', () => gracefulShutdown('SIGINT'));
    rl.on('close', () => gracefulShutdown('STDIN_CLOSE'));
}
