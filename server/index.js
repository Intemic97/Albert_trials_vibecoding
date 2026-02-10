const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const { WebSocketServer } = require('ws');
const { initDb, openDb } = require('./db');
const { importUseCasePackage, validateUseCasePackage } = require('./useCaseImporter');
const { WorkflowExecutor, setBroadcastToOrganization } = require('./workflowExecutor');
const { gcsService } = require('./gcsService');
const { prefectClient } = require('./prefectClient');
const { initPollingService, getPollingService } = require('./executionPolling');
const { getConnectionHealthChecker } = require('./utils/otConnections');
// Load environment variables - Try multiple methods to ensure it loads
const envPath = path.join(__dirname, '.env');
console.log('[ENV] Attempting to load .env from:', envPath);
console.log('[ENV] File exists:', require('fs').existsSync(envPath));

// Method 1: Explicit path
const result1 = require('dotenv').config({ path: envPath });
if (result1.error) {
    console.error('[ENV] Error loading .env:', result1.error);
}

// Method 2: Also try without explicit path (default behavior)
if (!process.env.OPENAI_API_KEY) {
    require('dotenv').config();
}

// Debug: Verificar que OPENAI_API_KEY se cargó correctamente
const openaiKey = process.env.OPENAI_API_KEY;
console.log('[ENV] OPENAI_API_KEY cargada:', openaiKey ? `✅ SÍ (length: ${openaiKey.length}, starts with: ${openaiKey.substring(0, 20)}...)` : '❌ NO - VARIABLE NO ENCONTRADA');
if (!openaiKey) {
    console.error('[ENV] ERROR: OPENAI_API_KEY no está configurada. Verifica el archivo .env');
    console.error('[ENV] Variables disponibles:', Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY')).join(', '));
}

// Stripe configuration
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// Stripe Price IDs for subscription plans
const STRIPE_PRICES = {
    pro: process.env.STRIPE_PRICE_PRO || 'price_pro_15_eur',      // 15€/month
    business: process.env.STRIPE_PRICE_BUSINESS || 'price_business_45_eur'  // 45€/month
};
const cookieParser = require('cookie-parser');
const { register, login, logout, authenticateToken, getMe, getOrganizations, switchOrganization, getOrganizationUsers, inviteUser, updateProfile, requireAdmin, completeOnboarding, verifyEmail, resendVerification, validateInvitation, registerWithInvitation, forgotPassword, validateResetToken, resetPassword } = require('./auth');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Helper to generate unique IDs
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// ==================== WEBSOCKET SETUP ====================
const wss = new WebSocketServer({ server, path: '/ws' });

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
const HEARTBEAT_INTERVAL = 10000; // 10 seconds

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

wss.on('connection', (ws) => {
    const socketId = generateSocketId();
    let currentWorkflowId = null;
    let userData = null;
    
    // Setup heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'subscribe_ot_alerts': {
                    // Subscribe to OT alerts for the organization
                    const { orgId, user } = message;
                    
                    if (!orgId || !user) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing orgId or user' }));
                        return;
                    }
                    
                    // Track connection for organization alerts
                    if (!organizationConnections.has(orgId)) {
                        organizationConnections.set(orgId, new Set());
                    }
                    organizationConnections.get(orgId).add(ws);
                    
                    ws.send(JSON.stringify({ 
                        type: 'ot_alerts_subscribed',
                        orgId 
                    }));
                    break;
                }
                
                case 'subscribe_ot_metrics': {
                    // Subscribe to OT metrics for the organization (same connection pool as alerts)
                    const { orgId } = message;
                    
                    if (!orgId) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing orgId' }));
                        return;
                    }
                    
                    // Reuse organization connections for metrics
                    if (!organizationConnections.has(orgId)) {
                        organizationConnections.set(orgId, new Set());
                    }
                    organizationConnections.get(orgId).add(ws);
                    
                    ws.send(JSON.stringify({ 
                        type: 'ot_metrics_subscribed',
                        orgId 
                    }));
                    break;
                }
                
                case 'join': {
                    // User joins a workflow canvas
                    const { workflowId: rawWorkflowId, orgId, user } = message;
                    
                    // Normalize workflowId to string to prevent type mismatches
                    const workflowId = rawWorkflowId ? String(rawWorkflowId) : null;
                    
                    console.log(`[WS] Join request - workflowId: "${workflowId}" (type: ${typeof rawWorkflowId}), user: ${user?.id}, org: ${orgId}`);
                    
                    if (!workflowId) {
                        console.log('[WS] REJECTED: Missing workflowId');
                        ws.send(JSON.stringify({ type: 'error', message: 'Missing workflowId' }));
                        return;
                    }
                    
                    // SECURITY: Validate that the workflow belongs to the user's organization
                    // This prevents users from different organizations seeing each other's cursors
                    (async () => {
                        try {
                            // 1. Verify the workflow exists and belongs to the claimed organization
                            const workflow = await db.get(
                                'SELECT id, organizationId FROM workflows WHERE id = ?',
                                [workflowId]
                            );
                            
                            if (!workflow) {
                                console.log(`[WS] SECURITY: Workflow ${workflowId} not found`);
                                ws.send(JSON.stringify({ type: 'error', message: 'Workflow not found' }));
                                return;
                            }
                            
                            // 2. Verify the workflow belongs to the organization the user claims
                            if (workflow.organizationId !== orgId) {
                                console.log(`[WS] SECURITY: Workflow ${workflowId} belongs to org ${workflow.organizationId}, not ${orgId}`);
                                ws.send(JSON.stringify({ type: 'error', message: 'Access denied: workflow does not belong to your organization' }));
                                return;
                            }
                            
                            // 3. Verify the user belongs to that organization
                            const userOrg = await db.get(
                                'SELECT userId FROM user_organizations WHERE userId = ? AND organizationId = ?',
                                [user.id, orgId]
                            );
                            
                            if (!userOrg) {
                                console.log(`[WS] SECURITY: User ${user.id} does not belong to org ${orgId}`);
                                ws.send(JSON.stringify({ type: 'error', message: 'Access denied: you do not belong to this organization' }));
                                return;
                            }
                            
                            console.log(`[WS] SECURITY: User ${user.id} validated for workflow ${workflowId} in org ${orgId}`);
                            
                            // If already in a room, leave it first
                            if (currentWorkflowId) {
                                leaveRoom(socketId, currentWorkflowId);
                            }
                            
                            currentWorkflowId = workflowId;
                            userData = user;
                            
                            if (!workflowRooms.has(workflowId)) {
                                workflowRooms.set(workflowId, new Map());
                            }
                            
                            const room = workflowRooms.get(workflowId);
                            const colorIndex = room.size % CURSOR_COLORS.length;
                            
                            room.set(socketId, {
                                ws,
                                workflowId, // Store workflowId with user for validation
                                user: {
                                    id: user.id,
                                    name: user.name || user.email?.split('@')[0] || 'Anonymous',
                                    color: CURSOR_COLORS[colorIndex],
                                    profilePhoto: user.profilePhoto
                                },
                                cursor: null,
                                orgId: orgId // Store orgId for organization-wide broadcasts
                            });

                            // Track connection by organization for OT alerts
                            if (orgId) {
                                if (!organizationConnections.has(orgId)) {
                                    organizationConnections.set(orgId, new Set());
                                }
                                organizationConnections.get(orgId).add(ws);
                            }
                            
                            // console.log(`[WS] User ${user.name || user.id} (socket: ${socketId}) joined workflow ${workflowId} (${room.size} users in room)`);
                            
                            // Debug: Log all active rooms and users
                            // console.log('[WS] === ACTIVE ROOMS DEBUG ===');
                            // workflowRooms.forEach((roomUsers, roomWorkflowId) => {
                            //     const userList = [];
                            //     roomUsers.forEach((data, sid) => {
                            //         userList.push(`${data.user?.name || 'Unknown'}(${sid.substring(0, 10)}...)`);
                            //     });
                            //     console.log(`[WS] Room ${roomWorkflowId}: ${userList.join(', ')}`);
                            // });
                            // console.log('[WS] === END ROOMS DEBUG ===');
                            
                            // Send existing users to the new user (exclude own user's other tabs)
                            const existingUsers = [];
                            room.forEach((data, id) => {
                                // Skip this socket and any other tabs of the same user
                                if (id !== socketId && data.user?.id !== user.id) {
                                    existingUsers.push({
                                        id,
                                        user: data.user,
                                        cursor: data.cursor
                                    });
                                }
                            });
                            
                            ws.send(JSON.stringify({
                                type: 'room_state',
                                workflowId, // Include workflowId for client validation
                                users: existingUsers,
                                yourId: socketId,
                                yourColor: CURSOR_COLORS[colorIndex]
                            }));
                            
                            // Notify others about new user (exclude other tabs of the same user)
                            const newUserData = room.get(socketId);
                            // console.log(`[WS] Broadcasting user_joined for ${user.name || user.id} to workflow ${workflowId}`);
                            // console.log(`[WS] Room has ${room.size} users, will notify others (excluding socket ${socketId} and userId ${user.id})`);
                            
                            // Debug: list who will receive the message
                            // room.forEach((data, id) => {
                            //     const willReceive = id !== socketId && (!user.id || data.user?.id !== user.id);
                            //     console.log(`[WS]   - ${data.user?.name || id}: willReceive=${willReceive} (socketMatch=${id === socketId}, userIdMatch=${data.user?.id === user.id})`);
                            // });
                            
                            broadcastToRoom(workflowId, {
                                type: 'user_joined',
                                id: socketId,
                                user: newUserData.user
                            }, socketId, user.id);
                            
                        } catch (err) {
                            console.error('[WS] Error validating join:', err);
                            ws.send(JSON.stringify({ type: 'error', message: 'Server error during validation' }));
                        }
                    })();
                    
                    break;
                }
                
                case 'cursor_move': {
                    // User moved their cursor
                    const { x, y, canvasX, canvasY } = message;
                    
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        const room = workflowRooms.get(currentWorkflowId);
                        const userEntry = room.get(socketId);
                        
                        if (userEntry) {
                            userEntry.cursor = { x, y, canvasX, canvasY };
                            
                            // Broadcast cursor position to others (exclude all tabs of the same user)
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
                    // User moved a node
                    const { nodeId, x, y } = message;
                    
                    if (currentWorkflowId && workflowRooms.has(currentWorkflowId)) {
                        const room = workflowRooms.get(currentWorkflowId);
                        // console.log(`[WS] node_move from ${userData?.name || socketId}: nodeId=${nodeId}, x=${Math.round(x)}, y=${Math.round(y)}, room size=${room.size}`);
                        
                        // Broadcast node movement to others
                        broadcastToRoom(currentWorkflowId, {
                            type: 'node_update',
                            nodeId,
                            x,
                            y,
                            movedBy: socketId
                        }, socketId);
                    } else {
                        // console.log(`[WS] node_move IGNORED: currentWorkflowId=${currentWorkflowId}, hasRoom=${workflowRooms.has(currentWorkflowId)}`);
                    }
                    break;
                }
                
                case 'node_add': {
                    // User added a new node
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
                    // User deleted a node
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
                    // User added a connection
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
                    // User deleted a connection
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
                    // User updated node properties (status, config, data, etc.)
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
                    // User started running the workflow
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
                    // User finished running the workflow
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
        
        // Remove from organization connections on close
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
    // Include workflowId in all messages so clients can validate they're for the correct workflow
    const messageWithWorkflow = { ...message, workflowId };
    const messageStr = JSON.stringify(messageWithWorkflow);
    
    let sentCount = 0;
    room.forEach((data, id) => {
        // Skip if this is the excluded socket
        if (id === excludeSocketId) return;
        // Skip if this user should be excluded (all their tabs)
        if (excludeUserId && data.user && data.user.id === excludeUserId) return;
        // Double-check user's stored workflowId matches (extra safety)
        if (data.workflowId && data.workflowId !== workflowId) {
            console.warn(`[WS] MISMATCH: User ${data.user?.id} in room ${workflowId} but has stored workflowId ${data.workflowId}`);
            return;
        }
        // Send if connection is open
        if (data.ws.readyState === 1) {
            data.ws.send(messageStr);
            sentCount++;
        }
    });
    
    // Log for node updates to help debug
    // if (message.type === 'node_update' || message.type === 'node_added' || message.type === 'node_deleted') {
    //     console.log(`[WS] Broadcast ${message.type} to ${sentCount} users (room size: ${room.size}, excluded: ${excludeSocketId})`);
    // }
}

function leaveRoom(socketId, workflowId) {
    console.log(`[WS] leaveRoom called - socket: ${socketId}, workflow: ${workflowId}`);
    if (!workflowId || !workflowRooms.has(workflowId)) {
        console.log(`[WS] leaveRoom skipped - workflowId: ${workflowId}, hasRoom: ${workflowRooms.has(workflowId)}`);
        return;
    }
    
    const room = workflowRooms.get(workflowId);
    if (room.has(socketId)) {
        const userData = room.get(socketId);
        const orgId = userData?.orgId;
        
        console.log(`[WS] User ${userData?.user?.name || socketId} left workflow ${workflowId} (${room.size - 1} users remaining)`);
        
        room.delete(socketId);
        
        // Remove from organization connections
        if (orgId && organizationConnections.has(orgId)) {
            organizationConnections.get(orgId).delete(userData.ws);
            if (organizationConnections.get(orgId).size === 0) {
                organizationConnections.delete(orgId);
            }
        }
        
        // Notify others
        broadcastToRoom(workflowId, {
            type: 'user_left',
            id: socketId
        });
        
        // Clean up empty rooms
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
        if (ws.readyState === 1) { // WebSocket.OPEN
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

// Configure multer for file uploads
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
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        // Allow common file types and all images
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
        
        // Accept any image type (image/*)
        if (file.mimetype.startsWith('image/') || allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            console.log(`[Upload] Rejected file type: ${file.mimetype} for file: ${file.originalname}`);
            cb(new Error(`File type not allowed: ${file.mimetype}`), false);
        }
    }
});

app.use(cors({
    origin: [
        'http://localhost:5173', 
        'http://localhost:5174', 
        'http://localhost:5175',
        'http://178.128.170.0',
        'https://178.128.170.0'
    ],
    credentials: true
}));
// Stripe webhook needs raw body - must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes - increased limit for large workflows with embedded data
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

let db;

// Initialize DB and start server
initDb().then(database => {
    db = database;
    console.log('Database initialized');

    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
        
        // Start OT connection health checker (every 5 minutes)
        try {
            const healthChecker = getConnectionHealthChecker(db, broadcastToOrganization);
            healthChecker.start(5 * 60 * 1000); // 5 minutes
            console.log('[OT] Connection health checker started');
        } catch (error) {
            console.error('[OT] Failed to start health checker:', error);
        }
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});

// --- Routes ---

// Auth Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/verify-email', verifyEmail);
app.post('/api/auth/resend-verification', resendVerification);
app.get('/api/auth/validate-invitation', validateInvitation);
app.post('/api/auth/register-with-invitation', registerWithInvitation);
app.post('/api/auth/forgot-password', forgotPassword);
app.get('/api/auth/validate-reset-token', validateResetToken);
app.post('/api/auth/reset-password', resetPassword);
app.get('/api/auth/me', authenticateToken, getMe);
app.get('/api/auth/organizations', authenticateToken, getOrganizations);
app.post('/api/auth/switch-org', authenticateToken, switchOrganization);
app.get('/api/organization/users', authenticateToken, getOrganizationUsers);
app.post('/api/organization/invite', authenticateToken, inviteUser);

// Get pending invitations for current organization
app.get('/api/organization/pending-invitations', authenticateToken, async (req, res) => {
    const orgId = req.user.orgId;
    const db = await openDb();

    try {
        const invitations = await db.all(`
            SELECT id, email, invitedByName, createdAt, status
            FROM pending_invitations 
            WHERE organizationId = ? AND status = 'pending'
            ORDER BY createdAt DESC
        `, [orgId]);

        res.json(invitations);
    } catch (error) {
        console.error('Get pending invitations error:', error);
        res.status(500).json({ error: 'Failed to fetch pending invitations' });
    }
});

// Cancel/delete a pending invitation
app.delete('/api/organization/pending-invitations/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const orgId = req.user.orgId;
    const db = await openDb();

    try {
        // Verify the invitation belongs to this organization
        const invitation = await db.get(
            'SELECT id, email FROM pending_invitations WHERE id = ? AND organizationId = ?',
            [id, orgId]
        );

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        await db.run('DELETE FROM pending_invitations WHERE id = ?', [id]);

        console.log(`[Auth] Invitation to ${invitation.email} cancelled for org ${orgId}`);
        res.json({ message: 'Invitation cancelled', email: invitation.email });
    } catch (error) {
        console.error('Cancel invitation error:', error);
        res.status(500).json({ error: 'Failed to cancel invitation' });
    }
});

// Create new organization
app.post('/api/organizations', authenticateToken, async (req, res) => {
    const { name } = req.body;
    const userId = req.user.sub;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Organization name is required' });
    }

    const db = await openDb();

    try {
        const orgId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        await db.run('BEGIN TRANSACTION');

        // Create the organization
        await db.run(
            'INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)',
            [orgId, name.trim(), now]
        );

        // Add the user as admin of the new organization
        await db.run(
            'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
            [userId, orgId, 'admin']
        );

        await db.run('COMMIT');

        console.log(`[Org] User ${userId} created organization ${name} (${orgId})`);

        res.status(201).json({ 
            message: 'Organization created successfully',
            organization: { id: orgId, name: name.trim(), role: 'admin' }
        });

    } catch (error) {
        await db.run('ROLLBACK');
        console.error('Create organization error:', error);
        res.status(500).json({ error: 'Failed to create organization' });
    }
});

app.put('/api/profile', authenticateToken, updateProfile);
app.post('/api/auth/onboarding', authenticateToken, completeOnboarding);

// Company information endpoints
app.get('/api/company', authenticateToken, async (req, res) => {
    try {
        const org = await db.get(
            'SELECT name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview FROM organizations WHERE id = ?',
            [req.user.orgId]
        );
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        res.json(org);
    } catch (error) {
        console.error('Get company info error:', error);
        res.status(500).json({ error: 'Failed to get company information' });
    }
});

app.put('/api/company', authenticateToken, async (req, res) => {
    const { name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview } = req.body;
    
    try {
        await db.run(
            `UPDATE organizations SET 
                name = COALESCE(?, name),
                industry = ?,
                employees = ?,
                website = ?,
                linkedinUrl = ?,
                headquarters = ?,
                foundingYear = ?,
                overview = ?
            WHERE id = ?`,
            [name, industry, employees, website, linkedinUrl, headquarters, foundingYear, overview, req.user.orgId]
        );
        
        res.json({ message: 'Company information updated successfully' });
    } catch (error) {
        console.error('Update company info error:', error);
        res.status(500).json({ error: 'Failed to update company information' });
    }
});

// Update organization logo
app.put('/api/organizations/current/logo', authenticateToken, async (req, res) => {
    const { logo } = req.body;
    
    if (!logo) {
        return res.status(400).json({ error: 'Logo filename is required' });
    }
    
    const db = await openDb();
    
    try {
        await db.run(
            'UPDATE organizations SET logo = ? WHERE id = ?',
            [logo, req.user.orgId]
        );
        
        console.log(`[Org] Updated logo for organization ${req.user.orgId}`);
        res.json({ message: 'Organization logo updated successfully', logo });
    } catch (error) {
        console.error('Update organization logo error:', error);
        res.status(500).json({ error: 'Failed to update organization logo' });
    }
});

// ==================== NOTIFICATIONS ENDPOINTS ====================

// Get notifications for user
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const { limit = 20, offset = 0, unread } = req.query;
        
        let query = `
            SELECT n.*, 
                   CASE WHEN nr.id IS NOT NULL THEN 1 ELSE 0 END as isRead
            FROM notifications n
            LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
            WHERE n.orgId = ? OR n.userId = ?
        `;
        const params = [req.user.id, req.user.orgId, req.user.id];
        
        if (unread === 'true') {
            query += ' AND nr.id IS NULL';
        }
        
        query += ' ORDER BY n.createdAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const notifications = await db.all(query, params);
        
        res.json(notifications.map(n => ({
            ...n,
            isRead: Boolean(n.isRead)
        })));
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});

// Get unread count
app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
    try {
        const result = await db.get(`
            SELECT COUNT(*) as count
            FROM notifications n
            LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
            WHERE (n.orgId = ? OR n.userId = ?) AND nr.id IS NULL
        `, [req.user.id, req.user.orgId, req.user.id]);
        
        res.json({ count: result?.count || 0 });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});

// Mark all as read
app.post('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        // Get all unread notification IDs for this user
        const unreadNotifications = await db.all(`
            SELECT n.id
            FROM notifications n
            LEFT JOIN notification_reads nr ON n.id = nr.notificationId AND nr.userId = ?
            WHERE (n.orgId = ? OR n.userId = ?) AND nr.id IS NULL
        `, [req.user.id, req.user.orgId, req.user.id]);
        
        // Insert read records for each
        for (const notification of unreadNotifications) {
            await db.run(
                'INSERT OR IGNORE INTO notification_reads (id, notificationId, userId, readAt) VALUES (?, ?, ?, ?)',
                [generateId(), notification.id, req.user.id, new Date().toISOString()]
            );
        }
        
        res.json({ message: 'All notifications marked as read', count: unreadNotifications.length });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// Mark single notification as read
app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await db.run(
            'INSERT OR IGNORE INTO notification_reads (id, notificationId, userId, readAt) VALUES (?, ?, ?, ?)',
            [generateId(), req.params.id, req.user.id, new Date().toISOString()]
        );
        
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// ==================== OT ALERTS ENDPOINTS ====================

// Get OT alerts
app.get('/api/ot-alerts', authenticateToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0, severity, acknowledged } = req.query;
        
        let query = 'SELECT * FROM ot_alerts WHERE organizationId = ?';
        const params = [req.user.orgId];
        
        if (severity) {
            query += ' AND severity = ?';
            params.push(severity);
        }
        
        if (acknowledged === 'false' || acknowledged === false) {
            query += ' AND acknowledgedAt IS NULL';
        } else if (acknowledged === 'true' || acknowledged === true) {
            query += ' AND acknowledgedAt IS NOT NULL';
        }
        
        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const alerts = await db.all(query, params);
        
        res.json(alerts.map(alert => ({
            ...alert,
            threshold: alert.threshold ? JSON.parse(alert.threshold) : null,
            metadata: alert.metadata ? JSON.parse(alert.metadata) : null
        })));
    } catch (error) {
        console.error('Get OT alerts error:', error);
        res.status(500).json({ error: 'Failed to get OT alerts' });
    }
});

// Acknowledge OT alert
app.post('/api/ot-alerts/:id/acknowledge', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const now = new Date().toISOString();
        
        await db.run(
            'UPDATE ot_alerts SET acknowledgedAt = ?, acknowledgedBy = ? WHERE id = ? AND organizationId = ?',
            [now, req.user.sub, id, req.user.orgId]
        );
        
        res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error) {
        console.error('Acknowledge OT alert error:', error);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});

// ==================== OT NOTIFICATION SETTINGS ====================
const { getOTNotificationsService } = require('./utils/otNotifications');

// Get OT notification settings
app.get('/api/ot-notification-settings', authenticateToken, async (req, res) => {
    try {
        const notificationsService = getOTNotificationsService(db);
        const settings = await notificationsService.getNotificationSettings(req.user.orgId);
        
        // Don't send password back to client
        if (settings) {
            settings.smtpPass = settings.smtpPass ? '********' : '';
        }
        
        res.json(settings || {
            smtpEnabled: false,
            smtpHost: '',
            smtpPort: '587',
            smtpUser: '',
            emailRecipients: [],
            alertSeverities: ['error'],
            emailEnabled: true,
            browserEnabled: true,
            cooldownMinutes: 5
        });
    } catch (error) {
        console.error('Get OT notification settings error:', error);
        res.status(500).json({ error: 'Failed to get notification settings' });
    }
});

// Save OT notification settings
app.post('/api/ot-notification-settings', authenticateToken, async (req, res) => {
    try {
        const notificationsService = getOTNotificationsService(db);
        const settings = req.body;
        
        // If password is masked, get the existing one
        if (settings.smtpPass === '********') {
            const existingSettings = await notificationsService.getNotificationSettings(req.user.orgId);
            if (existingSettings) {
                settings.smtpPass = existingSettings.smtpPass;
            }
        }
        
        await notificationsService.saveNotificationSettings(req.user.orgId, settings);
        res.json({ success: true, message: 'Notification settings saved' });
    } catch (error) {
        console.error('Save OT notification settings error:', error);
        res.status(500).json({ error: 'Failed to save notification settings' });
    }
});

// Send test email
app.post('/api/ot-notification-settings/test', authenticateToken, async (req, res) => {
    try {
        const { testEmail } = req.body;
        
        if (!testEmail) {
            return res.status(400).json({ error: 'Test email address required' });
        }
        
        const notificationsService = getOTNotificationsService(db);
        const result = await notificationsService.sendTestEmail(req.user.orgId, testEmail);
        
        res.json(result);
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({ error: 'Failed to send test email' });
    }
});

// Get OT metrics history (for charts)
app.get('/api/ot-metrics/history', authenticateToken, async (req, res) => {
    try {
        const { connectionId, timeRange = '24h', metric = 'latency' } = req.query;
        
        // Calculate time range
        const rangeMs = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        }[timeRange] || 24 * 60 * 60 * 1000;
        
        const since = new Date(Date.now() - rangeMs).toISOString();
        
        // For now, generate simulated data (in production, this would come from a metrics table)
        const points = 24;
        const interval = rangeMs / points;
        const data = [];
        
        for (let i = 0; i < points; i++) {
            const timestamp = new Date(Date.now() - rangeMs + (i * interval)).toISOString();
            data.push({
                timestamp,
                value: metric === 'latency' 
                    ? Math.random() * 50 + 20  // 20-70ms
                    : Math.floor(Math.random() * 100)  // 0-100 messages
            });
        }
        
        res.json({
            metric,
            timeRange,
            connectionId: connectionId || 'all',
            data
        });
    } catch (error) {
        console.error('Get OT metrics history error:', error);
        res.status(500).json({ error: 'Failed to get metrics history' });
    }
});

// Get alert configurations
app.get('/api/alert-configs', authenticateToken, async (req, res) => {
    try {
        const configs = await db.all(
            'SELECT * FROM alert_configs WHERE orgId = ? AND (userId = ? OR userId IS NULL) ORDER BY createdAt DESC',
            [req.user.orgId, req.user.id]
        );
        
        res.json(configs || []);
    } catch (error) {
        console.error('Get alert configs error:', error);
        res.status(500).json({ error: 'Failed to get alert configurations' });
    }
});

// Create alert configuration
app.post('/api/alert-configs', authenticateToken, async (req, res) => {
    try {
        const { name, type, condition, threshold, entityId, enabled = true } = req.body;
        
        const id = generateId();
        await db.run(
            `INSERT INTO alert_configs (id, orgId, userId, name, type, condition, threshold, entityId, enabled, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.orgId, req.user.id, name, type, condition, threshold, entityId, enabled ? 1 : 0, new Date().toISOString()]
        );
        
        res.json({ id, message: 'Alert configuration created' });
    } catch (error) {
        console.error('Create alert config error:', error);
        res.status(500).json({ error: 'Failed to create alert configuration' });
    }
});

// Update alert configuration
app.put('/api/alert-configs/:id', authenticateToken, async (req, res) => {
    try {
        const { name, type, condition, threshold, entityId, enabled } = req.body;
        
        await db.run(
            `UPDATE alert_configs SET 
                name = COALESCE(?, name),
                type = COALESCE(?, type),
                condition = COALESCE(?, condition),
                threshold = COALESCE(?, threshold),
                entityId = COALESCE(?, entityId),
                enabled = COALESCE(?, enabled)
             WHERE id = ? AND orgId = ?`,
            [name, type, condition, threshold, entityId, enabled !== undefined ? (enabled ? 1 : 0) : null, req.params.id, req.user.orgId]
        );
        
        res.json({ message: 'Alert configuration updated' });
    } catch (error) {
        console.error('Update alert config error:', error);
        res.status(500).json({ error: 'Failed to update alert configuration' });
    }
});

// Delete alert configuration
app.delete('/api/alert-configs/:id', authenticateToken, async (req, res) => {
    try {
        await db.run('DELETE FROM alert_configs WHERE id = ? AND orgId = ?', [req.params.id, req.user.orgId]);
        res.json({ message: 'Alert configuration deleted' });
    } catch (error) {
        console.error('Delete alert config error:', error);
        res.status(500).json({ error: 'Failed to delete alert configuration' });
    }
});

// ==================== AUDIT LOG ENDPOINTS ====================

// Helper function to log activities
async function logActivity(db, {
    organizationId,
    userId,
    userName,
    userEmail,
    action,
    resourceType,
    resourceId,
    resourceName,
    details,
    ipAddress,
    userAgent
}) {
    try {
        const id = generateId();
        await db.run(
            `INSERT INTO audit_logs (id, organizationId, userId, userName, userEmail, action, resourceType, resourceId, resourceName, details, ipAddress, userAgent, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, organizationId, userId, userName, userEmail, action, resourceType, resourceId, resourceName, 
             details ? JSON.stringify(details) : null, ipAddress, userAgent, new Date().toISOString()]
        );
        return id;
    } catch (error) {
        console.error('Error logging activity:', error);
        return null;
    }
}

// Get audit logs for organization
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
    try {
        const { 
            limit = 50, 
            offset = 0, 
            action, 
            resourceType, 
            userId,
            startDate,
            endDate,
            search
        } = req.query;

        let query = `
            SELECT * FROM audit_logs 
            WHERE organizationId = ?
        `;
        const params = [req.user.orgId];

        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }

        if (resourceType) {
            query += ' AND resourceType = ?';
            params.push(resourceType);
        }

        if (userId) {
            query += ' AND userId = ?';
            params.push(userId);
        }

        if (startDate) {
            query += ' AND createdAt >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND createdAt <= ?';
            params.push(endDate);
        }

        if (search) {
            query += ' AND (userName LIKE ? OR userEmail LIKE ? OR resourceName LIKE ? OR action LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const logs = await db.all(query, params);

        // Parse details JSON
        const parsedLogs = logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : null
        }));

        res.json(parsedLogs);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

// Get audit log stats/summary
app.get('/api/audit-logs/stats', authenticateToken, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Get counts by action type
        const actionCounts = await db.all(`
            SELECT action, COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ?
            GROUP BY action
            ORDER BY count DESC
        `, [req.user.orgId, startDate]);

        // Get counts by resource type
        const resourceCounts = await db.all(`
            SELECT resourceType, COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ?
            GROUP BY resourceType
            ORDER BY count DESC
        `, [req.user.orgId, startDate]);

        // Get most active users
        const activeUsers = await db.all(`
            SELECT userId, userName, COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ? AND userId IS NOT NULL
            GROUP BY userId
            ORDER BY count DESC
            LIMIT 10
        `, [req.user.orgId, startDate]);

        // Get activity by day
        const dailyActivity = await db.all(`
            SELECT DATE(createdAt) as date, COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ?
            GROUP BY DATE(createdAt)
            ORDER BY date ASC
        `, [req.user.orgId, startDate]);

        // Get total count
        const total = await db.get(`
            SELECT COUNT(*) as count
            FROM audit_logs
            WHERE organizationId = ? AND createdAt >= ?
        `, [req.user.orgId, startDate]);

        res.json({
            total: total.count,
            actionCounts,
            resourceCounts,
            activeUsers,
            dailyActivity
        });
    } catch (error) {
        console.error('Get audit log stats error:', error);
        res.status(500).json({ error: 'Failed to get audit log stats' });
    }
});

// Get unique action types and resource types for filters
app.get('/api/audit-logs/filters', authenticateToken, async (req, res) => {
    try {
        const actions = await db.all(`
            SELECT DISTINCT action FROM audit_logs WHERE organizationId = ? ORDER BY action
        `, [req.user.orgId]);

        const resourceTypes = await db.all(`
            SELECT DISTINCT resourceType FROM audit_logs WHERE organizationId = ? ORDER BY resourceType
        `, [req.user.orgId]);

        const users = await db.all(`
            SELECT DISTINCT userId, userName FROM audit_logs 
            WHERE organizationId = ? AND userId IS NOT NULL 
            ORDER BY userName
        `, [req.user.orgId]);

        res.json({
            actions: actions.map(a => a.action),
            resourceTypes: resourceTypes.map(r => r.resourceType),
            users: users.map(u => ({ id: u.userId, name: u.userName }))
        });
    } catch (error) {
        console.error('Get audit log filters error:', error);
        res.status(500).json({ error: 'Failed to get filters' });
    }
});

// Export audit logs as CSV
app.get('/api/audit-logs/export', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, action, resourceType } = req.query;

        let query = `SELECT * FROM audit_logs WHERE organizationId = ?`;
        const params = [req.user.orgId];

        if (startDate) {
            query += ' AND createdAt >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND createdAt <= ?';
            params.push(endDate);
        }
        if (action) {
            query += ' AND action = ?';
            params.push(action);
        }
        if (resourceType) {
            query += ' AND resourceType = ?';
            params.push(resourceType);
        }

        query += ' ORDER BY createdAt DESC';

        const logs = await db.all(query, params);

        // Convert to CSV
        const headers = ['Date', 'User', 'Email', 'Action', 'Resource Type', 'Resource Name', 'Details', 'IP Address'];
        const rows = logs.map(log => [
            log.createdAt,
            log.userName || 'System',
            log.userEmail || '',
            log.action,
            log.resourceType,
            log.resourceName || '',
            log.details || '',
            log.ipAddress || ''
        ]);

        const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Export audit logs error:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

// Admin Routes - Platform-wide admin panel
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get total counts
        const userCount = await db.get('SELECT COUNT(*) as count FROM users');
        const orgCount = await db.get('SELECT COUNT(*) as count FROM organizations');
        const workflowCount = await db.get('SELECT COUNT(*) as count FROM workflows');
        const dashboardCount = await db.get('SELECT COUNT(*) as count FROM dashboards');
        const entityCount = await db.get('SELECT COUNT(*) as count FROM entities');

        res.json({
            users: userCount.count,
            organizations: orgCount.count,
            workflows: workflowCount.count,
            dashboards: dashboardCount.count,
            entities: entityCount.count
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Get all users with their organization info and resource counts
        const users = await db.all(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u.profilePhoto,
                u.companyRole,
                u.isAdmin,
                u.createdAt,
                u.onboardingRole,
                u.onboardingIndustry,
                u.onboardingUseCase,
                u.onboardingSource,
                u.onboardingCompleted,
                GROUP_CONCAT(DISTINCT o.name) as organizations,
                COUNT(DISTINCT uo.organizationId) as orgCount
            FROM users u
            LEFT JOIN user_organizations uo ON u.id = uo.userId
            LEFT JOIN organizations o ON uo.organizationId = o.id
            GROUP BY u.id
            ORDER BY u.createdAt DESC
        `);

        // For each user, get their workflow and dashboard counts across all their orgs
        const usersWithCounts = await Promise.all(users.map(async (user) => {
            // Get all org IDs for this user
            const userOrgs = await db.all(
                'SELECT organizationId FROM user_organizations WHERE userId = ?',
                [user.id]
            );
            const orgIds = userOrgs.map(o => o.organizationId);

            let workflowCount = 0;
            let dashboardCount = 0;

            if (orgIds.length > 0) {
                const placeholders = orgIds.map(() => '?').join(',');
                const wfCount = await db.get(
                    `SELECT COUNT(*) as count FROM workflows WHERE organizationId IN (${placeholders})`,
                    orgIds
                );
                const dbCount = await db.get(
                    `SELECT COUNT(*) as count FROM dashboards WHERE organizationId IN (${placeholders})`,
                    orgIds
                );
                workflowCount = wfCount.count;
                dashboardCount = dbCount.count;
            }

            return {
                ...user,
                isAdmin: !!user.isAdmin,
                onboardingCompleted: !!user.onboardingCompleted,
                workflowCount,
                dashboardCount
            };
        }));

        res.json(usersWithCounts);
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.put('/api/admin/users/:id/admin', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { isAdmin } = req.body;

        await db.run('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin ? 1 : 0, id]);

        res.json({ message: 'User admin status updated' });
    } catch (error) {
        console.error('Update admin status error:', error);
        res.status(500).json({ error: 'Failed to update admin status' });
    }
});

// Delete user - Admin only
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const adminUserId = req.user.sub;

        // Prevent self-deletion
        if (id === adminUserId) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        // Check if user exists
        const user = await db.get('SELECT id, email, name FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Helper function to safely delete from a table (ignores errors if table doesn't exist)
        const safeDelete = async (query, params) => {
            try {
                await db.run(query, params);
            } catch (err) {
                console.log(`[Admin] Safe delete skipped (table may not exist): ${err.message}`);
            }
        };

        // Start transaction for cascading deletes
        await db.run('BEGIN TRANSACTION');

        try {
            // Delete user's organization memberships
            await safeDelete('DELETE FROM user_organizations WHERE userId = ?', [id]);

            // Delete user's workflows (if they are the creator)
            await safeDelete('DELETE FROM workflows WHERE createdBy = ?', [id]);

            // Delete user's dashboards (if they are the creator)
            await safeDelete('DELETE FROM dashboards WHERE createdBy = ?', [id]);

            // Delete user's reports (if they are the creator)
            await safeDelete('DELETE FROM reports WHERE createdBy = ?', [id]);

            // Delete user's entities (if they are the creator)
            await safeDelete('DELETE FROM entities WHERE createdBy = ?', [id]);

            // Delete user's credentials
            await safeDelete('DELETE FROM credentials WHERE userId = ?', [id]);

            // Delete user's audit logs
            await safeDelete('DELETE FROM audit_logs WHERE userId = ?', [id]);

            // Delete any pending invitations sent by this user
            await safeDelete('DELETE FROM pending_invitations WHERE invitedBy = ?', [id]);

            // Delete node feedback from this user
            await safeDelete('DELETE FROM node_feedback WHERE userId = ?', [id]);

            // Delete the user (this one must succeed)
            await db.run('DELETE FROM users WHERE id = ?', [id]);

            await db.run('COMMIT');

            console.log(`[Admin] User ${user.email} (${id}) deleted by admin ${adminUserId}`);
            res.json({ message: `User ${user.email} has been deleted`, deletedUser: { id, email: user.email, name: user.name } });

        } catch (deleteError) {
            await db.run('ROLLBACK');
            throw deleteError;
        }

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user: ' + error.message });
    }
});

// File Upload Endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Return file info
        res.json({
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            url: `/api/files/${req.file.filename}`
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// File Serve Endpoint
app.get('/api/files/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filePath);
});

// File Download Endpoint (forces download with original name)
app.get('/api/files/:filename/download', async (req, res) => {
    const { filename } = req.params;
    const { originalName } = req.query;
    const filePath = path.join(uploadsDir, filename);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, originalName || filename);
});

// Parse Excel/CSV file endpoint
app.post('/api/parse-spreadsheet', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = path.join(uploadsDir, req.file.filename);
        const ext = path.extname(req.file.originalname).toLowerCase();

        let data = [];
        let headers = [];

        if (ext === '.csv') {
            // Parse CSV
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            if (lines.length > 0) {
                // First line is headers
                headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                
                // Parse data rows
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    if (values.length > 0) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            row[header] = values[idx] || '';
                        });
                        data.push(row);
                    }
                }
            }
        } else if (ext === '.xlsx' || ext === '.xls') {
            // Parse Excel
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON with header row
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length > 0) {
                headers = jsonData[0].map(h => String(h || '').trim());
                
                for (let i = 1; i < jsonData.length; i++) {
                    const rowData = jsonData[i];
                    if (rowData && rowData.some(cell => cell !== null && cell !== undefined && cell !== '')) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            const value = rowData[idx];
                            row[header] = value !== null && value !== undefined ? String(value) : '';
                        });
                        data.push(row);
                    }
                }
            }
        } else {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Unsupported file format. Please upload .csv, .xlsx, or .xls files.' });
        }

        // Clean up uploaded file after parsing
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            headers,
            data,
            rowCount: data.length
        });

    } catch (error) {
        console.error('Error parsing spreadsheet:', error);
        res.status(500).json({ error: 'Failed to parse spreadsheet: ' + error.message });
    }
});

// Parse PDF file endpoint
app.post('/api/parse-pdf', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = path.join(uploadsDir, req.file.filename);
        const ext = path.extname(req.file.originalname).toLowerCase();

        if (ext !== '.pdf') {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Unsupported file format. Please upload .pdf files.' });
        }

        // Read PDF file
        const dataBuffer = fs.readFileSync(filePath);
        
        // Parse PDF
        const pdfData = await pdfParse(dataBuffer);

        // Clean up uploaded file after parsing
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            text: pdfData.text,
            pages: pdfData.numpages,
            info: pdfData.info,
            metadata: pdfData.metadata,
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error('Error parsing PDF:', error);
        res.status(500).json({ error: 'Failed to parse PDF: ' + error.message });
    }
});

// Helper function to parse CSV lines (handles quoted values with commas)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
}

// ==================== GCS ENDPOINTS ====================

// Upload spreadsheet data to GCS (for large files)
app.post('/api/upload-spreadsheet-gcs', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { workflowId, nodeId } = req.body;
        if (!workflowId || !nodeId) {
            return res.status(400).json({ error: 'workflowId and nodeId are required' });
        }

        const filePath = path.join(uploadsDir, req.file.filename);
        const ext = path.extname(req.file.originalname).toLowerCase();

        let data = [];
        let headers = [];

        // Parse the file
        if (ext === '.csv') {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            if (lines.length > 0) {
                headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    if (values.length > 0) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            row[header] = values[idx] || '';
                        });
                        data.push(row);
                    }
                }
            }
        } else if (ext === '.xlsx' || ext === '.xls') {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length > 0) {
                headers = jsonData[0].map(h => String(h || '').trim());
                
                for (let i = 1; i < jsonData.length; i++) {
                    const rowData = jsonData[i];
                    if (rowData && rowData.some(cell => cell !== null && cell !== undefined && cell !== '')) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            const value = rowData[idx];
                            row[header] = value !== null && value !== undefined ? String(value) : '';
                        });
                        data.push(row);
                    }
                }
            }
        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Unsupported file format. Please upload .csv, .xlsx, or .xls files.' });
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        // Check if GCS is available
        const gcsAvailable = await gcsService.init();
        
        if (gcsAvailable && data.length > 50) {
            // Upload full data to GCS
            const uploadResult = await gcsService.uploadWorkflowData(
                workflowId,
                nodeId,
                data,
                req.file.originalname
            );

            if (uploadResult.success) {
                // Return preview (first 100 rows) + GCS reference
                const previewData = data.slice(0, 100);
                
                res.json({
                    success: true,
                    useGCS: true,
                    gcsPath: uploadResult.gcsPath,
                    headers,
                    previewData,
                    totalRows: data.length,
                    previewRows: previewData.length,
                    fileName: req.file.originalname,
                    message: `Uploaded ${data.length} rows to cloud storage`
                });
                return;
            } else {
                console.warn('[GCS] Upload failed, falling back to inline:', uploadResult.error);
            }
        }

        // Fallback: return all data inline (for small files or GCS unavailable)
        res.json({
            success: true,
            useGCS: false,
            headers,
            data,
            rowCount: data.length,
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error('Error uploading spreadsheet:', error);
        res.status(500).json({ error: 'Failed to upload spreadsheet: ' + error.message });
    }
});

// Download data from GCS
app.get('/api/gcs-data/:gcsPath(*)', authenticateToken, async (req, res) => {
    try {
        const { gcsPath } = req.params;
        
        if (!gcsPath) {
            return res.status(400).json({ error: 'gcsPath is required' });
        }

        const gcsAvailable = await gcsService.init();
        if (!gcsAvailable) {
            return res.status(503).json({ error: 'Cloud storage not available' });
        }

        const result = await gcsService.downloadWorkflowData(gcsPath);
        
        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        res.json({
            success: true,
            data: result.data,
            rowCount: result.rowCount
        });

    } catch (error) {
        console.error('Error downloading from GCS:', error);
        res.status(500).json({ error: 'Failed to download data: ' + error.message });
    }
});

// Delete GCS data for a workflow
app.delete('/api/gcs-workflow/:workflowId', authenticateToken, async (req, res) => {
    try {
        const { workflowId } = req.params;
        
        const gcsAvailable = await gcsService.init();
        if (!gcsAvailable) {
            return res.json({ success: true, message: 'GCS not configured' });
        }

        const result = await gcsService.deleteWorkflowFolder(workflowId);
        
        res.json({
            success: true,
            deletedCount: result.deletedCount || 0
        });

    } catch (error) {
        console.error('Error deleting GCS data:', error);
        res.status(500).json({ error: 'Failed to delete data: ' + error.message });
    }
});

// Check GCS status
app.get('/api/gcs-status', authenticateToken, async (req, res) => {
    try {
        const gcsAvailable = await gcsService.init();
        res.json({
            available: gcsAvailable,
            bucket: gcsAvailable ? gcsService.bucketName : null
        });
    } catch (error) {
        res.json({ available: false, error: error.message });
    }
});

// ==================== END GCS ENDPOINTS ====================

// Helper function to extract text from files
async function extractFileContent(filename) {
    const filePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    const ext = path.extname(filename).toLowerCase();
    
    try {
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return {
                type: 'pdf',
                text: data.text,
                pages: data.numpages,
                info: data.info
            };
        } else if (ext === '.txt' || ext === '.csv') {
            const text = fs.readFileSync(filePath, 'utf8');
            return {
                type: ext.slice(1),
                text: text
            };
        } else {
            // For other file types, return info only
            return {
                type: ext.slice(1),
                text: null,
                message: 'Text extraction not supported for this file type'
            };
        }
    } catch (error) {
        console.error('Error extracting file content:', error);
        return {
            type: ext.slice(1),
            text: null,
            error: error.message
        };
    }
}

// File Content Extraction Endpoint
app.get('/api/files/:filename/content', authenticateToken, async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    const content = await extractFileContent(filename);
    res.json(content);
});

// GET all entities (with properties)
app.get('/api/entities', authenticateToken, async (req, res) => {
    try {
        const entities = await db.all('SELECT * FROM entities WHERE organizationId = ?', [req.user.orgId]);

        const entitiesWithProps = await Promise.all(entities.map(async (entity) => {
            const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entity.id]);
            return { ...entity, properties };
        }));

        res.json(entitiesWithProps);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch entities' });
    }
});

// POST create entity
app.post('/api/entities', authenticateToken, async (req, res) => {
    const { id, name, description, author, lastEdited, properties, entityType } = req.body;

    try {
        await db.run(
            'INSERT INTO entities (id, organizationId, name, description, author, lastEdited, entityType) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, req.user.orgId, name, description, author, lastEdited, entityType || 'generic']
        );

        if (properties && properties.length > 0) {
            for (const prop of properties) {
                await db.run(
                    'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [prop.id, id, prop.name, prop.type, prop.defaultValue, prop.relatedEntityId, prop.unit]
                );
            }
        }

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: author || req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'entity',
            resourceId: id,
            resourceName: name,
            details: { propertyCount: properties?.length || 0 },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ message: 'Entity created' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create entity' });
    }
});

// DELETE entity
app.delete('/api/entities/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Get entity name before deleting
        const entity = await db.get('SELECT name FROM entities WHERE id = ?', [id]);
        
        await db.run('DELETE FROM entities WHERE id = ?', [id]);
        await db.run('DELETE FROM properties WHERE entityId = ?', [id]);

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'delete',
            resourceType: 'entity',
            resourceId: id,
            resourceName: entity?.name || 'Unknown',
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Entity deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete entity' });
    }
});

// POST add property
app.post('/api/properties', authenticateToken, async (req, res) => {
    const { id, entityId, name, type, defaultValue, relatedEntityId, unit } = req.body;
    try {
        await db.run(
            'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, entityId, name, type, defaultValue, relatedEntityId, unit]
        );
        res.status(201).json({ message: 'Property added' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add property' });
    }
});

// DELETE property
app.delete('/api/properties/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM properties WHERE id = ?', [id]);
        res.json({ message: 'Property deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete property' });
    }
});

// GET audit log for an entity
app.get('/api/entities/:id/audit', authenticateToken, async (req, res) => {
    try {
        const logs = await db.all(
            'SELECT * FROM audit_log WHERE entityId = ? AND organizationId = ? ORDER BY timestamp DESC LIMIT 100',
            [req.params.id, req.user.orgId]
        );
        res.json(logs);
    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

// Helper to resolve relation values
async function resolveRelationValue(db, value, relatedEntityId) {
    if (!value || !relatedEntityId) return value;

    try {
        let ids = [];
        try {
            const parsed = JSON.parse(value);
            ids = Array.isArray(parsed) ? parsed : [value];
        } catch {
            ids = [value];
        }

        const names = [];
        for (const id of ids) {
            // Get related record values
            const relatedValues = await db.all('SELECT * FROM record_values WHERE recordId = ?', [id]);
            if (relatedValues.length === 0) {
                names.push(id);
                continue;
            }

            // Get related entity properties to identify the "name" field
            const relatedProps = await db.all('SELECT * FROM properties WHERE entityId = ?', [relatedEntityId]);

            let nameVal = null;
            // 1. Try "name" or "title"
            const nameProp = relatedProps.find(p => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title');
            if (nameProp) {
                const valRow = relatedValues.find(rv => rv.propertyId === nameProp.id);
                if (valRow) nameVal = valRow.value;
            }

            // 2. Fallback to first text property
            if (!nameVal) {
                const textProp = relatedProps.find(p => p.type === 'text');
                if (textProp) {
                    const valRow = relatedValues.find(rv => rv.propertyId === textProp.id);
                    if (valRow) nameVal = valRow.value;
                }
            }

            names.push(nameVal || id);
        }
        return names.join(', ');
    } catch (error) {
        console.error('Error resolving relation:', error);
        return value;
    }
}

// --- Records Endpoints ---

// GET /api/entities/:id/records
// GET /api/entities/:id/records
app.get('/api/entities/:id/records', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Verify entity belongs to user's organization
        const entity = await db.get('SELECT id FROM entities WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!entity) {
            return res.status(404).json({ error: 'Entity not found or access denied' });
        }

        const records = await db.all('SELECT * FROM records WHERE entityId = ?', [id]);

        const recordsWithValues = await Promise.all(records.map(async (record) => {
            const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [record.id]);
            const valuesMap = {};
            values.forEach(v => {
                valuesMap[v.propertyId] = v.value;
            });
            return { ...record, values: valuesMap };
        }));

        res.json(recordsWithValues);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
});

// POST /api/entities/:id/records - Create record with property names (for workflows)
app.post('/api/entities/:id/records', authenticateToken, async (req, res) => {
    const { id: entityId } = req.params;
    const recordData = req.body; // Data with property names as keys

    try {
        // Verify entity belongs to user's organization
        const entity = await db.get('SELECT id FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
        if (!entity) {
            return res.status(403).json({ error: 'Access denied to this entity' });
        }

        // Get entity properties to map names to IDs
        const properties = await db.all('SELECT id, name, type FROM properties WHERE entityId = ?', [entityId]);
        
        // Create name -> property mapping (case-insensitive)
        const propertyMap = {};
        properties.forEach(prop => {
            propertyMap[prop.name.toLowerCase()] = prop;
        });

        // Create the record
        const recordId = Math.random().toString(36).substr(2, 9);
        const createdAt = new Date().toISOString();

        await db.run(
            'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
            [recordId, entityId, createdAt]
        );

        // Map property names to IDs and save values
        let savedFields = 0;
        let skippedFields = [];
        
        for (const [key, val] of Object.entries(recordData)) {
            // Skip internal fields
            if (key === 'id' || key === 'createdAt' || key === 'entityId') continue;
            
            const prop = propertyMap[key.toLowerCase()];
            if (prop) {
                const valueId = Math.random().toString(36).substr(2, 9);
                await db.run(
                    'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                    [valueId, recordId, prop.id, String(val)]
                );
                savedFields++;
            } else {
                skippedFields.push(key);
            }
        }

        res.status(201).json({ 
            message: 'Record created', 
            id: recordId,
            savedFields,
            skippedFields: skippedFields.length > 0 ? skippedFields : undefined
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create record' });
    }
});

// POST /api/records
// POST /api/records
app.post('/api/records', authenticateToken, async (req, res) => {
    const { entityId, values } = req.body;

    try {
        // Verify entity belongs to user's organization
        const entity = await db.get('SELECT id FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
        if (!entity) {
            return res.status(403).json({ error: 'Access denied to this entity' });
        }

        const recordId = Math.random().toString(36).substr(2, 9);
        const createdAt = new Date().toISOString();

        await db.run(
            'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
            [recordId, entityId, createdAt]
        );

        if (values) {
            for (const [propId, val] of Object.entries(values)) {
                const valueId = Math.random().toString(36).substr(2, 9);
                await db.run(
                    'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                    [valueId, recordId, propId, String(val)]
                );
            }
        }

        res.status(201).json({ message: 'Record created', id: recordId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create record' });
    }
});

// PUT /api/records/:id
// PUT /api/records/:id
app.put('/api/records/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { values } = req.body;

    try {
        // Verify record belongs to an entity in user's organization
        const record = await db.get(`
            SELECT r.id 
            FROM records r 
            JOIN entities e ON r.entityId = e.id 
            WHERE r.id = ? AND e.organizationId = ?
        `, [id, req.user.orgId]);

        if (!record) {
            return res.status(404).json({ error: 'Record not found or access denied' });
        }

        // Get entity info for audit log
        const recordInfo = await db.get('SELECT entityId FROM records WHERE id = ?', [id]);
        const entityInfo = recordInfo ? await db.get('SELECT organizationId FROM entities WHERE id = ?', [recordInfo.entityId]) : null;

        if (values) {
            for (const [propId, val] of Object.entries(values)) {
                const existing = await db.get(
                    'SELECT id, value FROM record_values WHERE recordId = ? AND propertyId = ?',
                    [id, propId]
                );

                const oldValue = existing?.value || null;
                const newValue = String(val);

                if (existing) {
                    if (oldValue !== newValue) {
                        await db.run(
                            'UPDATE record_values SET value = ? WHERE id = ?',
                            [newValue, existing.id]
                        );
                        // Audit log
                        if (entityInfo && recordInfo) {
                            const prop = await db.get('SELECT name FROM properties WHERE id = ?', [propId]);
                            await db.run(
                                'INSERT INTO audit_log (id, organizationId, entityId, recordId, action, field, oldValue, newValue, userId, userName, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                [Math.random().toString(36).substr(2, 12), entityInfo.organizationId, recordInfo.entityId, id, 'update', prop?.name || propId, oldValue, newValue, req.user.sub, req.user.email, new Date().toISOString()]
                            );
                        }
                    }
                } else {
                    const valueId = Math.random().toString(36).substr(2, 9);
                    await db.run(
                        'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                        [valueId, id, propId, newValue]
                    );
                }
            }
        }

        res.json({ message: 'Record updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update record' });
    }
});

// PUT /api/records/:id/tags - Update record tags
app.put('/api/records/:id/tags', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { tags } = req.body; // Array of strings
    try {
        const record = await db.get(`
            SELECT r.id FROM records r JOIN entities e ON r.entityId = e.id 
            WHERE r.id = ? AND e.organizationId = ?
        `, [id, req.user.orgId]);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        
        await db.run('UPDATE records SET tags = ? WHERE id = ?', [JSON.stringify(tags || []), id]);
        res.json({ message: 'Tags updated' });
    } catch (error) {
        console.error('Error updating tags:', error);
        res.status(500).json({ error: 'Failed to update tags' });
    }
});

// DELETE /api/records/:id
// DELETE /api/records/:id
app.delete('/api/records/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Verify record belongs to an entity in user's organization
        const record = await db.get(`
            SELECT r.id 
            FROM records r 
            JOIN entities e ON r.entityId = e.id 
            WHERE r.id = ? AND e.organizationId = ?
        `, [id, req.user.orgId]);

        if (!record) {
            return res.status(404).json({ error: 'Record not found or access denied' });
        }

        await db.run('DELETE FROM records WHERE id = ?', [id]);
        res.json({ message: 'Record deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete record' });
    }
});

// ==================== DATABASE ASSISTANT ENDPOINT ====================

// Database Assistant - Answer questions about the database using AI
app.post('/api/database/ask', authenticateToken, async (req, res) => {
    console.log('[Database Assistant] Received question');
    try {
        const { question, conversationHistory, chatId, instructions, allowedEntities, mentionedEntities } = req.body;
        const orgId = req.user.orgId;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        // If chatId is provided, try to load chat configuration
        let chatInstructions = instructions;
        let chatAllowedEntities = allowedEntities;
        if (chatId) {
            try {
                const chat = await db.get(
                    'SELECT instructions, allowedEntities FROM copilot_chats WHERE id = ? AND organizationId = ?',
                    [chatId, orgId]
                );
                if (chat) {
                    chatInstructions = chatInstructions || chat.instructions;
                    chatAllowedEntities = chatAllowedEntities || (chat.allowedEntities ? JSON.parse(chat.allowedEntities) : null);
                }
            } catch (e) {
                console.log('[Database Assistant] Could not load chat config:', e.message);
            }
        }

        // Combine allowed entities with mentioned entities from the message
        // mentionedEntities are entities explicitly cited in the user's message (via @ or # folder citations)
        let effectiveEntities = chatAllowedEntities;
        if (mentionedEntities && Array.isArray(mentionedEntities) && mentionedEntities.length > 0) {
            if (effectiveEntities && Array.isArray(effectiveEntities) && effectiveEntities.length > 0) {
                // Combine both lists, removing duplicates
                effectiveEntities = [...new Set([...effectiveEntities, ...mentionedEntities])];
            } else {
                // No allowed entities restriction, but we have mentioned entities - prioritize them
                effectiveEntities = mentionedEntities;
            }
        }

        // Fetch entities - filter by effectiveEntities if specified
        let entitiesQuery = 'SELECT * FROM entities WHERE organizationId = ?';
        let entitiesParams = [orgId];
        
        console.log('[Database Assistant] Mentioned entities:', mentionedEntities);
        console.log('[Database Assistant] Effective entities:', effectiveEntities);
        
        if (effectiveEntities && Array.isArray(effectiveEntities) && effectiveEntities.length > 0) {
            const placeholders = effectiveEntities.map(() => '?').join(',');
            entitiesQuery += ` AND id IN (${placeholders})`;
            entitiesParams = [orgId, ...effectiveEntities];
        }
        
        const entities = await db.all(entitiesQuery, entitiesParams);
        console.log('[Database Assistant] Loaded entities:', entities.map(e => ({ id: e.id, name: e.name })));
        
        const databaseContext = {};
        
        for (const entity of entities) {
            const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entity.id]);
            const records = await db.all('SELECT * FROM records WHERE entityId = ?', [entity.id]);
            
            const recordsWithValues = await Promise.all(records.map(async (record) => {
                const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [record.id]);
                const valuesMap = {};
                
                for (const v of values) {
                    const prop = properties.find(p => p.id === v.propertyId);
                    const key = prop ? prop.name : v.propertyId;
                    
                    // Handle relation values - resolve to display names
                    if (prop && prop.type === 'relation' && prop.relatedEntityId && v.value) {
                        try {
                            const ids = JSON.parse(v.value);
                            if (Array.isArray(ids) && ids.length > 0) {
                                const relatedEntity = entities.find(e => e.id === prop.relatedEntityId);
                                if (relatedEntity) {
                                    const relatedProps = await db.all('SELECT * FROM properties WHERE entityId = ?', [prop.relatedEntityId]);
                                    const names = [];
                                    for (const id of ids) {
                                        const relatedValues = await db.all('SELECT * FROM record_values WHERE recordId = ?', [id]);
                                        const nameProp = relatedProps.find(p => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title');
                                        if (nameProp) {
                                            const nameVal = relatedValues.find(rv => rv.propertyId === nameProp.id);
                                            if (nameVal) names.push(nameVal.value);
                                        }
                                    }
                                    valuesMap[key] = names.length > 0 ? names.join(', ') : v.value;
                                } else {
                                    valuesMap[key] = v.value;
                                }
                            } else {
                                valuesMap[key] = v.value;
                            }
                        } catch {
                            valuesMap[key] = v.value;
                        }
                    } else {
                        valuesMap[key] = v.value;
                    }
                }
                
                return valuesMap;
            }));
            
            databaseContext[entity.name] = {
                description: entity.description,
                properties: properties.map(p => ({
                    name: p.name,
                    type: p.type,
                    relatedTo: p.relatedEntityId ? entities.find(e => e.id === p.relatedEntityId)?.name : null
                })),
                recordCount: records.length,
                records: recordsWithValues.slice(0, 50) // Limit to prevent token overflow
            };
        }

        // Build conversation for OpenAI
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build custom instructions
        const customInstructions = chatInstructions 
            ? `\n\nCUSTOM INSTRUCTIONS FOR THIS COPILOT:\n${chatInstructions}\n\nFollow these instructions when answering questions.`
            : '';

        const systemPrompt = `You are a helpful database assistant for Intemic platform. You have access to the user's database and can answer questions about their data.

DATABASE SCHEMA AND DATA:
${JSON.stringify(databaseContext, null, 2)}
${customInstructions}

INSTRUCTIONS:
1. Answer questions about the data clearly and concisely
2. When counting records, be precise
3. When asked to find specific data, search through the records
4. Explain relationships between entities when relevant
5. If asked about something not in the database, say so politely
6. Format numbers and lists nicely for readability
7. If the question is ambiguous, ask for clarification
8. You can perform calculations, aggregations, and comparisons on the data
9. Always be helpful and provide context about where the data comes from
${chatInstructions ? '10. Follow the custom instructions provided above for this specific copilot.' : ''}

RESPONSE FORMAT:
You must respond in valid JSON format with the following structure:
{
  "answer": "Your conversational answer here. Be informative, use bullet points for lists, mention entity/table names when referencing data.",
  "explanation": "A brief explanation of how you prepared this response. Mention which entities you analyzed, what data you looked at, and your reasoning process. Example: 'I analyzed the @Customers entity (45 records) and counted all entries. I also checked the @Orders entity to understand relationships.'",
  "entitiesUsed": ["EntityName1", "EntityName2"]
}

IMPORTANT:
- The "answer" should be conversational but informative
- The "explanation" should describe your analysis process in 1-2 sentences
- Use @EntityName format when mentioning entities in the explanation
- "entitiesUsed" should list all entity names you analyzed to answer the question
- Always respond with valid JSON only, no additional text`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...(conversationHistory || []).map(m => ({
                role: m.role,
                content: m.content
            })),
            { role: 'user', content: question }
        ];

        console.log('[Database Assistant] Calling OpenAI API...');
        console.log('[Database Assistant] API Key present:', !!process.env.OPENAI_API_KEY);
        console.log('[Database Assistant] API Key length:', process.env.OPENAI_API_KEY?.length);
        
        let completion;
        try {
            completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages,
                temperature: 0.3,
                max_tokens: 1500,
                response_format: { type: "json_object" }
            });
            console.log('[Database Assistant] OpenAI API call successful');
        } catch (openaiError) {
            console.error('[Database Assistant] OpenAI API Error:', openaiError.message);
            console.error('[Database Assistant] OpenAI API Error details:', openaiError);
            return res.status(500).json({ 
                error: 'Failed to get response from OpenAI',
                details: openaiError.message 
            });
        }

        const responseText = completion.choices[0]?.message?.content || '{}';
        let parsedResponse;
        
        try {
            parsedResponse = JSON.parse(responseText);
        } catch (parseError) {
            console.error('[Database Assistant] Failed to parse JSON response:', parseError);
            parsedResponse = {
                answer: responseText,
                explanation: 'I analyzed your database to answer this question.',
                entitiesUsed: Object.keys(databaseContext)
            };
        }

        console.log('[Database Assistant] Response generated');

        res.json({ 
            answer: parsedResponse.answer || 'I could not generate a response.',
            explanation: parsedResponse.explanation || 'I analyzed your database entities to prepare this response.',
            entitiesUsed: parsedResponse.entitiesUsed || Object.keys(databaseContext),
            entitiesAnalyzed: Object.keys(databaseContext).length,
            totalRecords: Object.values(databaseContext).reduce((sum, e) => sum + e.recordCount, 0)
        });

    } catch (error) {
        console.error('[Database Assistant] Error:', error);
        console.error('[Database Assistant] Error stack:', error.stack);
        console.error('[Database Assistant] Error name:', error.name);
        res.status(500).json({ 
            error: 'Failed to process your question. Please try again.',
            details: error.message 
        });
    }
});

// ==================== COPILOT CHAT MANAGEMENT ====================

// Get all chats for the organization (shared across all org members)
app.get('/api/copilot/chats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const orgId = req.user.orgId;

        // Get all chats from the organization - shared across all members
        const chats = await db.all(
            'SELECT * FROM copilot_chats WHERE organizationId = ? ORDER BY updatedAt DESC',
            [orgId]
        );

        // Parse messages JSON for each chat
        const parsedChats = chats.map(chat => {
            try {
                return {
                    ...chat,
                    messages: chat.messages ? JSON.parse(chat.messages) : [],
                    instructions: chat.instructions || null,
                    allowedEntities: chat.allowedEntities ? JSON.parse(chat.allowedEntities) : null,
                    isFavorite: chat.isFavorite === 1,
                    tags: chat.tags ? JSON.parse(chat.tags) : [],
                    createdAt: chat.createdAt ? new Date(chat.createdAt) : new Date(),
                    updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : new Date()
                };
            } catch (parseError) {
                console.error('[Copilot] Error parsing chat:', chat.id, parseError);
                return {
                    ...chat,
                    messages: [],
                    instructions: chat.instructions || null,
                    allowedEntities: null,
                    isFavorite: false,
                    tags: [],
                    createdAt: chat.createdAt ? new Date(chat.createdAt) : new Date(),
                    updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : new Date()
                };
            }
        });

        res.json({ chats: parsedChats });
    } catch (error) {
        console.error('[Copilot] Error loading chats:', error);
        console.error('[Copilot] Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to load chats', details: error.message });
    }
});

// Create a new chat
app.post('/api/copilot/chats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const orgId = req.user.orgId;
        const { id, title, messages, createdAt, updatedAt } = req.body;

        const { instructions, allowedEntities, isFavorite, tags } = req.body;
        
        await db.run(
            `INSERT INTO copilot_chats (id, userId, organizationId, title, messages, instructions, allowedEntities, isFavorite, tags, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, 
                userId, 
                orgId, 
                title, 
                JSON.stringify(messages), 
                instructions || null,
                allowedEntities ? JSON.stringify(allowedEntities) : null,
                isFavorite ? 1 : 0,
                tags ? JSON.stringify(tags) : null,
                createdAt, 
                updatedAt
            ]
        );

        // Log activity
        await logActivity(db, {
            organizationId: orgId,
            userId: userId,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'copilot',
            resourceId: id,
            resourceName: title,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, chatId: id });
    } catch (error) {
        console.error('[Copilot] Error creating chat:', error);
        res.status(500).json({ error: 'Failed to create chat' });
    }
});

// Update a chat (or create if it doesn't exist - upsert)
// Any organization member can update chats in their organization
app.put('/api/copilot/chats/:chatId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const orgId = req.user.orgId;
        const { chatId } = req.params;
        const { title, messages, updatedAt, createdAt } = req.body;

        // Check if chat exists in the organization (any member can update)
        const chat = await db.get(
            'SELECT * FROM copilot_chats WHERE id = ? AND organizationId = ?',
            [chatId, orgId]
        );

        const { instructions, allowedEntities, isFavorite, tags } = req.body;
        
        if (!chat) {
            // Chat doesn't exist, create it (upsert behavior)
            console.log('[Copilot] Chat not found, creating new chat:', chatId);
            await db.run(
                `INSERT INTO copilot_chats (id, userId, organizationId, title, messages, instructions, allowedEntities, isFavorite, tags, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    chatId,
                    userId,
                    orgId,
                    title,
                    JSON.stringify(messages),
                    instructions || null,
                    allowedEntities ? JSON.stringify(allowedEntities) : null,
                    isFavorite ? 1 : 0,
                    tags ? JSON.stringify(tags) : null,
                    createdAt || updatedAt || new Date().toISOString(),
                    updatedAt || new Date().toISOString()
                ]
            );
        } else {
            // Chat exists, update it
            await db.run(
                `UPDATE copilot_chats SET title = ?, messages = ?, instructions = ?, allowedEntities = ?, isFavorite = ?, tags = ?, updatedAt = ? WHERE id = ?`,
                [
                    title, 
                    JSON.stringify(messages), 
                    instructions || null,
                    allowedEntities ? JSON.stringify(allowedEntities) : null,
                    isFavorite ? 1 : 0,
                    tags ? JSON.stringify(tags) : null,
                    updatedAt, 
                    chatId
                ]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Copilot] Error updating chat:', error);
        res.status(500).json({ error: 'Failed to update chat' });
    }
});

// Delete a chat
// Any organization member can delete chats in their organization
app.delete('/api/copilot/chats/:chatId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const orgId = req.user.orgId;
        const { chatId } = req.params;

        // Verify the chat belongs to the organization (any member can delete)
        const chat = await db.get(
            'SELECT * FROM copilot_chats WHERE id = ? AND organizationId = ?',
            [chatId, orgId]
        );

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        await db.run('DELETE FROM copilot_chats WHERE id = ?', [chatId]);

        res.json({ success: true });
    } catch (error) {
        console.error('[Copilot] Error deleting chat:', error);
        res.status(500).json({ error: 'Failed to delete chat' });
    }
});

// OpenAI Generation Endpoint
app.post('/api/generate', authenticateToken, async (req, res) => {
    console.log('Received generation request');
    console.time('Total Request Time');
    try {
        const { prompt, mentionedEntityIds, additionalContext } = req.body;
        console.log('Prompt:', prompt);
        console.log('Mentioned IDs:', mentionedEntityIds);
        console.log('Additional Context Present:', !!additionalContext);

        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API Key missing');
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        // 1. Fetch data for mentioned entities
        console.time('DB Fetch Time');
        let contextData = {};

        if (mentionedEntityIds && mentionedEntityIds.length > 0) {
            // Fetch all entities in parallel
            const entityPromises = mentionedEntityIds.map(async (entityId) => {
                // Get Entity Metadata (Ensure it belongs to user's org)
                const entity = await db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
                if (!entity) return null;

                // Get Properties
                const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entityId]);

                // Get Records (Limit to 50 for performance)
                const records = await db.all('SELECT * FROM records WHERE entityId = ? LIMIT 50', [entityId]);

                // Fetch record values for these records
                // Fetch record values for these records
                const recordsWithValues = await Promise.all(records.map(async (r) => {
                    const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [r.id]);
                    const valuesMap = {};

                    await Promise.all(values.map(async v => {
                        // Find property name if possible, or use ID
                        const prop = properties.find(p => p.id === v.propertyId);
                        const key = prop ? prop.name : v.propertyId;

                        let value = v.value;
                        if (prop && prop.type === 'relation' && prop.relatedEntityId) {
                            value = await resolveRelationValue(db, v.value, prop.relatedEntityId);
                        } else if (prop && prop.type === 'file' && v.value) {
                            // Extract file content for file type properties
                            try {
                                const fileData = JSON.parse(v.value);
                                if (fileData && fileData.filename) {
                                    const fileContent = await extractFileContent(fileData.filename);
                                    if (fileContent && fileContent.text) {
                                        value = {
                                            filename: fileData.originalName || fileData.filename,
                                            content: fileContent.text.substring(0, 50000) // Limit to ~50k chars to avoid token limits
                                        };
                                    } else {
                                        value = {
                                            filename: fileData.originalName || fileData.filename,
                                            content: '[File content could not be extracted]'
                                        };
                                    }
                                }
                            } catch (e) {
                                console.error('Error processing file value:', e);
                            }
                        }

                        valuesMap[key] = value;
                    }));

                    return {
                        id: r.id,
                        createdAt: r.createdAt,
                        ...valuesMap
                    };
                }));

                return {
                    name: entity.name,
                    data: {
                        description: entity.description,
                        properties: properties.map(p => ({ name: p.name, type: p.type })),
                        records: recordsWithValues
                    }
                };
            });

            const results = await Promise.all(entityPromises);

            results.forEach(result => {
                if (result) {
                    contextData[result.name] = result.data;
                }
            });

            // 2. Fetch related entities (both outgoing and incoming relations)
            const relatedEntityIds = new Set();
            
            // Find outgoing relations (entities this entity links TO)
            for (const entityId of mentionedEntityIds) {
                const relationProps = await db.all(
                    'SELECT relatedEntityId FROM properties WHERE entityId = ? AND type = ? AND relatedEntityId IS NOT NULL',
                    [entityId, 'relation']
                );
                relationProps.forEach(p => relatedEntityIds.add(p.relatedEntityId));
            }

            // Find incoming relations (entities that link TO this entity)
            for (const entityId of mentionedEntityIds) {
                const incomingProps = await db.all(
                    'SELECT DISTINCT entityId FROM properties WHERE type = ? AND relatedEntityId = ?',
                    ['relation', entityId]
                );
                incomingProps.forEach(p => relatedEntityIds.add(p.entityId));
            }

            // Remove already mentioned entities
            mentionedEntityIds.forEach(id => relatedEntityIds.delete(id));

            // Fetch data for related entities
            if (relatedEntityIds.size > 0) {
                console.log('Found related entities:', Array.from(relatedEntityIds));
                
                const relatedPromises = Array.from(relatedEntityIds).map(async (entityId) => {
                    const entity = await db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
                    if (!entity) return null;

                    const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entityId]);
                    const records = await db.all('SELECT * FROM records WHERE entityId = ? LIMIT 50', [entityId]);

                    const recordsWithValues = await Promise.all(records.map(async (r) => {
                        const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [r.id]);
                        const valuesMap = {};

                        await Promise.all(values.map(async v => {
                            const prop = properties.find(p => p.id === v.propertyId);
                            const key = prop ? prop.name : v.propertyId;

                            let value = v.value;
                            if (prop && prop.type === 'relation' && prop.relatedEntityId) {
                                value = await resolveRelationValue(db, v.value, prop.relatedEntityId);
                            } else if (prop && prop.type === 'file' && v.value) {
                                try {
                                    const fileData = JSON.parse(v.value);
                                    if (fileData && fileData.filename) {
                                        const fileContent = await extractFileContent(fileData.filename);
                                        if (fileContent && fileContent.text) {
                                            value = {
                                                filename: fileData.originalName || fileData.filename,
                                                content: fileContent.text.substring(0, 50000)
                                            };
                                        } else {
                                            value = {
                                                filename: fileData.originalName || fileData.filename,
                                                content: '[File content could not be extracted]'
                                            };
                                        }
                                    }
                                } catch (e) {
                                    console.error('Error processing file value:', e);
                                }
                            }

                            valuesMap[key] = value;
                        }));

                        return { id: r.id, createdAt: r.createdAt, ...valuesMap };
                    }));

                    return {
                        name: entity.name,
                        data: {
                            description: entity.description,
                            properties: properties.map(p => ({ name: p.name, type: p.type, relatedTo: p.relatedEntityId ? 'linked' : null })),
                            records: recordsWithValues,
                            _isRelatedEntity: true
                        }
                    };
                });

                const relatedResults = await Promise.all(relatedPromises);
                relatedResults.forEach(result => {
                    if (result && !contextData[result.name]) {
                        contextData[result.name] = result.data;
                    }
                });
            }
        }
        console.timeEnd('DB Fetch Time');
        console.log('Context Data Keys:', Object.keys(contextData));

        // 2. Call OpenAI
        console.time('OpenAI API Time');
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        let systemPrompt = `You are a helpful data analyst assistant. 
            You have access to the following data context (JSON format): ${JSON.stringify(contextData)}.`;

        if (additionalContext) {
            systemPrompt += `\n\nAdditionally, here is some specific input data to consider: ${JSON.stringify(additionalContext)}.`;
        }

        systemPrompt += `\n\nAnswer the user's question based on this data. 
            If the answer is not in the data, say so.
            Format your response in Markdown.`;

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
        });
        console.timeEnd('OpenAI API Time');
        console.timeEnd('Total Request Time');

        res.json({ response: completion.choices[0].message.content });

    } catch (error) {
        console.error('Error generating response:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// Python Execution Endpoint - Secure Sandbox
app.post('/api/python/execute', authenticateToken, async (req, res) => {
    const { code, inputData } = req.body;
    
    // Check if Lambda is configured
    const useLambda = process.env.USE_LAMBDA_FOR_PYTHON === 'true' && 
                     process.env.AWS_ACCESS_KEY_ID && 
                     process.env.LAMBDA_FUNCTION_NAME;
    
    if (useLambda) {
        // Use AWS Lambda for execution (secure, isolated)
        try {
            const { executePythonInLambda } = require('./lambdaService');
            console.log('[Python] Using AWS Lambda for execution');
            
            const result = await executePythonInLambda(code, inputData);
            
            if (result.success) {
                // Log result details for debugging
                const resultType = result.result === null ? 'null' : 
                                   result.result === undefined ? 'undefined' :
                                   Array.isArray(result.result) ? `array[${result.result.length}]` :
                                   typeof result.result;
                console.log(`[Python Lambda] Result type: ${resultType}`);
                
                if (result.result === null || result.result === undefined) {
                    console.warn('[Python Lambda] Warning: process() returned null/undefined');
                }
                
                res.json({
                    success: true,
                    output: result.output || '',
                    result: result.result,
                    resultType: resultType // Include type info for debugging
                });
            } else {
                res.json({
                    success: false,
                    error: result.error || 'Execution failed',
                    traceback: result.traceback
                });
            }
            return;
        } catch (error) {
            console.error('[Python Lambda] Execution error:', error);
            // Fall back to local execution if Lambda fails
            console.log('[Python] Lambda failed, falling back to local execution');
        }
    }
    
    // Fallback: Local execution with sandboxing (less secure)
    console.log('[Python] Using local sandboxed execution');
    const fs = require('fs');
    const path = require('path');
    const { spawn } = require('child_process');
    const crypto = require('crypto');

    // Timeout in seconds
    const EXECUTION_TIMEOUT = 30;

    try {
        // Escape user code safely - convert to base64 to avoid any injection
        const codeBase64 = Buffer.from(code || '').toString('base64');
        
        // Create a secure wrapper script
        const wrapperCode = `
import json
import sys
import ast
import base64
import signal

# ============== TIMEOUT HANDLER ==============
class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("Execution timed out (${EXECUTION_TIMEOUT}s limit)")

# Set timeout (Unix only, Windows will skip this)
try:
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(${EXECUTION_TIMEOUT})
except:
    pass  # Windows doesn't support SIGALRM

# ============== SECURITY CHECKS ==============
def check_security(code_str):
    try:
        tree = ast.parse(code_str)
    except SyntaxError as e:
        return f"Syntax Error: {e}"

    # Allowed safe imports (whitelist approach)
    allowed_imports = {
        'json', 'math', 're', 'datetime', 'collections', 'itertools',
        'functools', 'decimal', 'fractions', 'random', 'statistics',
        'string', 'copy', 'operator', 'numbers', 'time', 'calendar',
        'heapq', 'bisect', 'array', 'enum', 'typing', 'dataclasses',
        'csv', 'hashlib', 'hmac', 'base64', 'binascii', 'struct',
        'codecs', 'unicodedata', 'difflib', 'textwrap', 'pprint',
        # Data processing libraries (commonly needed)
        'urllib', 'html', 'xml', 'warnings', 'logging', 'uuid',
        'pickle', 'shelve', 'sqlite3', 'zlib', 'gzip', 'bz2',
        # Numeric/Scientific (if installed)
        'numpy', 'pandas', 'scipy', 'matplotlib', 'seaborn',
        # Others
        'io', 'pathlib', 'glob', 'fnmatch', 'linecache', 'shutil'
    }
    
    # Expanded forbidden functions/names
    forbidden_names = {
        'open', 'exec', 'eval', 'compile', '__import__', 'input', 
        'breakpoint', 'help', 'exit', 'quit',
        '__build_class__', '__loader__', '__spec__', '__builtins__', 
        '__cached__', '__doc__', '__file__', '__name__', '__package__'
    }
    
    # Forbidden attribute access patterns
    forbidden_attrs = {
        '__class__', '__bases__', '__subclasses__', '__mro__', '__dict__',
        '__globals__', '__code__', '__closure__', '__func__', '__self__',
        '__reduce__', '__reduce_ex__', '__getinitargs__', '__getnewargs__',
        '__getstate__', '__setstate__', 'gi_frame', 'gi_code', 'f_globals',
        'f_locals', 'f_builtins', 'co_code', 'func_globals', 'func_code'
    }

    for node in ast.walk(tree):
        # Check imports - whitelist approach
        if isinstance(node, ast.Import):
            for alias in node.names:
                module_base = alias.name.split('.')[0]
                if module_base not in allowed_imports:
                    return f"Security Error: Import of '{alias.name}' is not allowed. Allowed: {', '.join(sorted(allowed_imports))}"
        
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module_base = node.module.split('.')[0]
                if module_base not in allowed_imports:
                    return f"Security Error: Import from '{node.module}' is not allowed. Allowed: {', '.join(sorted(allowed_imports))}"
        
        # Check function calls and name access
        elif isinstance(node, ast.Name):
            if node.id in forbidden_names:
                return f"Security Error: Access to '{node.id}' is not allowed"
        
        # Check attribute access - only block dangerous dunder methods
        elif isinstance(node, ast.Attribute):
            if node.attr in forbidden_attrs:
                return f"Security Error: Access to '{node.attr}' is not allowed"

    return None

# ============== SAFE BUILTINS ==============
SAFE_BUILTINS = {
    'True': True,
    'False': False,
    'None': None,
    'abs': abs,
    'all': all,
    'any': any,
    'bin': bin,
    'bool': bool,
    'chr': chr,
    'dict': dict,
    'divmod': divmod,
    'enumerate': enumerate,
    'filter': filter,
    'float': float,
    'format': format,
    'frozenset': frozenset,
    'hash': hash,
    'hex': hex,
    'int': int,
    'isinstance': isinstance,
    'issubclass': issubclass,
    'iter': iter,
    'len': len,
    'list': list,
    'map': map,
    'max': max,
    'min': min,
    'next': next,
    'oct': oct,
    'ord': ord,
    'pow': pow,
    'print': print,
    'range': range,
    'repr': repr,
    'reversed': reversed,
    'round': round,
    'set': set,
    'slice': slice,
    'sorted': sorted,
    'str': str,
    'sum': sum,
    'tuple': tuple,
    'zip': zip,
    # Math functions (safe)
    'complex': complex,
}

# ============== DECODE AND EXECUTE ==============
try:
    # Decode user code from base64
    user_code = base64.b64decode("${codeBase64}").decode('utf-8')
    
    # Run security check
    security_error = check_security(user_code)
    if security_error:
        print(json.dumps({"error": security_error}))
        sys.exit(0)
    
    # Create restricted globals
    restricted_globals = {
        '__builtins__': SAFE_BUILTINS,
        'json': json,  # Allow json for data processing
        'math': __import__('math'),  # Allow math module
        're': __import__('re'),  # Allow regex
        'datetime': __import__('datetime'),  # Allow datetime
        'collections': __import__('collections'),  # Allow collections
        'itertools': __import__('itertools'),  # Allow itertools
        'functools': __import__('functools'),  # Allow functools
        'decimal': __import__('decimal'),  # Allow decimal
        'fractions': __import__('fractions'),  # Allow fractions
        'random': __import__('random'),  # Allow random
        'statistics': __import__('statistics'),  # Allow statistics
        'string': __import__('string'),  # Allow string
        'copy': __import__('copy'),  # Allow copy
    }
    restricted_locals = {}
    
    # Execute user code in restricted environment
    exec(user_code, restricted_globals, restricted_locals)
    
    # Read input from stdin
    input_data = json.load(sys.stdin)
    
    # Execute user function (must be named 'process')
    if 'process' in restricted_locals:
        result = restricted_locals['process'](input_data)
        print(json.dumps(result))
    else:
        print(json.dumps({"error": "Function 'process(data)' not found. Please define: def process(data): ..."}))

except TimeoutError as e:
    print(json.dumps({"error": str(e)}))
except MemoryError:
    print(json.dumps({"error": "Memory limit exceeded"}))
except Exception as e:
    print(json.dumps({"error": f"Runtime Error: {str(e)}"}))
finally:
    # Cancel alarm
    try:
        signal.alarm(0)
    except:
        pass
`;

        // Write to temp file with random name to prevent race conditions
        const tempFile = path.join(__dirname, `sandbox_${crypto.randomBytes(8).toString('hex')}.py`);
        fs.writeFileSync(tempFile, wrapperCode);

        // Execute python script
        const pythonCommand = process.platform === 'win32' ? 'py' : 'python3';
        console.log('Executing Python (sandboxed) with command:', pythonCommand);

        const pythonProcess = spawn(pythonCommand, [tempFile]);

        // Set up Node.js level timeout as backup
        const processTimeout = setTimeout(() => {
            pythonProcess.kill('SIGKILL');
            console.error('Python process killed due to timeout');
        }, (EXECUTION_TIMEOUT + 5) * 1000);

        pythonProcess.on('error', (err) => {
            clearTimeout(processTimeout);
            console.error('Failed to start python process:', err);
        });

        let stdoutData = '';
        let stderrData = '';

        // Send input data to stdin
        pythonProcess.stdin.write(JSON.stringify(inputData || []));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            // Limit output size to prevent memory exhaustion
            if (stdoutData.length < 10 * 1024 * 1024) { // 10MB limit
                stdoutData += data.toString();
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            if (stderrData.length < 1024 * 1024) { // 1MB limit
                stderrData += data.toString();
            }
        });

        pythonProcess.on('close', (code) => {
            clearTimeout(processTimeout);
            
            // Cleanup temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.error('Error deleting temp file:', e);
            }

            if (code !== 0 && !stdoutData) {
                return res.status(500).json({ error: stderrData || 'Python execution failed' });
            }

            try {
                const result = JSON.parse(stdoutData);
                if (result.error) {
                    return res.status(400).json({ error: result.error });
                }
                res.json({ result });
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse Python output: ' + stdoutData.substring(0, 500) });
            }
        });

    } catch (error) {
        console.error('Error executing Python:', error);
        res.status(500).json({ error: 'Internal server error during execution' });
    }
});

// Franmit Reactor Execution Endpoint - Local Python Execution
app.post('/api/franmit/execute', authenticateToken, async (req, res) => {
    const { funName, receta, qins, reactorConfiguration } = req.body;

    const fs = require('fs');
    const path = require('path');
    const { spawn } = require('child_process');
    const platform = require('os').platform();

    try {
        console.log('[Franmit] Executing reactor model locally');
        
        // Build input data
        const zeros8 = [0, 0, 0, 0, 0, 0, 0, 0];
        const inputData = {
            receta: receta || {},
            reactor_configuration: reactorConfiguration || { V_reb: 53, scale_cat: 1 },
            qins: qins || {
                'Q_H2o': 0, 'Q_Hxo': 0,
                'Q_Po': [...zeros8], 'Q_Yo': [...zeros8], 'Q_Y1': [...zeros8],
                'Q_To': [...zeros8], 'Q_T1': [...zeros8], 'Q_T2': [...zeros8],
            }
        };
        
        console.log('[Franmit] Input data:', JSON.stringify(inputData).substring(0, 300));

        // Path to Python script
        const scriptPath = path.join(__dirname, 'franmit_model.py');
        
        // Check if script exists
        if (!fs.existsSync(scriptPath)) {
            return res.status(500).json({
                success: false,
                error: `Franmit model script not found at ${scriptPath}`
            });
        }

        // Determine Python command
        const pythonCmd = platform === 'win32' ? 'py' : 'python3';
        
        // Execute Python script
        const pythonProcess = spawn(pythonCmd, [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Send input data as JSON
        pythonProcess.stdin.write(JSON.stringify(inputData));
        pythonProcess.stdin.end();

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        // Set timeout (60 seconds for reactor model)
        const timeout = setTimeout(() => {
            pythonProcess.kill('SIGKILL');
            return res.status(500).json({
                success: false,
                error: 'Franmit execution timed out (60s limit)'
            });
        }, 60000);

        pythonProcess.on('close', (code) => {
            clearTimeout(timeout);
            
            // Log stderr warnings (numpy RuntimeWarnings are expected)
            if (stderrData) {
                console.log('[Franmit] Python stderr (warnings):', stderrData.substring(0, 300));
            }

            // Try to parse stdout first (even on non-zero exit code, errors are in stdout as JSON)
            try {
                const result = JSON.parse(stdoutData);
                
                if (result.success) {
                    console.log('[Franmit] Reactor model completed successfully');
                    res.json({
                        success: true,
                        outs: result.outs,
                        qouts: result.qouts,
                        display: ''
                    });
                } else {
                    console.log('[Franmit] Model returned error:', result.error);
                    res.json({
                        success: false,
                        error: result.error || 'Franmit execution failed',
                        traceback: result.traceback,
                        display: result.error || ''
                    });
                }
            } catch (parseError) {
                // If stdout is not valid JSON, fall back to stderr
                if (code !== 0) {
                    console.error('[Franmit] Python process error (code ' + code + '):', stderrData || stdoutData);
                    res.status(500).json({
                        success: false,
                        error: stderrData || stdoutData || 'Franmit execution failed',
                        traceback: stderrData
                    });
                } else {
                    console.error('[Franmit] Failed to parse output:', parseError);
                    console.error('[Franmit] Raw stdout:', stdoutData.substring(0, 500));
                    res.status(500).json({
                        success: false,
                        error: 'Failed to parse Franmit output',
                        rawOutput: stdoutData.substring(0, 500)
                    });
                }
            }
        });

        pythonProcess.on('error', (error) => {
            clearTimeout(timeout);
            console.error('[Franmit] Failed to start Python process:', error);
            res.status(500).json({
                success: false,
                error: `Failed to execute Python: ${error.message}. Make sure Python 3 with numpy is installed.`
            });
        });

    } catch (error) {
        console.error('[Franmit] Execution error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Franmit execution failed'
        });
    }
});

// Python Debug Endpoint - AI analyzes error and suggests fix
app.post('/api/debug-python-code', authenticateToken, async (req, res) => {
    const { code, error, inputDataSample } = req.body;

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API Key not configured' });
    }

    if (!code || !error) {
        return res.status(400).json({ error: 'Code and error are required' });
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build context about input data if available
        let inputContext = '';
        if (inputDataSample && inputDataSample.length > 0) {
            inputContext = `\n\nSample input data (first ${inputDataSample.length} records):\n${JSON.stringify(inputDataSample, null, 2)}`;
        }

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a Python debugging expert. Analyze the code and error, then provide a fixed version.

Your response MUST be valid JSON with this structure:
{
    "explanation": "Brief explanation of what was wrong and how you fixed it",
    "fixedCode": "The complete fixed Python code"
}

RULES:
1. The code must define a function called "process" that takes "data" as parameter
2. The function must return the processed data (array of objects or single object)
3. Keep the same general logic but fix the error
4. If using numpy/pandas/scipy, make sure imports are correct
5. Return ONLY the JSON, no markdown formatting`
                },
                {
                    role: "user",
                    content: `Please fix this Python code:

=== ORIGINAL CODE ===
${code}

=== ERROR MESSAGE ===
${error}
${inputContext}

Analyze the error and provide the fixed code.`
                }
            ],
            model: "gpt-4o-mini",
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log('[Python Debug] AI suggestion:', result.explanation);
        
        res.json({
            fixedCode: result.fixedCode,
            explanation: result.explanation
        });

    } catch (error) {
        console.error('Error debugging Python code:', error);
        res.status(500).json({ error: 'Failed to debug code' });
    }
});

// Python Code Generation Endpoint
app.post('/api/python/generate', authenticateToken, async (req, res) => {
    const { prompt, inputDataSchema } = req.body;

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API Key not configured' });
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build context about input data if available
        let inputDataContext = '';
        if (inputDataSchema && inputDataSchema.columns && inputDataSchema.columns.length > 0) {
            console.log('Python Generate - Input Schema:', JSON.stringify(inputDataSchema));
            inputDataContext = `

CRITICAL - INPUT DATA STRUCTURE:
The input data contains records with these EXACT column names: ${inputDataSchema.columns.map(c => `"${c}"`).join(', ')}
You MUST use these EXACT column names in your code. Do NOT translate, rename, or modify them in any way.
For example, if the column is "temperatura_celsius", use exactly "temperatura_celsius", NOT "temperature_celsius".`;
            
            if (inputDataSchema.sampleData && inputDataSchema.sampleData.length > 0) {
                inputDataContext += `
Sample input data: ${JSON.stringify(inputDataSchema.sampleData)}`;
            }
        } else {
            console.log('Python Generate - No input schema provided');
        }

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a Python code generator. Your ONLY job is to output Python code. NEVER output explanations, comments outside code, or any text that is not valid Python code.

STRICT RULES:
1. Output ONLY valid Python code - nothing else.
2. Start with any necessary imports (like: import json, import math, etc.)
3. Define a function named exactly: def process(data):
4. The function receives 'data' which is a list of dictionaries (records).
5. The function MUST return the modified list.
6. Do NOT include markdown formatting (no \`\`\`python or \`\`\`).
7. Do NOT include any explanations or text outside the code.${inputDataContext}

EXAMPLE OUTPUT FORMAT:
import json

def process(data):
    for record in data:
        # your logic here
        pass
    return data`
                },
                { role: "user", content: `Generate Python code to: ${prompt}` }
            ],
            model: "gpt-4o",
        });

        let code = completion.choices[0].message.content;

        // Strip markdown if present (just in case)
        code = code.replace(/```python/g, '').replace(/```/g, '').trim();

        res.json({ code });

    } catch (error) {
        console.error('Error generating Python code:', error);
        res.status(500).json({ error: 'Failed to generate code' });
    }
});

// OpenAI Widget Generation Endpoint
app.post('/api/generate-widget', authenticateToken, async (req, res) => {
    console.log('Received widget generation request');
    try {
        const { prompt, mentionedEntityIds, entityContext, forceRealData } = req.body;
        console.log('Widget Prompt:', prompt);
        console.log('Entity IDs:', mentionedEntityIds?.length || 0, 'entities');

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        // If no entities provided, fetch ALL entities from the organization
        let entityIdsToUse = mentionedEntityIds || [];
        if (entityIdsToUse.length === 0) {
            console.log('No entities mentioned, fetching all organization entities...');
            const allEntities = await db.all('SELECT id FROM entities WHERE organizationId = ?', [req.user.orgId]);
            entityIdsToUse = allEntities.map(e => e.id);
            console.log('Found', entityIdsToUse.length, 'entities in organization');
        }

        // 1. Fetch data context (Reuse logic - ideally refactor into function)
        let contextData = {};
        if (entityIdsToUse && entityIdsToUse.length > 0) {
            const entityPromises = entityIdsToUse.map(async (entityId) => {
                const entity = await db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
                if (!entity) return null;
                const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entityId]);
                const records = await db.all('SELECT * FROM records WHERE entityId = ? LIMIT 50', [entityId]);
                const recordsWithValues = await Promise.all(records.map(async (r) => {
                    const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [r.id]);
                    const valuesMap = {};

                    await Promise.all(values.map(async v => {
                        const prop = properties.find(p => p.id === v.propertyId);
                        const key = prop ? prop.name : v.propertyId;

                        let value = v.value;
                        if (prop && prop.type === 'relation' && prop.relatedEntityId) {
                            value = await resolveRelationValue(db, v.value, prop.relatedEntityId);
                        } else if (prop && prop.type === 'file' && v.value) {
                            // Extract file content for file type properties
                            try {
                                const fileData = JSON.parse(v.value);
                                if (fileData && fileData.filename) {
                                    const fileContent = await extractFileContent(fileData.filename);
                                    if (fileContent && fileContent.text) {
                                        value = {
                                            filename: fileData.originalName || fileData.filename,
                                            content: fileContent.text.substring(0, 50000)
                                        };
                                    } else {
                                        value = {
                                            filename: fileData.originalName || fileData.filename,
                                            content: '[File content could not be extracted]'
                                        };
                                    }
                                }
                            } catch (e) {
                                console.error('Error processing file value:', e);
                            }
                        }

                        valuesMap[key] = value;
                    }));

                    return { id: r.id, ...valuesMap };
                }));
                return {
                    name: entity.name,
                    data: { properties: properties.map(p => ({ name: p.name, type: p.type })), records: recordsWithValues }
                };
            });
            const results = await Promise.all(entityPromises);
            results.forEach(result => { if (result) contextData[result.name] = result.data; });

            // Fetch related entities (both outgoing and incoming relations)
            const relatedEntityIds = new Set();
            
            for (const entityId of entityIdsToUse) {
                const relationProps = await db.all(
                    'SELECT relatedEntityId FROM properties WHERE entityId = ? AND type = ? AND relatedEntityId IS NOT NULL',
                    [entityId, 'relation']
                );
                relationProps.forEach(p => relatedEntityIds.add(p.relatedEntityId));
            }

            for (const entityId of entityIdsToUse) {
                const incomingProps = await db.all(
                    'SELECT DISTINCT entityId FROM properties WHERE type = ? AND relatedEntityId = ?',
                    ['relation', entityId]
                );
                incomingProps.forEach(p => relatedEntityIds.add(p.entityId));
            }

            entityIdsToUse.forEach(id => relatedEntityIds.delete(id));

            if (relatedEntityIds.size > 0) {
                const relatedPromises = Array.from(relatedEntityIds).map(async (entityId) => {
                    const entity = await db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
                    if (!entity) return null;

                    const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entityId]);
                    const records = await db.all('SELECT * FROM records WHERE entityId = ? LIMIT 50', [entityId]);

                    const recordsWithValues = await Promise.all(records.map(async (r) => {
                        const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [r.id]);
                        const valuesMap = {};

                        await Promise.all(values.map(async v => {
                            const prop = properties.find(p => p.id === v.propertyId);
                            const key = prop ? prop.name : v.propertyId;
                            let value = v.value;
                            if (prop && prop.type === 'relation' && prop.relatedEntityId) {
                                value = await resolveRelationValue(db, v.value, prop.relatedEntityId);
                            }
                            valuesMap[key] = value;
                        }));

                        return { id: r.id, ...valuesMap };
                    }));

                    return {
                        name: entity.name,
                        data: { properties: properties.map(p => ({ name: p.name, type: p.type })), records: recordsWithValues }
                    };
                });

                const relatedResults = await Promise.all(relatedPromises);
                relatedResults.forEach(result => {
                    if (result && !contextData[result.name]) {
                        contextData[result.name] = result.data;
                    }
                });
            }
        }

        // 2. Call OpenAI for Widget Config
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Check if we have real data to work with
        const hasRealData = Object.keys(contextData).length > 0;
        if (!hasRealData) {
            console.warn('No data context available for widget generation');
            return res.status(400).json({ 
                error: 'No data available. Please ensure you have entities with records in your database.' 
            });
        }

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a data visualization expert. You MUST ONLY use data from the provided context - NEVER invent, fabricate, or estimate data.

CRITICAL RULES:
1. ONLY use the actual data provided in the context below. Do NOT make up any values.
2. If the data doesn't contain what the user is asking for, explain what data IS available.
3. All values in your output MUST come directly from the provided records.
4. Do NOT extrapolate, estimate, or create fictional data points.

DATA CONTEXT (USE ONLY THIS DATA):
${JSON.stringify(contextData, null, 2)}

Based on the user's prompt and ONLY the data above, generate a JSON configuration for a chart.

The JSON structure MUST be:
{
    "type": "bar" | "line" | "pie" | "area",
    "title": "Chart Title",
    "description": "Brief description",
    "explanation": "A detailed explanation of how this chart was prepared. Structure it as two paragraphs separated by a double newline (\\n\\n). First paragraph: A natural language description of the logic. Second paragraph: Start with 'I executed the following technical query:' followed by pseudo-code steps. IMPORTANT: In the Technical Query, you MUST use the EXACT names of the Entities and Properties from the provided context (e.g., 'Filter @Equipment where Status=Active'). Do not use generic terms.",
    "data": [ { "name": "Label", "value": 123, ... } ],
    "xAxisKey": "name",
    "dataKey": "value" (or array of keys for multiple lines/areas),
    "colors": ["#hex", ...] (optional custom colors)
}

REMEMBER: Every data point must come from the actual records in the context. Never invent data.
Return ONLY the valid JSON string, no markdown formatting.`
                },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        const widgetConfig = JSON.parse(completion.choices[0].message.content);
        res.json(widgetConfig);

    } catch (error) {
        console.error('Error generating widget:', error);
        res.status(500).json({ error: 'Failed to generate widget' });
    }
});

// Generate Widget from Direct Data (for Workflow nodes)
app.post('/api/generate-widget-from-data', authenticateToken, async (req, res) => {
    console.log('Received widget generation request from workflow data');
    try {
        const { prompt, data } = req.body;
        console.log('Widget Prompt:', prompt);
        console.log('Data records:', Array.isArray(data) ? data.length : 'not an array');

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        if (!data || (Array.isArray(data) && data.length === 0)) {
            return res.status(400).json({ error: 'No data provided for visualization' });
        }

        // Prepare context with data schema and sample
        const dataArray = Array.isArray(data) ? data : [data];
        const sampleData = dataArray.slice(0, 10); // First 10 records as sample
        const fields = Object.keys(dataArray[0] || {});
        
        const dataContext = {
            totalRecords: dataArray.length,
            fields: fields,
            sampleRecords: sampleData,
            fullData: dataArray.slice(0, 100) // Limit to 100 records for processing
        };

        // Call OpenAI for Widget Config
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a data visualization expert.
            You have access to the following data:
            - Total records: ${dataContext.totalRecords}
            - Available fields: ${fields.join(', ')}
            - Sample data: ${JSON.stringify(dataContext.sampleRecords, null, 2)}
            - Full data (up to 100 records): ${JSON.stringify(dataContext.fullData)}
            
            Based on the user's prompt, generate a JSON configuration for a chart.
            IMPORTANT: You must transform/aggregate the provided data as needed to create meaningful visualizations.
            
            The JSON structure MUST be:
            {
                "type": "bar" | "line" | "pie" | "area",
                "title": "Chart Title",
                "description": "Brief description",
                "explanation": "A detailed explanation of how this chart was prepared. Structure it as two paragraphs separated by a double newline (\\n\\n). First paragraph: A natural language description of the logic and what the chart shows. Second paragraph: Start with 'Technical approach:' followed by how you processed the data.",
                "data": [ { "name": "Label", "value": 123, ... } ],
                "xAxisKey": "name",
                "dataKey": "value" (or array of keys for multiple lines/areas),
                "colors": ["#hex", ...] (optional custom colors)
            }
            
            CRITICAL RULES:
            1. The "data" array should contain the TRANSFORMED/AGGREGATED data ready for charting, NOT the raw input data
            2. For bar/line/area charts, ensure data has proper labels (xAxisKey) and numeric values (dataKey)
            3. For pie charts, ensure data has "name" field and a numeric value field
            4. If the user asks for aggregations (sum, count, average, group by), calculate them
            5. Ensure the data is aggregated or formatted correctly for the chosen chart type
            6. Return ONLY the valid JSON string, no markdown formatting.`
                },
                { role: "user", content: prompt }
            ],
            model: "gpt-4o",
            response_format: { type: "json_object" }
        });

        const widgetConfig = JSON.parse(completion.choices[0].message.content);
        console.log('Generated widget config:', widgetConfig.title);
        res.json(widgetConfig);

    } catch (error) {
        console.error('Error generating widget from data:', error);
        res.status(500).json({ error: error.message || 'Failed to generate widget' });
    }
});

// AI Workflow Generation Endpoint
app.post('/api/generate-workflow', authenticateToken, async (req, res) => {
    console.log('Received workflow generation request');
    try {
        const { prompt, entities } = req.body;
        console.log('Workflow Prompt:', prompt);

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        // Build entity context for the AI
        const entityContext = entities.map(e => ({
            id: e.id,
            name: e.name,
            properties: e.properties.map(p => ({ name: p.name, type: p.type }))
        }));

        const systemPrompt = `You are an AI assistant that generates workflow configurations. You must output ONLY valid JSON, no explanations.

Available node types and their configurations:

1. **trigger** - Start the workflow
   - label: "Manual Trigger" or "Schedule"

2. **fetchData** - Get records from a database entity
   - config: { selectedEntityId: "entity-uuid", selectedEntityName: "EntityName" }

3. **condition** - If/Else branching (has two outputs: true and false)
   - config: { conditionField: "fieldName", conditionOperator: "equals|notEquals|contains|greaterThan|lessThan", conditionValue: "value" }

4. **join** - Combine data from two sources (has two inputs: A and B)
   - config: { joinStrategy: "concat|mergeByKey", joinKey: "fieldName" }

5. **addField** - Add a new field to each record
   - config: { fieldName: "newField", fieldValue: "value or expression" }

6. **llm** - Generate text using AI
   - config: { prompt: "AI prompt text" }

7. **python** - Run Python code
   - config: { code: "python code here" }

8. **http** - Make HTTP request
   - config: { url: "https://...", method: "GET|POST" }

9. **manualInput** - Define a variable
   - config: { variableName: "name", variableValue: "value" }

10. **saveRecords** - Save data to database
    - config: { targetEntityId: "entity-uuid", targetEntityName: "EntityName", fieldMappings: {} }

11. **output** - Display results
    - label: "Output" or custom label

12. **humanApproval** - Wait for user approval
    - label: "Human Approval"

13. **esios** - Fetch energy prices from Red Eléctrica
    - config: { indicator: "indicator-id" }

14. **climatiq** - Search CO2 emission factors
    - config: { searchQuery: "activity description" }

15. **excelInput** - Load data from Excel or CSV file
    - config: { fileName: "file.xlsx" } (file must be uploaded via node configuration)

User's available entities:
${JSON.stringify(entityContext, null, 2)}

RULES:
1. Always start with a "trigger" node at x=150
2. Space nodes horizontally by 280px (x: 150, 430, 710, 990...)
3. Keep y position around 250 for main flow
4. For condition nodes, branch true path at y=200, false path at y=400
5. Generate unique IDs using format: "node_1", "node_2", etc.
6. Connection IDs use format: "conn_1", "conn_2", etc.
7. For condition connections, specify outputType: "true" or "false"
8. For join connections, specify inputPort: "A" or "B"
9. Match entity names/IDs from the provided entities list when using fetchData or saveRecords

Output format:
{
  "nodes": [
    { "id": "node_1", "type": "trigger", "label": "Manual Trigger", "x": 150, "y": 250 },
    { "id": "node_2", "type": "fetchData", "label": "Fetch Customers", "x": 430, "y": 250, "config": { "selectedEntityId": "uuid", "selectedEntityName": "Customers" } }
  ],
  "connections": [
    { "id": "conn_1", "fromNodeId": "node_1", "toNodeId": "node_2" }
  ]
}`;

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Create a workflow for: ${prompt}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        const workflowData = JSON.parse(completion.choices[0].message.content);
        console.log('Generated workflow:', JSON.stringify(workflowData, null, 2));
        res.json(workflowData);

    } catch (error) {
        console.error('Error generating workflow:', error);
        res.status(500).json({ error: 'Failed to generate workflow' });
    }
});

// AI Workflow Assistant Chat Endpoint
app.post('/api/workflows/assistant/chat', authenticateToken, async (req, res) => {
    console.log('[Workflow AI Chat] Request received');
    try {
        const { message, workflowId, workflowName, nodes, connections, entities } = req.body;
        
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        console.log('[Workflow AI Chat] Message:', message);
        console.log('[Workflow AI Chat] Workflow:', workflowName, '- Nodes:', nodes.length, '- Connections:', connections.length);

        // Build context about the current workflow
        const workflowContext = {
            name: workflowName,
            nodes: nodes.map(n => ({
                id: n.id,
                type: n.type,
                label: n.label,
                config: n.config
            })),
            connections: connections.map(c => ({
                from: c.fromNodeId,
                to: c.toNodeId,
                outputType: c.outputType,
                inputPort: c.inputPort
            })),
            entities: entities.map(e => ({
                id: e.id,
                name: e.name,
                properties: e.properties
            }))
        };

        const systemPrompt = `You are an AI workflow assistant. You help users build and modify automation workflows.

Current Workflow Context:
${JSON.stringify(workflowContext, null, 2)}

Available node types:
- trigger: Start workflow (Manual or Schedule)
- fetchData: Get records from database
- condition: If/Else branching (outputs: true/false)
- join: Combine data from two sources (inputs: A/B)
- addField: Add field to records
- llm: AI text generation
- python: Run Python code
- http: HTTP request
- manualInput: Define variable
- saveRecords: Save to database
- output: Display results
- humanApproval: Wait for approval
- excelInput: Load Excel/CSV
- pdfInput: Extract PDF text
- splitColumns: Split data by columns
- mysql: Query MySQL database
- sendEmail: Send email
- webhook: Receive external data

When the user asks to add nodes or modify the workflow:
1. Respond with a friendly explanation of what you're suggesting
2. Include a "suggestion" object with the workflow modification

Response format when suggesting workflow changes:
{
  "message": "I'll add a Fetch Data node to get customer records...",
  "suggestion": {
    "type": "nodes",
    "description": "Add Fetch Data node for customers",
    "nodes": [
      {
        "id": "node_new_1",
        "type": "fetchData",
        "label": "Fetch Customers",
        "x": 430,
        "y": 250,
        "config": { "selectedEntityId": "uuid", "selectedEntityName": "Customers" }
      }
    ],
    "connections": [
      {
        "id": "conn_new_1",
        "fromNodeId": "existing_node_id",
        "toNodeId": "node_new_1"
      }
    ]
  }
}

Response format for general questions (no workflow changes):
{
  "message": "Your response here..."
}

IMPORTANT:
- Only include "suggestion" when the user wants to ADD or MODIFY nodes
- For questions or explanations, just return "message"
- Position new nodes thoughtfully (consider existing node positions)
- Generate unique IDs for new nodes/connections
- Always respond in JSON format`;

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        const aiResponse = JSON.parse(completion.choices[0].message.content);
        console.log('[Workflow AI Chat] Response:', aiResponse.message);
        
        if (aiResponse.suggestion) {
            console.log('[Workflow AI Chat] Suggestion type:', aiResponse.suggestion.type);
        }

        // Save the prompt as feedback for admin review
        try {
            const feedbackId = Math.random().toString(36).substr(2, 9);
            const createdAt = new Date().toISOString();
            
            await db.run(`
                INSERT INTO node_feedback (id, nodeType, nodeLabel, feedbackText, userId, userName, userEmail, organizationId, workflowId, workflowName, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                feedbackId,
                'ai_assistant',
                'Workflow AI Assistant',
                message,
                req.user.sub,
                req.user.name || '',
                req.user.email || '',
                req.user.orgId,
                workflowId || null,
                workflowName || null,
                createdAt
            ]);
            
            console.log('[Workflow AI Chat] Prompt saved to feedback');
        } catch (feedbackError) {
            console.error('[Workflow AI Chat] Error saving feedback:', feedbackError);
            // Don't fail the request if feedback save fails
        }

        res.json(aiResponse);

    } catch (error) {
        console.error('[Workflow AI Chat] Error:', error);
        res.status(500).json({ error: 'Failed to process AI chat message' });
    }
});

// Dashboard Management Endpoints
app.get('/api/dashboards', authenticateToken, async (req, res) => {
    try {
        const dashboards = await db.all(
            'SELECT id, name, description, isPublic, shareToken, createdAt, updatedAt FROM dashboards WHERE organizationId = ? ORDER BY updatedAt DESC',
            [req.user.orgId]
        );
        res.json(dashboards);
    } catch (error) {
        console.error('Error fetching dashboards:', error);
        res.status(500).json({ error: 'Failed to fetch dashboards' });
    }
});

app.post('/api/dashboards', authenticateToken, async (req, res) => {
    try {
        const { id, name, description } = req.body;
        const now = new Date().toISOString();
        
        await db.run(
            'INSERT INTO dashboards (id, organizationId, name, description, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, req.user.orgId, name, description || '', req.user.id, now, now]
        );

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'dashboard',
            resourceId: id,
            resourceName: name,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ id, name, description, createdAt: now, updatedAt: now });
    } catch (error) {
        console.error('Error creating dashboard:', error);
        res.status(500).json({ error: 'Failed to create dashboard' });
    }
});

app.put('/api/dashboards/:id', authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;
        const now = new Date().toISOString();
        
        await db.run(
            'UPDATE dashboards SET name = ?, description = ?, updatedAt = ? WHERE id = ? AND organizationId = ?',
            [name, description || '', now, req.params.id, req.user.orgId]
        );

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'update',
            resourceType: 'dashboard',
            resourceId: req.params.id,
            resourceName: name,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating dashboard:', error);
        res.status(500).json({ error: 'Failed to update dashboard' });
    }
});

app.delete('/api/dashboards/:id', authenticateToken, async (req, res) => {
    try {
        // Get dashboard name before deleting
        const dashboard = await db.get('SELECT name FROM dashboards WHERE id = ? AND organizationId = ?', [req.params.id, req.user.orgId]);
        
        await db.run('DELETE FROM dashboards WHERE id = ? AND organizationId = ?', [req.params.id, req.user.orgId]);

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'delete',
            resourceType: 'dashboard',
            resourceId: req.params.id,
            resourceName: dashboard?.name || 'Unknown',
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting dashboard:', error);
        res.status(500).json({ error: 'Failed to delete dashboard' });
    }
});

// Share dashboard - generate share token
app.post('/api/dashboards/:id/share', authenticateToken, async (req, res) => {
    try {
        const shareToken = require('crypto').randomBytes(16).toString('hex');
        const now = new Date().toISOString();
        
        // Get dashboard name for logging
        const dashboard = await db.get('SELECT name FROM dashboards WHERE id = ? AND organizationId = ?', [req.params.id, req.user.orgId]);
        
        await db.run(
            'UPDATE dashboards SET isPublic = 1, shareToken = ?, updatedAt = ? WHERE id = ? AND organizationId = ?',
            [shareToken, now, req.params.id, req.user.orgId]
        );

        // Log share activity (important security event)
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'share',
            resourceType: 'dashboard',
            resourceId: req.params.id,
            resourceName: dashboard?.name || 'Unknown',
            details: { shareToken: shareToken.substring(0, 8) + '...' },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ shareToken, shareUrl: `/shared/${shareToken}` });
    } catch (error) {
        console.error('Error sharing dashboard:', error);
        res.status(500).json({ error: 'Failed to share dashboard' });
    }
});

// Unshare dashboard
app.post('/api/dashboards/:id/unshare', authenticateToken, async (req, res) => {
    try {
        const now = new Date().toISOString();
        
        // Get dashboard name for logging
        const dashboard = await db.get('SELECT name FROM dashboards WHERE id = ? AND organizationId = ?', [req.params.id, req.user.orgId]);
        
        await db.run(
            'UPDATE dashboards SET isPublic = 0, shareToken = NULL, updatedAt = ? WHERE id = ? AND organizationId = ?',
            [now, req.params.id, req.user.orgId]
        );

        // Log unshare activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'unshare',
            resourceType: 'dashboard',
            resourceId: req.params.id,
            resourceName: dashboard?.name || 'Unknown',
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error unsharing dashboard:', error);
        res.status(500).json({ error: 'Failed to unshare dashboard' });
    }
});

// Get widgets for a dashboard
app.get('/api/dashboards/:id/widgets', authenticateToken, async (req, res) => {
    try {
        // Verify dashboard belongs to user's org
        const dashboard = await db.get('SELECT id FROM dashboards WHERE id = ? AND organizationId = ?', [req.params.id, req.user.orgId]);
        if (!dashboard) {
            return res.status(404).json({ error: 'Dashboard not found' });
        }
        
        const widgets = await db.all(
            `SELECT id, title, description, config, position, gridX, gridY, gridWidth, gridHeight, 
             dataSource, workflowConnectionId, createdAt 
             FROM widgets WHERE dashboardId = ? ORDER BY position ASC`,
            [req.params.id]
        );
        
        // Parse config JSON
        const parsedWidgets = widgets.map(w => ({
            ...w,
            config: JSON.parse(w.config || '{}'),
            gridX: w.gridX || 0,
            gridY: w.gridY || 0,
            gridWidth: w.gridWidth || 1,
            gridHeight: w.gridHeight || 1,
            dataSource: w.dataSource || 'entity'
        }));
        
        res.json(parsedWidgets);
    } catch (error) {
        console.error('Error fetching widgets:', error);
        res.status(500).json({ error: 'Failed to fetch widgets' });
    }
});

// Add widget to dashboard
app.post('/api/dashboards/:id/widgets', authenticateToken, async (req, res) => {
    try {
        const { id: widgetId, title, description, config, gridX, gridY, gridWidth, gridHeight } = req.body;
        const now = new Date().toISOString();
        
        // Get max position
        const maxPos = await db.get('SELECT MAX(position) as maxPos FROM widgets WHERE dashboardId = ?', [req.params.id]);
        const position = (maxPos?.maxPos || 0) + 1;
        
        await db.run(
            'INSERT INTO widgets (id, dashboardId, title, description, config, position, gridX, gridY, gridWidth, gridHeight, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [widgetId, req.params.id, title, description || '', JSON.stringify(config), position, gridX || 0, gridY || 0, gridWidth || 4, gridHeight || 3, now]
        );
        
        // Update dashboard updatedAt
        await db.run('UPDATE dashboards SET updatedAt = ? WHERE id = ?', [now, req.params.id]);
        
        res.json({ 
            id: widgetId, 
            title, 
            description, 
            config, 
            position, 
            gridX: gridX || 0,
            gridY: gridY || 0,
            gridWidth: gridWidth || 4,
            gridHeight: gridHeight || 3,
            createdAt: now 
        });
    } catch (error) {
        console.error('Error adding widget:', error);
        res.status(500).json({ error: 'Failed to add widget' });
    }
});

// Delete widget
app.delete('/api/widgets/:id', authenticateToken, async (req, res) => {
    try {
        // Verify widget belongs to user's org via dashboard
        const widget = await db.get(`
            SELECT w.id FROM widgets w 
            JOIN dashboards d ON w.dashboardId = d.id 
            WHERE w.id = ? AND d.organizationId = ?
        `, [req.params.id, req.user.orgId]);
        
        if (!widget) {
            return res.status(404).json({ error: 'Widget not found' });
        }
        
        await db.run('DELETE FROM widgets WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting widget:', error);
        res.status(500).json({ error: 'Failed to delete widget' });
    }
});

// ==================== USE CASE PACKAGE IMPORT ====================

// POST /api/use-case/import - Subir un package JSON para importar como use case (entidades, workflow, simulación, dashboard)
app.post('/api/use-case/import', authenticateToken, async (req, res) => {
    try {
        let packageObj = req.body;
        if (!packageObj || typeof packageObj !== 'object') {
            return res.status(400).json({ error: 'Body must be a JSON object (use case package)' });
        }
        const dryRun = String(req.query.dryRun || req.body?.dryRun || '').toLowerCase() === 'true';
        const result = await importUseCasePackage(db, req.user.orgId, packageObj, req.user.sub, { dryRun });
        res.json({
            message: dryRun ? 'Validación/dry run completado' : 'Use case importado',
            ...result
        });
    } catch (error) {
        console.error('Error importing use case:', error);
        res.status(500).json({ error: error.message || 'Error al importar use case' });
    }
});

// POST /api/use-case/import-file - Mismo import pero subiendo un archivo .json (multipart)
app.post('/api/use-case/import-file', authenticateToken, upload.single('package'), async (req, res) => {
    try {
        if (!req.file || !req.file.path) {
            return res.status(400).json({ error: 'Envía un archivo con field name "package" (JSON)' });
        }
        const raw = fs.readFileSync(req.file.path, 'utf8');
        let packageObj;
        try {
            packageObj = JSON.parse(raw);
        } catch (e) {
            return res.status(400).json({ error: 'El archivo no es un JSON válido' });
        }
        const dryRun = String(req.query.dryRun || '').toLowerCase() === 'true';
        const result = await importUseCasePackage(db, req.user.orgId, packageObj, req.user.sub, { dryRun });
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        res.json({
            message: dryRun ? 'Validación/dry run completado' : 'Use case importado',
            ...result
        });
    } catch (error) {
        console.error('Error importing use case from file:', error);
        res.status(500).json({ error: error.message || 'Error al importar use case' });
    }
});

// POST /api/use-case/validate - Validar package sin importar
app.post('/api/use-case/validate', authenticateToken, async (req, res) => {
    try {
        const packageObj = req.body;
        const validation = validateUseCasePackage(packageObj);
        res.json(validation);
    } catch (error) {
        console.error('Error validating use case:', error);
        res.status(500).json({ error: error.message || 'Error validando use case' });
    }
});

// ==================== SIMULATIONS ENDPOINTS ====================

// Get all simulations for the organization
app.get('/api/simulations', authenticateToken, async (req, res) => {
    try {
        const simulations = await db.all(
            'SELECT * FROM simulations WHERE organizationId = ? ORDER BY updatedAt DESC',
            [req.user.orgId]
        );
        
        // Parse JSON fields - support both old and new schema
        const parsed = simulations.map(sim => {
            // Try to parse new schema
            try {
                const data = JSON.parse(sim.sourceEntities || '{}');
                if (data.workflowId) {
                    return {
                        id: sim.id,
                        name: sim.name,
                        description: sim.description,
                        workflowId: data.workflowId,
                        workflowName: data.workflowName,
                        parameters: data.parameters || [],
                        visualizations: data.visualizations || [],
                        savedScenarios: data.savedScenarios || [],
                        runs: data.runs || [],
                        createdAt: sim.createdAt,
                        updatedAt: sim.updatedAt
                    };
                }
            } catch (e) {}
            
            // Old schema fallback
            return {
                ...sim,
                sourceEntities: JSON.parse(sim.sourceEntities || '[]'),
                variables: JSON.parse(sim.variables || '[]'),
                scenarios: JSON.parse(sim.scenariosData || '[]')
            };
        });
        
        res.json(parsed);
    } catch (error) {
        console.error('Error fetching simulations:', error);
        res.status(500).json({ error: 'Failed to fetch simulations' });
    }
});

// Get single simulation
app.get('/api/simulations/:id', authenticateToken, async (req, res) => {
    try {
        const sim = await db.get(
            'SELECT * FROM simulations WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!sim) {
            return res.status(404).json({ error: 'Simulation not found' });
        }
        
        // Try to parse new schema
        try {
            const data = JSON.parse(sim.sourceEntities || '{}');
            if (data.workflowId) {
                return res.json({
                    id: sim.id,
                    name: sim.name,
                    description: sim.description,
                    workflowId: data.workflowId,
                    workflowName: data.workflowName,
                    parameters: data.parameters || [],
                    visualizations: data.visualizations || [],
                    savedScenarios: data.savedScenarios || [],
                    runs: data.runs || [],
                    createdAt: sim.createdAt,
                    updatedAt: sim.updatedAt
                });
            }
        } catch (e) {}
        
        // Old schema fallback
        res.json({
            ...sim,
            sourceEntities: JSON.parse(sim.sourceEntities || '[]'),
            variables: JSON.parse(sim.variables || '[]'),
            scenarios: JSON.parse(sim.scenariosData || '[]')
        });
    } catch (error) {
        console.error('Error fetching simulation:', error);
        res.status(500).json({ error: 'Failed to fetch simulation' });
    }
});

// Create simulation
app.post('/api/simulations', authenticateToken, async (req, res) => {
    try {
        const { 
            id, name, description, 
            // New schema fields
            workflowId, workflowName, parameters, visualizations, savedScenarios, runs,
            // Old schema fields (for backwards compatibility)
            sourceEntities, variables, scenarios 
        } = req.body;
        const now = new Date().toISOString();
        const simId = id || generateId();
        
        // Store new schema data in sourceEntities field as JSON
        const dataToStore = workflowId ? {
            workflowId,
            workflowName,
            parameters: parameters || [],
            visualizations: visualizations || [],
            savedScenarios: savedScenarios || [],
            runs: runs || []
        } : sourceEntities || [];
        
        await db.run(
            `INSERT INTO simulations (id, organizationId, name, description, sourceEntities, variables, scenariosData, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                simId,
                req.user.orgId,
                name,
                description || '',
                JSON.stringify(dataToStore),
                JSON.stringify(variables || []),
                JSON.stringify(scenarios || []),
                now,
                now
            ]
        );
        
        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'lab',
            resourceId: simId,
            resourceName: name,
            details: { workflowId, workflowName },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        // Return appropriate response based on schema
        if (workflowId) {
            res.json({
                id: simId,
                name,
                description,
                workflowId,
                workflowName,
                parameters: parameters || [],
                visualizations: visualizations || [],
                savedScenarios: savedScenarios || [],
                runs: runs || [],
                createdAt: now,
                updatedAt: now
            });
        } else {
            res.json({
                id: simId,
                name,
                description,
                sourceEntities: sourceEntities || [],
                variables: variables || [],
                scenarios: scenarios || [],
                createdAt: now,
                updatedAt: now
            });
        }
    } catch (error) {
        console.error('Error creating simulation:', error);
        res.status(500).json({ error: 'Failed to create simulation' });
    }
});

// Update simulation
app.put('/api/simulations/:id', authenticateToken, async (req, res) => {
    try {
        const { 
            name, description,
            // New schema fields
            workflowId, workflowName, parameters, visualizations, savedScenarios, runs,
            // Old schema fields
            sourceEntities, variables, scenarios 
        } = req.body;
        const now = new Date().toISOString();
        
        // Verify ownership
        const existing = await db.get(
            'SELECT id FROM simulations WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Simulation not found' });
        }
        
        // Store new schema data in sourceEntities field as JSON
        const dataToStore = workflowId ? {
            workflowId,
            workflowName,
            parameters: parameters || [],
            visualizations: visualizations || [],
            savedScenarios: savedScenarios || [],
            runs: runs || []
        } : sourceEntities || [];
        
        await db.run(
            `UPDATE simulations SET name = ?, description = ?, sourceEntities = ?, variables = ?, scenariosData = ?, updatedAt = ? 
             WHERE id = ?`,
            [
                name,
                description || '',
                JSON.stringify(dataToStore),
                JSON.stringify(variables || []),
                JSON.stringify(scenarios || []),
                now,
                req.params.id
            ]
        );
        
        // Return appropriate response based on schema
        if (workflowId) {
            res.json({
                id: req.params.id,
                name,
                description,
                workflowId,
                workflowName,
                parameters: parameters || [],
                visualizations: visualizations || [],
                savedScenarios: savedScenarios || [],
                runs: runs || [],
                updatedAt: now
            });
        } else {
            res.json({
                id: req.params.id,
                name,
                description,
                sourceEntities: sourceEntities || [],
                variables: variables || [],
                scenarios: scenarios || [],
                updatedAt: now
            });
        }
    } catch (error) {
        console.error('Error updating simulation:', error);
        res.status(500).json({ error: 'Failed to update simulation' });
    }
});

// Delete simulation
app.delete('/api/simulations/:id', authenticateToken, async (req, res) => {
    try {
        // Verify ownership
        const existing = await db.get(
            'SELECT id FROM simulations WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Simulation not found' });
        }
        
        await db.run('DELETE FROM simulations WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting simulation:', error);
        res.status(500).json({ error: 'Failed to delete simulation' });
    }
});

// Simulation Chat Assistant
app.post('/api/simulations/chat', authenticateToken, async (req, res) => {
    try {
        const { simulationName, parameters, lastResult, userQuery, calculationCode, conversationHistory } = req.body;
        
        // Build rich context
        const parameterContext = parameters.map(p => 
            `- ${p.name} (variable: "${p.variable}"): ${p.currentValue}${p.unit ? ' ' + p.unit : ''} (min: ${p.min ?? '-'}, max: ${p.max ?? '-'})`
        ).join('\n');
        
        const resultSummary = lastResult 
            ? Object.entries(lastResult)
                .filter(([_, v]) => typeof v === 'number' || typeof v === 'string')
                .map(([k, v]) => `- ${k}: ${typeof v === 'number' ? v.toLocaleString() : v}`)
                .join('\n')
            : 'No hay resultados. El usuario debe ejecutar la simulación primero.';

        const arrayFields = lastResult
            ? Object.entries(lastResult)
                .filter(([_, v]) => Array.isArray(v))
                .map(([k, v]) => `- ${k}: ${v.length} items`)
                .join('\n')
            : '';
        
        const systemPrompt = `Eres un ingeniero de procesos senior especializado en plantas petroquímicas.
Hablas SIEMPRE en español. Eres directo y técnico.

SIMULACIÓN: "${simulationName}"

PARÁMETROS (puedes ajustarlos con set_parameter):
${parameterContext}

${resultSummary !== 'No hay resultados. El usuario debe ejecutar la simulación primero.' ? `ÚLTIMO RESULTADO:\n${resultSummary}` : 'AÚN NO SE HA EJECUTADO. Si el usuario pide algo, ajusta parámetros y ejecuta.'}
${arrayFields ? `\nDATOS PARA GRÁFICOS:\n${arrayFields}` : ''}

REGLAS CRÍTICAS:
1. SIEMPRE responde en español
2. Sé CONCISO: máximo 2-3 frases en "message"
3. NUNCA digas "voy a ajustar" o "procederé a" - HAZLO directamente con actions
4. Si el usuario pide cambiar algo, SIEMPRE incluye set_parameter + run_simulation juntos
5. Si pide maximizar/optimizar algo, ajusta los parámetros al valor óptimo y ejecuta
6. Si pide un escenario (crisis, máxima capacidad, etc.), ajusta TODOS los parámetros relevantes

FORMATO DE RESPUESTA (JSON estricto):
{
  "message": "Texto conciso en español para el usuario",
  "actions": [
    { "type": "set_parameter", "variable": "nombre_var", "value": 1500 },
    { "type": "run_simulation" },
    { "type": "create_visualization", "vizType": "kpi|line|bar|pie|table", "source": "campo", "title": "Título", "format": "number|currency|percent", "xAxis": "key", "yAxis": ["k1","k2"], "labelKey": "key", "valueKey": "key" }
  ]
}

Ejemplo: si el usuario dice "sube eficiencia al máximo y ejecuta":
{
  "message": "Eficiencia al 100%. Ejecutando simulación.",
  "actions": [
    { "type": "set_parameter", "variable": "eficiencia", "value": 100 },
    { "type": "run_simulation" }
  ]
}`;

        const openaiKey = process.env.OPENAI_API_KEY;
        
        if (openaiKey) {
            // Build messages with conversation history
            const messages = [{ role: 'system', content: systemPrompt }];
            if (conversationHistory && Array.isArray(conversationHistory)) {
                conversationHistory.slice(-6).forEach(msg => {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                });
            }
            messages.push({ role: 'user', content: userQuery });

            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages,
                    temperature: 0.4,
                    max_tokens: 1000,
                    response_format: { type: 'json_object' }
                })
            });
            
            if (openaiRes.ok) {
                const data = await openaiRes.json();
                const content = data.choices[0]?.message?.content || '{}';
                
                try {
                    const parsed = JSON.parse(content);
                    return res.json({
                        message: parsed.message || 'Procesado.',
                        actions: parsed.actions || []
                    });
                } catch (e) {
                    return res.json({ message: content, actions: [] });
                }
            }
        }
        
        // Fallback: pattern matching (when no OpenAI key)
        const query = userQuery.toLowerCase();
        let message = '';
        const actions = [];
        
        if (query.includes('ejecuta') || query.includes('corre') || query.includes('run')) {
            message = 'Ejecutando la simulación con los parámetros actuales...';
            actions.push({ type: 'run_simulation' });
        } else if (query.match(/(?:sube|aumenta|pon).*(?:resina|precio|capacidad|eficiencia|venta|dias)/i)) {
            // Try to match parameter and value
            for (const param of parameters) {
                const nameLC = (param.name || '').toLowerCase();
                const varLC = (param.variable || '').toLowerCase();
                if (query.includes(nameLC) || query.includes(varLC)) {
                    const numMatch = query.match(/\d+/);
                    if (numMatch) {
                        const newValue = parseInt(numMatch[0]);
                        message = `Ajustando ${param.name} a ${newValue}${param.unit ? ' ' + param.unit : ''}.`;
                        actions.push({ type: 'set_parameter', variable: param.variable, value: newValue });
                        actions.push({ type: 'run_simulation' });
                    }
                    break;
                }
            }
            if (!message) {
                message = 'No pude identificar qué parámetro quieres cambiar. Intenta ser más específico.';
            }
        } else {
            message = `Tienes ${parameters.length} parámetros configurados. Puedo ajustar valores, ejecutar simulaciones, o explicar resultados.`;
        }
        
        res.json({ message, actions });
    } catch (error) {
        console.error('Error in simulation chat:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});

// Public shared dashboard endpoint (no auth required)
app.get('/api/shared/:token', async (req, res) => {
    try {
        const dashboard = await db.get(
            'SELECT id, name, description, createdAt FROM dashboards WHERE shareToken = ? AND isPublic = 1',
            [req.params.token]
        );
        
        if (!dashboard) {
            return res.status(404).json({ error: 'Dashboard not found or not shared' });
        }
        
        const widgets = await db.all(
            `SELECT id, title, description, config, position, gridX, gridY, gridWidth, gridHeight, dataSource 
             FROM widgets WHERE dashboardId = ? ORDER BY position ASC`,
            [dashboard.id]
        );
        
        const parsedWidgets = widgets.map(w => ({
            ...w,
            config: JSON.parse(w.config || '{}'),
            gridX: w.gridX || 0,
            gridY: w.gridY || 0,
            gridWidth: w.gridWidth || 1,
            gridHeight: w.gridHeight || 1,
            dataSource: w.dataSource || 'entity'
        }));
        
        res.json({
            dashboard,
            widgets: parsedWidgets
        });
    } catch (error) {
        console.error('Error fetching shared dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch shared dashboard' });
    }
});

// ==================== KNOWLEDGE BASE ENDPOINTS ====================

// Get all knowledge documents
app.get('/api/knowledge/documents', authenticateToken, async (req, res) => {
    try {
        const documents = await db.all(
            `SELECT id, name, type, source, filePath, googleDriveId, googleDriveUrl, mimeType, fileSize, 
             summary, tags, relatedEntityIds, uploadedBy, createdAt, updatedAt 
             FROM knowledge_documents 
             WHERE organizationId = ? 
             ORDER BY updatedAt DESC`,
            [req.user.orgId]
        );
        
        // Parse JSON fields
        const parsedDocs = documents.map(doc => ({
            ...doc,
            relatedEntityIds: doc.relatedEntityIds ? JSON.parse(doc.relatedEntityIds) : [],
            tags: doc.tags ? doc.tags.split(',').filter(t => t) : []
        }));
        
        res.json(parsedDocs);
    } catch (error) {
        console.error('Error fetching knowledge documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// Get single knowledge document
app.get('/api/knowledge/documents/:id', authenticateToken, async (req, res) => {
    try {
        const doc = await db.get(
            `SELECT * FROM knowledge_documents 
             WHERE id = ? AND organizationId = ?`,
            [req.params.id, req.user.orgId]
        );
        
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Parse JSON fields
        doc.relatedEntityIds = doc.relatedEntityIds ? JSON.parse(doc.relatedEntityIds) : [];
        doc.tags = doc.tags ? doc.tags.split(',').filter(t => t) : [];
        doc.metadata = doc.metadata ? JSON.parse(doc.metadata) : {};
        
        res.json(doc);
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
});

// Upload knowledge document
const knowledgeUpload = multer({ 
    dest: 'server/uploads/knowledge/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

app.post('/api/knowledge/documents', authenticateToken, knowledgeUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { name, tags, relatedEntityIds } = req.body;
        const id = require('crypto').randomBytes(16).toString('hex');
        const now = new Date().toISOString();
        
        // Extract text based on file type
        let extractedText = '';
        let summary = '';
        
        try {
            if (req.file.mimetype === 'application/pdf') {
                const pdfBuffer = require('fs').readFileSync(req.file.path);
                const pdfData = await pdfParse(pdfBuffer);
                extractedText = pdfData.text;
            } else if (req.file.mimetype === 'text/plain' || req.file.mimetype === 'text/csv') {
                extractedText = require('fs').readFileSync(req.file.path, 'utf-8');
            } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                       req.file.mimetype === 'application/vnd.ms-excel') {
                const workbook = XLSX.readFile(req.file.path);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                extractedText = XLSX.utils.sheet_to_csv(worksheet);
            }
            
            // Generate summary with OpenAI if text extracted
            if (extractedText && extractedText.length > 100 && process.env.OPENAI_API_KEY) {
                const OpenAI = require('openai');
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                
                const summaryResponse = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'user',
                        content: `Resume este documento en máximo 3 frases:\n\n${extractedText.substring(0, 2000)}`
                    }],
                    max_tokens: 150
                });
                
                summary = summaryResponse.choices[0].message.content.trim();
            }
        } catch (extractError) {
            console.error('Error extracting text:', extractError);
            // Continue without extracted text
        }
        
        await db.run(
            `INSERT INTO knowledge_documents 
             (id, organizationId, name, type, source, filePath, mimeType, fileSize, extractedText, summary, tags, relatedEntityIds, uploadedBy, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                req.user.orgId,
                name || req.file.originalname,
                'file',
                'upload',
                req.file.path,
                req.file.mimetype,
                req.file.size,
                extractedText,
                summary,
                tags || '',
                relatedEntityIds ? JSON.stringify(JSON.parse(relatedEntityIds)) : '[]',
                req.user.id,
                now,
                now
            ]
        );
        
        // If folderId is provided, add document to folder
        const { folderId } = req.body;
        if (folderId) {
            const folder = await db.get(
                'SELECT documentIds FROM knowledge_folders WHERE id = ? AND organizationId = ?',
                [folderId, req.user.orgId]
            );
            if (folder) {
                const docIds = folder.documentIds ? JSON.parse(folder.documentIds) : [];
                docIds.push(id);
                await db.run(
                    'UPDATE knowledge_folders SET documentIds = ?, updatedAt = ? WHERE id = ?',
                    [JSON.stringify(docIds), now, folderId]
                );
            }
        }
        
        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'document',
            resourceId: id,
            resourceName: name || req.file.originalname,
            details: { fileSize: req.file.size, mimeType: req.file.mimetype },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({
            id,
            name: name || req.file.originalname,
            type: 'file',
            source: 'upload',
            fileSize: req.file.size,
            summary,
            folderId: folderId || null,
            createdAt: now
        });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

// Delete knowledge document
app.delete('/api/knowledge/documents/:id', authenticateToken, async (req, res) => {
    try {
        const doc = await db.get(
            'SELECT filePath, name FROM knowledge_documents WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Delete file if exists
        if (doc.filePath && require('fs').existsSync(doc.filePath)) {
            require('fs').unlinkSync(doc.filePath);
        }
        
        await db.run('DELETE FROM knowledge_documents WHERE id = ?', [req.params.id]);

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'delete',
            resourceType: 'document',
            resourceId: req.params.id,
            resourceName: doc.name || 'Unknown',
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// Search in knowledge documents
app.post('/api/knowledge/search', authenticateToken, async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query || query.trim().length === 0) {
            return res.json([]);
        }
        
        // Simple text search in extractedText and name
        const documents = await db.all(
            `SELECT id, name, summary, extractedText, type, createdAt 
             FROM knowledge_documents 
             WHERE organizationId = ? 
             AND (extractedText LIKE ? OR name LIKE ? OR summary LIKE ?)
             ORDER BY updatedAt DESC
             LIMIT 20`,
            [req.user.orgId, `%${query}%`, `%${query}%`, `%${query}%`]
        );
        
        res.json(documents);
    } catch (error) {
        console.error('Error searching documents:', error);
        res.status(500).json({ error: 'Failed to search documents' });
    }
});

// Relate document to entity
app.post('/api/knowledge/documents/:id/relate', authenticateToken, async (req, res) => {
    try {
        const { entityId } = req.body;
        
        const doc = await db.get(
            'SELECT relatedEntityIds FROM knowledge_documents WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const relatedIds = doc.relatedEntityIds ? JSON.parse(doc.relatedEntityIds) : [];
        if (!relatedIds.includes(entityId)) {
            relatedIds.push(entityId);
        }
        
        await db.run(
            'UPDATE knowledge_documents SET relatedEntityIds = ?, updatedAt = ? WHERE id = ?',
            [JSON.stringify(relatedIds), new Date().toISOString(), req.params.id]
        );
        
        res.json({ success: true, relatedEntityIds: relatedIds });
    } catch (error) {
        console.error('Error relating document:', error);
        res.status(500).json({ error: 'Failed to relate document' });
    }
});

// ==================== KNOWLEDGE FOLDERS ENDPOINTS ====================

// Get all folders
app.get('/api/knowledge/folders', authenticateToken, async (req, res) => {
    try {
        const folders = await db.all(
            'SELECT * FROM knowledge_folders WHERE organizationId = ? ORDER BY name ASC',
            [req.user.orgId]
        );
        
        const parsed = folders.map(f => ({
            ...f,
            documentIds: f.documentIds ? JSON.parse(f.documentIds) : [],
            entityIds: f.entityIds ? JSON.parse(f.entityIds) : []
        }));
        
        res.json(parsed);
    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// Get single folder
app.get('/api/knowledge/folders/:id', authenticateToken, async (req, res) => {
    try {
        const folder = await db.get(
            'SELECT * FROM knowledge_folders WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        res.json({
            ...folder,
            documentIds: folder.documentIds ? JSON.parse(folder.documentIds) : [],
            entityIds: folder.entityIds ? JSON.parse(folder.entityIds) : []
        });
    } catch (error) {
        console.error('Error fetching folder:', error);
        res.status(500).json({ error: 'Failed to fetch folder' });
    }
});

// Create folder
app.post('/api/knowledge/folders', authenticateToken, async (req, res) => {
    try {
        const { name, description, color, parentId, documentIds, entityIds, createdBy } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(
            `INSERT INTO knowledge_folders (id, organizationId, name, description, color, parentId, documentIds, entityIds, createdBy, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                req.user.orgId,
                name,
                description || null,
                color || '#3b82f6',
                parentId || null,
                JSON.stringify(documentIds || []),
                JSON.stringify(entityIds || []),
                createdBy || req.user.id,
                now,
                now
            ]
        );
        
        res.json({ 
            id, 
            name, 
            description, 
            color: color || '#3b82f6', 
            parentId: parentId || null,
            documentIds: documentIds || [], 
            entityIds: entityIds || [],
            createdBy: createdBy || req.user.id,
            createdAt: now,
            updatedAt: now
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Update folder
app.put('/api/knowledge/folders/:id', authenticateToken, async (req, res) => {
    try {
        const { name, description, color, parentId } = req.body;
        const now = new Date().toISOString();
        
        const folder = await db.get(
            'SELECT * FROM knowledge_folders WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        await db.run(
            `UPDATE knowledge_folders SET name = ?, description = ?, color = ?, parentId = ?, updatedAt = ? WHERE id = ?`,
            [
                name || folder.name,
                description !== undefined ? description : folder.description,
                color || folder.color,
                parentId !== undefined ? parentId : folder.parentId,
                now,
                req.params.id
            ]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating folder:', error);
        res.status(500).json({ error: 'Failed to update folder' });
    }
});

// Delete folder
app.delete('/api/knowledge/folders/:id', authenticateToken, async (req, res) => {
    try {
        const folder = await db.get(
            'SELECT * FROM knowledge_folders WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        // Move children to parent folder
        await db.run(
            'UPDATE knowledge_folders SET parentId = ? WHERE parentId = ?',
            [folder.parentId, req.params.id]
        );
        
        await db.run('DELETE FROM knowledge_folders WHERE id = ?', [req.params.id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// Add item to folder
app.post('/api/knowledge/folders/:id/add', authenticateToken, async (req, res) => {
    try {
        const { type, itemId } = req.body;
        
        const folder = await db.get(
            'SELECT * FROM knowledge_folders WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        const field = type === 'entity' ? 'entityIds' : 'documentIds';
        const currentIds = folder[field] ? JSON.parse(folder[field]) : [];
        
        if (!currentIds.includes(itemId)) {
            currentIds.push(itemId);
            await db.run(
                `UPDATE knowledge_folders SET ${field} = ?, updatedAt = ? WHERE id = ?`,
                [JSON.stringify(currentIds), new Date().toISOString(), req.params.id]
            );
        }
        
        res.json({ success: true, [field]: currentIds });
    } catch (error) {
        console.error('Error adding to folder:', error);
        res.status(500).json({ error: 'Failed to add item to folder' });
    }
});

// Remove item from folder
app.post('/api/knowledge/folders/:id/remove', authenticateToken, async (req, res) => {
    try {
        const { type, itemId } = req.body;
        
        const folder = await db.get(
            'SELECT * FROM knowledge_folders WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        
        const field = type === 'entity' ? 'entityIds' : 'documentIds';
        const currentIds = folder[field] ? JSON.parse(folder[field]) : [];
        const updatedIds = currentIds.filter(id => id !== itemId);
        
        await db.run(
            `UPDATE knowledge_folders SET ${field} = ?, updatedAt = ? WHERE id = ?`,
            [JSON.stringify(updatedIds), new Date().toISOString(), req.params.id]
        );
        
        res.json({ success: true, [field]: updatedIds });
    } catch (error) {
        console.error('Error removing from folder:', error);
        res.status(500).json({ error: 'Failed to remove item from folder' });
    }
});

// ==================== DASHBOARD-WORKFLOW CONNECTION ENDPOINTS ====================

// Connect widget to workflow output
app.post('/api/dashboards/:dashboardId/widgets/:widgetId/connect-workflow', authenticateToken, async (req, res) => {
    try {
        const { workflowId, nodeId, executionId, outputPath, refreshMode, refreshInterval } = req.body;
        
        // Verify dashboard belongs to user's org
        const dashboard = await db.get(
            'SELECT id FROM dashboards WHERE id = ? AND organizationId = ?',
            [req.params.dashboardId, req.user.orgId]
        );
        
        if (!dashboard) {
            return res.status(404).json({ error: 'Dashboard not found' });
        }
        
        // Verify widget belongs to dashboard
        const widget = await db.get(
            'SELECT id FROM widgets WHERE id = ? AND dashboardId = ?',
            [req.params.widgetId, req.params.dashboardId]
        );
        
        if (!widget) {
            return res.status(404).json({ error: 'Widget not found' });
        }
        
        const connectionId = require('crypto').randomBytes(16).toString('hex');
        const now = new Date().toISOString();
        
        // Check if connection already exists
        const existing = await db.get(
            'SELECT id FROM dashboard_workflow_connections WHERE widgetId = ?',
            [req.params.widgetId]
        );
        
        if (existing) {
            // Update existing connection
            await db.run(
                `UPDATE dashboard_workflow_connections 
                 SET workflowId = ?, nodeId = ?, executionId = ?, outputPath = ?, refreshMode = ?, refreshInterval = ?, updatedAt = ?
                 WHERE widgetId = ?`,
                [workflowId, nodeId, executionId || null, outputPath || '', refreshMode || 'manual', refreshInterval || null, now, req.params.widgetId]
            );
            
            // Update widget
            await db.run(
                'UPDATE widgets SET workflowConnectionId = ?, dataSource = ? WHERE id = ?',
                [existing.id, 'workflow', req.params.widgetId]
            );
            
            res.json({ success: true, connectionId: existing.id });
        } else {
            // Create new connection
            await db.run(
                `INSERT INTO dashboard_workflow_connections 
                 (id, dashboardId, widgetId, workflowId, nodeId, executionId, outputPath, refreshMode, refreshInterval, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [connectionId, req.params.dashboardId, req.params.widgetId, workflowId, nodeId, executionId || null, outputPath || '', refreshMode || 'manual', refreshInterval || null, now, now]
            );
            
            // Update widget
            await db.run(
                'UPDATE widgets SET workflowConnectionId = ?, dataSource = ? WHERE id = ?',
                [connectionId, 'workflow', req.params.widgetId]
            );
            
            res.json({ success: true, connectionId });
        }
    } catch (error) {
        console.error('Error connecting widget to workflow:', error);
        res.status(500).json({ error: 'Failed to connect widget to workflow' });
    }
});

// Get widget data from workflow execution
app.get('/api/dashboards/:dashboardId/widgets/:widgetId/data', authenticateToken, async (req, res) => {
    try {
        // Get connection
        const connection = await db.get(
            `SELECT c.*, d.organizationId 
             FROM dashboard_workflow_connections c
             JOIN dashboards d ON c.dashboardId = d.id
             WHERE c.widgetId = ? AND d.organizationId = ?`,
            [req.params.widgetId, req.user.orgId]
        );
        
        if (!connection) {
            return res.status(404).json({ error: 'Widget not connected to workflow' });
        }
        
        // Get execution data
        let execution;
        if (connection.executionId) {
            execution = await db.get(
                'SELECT * FROM workflow_executions WHERE id = ? AND organizationId = ?',
                [connection.executionId, req.user.orgId]
            );
        } else {
            // Get latest execution
            execution = await db.get(
                'SELECT * FROM workflow_executions WHERE workflowId = ? AND organizationId = ? ORDER BY createdAt DESC LIMIT 1',
                [connection.workflowId, req.user.orgId]
            );
        }
        
        if (!execution) {
            return res.status(404).json({ error: 'Workflow execution not found' });
        }
        
        // Extract data based on outputPath
        let data = null;
        if (execution.nodeResults) {
            const nodeResults = JSON.parse(execution.nodeResults);
            if (connection.outputPath) {
                // Navigate JSON path (e.g., "results.node1.outputData")
                const parts = connection.outputPath.split('.');
                data = nodeResults;
                for (const part of parts) {
                    if (data && typeof data === 'object') {
                        data = data[part];
                    } else {
                        data = null;
                        break;
                    }
                }
            } else if (connection.nodeId && nodeResults[connection.nodeId]) {
                data = nodeResults[connection.nodeId].outputData || nodeResults[connection.nodeId];
            } else {
                data = nodeResults;
            }
        } else if (execution.finalOutput) {
            data = JSON.parse(execution.finalOutput);
        }
        
        res.json({
            data,
            executionId: execution.id,
            status: execution.status,
            createdAt: execution.createdAt,
            completedAt: execution.completedAt
        });
    } catch (error) {
        console.error('Error fetching widget data:', error);
        res.status(500).json({ error: 'Failed to fetch widget data' });
    }
});

// Generate widget from workflow output with prompt
app.post('/api/dashboards/:dashboardId/generate-widget-from-workflow', authenticateToken, async (req, res) => {
    try {
        const { workflowId, nodeId, executionId, prompt, mentionedEntityIds } = req.body;
        
        // Verify dashboard belongs to user's org
        const dashboard = await db.get(
            'SELECT id FROM dashboards WHERE id = ? AND organizationId = ?',
            [req.params.dashboardId, req.user.orgId]
        );
        
        if (!dashboard) {
            return res.status(404).json({ error: 'Dashboard not found' });
        }
        
        // Get execution data
        let execution;
        if (executionId) {
            execution = await db.get(
                'SELECT * FROM workflow_executions WHERE id = ? AND organizationId = ?',
                [executionId, req.user.orgId]
            );
        } else {
            execution = await db.get(
                'SELECT * FROM workflow_executions WHERE workflowId = ? AND organizationId = ? ORDER BY createdAt DESC LIMIT 1',
                [workflowId, req.user.orgId]
            );
        }
        
        if (!execution) {
            return res.status(404).json({ error: 'Workflow execution not found' });
        }
        
        // Extract data from execution
        let workflowData = null;
        if (execution.nodeResults) {
            const nodeResults = JSON.parse(execution.nodeResults);
            if (nodeId && nodeResults[nodeId]) {
                workflowData = nodeResults[nodeId].outputData || nodeResults[nodeId];
            } else {
                workflowData = nodeResults;
            }
        } else if (execution.finalOutput) {
            workflowData = JSON.parse(execution.finalOutput);
        }
        
        if (!workflowData) {
            return res.status(400).json({ error: 'No data available from workflow execution' });
        }
        
        // Use existing generate-widget endpoint logic but with workflow data
        // This will be handled by the existing generate-widget endpoint with workflow data context
        // For now, return the data and let frontend handle widget generation
        res.json({
            workflowData,
            executionId: execution.id,
            nodeId
        });
    } catch (error) {
        console.error('Error generating widget from workflow:', error);
        res.status(500).json({ error: 'Failed to generate widget from workflow' });
    }
});

// ==================== STANDARDS ENDPOINTS ====================

// Get all standards
app.get('/api/standards', authenticateToken, async (req, res) => {
    try {
        const standards = await db.all(
            `SELECT id, name, code, category, description, version, status, effectiveDate, expiryDate, 
             tags, relatedEntityIds, createdBy, createdAt, updatedAt 
             FROM standards 
             WHERE organizationId = ? 
             ORDER BY updatedAt DESC`,
            [req.user.orgId]
        );
        
        const parsedStandards = standards.map(s => ({
            ...s,
            tags: s.tags ? s.tags.split(',').filter(t => t) : [],
            relatedEntityIds: s.relatedEntityIds ? JSON.parse(s.relatedEntityIds) : []
        }));
        
        res.json(parsedStandards);
    } catch (error) {
        console.error('Error fetching standards:', error);
        res.status(500).json({ error: 'Failed to fetch standards' });
    }
});

// Get single standard
app.get('/api/standards/:id', authenticateToken, async (req, res) => {
    try {
        const standard = await db.get(
            'SELECT * FROM standards WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!standard) {
            return res.status(404).json({ error: 'Standard not found' });
        }
        
        standard.tags = standard.tags ? standard.tags.split(',').filter(t => t) : [];
        standard.relatedEntityIds = standard.relatedEntityIds ? JSON.parse(standard.relatedEntityIds) : [];
        
        res.json(standard);
    } catch (error) {
        console.error('Error fetching standard:', error);
        res.status(500).json({ error: 'Failed to fetch standard' });
    }
});

// Create standard
app.post('/api/standards', authenticateToken, async (req, res) => {
    try {
        const { id, name, code, category, description, version, status, effectiveDate, expiryDate, content, tags, relatedEntityIds } = req.body;
        const now = new Date().toISOString();
        
        await db.run(
            `INSERT INTO standards 
             (id, organizationId, name, code, category, description, version, status, effectiveDate, expiryDate, content, tags, relatedEntityIds, createdBy, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                req.user.orgId,
                name,
                code || null,
                category || null,
                description || null,
                version || null,
                status || 'active',
                effectiveDate || null,
                expiryDate || null,
                content || null,
                tags ? tags.join(',') : '',
                relatedEntityIds ? JSON.stringify(relatedEntityIds) : '[]',
                req.user.id,
                now,
                now
            ]
        );
        
        res.json({ id, name, createdAt: now });
    } catch (error) {
        console.error('Error creating standard:', error);
        res.status(500).json({ error: 'Failed to create standard' });
    }
});

// Update standard
app.put('/api/standards/:id', authenticateToken, async (req, res) => {
    try {
        const { name, code, category, description, version, status, effectiveDate, expiryDate, content, tags, relatedEntityIds } = req.body;
        const now = new Date().toISOString();
        
        await db.run(
            `UPDATE standards 
             SET name = ?, code = ?, category = ?, description = ?, version = ?, status = ?, 
                 effectiveDate = ?, expiryDate = ?, content = ?, tags = ?, relatedEntityIds = ?, updatedAt = ?
             WHERE id = ? AND organizationId = ?`,
            [
                name,
                code || null,
                category || null,
                description || null,
                version || null,
                status || 'active',
                effectiveDate || null,
                expiryDate || null,
                content || null,
                tags ? tags.join(',') : '',
                relatedEntityIds ? JSON.stringify(relatedEntityIds) : '[]',
                now,
                req.params.id,
                req.user.orgId
            ]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating standard:', error);
        res.status(500).json({ error: 'Failed to update standard' });
    }
});

// Delete standard
app.delete('/api/standards/:id', authenticateToken, async (req, res) => {
    try {
        await db.run('DELETE FROM standards WHERE id = ? AND organizationId = ?', [req.params.id, req.user.orgId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting standard:', error);
        res.status(500).json({ error: 'Failed to delete standard' });
    }
});

// ==================== DATA CONNECTIONS ENDPOINTS ====================

// Get all data connections
app.get('/api/data-connections', authenticateToken, async (req, res) => {
    try {
        const connections = await db.all(
            `SELECT id, name, type, description, status, lastTestedAt, lastError, createdBy, createdAt, updatedAt 
             FROM data_connections 
             WHERE organizationId = ? 
             ORDER BY updatedAt DESC`,
            [req.user.orgId]
        );
        
        // Parse config JSON (but don't send sensitive data)
        const parsedConnections = connections.map(c => {
            let config = {};
            try {
                const fullConfig = JSON.parse(c.config || '{}');
                // Only return non-sensitive config fields
                config = {
                    type: fullConfig.type,
                    host: fullConfig.host ? '***' : undefined,
                    port: fullConfig.port,
                    database: fullConfig.database ? '***' : undefined,
                    // Don't send passwords, tokens, etc.
                };
            } catch (e) {
                // Invalid JSON, return empty
            }
            return {
                ...c,
                config
            };
        });
        
        res.json(parsedConnections);
    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).json({ error: 'Failed to fetch connections' });
    }
});

// Get single connection
app.get('/api/data-connections/:id', authenticateToken, async (req, res) => {
    try {
        const connection = await db.get(
            'SELECT * FROM data_connections WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }
        
        connection.config = connection.config ? JSON.parse(connection.config) : {};
        
        res.json(connection);
    } catch (error) {
        console.error('Error fetching connection:', error);
        res.status(500).json({ error: 'Failed to fetch connection' });
    }
});

// Create data connection
app.post('/api/data-connections', authenticateToken, async (req, res) => {
    try {
        const { id, name, type, description, config, status } = req.body;
        const now = new Date().toISOString();
        
        await db.run(
            `INSERT INTO data_connections 
             (id, organizationId, name, type, description, config, status, createdBy, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                req.user.orgId,
                name,
                type,
                description || null,
                JSON.stringify(config || {}),
                status || 'inactive',
                req.user.id,
                now,
                now
            ]
        );
        
        res.json({ id, name, createdAt: now });
    } catch (error) {
        console.error('Error creating connection:', error);
        res.status(500).json({ error: 'Failed to create connection' });
    }
});

// Update data connection
app.put('/api/data-connections/:id', authenticateToken, async (req, res) => {
    try {
        const { name, type, description, config, status } = req.body;
        const now = new Date().toISOString();
        
        await db.run(
            `UPDATE data_connections 
             SET name = ?, type = ?, description = ?, config = ?, status = ?, updatedAt = ?
             WHERE id = ? AND organizationId = ?`,
            [
                name,
                type,
                description || null,
                JSON.stringify(config || {}),
                status || 'inactive',
                now,
                req.params.id,
                req.user.orgId
            ]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating connection:', error);
        res.status(500).json({ error: 'Failed to update connection' });
    }
});

// Delete data connection
app.delete('/api/data-connections/:id', authenticateToken, async (req, res) => {
    try {
        await db.run('DELETE FROM data_connections WHERE id = ? AND organizationId = ?', [req.params.id, req.user.orgId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting connection:', error);
        res.status(500).json({ error: 'Failed to delete connection' });
    }
});

// Test data connection
app.post('/api/data-connections/:id/test', authenticateToken, async (req, res) => {
    try {
        const connection = await db.get(
            'SELECT * FROM data_connections WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }
        
        const config = JSON.parse(connection.config || '{}');
        const now = new Date().toISOString();
        
        // Test connection based on type
        let testResult = { success: false, message: 'Unknown connection type' };
        
        if (connection.type === 'mysql' || connection.type === 'postgresql') {
            // Test database connection
            try {
                const mysql = require('mysql2/promise');
                const conn = await mysql.createConnection({
                    host: config.host,
                    port: config.port || 3306,
                    user: config.username,
                    password: config.password,
                    database: config.database,
                    connectTimeout: 5000
                });
                await conn.execute('SELECT 1');
                await conn.end();
                testResult = { success: true, message: 'Connection successful' };
                
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?',
                    ['active', now, now, req.params.id]
                );
            } catch (error) {
                testResult = { success: false, message: error.message };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?',
                    ['inactive', now, error.message, now, req.params.id]
                );
            }
        } else if (connection.type === 'api' || connection.type === 'rest') {
            // Test API connection
            try {
                const response = await fetch(config.url, {
                    method: config.method || 'GET',
                    headers: config.headers || {},
                    signal: AbortSignal.timeout(5000)
                });
                testResult = { success: response.ok, message: response.ok ? 'Connection successful' : `HTTP ${response.status}` };
                
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?',
                    [response.ok ? 'active' : 'inactive', now, now, req.params.id]
                );
            } catch (error) {
                testResult = { success: false, message: error.message };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?',
                    ['inactive', now, error.message, now, req.params.id]
                );
            }
        } else if (connection.type === 'opcua') {
            // Test OPC UA connection
            try {
                if (!config.endpoint) {
                    throw new Error('OPC UA endpoint is required');
                }
                // Use real OPC UA connection test
                const { getOTConnectionsManager } = require('./utils/otConnections');
                const otManager = getOTConnectionsManager();
                testResult = await otManager.testOpcuaConnection(config);
                
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?',
                    [testResult.success ? 'active' : 'inactive', now, now, req.params.id]
                );
            } catch (error) {
                testResult = { success: false, message: error.message };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?',
                    ['inactive', now, error.message, now, req.params.id]
                );
            }
        } else if (connection.type === 'mqtt') {
            // Test MQTT connection
            try {
                if (!config.broker || !config.port) {
                    throw new Error('MQTT broker and port are required');
                }
                // Use real MQTT connection test
                const { getOTConnectionsManager } = require('./utils/otConnections');
                const otManager = getOTConnectionsManager();
                testResult = await otManager.testMqttConnection(config);
                
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?',
                    [testResult.success ? 'active' : 'inactive', now, now, req.params.id]
                );
            } catch (error) {
                testResult = { success: false, message: error.message };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?',
                    ['inactive', now, error.message, now, req.params.id]
                );
            }
        } else if (connection.type === 'modbus') {
            // Test Modbus connection
            try {
                if (!config.host || !config.port) {
                    throw new Error('Modbus host and port are required');
                }
                // Use real Modbus connection test
                const { getOTConnectionsManager } = require('./utils/otConnections');
                const otManager = getOTConnectionsManager();
                testResult = await otManager.testModbusConnection(config);
                
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?',
                    [testResult.success ? 'active' : 'inactive', now, now, req.params.id]
                );
            } catch (error) {
                testResult = { success: false, message: error.message };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?',
                    ['inactive', now, error.message, now, req.params.id]
                );
            }
        } else if (connection.type === 'scada') {
            // Test SCADA connection
            try {
                if (!config.protocol || !config.endpoint) {
                    throw new Error('SCADA protocol and endpoint are required');
                }
                testResult = { 
                    success: true, 
                    message: 'SCADA configuration valid (simulated test - real connection requires protocol-specific library)' 
                };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?',
                    ['active', now, now, req.params.id]
                );
            } catch (error) {
                testResult = { success: false, message: error.message };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?',
                    ['inactive', now, error.message, now, req.params.id]
                );
            }
        } else if (connection.type === 'mes') {
            // Test MES connection
            try {
                if (!config.apiUrl) {
                    throw new Error('MES API URL is required');
                }
                // Try to ping the API endpoint
                try {
                    const response = await fetch(config.apiUrl, {
                        method: 'GET',
                        headers: config.headers || {},
                        signal: AbortSignal.timeout(5000)
                    });
                    testResult = { 
                        success: response.ok, 
                        message: response.ok ? 'MES API reachable' : `MES API returned HTTP ${response.status}` 
                    };
                } catch (fetchError) {
                    // If fetch fails, still validate config is present
                    testResult = { 
                        success: true, 
                        message: 'MES configuration valid (API endpoint not reachable, but config is correct)' 
                    };
                }
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?',
                    ['active', now, now, req.params.id]
                );
            } catch (error) {
                testResult = { success: false, message: error.message };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?',
                    ['inactive', now, error.message, now, req.params.id]
                );
            }
        } else if (connection.type === 'data-historian' || connection.type === 'dataHistorian') {
            // Test Data Historian connection
            try {
                if (!config.server || !config.database) {
                    throw new Error('Data Historian server and database are required');
                }
                // TODO: Implement actual Data Historian connection test (PI/Wonderware/InfluxDB)
                testResult = { 
                    success: true, 
                    message: 'Data Historian configuration valid (simulated test - real connection requires specific library)' 
                };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = NULL, updatedAt = ? WHERE id = ?',
                    ['active', now, now, req.params.id]
                );
            } catch (error) {
                testResult = { success: false, message: error.message };
                await db.run(
                    'UPDATE data_connections SET status = ?, lastTestedAt = ?, lastError = ?, updatedAt = ? WHERE id = ?',
                    ['inactive', now, error.message, now, req.params.id]
                );
            }
        }
        
        res.json(testResult);
    } catch (error) {
        console.error('Error testing connection:', error);
        res.status(500).json({ error: 'Failed to test connection' });
    }
});

// Update widget grid position
app.put('/api/widgets/:id/grid', authenticateToken, async (req, res) => {
    try {
        const { gridX, gridY, gridWidth, gridHeight } = req.body;
        
        // Verify widget belongs to user's org
        const widget = await db.get(`
            SELECT w.id FROM widgets w 
            JOIN dashboards d ON w.dashboardId = d.id 
            WHERE w.id = ? AND d.organizationId = ?
        `, [req.params.id, req.user.orgId]);
        
        if (!widget) {
            return res.status(404).json({ error: 'Widget not found' });
        }
        
        await db.run(
            'UPDATE widgets SET gridX = ?, gridY = ?, gridWidth = ?, gridHeight = ? WHERE id = ?',
            [gridX || 0, gridY || 0, gridWidth || 1, gridHeight || 1, req.params.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating widget grid:', error);
        res.status(500).json({ error: 'Failed to update widget grid' });
    }
});

// Workflow Management Endpoints
app.get('/api/workflows', authenticateToken, async (req, res) => {
    try {
        const workflows = await db.all('SELECT id, name, createdAt, updatedAt, createdBy, createdByName, lastEditedBy, lastEditedByName, tags FROM workflows WHERE organizationId = ? ORDER BY updatedAt DESC', [req.user.orgId]);
        // Parse tags JSON for each workflow
        const parsedWorkflows = workflows.map(workflow => ({
            ...workflow,
            tags: workflow.tags ? JSON.parse(workflow.tags) : []
        }));
        res.json(parsedWorkflows);
    } catch (error) {
        console.error('Error fetching workflows:', error);
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
});

app.get('/api/workflows/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // First, try to get the workflow from user's organization
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        // Parse JSON data and tags before sending
        workflow.data = JSON.parse(workflow.data);
        workflow.tags = workflow.tags ? JSON.parse(workflow.tags) : [];
        res.json(workflow);
    } catch (error) {
        console.error('Error fetching workflow:', error);
        res.status(500).json({ error: 'Failed to fetch workflow' });
    }
});

app.post('/api/workflows', authenticateToken, async (req, res) => {
    try {
        const { name, data, tags, createdByName } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        // Store data and tags as JSON strings
        await db.run(
            'INSERT INTO workflows (id, organizationId, name, data, tags, createdAt, updatedAt, createdBy, createdByName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, req.user.orgId, name, JSON.stringify(data), tags ? JSON.stringify(tags) : null, now, now, req.user.sub, createdByName || 'Unknown']
        );

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: createdByName || req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'workflow',
            resourceId: id,
            resourceName: name,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ id, name, tags: tags || [], createdAt: now, updatedAt: now, createdBy: req.user.sub, createdByName: createdByName || 'Unknown' });
    } catch (error) {
        console.error('Error saving workflow:', error);
        res.status(500).json({ error: 'Failed to save workflow' });
    }
});

app.put('/api/workflows/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, data, tags, lastEditedByName } = req.body;
        const now = new Date().toISOString();

        await db.run(
            'UPDATE workflows SET name = ?, data = ?, tags = ?, updatedAt = ?, lastEditedBy = ?, lastEditedByName = ? WHERE id = ? AND organizationId = ?',
            [name, JSON.stringify(data), tags ? JSON.stringify(tags) : null, now, req.user.sub, lastEditedByName || 'Unknown', id, req.user.orgId]
        );

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: lastEditedByName || req.user.email,
            userEmail: req.user.email,
            action: 'update',
            resourceType: 'workflow',
            resourceId: id,
            resourceName: name,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Workflow updated' });
    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(500).json({ error: 'Failed to update workflow' });
    }
});

app.delete('/api/workflows/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get workflow name before deleting
        const workflow = await db.get('SELECT name FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        
        await db.run('DELETE FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'delete',
            resourceType: 'workflow',
            resourceId: id,
            resourceName: workflow?.name || 'Unknown',
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Workflow deleted' });
    } catch (error) {
        console.error('Error deleting workflow:', error);
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
});

// Request access to a workflow from another organization
app.post('/api/workflows/:id/request-access', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get workflow and organization information
        const workflow = await db.get(
            'SELECT w.name, w.organizationId, o.name as organizationName FROM workflows w LEFT JOIN organizations o ON w.organizationId = o.id WHERE w.id = ?',
            [id]
        );
        
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        if (workflow.organizationId === req.user.orgId) {
            return res.status(400).json({ error: 'You already have access to this workflow' });
        }
        
        // Get user information
        const user = await db.get('SELECT email, name FROM users WHERE id = ?', [req.user.sub]);
        const userName = user?.name || user?.email?.split('@')[0] || 'Unknown User';
        const userEmail = user?.email || 'Unknown';
        
        // Get user's organization name
        const userOrg = await db.get('SELECT name FROM organizations WHERE id = ?', [req.user.orgId]);
        const userOrgName = userOrg?.name || 'Unknown Organization';
        
        // TODO: In a real application, you would:
        // 1. Create a notification for the organization admins
        // 2. Send an email to the organization admins
        // 3. Store the access request in a database table
        
        // For now, we'll just log it and return success
        console.log(`Access request:
            User: ${userName} (${userEmail}) from ${userOrgName}
            Workflow: ${workflow.name}
            Target Organization: ${workflow.organizationName}
        `);
        
        res.json({ 
            message: 'Access request sent successfully',
            workflowName: workflow.name,
            organizationName: workflow.organizationName
        });
        
    } catch (error) {
        console.error('Error requesting access:', error);
        res.status(500).json({ error: 'Failed to request access' });
    }
});

// ==================== WEBHOOK ENDPOINTS ====================

// Receive webhook and trigger workflow execution
app.post('/api/webhook/:workflowId', async (req, res) => {
    try {
        const { workflowId } = req.params;
        const webhookData = req.body;

        console.log(`[Webhook] Received for workflow ${workflowId}:`, JSON.stringify(webhookData));

        // Verify workflow exists
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [workflowId]);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Execute workflow with webhook data as input
        const executor = new WorkflowExecutor(db, null, workflow.organizationId, null);
        const result = await executor.executeWorkflow(workflowId, { _webhookData: webhookData }, workflow.organizationId);

        res.json({
            success: true,
            executionId: result.executionId,
            status: result.status,
            results: result.results,  // Include workflow results
            message: 'Webhook processed successfully'
        });
    } catch (error) {
        console.error('[Webhook] Error:', error);
        res.status(500).json({ error: error.message || 'Webhook processing failed' });
    }
});

// Webhook with custom token for security
app.post('/api/webhook/:workflowId/:token', async (req, res) => {
    try {
        const { workflowId, token } = req.params;
        const webhookData = req.body;

        console.log(`[Webhook] Received for workflow ${workflowId} with token`);

        // Verify workflow exists and token matches
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [workflowId]);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Parse workflow data to check webhook token
        const workflowData = JSON.parse(workflow.data);
        const webhookNode = (workflowData.nodes || []).find(n => n.type === 'webhook');
        
        if (webhookNode?.config?.webhookToken && webhookNode.config.webhookToken !== token) {
            return res.status(401).json({ error: 'Invalid webhook token' });
        }

        // Execute workflow with webhook data
        const executor = new WorkflowExecutor(db, null, workflow.organizationId, null);
        const result = await executor.executeWorkflow(workflowId, { _webhookData: webhookData }, workflow.organizationId);

        res.json({
            success: true,
            executionId: result.executionId,
            status: result.status,
            message: 'Webhook processed successfully'
        });
    } catch (error) {
        console.error('[Webhook] Error:', error);
        res.status(500).json({ error: error.message || 'Webhook processing failed' });
    }
});

// Get webhook URL for a workflow
app.get('/api/workflow/:id/webhook-url', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const baseUrl = process.env.API_URL || process.env.FRONTEND_URL?.replace(/:\d+/, ':3001') || 'http://localhost:3001';
        
        // Generate a simple token based on workflow id
        const crypto = require('crypto');
        const token = crypto.createHash('md5').update(id + 'webhook-secret').digest('hex').substring(0, 12);

        res.json({
            webhookUrl: `${baseUrl}/api/webhook/${id}`,
            webhookUrlWithToken: `${baseUrl}/api/webhook/${id}/${token}`,
            token
        });
    } catch (error) {
        console.error('Error generating webhook URL:', error);
        res.status(500).json({ error: 'Failed to generate webhook URL' });
    }
});

// ==================== PUBLIC WORKFLOW FORM ENDPOINTS ====================

// Debug endpoint to see workflow data
app.get('/api/workflow/:id/debug', async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [id]);
        
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const data = JSON.parse(workflow.data || '{}');
        res.json({
            id: workflow.id,
            name: workflow.name,
            nodeCount: data.nodes?.length || 0,
            connectionCount: data.connections?.length || 0,
            nodes: data.nodes?.map(n => ({ id: n.id, type: n.type, label: n.label })) || [],
            connections: data.connections || []
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get workflow info for public form (no auth required)
app.get('/api/workflow/:id/public', async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await db.get('SELECT id, name, data FROM workflows WHERE id = ?', [id]);
        
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Parse workflow data to extract manual input nodes
        let workflowData;
        try {
            workflowData = JSON.parse(workflow.data);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid workflow data' });
        }

        // Find all manualInput nodes to create form fields
        const inputs = (workflowData.nodes || [])
            .filter(node => node.type === 'manualInput')
            .map(node => ({
                nodeId: node.id,
                varName: node.config?.inputVarName || node.config?.variableName || 'input',
                label: node.label || node.config?.inputVarName || node.config?.variableName || 'Input',
                defaultValue: node.config?.inputVarValue || node.config?.variableValue || ''
            }));

        res.json({
            id: workflow.id,
            name: workflow.name,
            inputs
        });
    } catch (error) {
        console.error('Error fetching public workflow:', error);
        res.status(500).json({ error: 'Failed to fetch workflow' });
    }
});

// Run workflow from public form (no auth required) - FULL EXECUTION
app.post('/api/workflow/:id/run-public', async (req, res) => {
    try {
        const { id } = req.params;
        const { inputs } = req.body; // { nodeId: value, ... }

        console.log(`[WorkflowExecutor] Public execution started for workflow ${id}`);

        // Get workflow to retrieve organizationId
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [id]);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        const executor = new WorkflowExecutor(db, null, workflow.organizationId, null);
        const result = await executor.executeWorkflow(id, inputs || {}, workflow.organizationId);

        res.json({
            success: true,
            executionId: result.executionId,
            status: result.status,
            result: result.results
        });
    } catch (error) {
        console.error('Error running public workflow:', error);
        res.status(500).json({ error: error.message || 'Failed to run workflow' });
    }
});

// ==================== WORKFLOW EXECUTION ENDPOINTS ====================

// Execute workflow (authenticated)
app.post('/api/workflow/:id/execute', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { inputs, usePrefect } = req.body;

        // Get workflow name for logging
        const workflow = await db.get('SELECT name FROM workflows WHERE id = ?', [id]);

        // Log workflow execution
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'execute',
            resourceType: 'workflow',
            resourceId: id,
            resourceName: workflow?.name || 'Unknown',
            details: { inputCount: Object.keys(inputs || {}).length },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        // Check if we should use Prefect service (background execution)
        const shouldUsePrefect = usePrefect !== false; // Default to true

        if (shouldUsePrefect) {
            console.log(`[WorkflowExecutor] Delegating workflow ${id} to Prefect service (background mode)`);
            
            try {
                // Delegate to Prefect microservice for background execution
                const result = await prefectClient.executeWorkflow(id, inputs || {}, req.user.orgId);

                // Start polling for execution progress
                const pollingService = getPollingService();
                if (pollingService && result.executionId) {
                    pollingService.startPolling(result.executionId, req.user.orgId, id);
                    console.log(`[WorkflowExecutor] Started progress polling for execution ${result.executionId}`);
                }

                return res.json({
                    success: true,
                    executionId: result.executionId,
                    status: result.status,
                    message: result.message || 'Workflow execution started in background',
                    usingPrefect: true,
                    backgroundExecution: true
                });

            } catch (prefectError) {
                console.warn('[WorkflowExecutor] Prefect service unavailable, falling back to local execution');
                console.warn('[WorkflowExecutor] Error:', prefectError.message);
                // Fall through to local execution
            }
        }

        // Local execution (synchronous, blocks until complete)
        console.log(`[WorkflowExecutor] Local execution for workflow ${id}`);

        const executor = new WorkflowExecutor(db, null, req.user.orgId, req.user.sub);
        const result = await executor.executeWorkflow(id, inputs || {}, req.user.orgId);

        res.json({
            success: true,
            executionId: result.executionId,
            status: result.status,
            result: result.results,
            usingPrefect: false,
            backgroundExecution: false
        });
    } catch (error) {
        console.error('Error executing workflow:', error);
        res.status(500).json({ error: error.message || 'Failed to execute workflow' });
    }
});

// Get execution status (authenticated)
app.get('/api/executions/:executionId', authenticateToken, async (req, res) => {
    try {
        const { executionId } = req.params;
        
        // Try Prefect service first
        try {
            const status = await prefectClient.getExecutionStatus(executionId);
            return res.json(status);
        } catch (prefectError) {
            // Fallback to local database
            const db = await openDb();
            const execution = await db.get(
                'SELECT * FROM workflow_executions WHERE id = ?',
                [executionId]
            );
            
            if (!execution) {
                return res.status(404).json({ error: 'Execution not found' });
            }
            
            // Get logs
            const logs = await db.all(
                'SELECT * FROM execution_logs WHERE executionId = ? ORDER BY timestamp',
                [executionId]
            );
            
            return res.json({
                executionId,
                workflowId: execution.workflowId,
                status: execution.status,
                createdAt: execution.createdAt,
                startedAt: execution.startedAt,
                completedAt: execution.completedAt,
                error: execution.error,
                progress: {
                    totalNodes: logs.length,
                    completedNodes: logs.filter(l => l.status === 'completed').length,
                    failedNodes: logs.filter(l => l.status === 'error').length
                },
                logs: logs.slice(-10)
            });
        }
    } catch (error) {
        console.error('Error getting execution status:', error);
        res.status(500).json({ error: error.message || 'Failed to get execution status' });
    }
});

// Get active polling executions (for debugging)
app.get('/api/executions/polling/active', authenticateToken, async (req, res) => {
    const pollingService = getPollingService();
    if (pollingService) {
        res.json({
            activeExecutions: pollingService.getActiveExecutions()
        });
    } else {
        res.json({ activeExecutions: [] });
    }
});

// Cancel a running execution
app.post('/api/executions/:executionId/cancel', authenticateToken, async (req, res) => {
    try {
        const { executionId } = req.params;
        
        console.log(`[Execution] Cancel request for: ${executionId}`);
        
        // Try Prefect service first
        try {
            const result = await prefectClient.cancelExecution(executionId);
            
            // Stop polling if active
            const pollingService = getPollingService();
            if (pollingService) {
                pollingService.stopPolling(executionId);
            }
            
            // Broadcast cancellation via WebSocket
            const db = await openDb();
            const execution = await db.get(
                'SELECT workflowId, organizationId FROM workflow_executions WHERE id = ?',
                [executionId]
            );
            
            if (execution && execution.organizationId) {
                broadcastToOrganization(execution.organizationId, {
                    type: 'execution_cancelled',
                    executionId,
                    workflowId: execution.workflowId,
                    message: 'Execution cancelled by user'
                });
            }
            
            return res.json(result);
        } catch (prefectError) {
            console.warn('[Execution] Prefect cancel failed, trying local:', prefectError.message);
            
            // Fallback: cancel in local database
            const db = await openDb();
            const execution = await db.get(
                'SELECT * FROM workflow_executions WHERE id = ?',
                [executionId]
            );
            
            if (!execution) {
                return res.status(404).json({ error: 'Execution not found' });
            }
            
            if (!['pending', 'running'].includes(execution.status)) {
                return res.json({
                    success: false,
                    executionId,
                    message: `Cannot cancel execution with status '${execution.status}'`,
                    previousStatus: execution.status
                });
            }
            
            await db.run(
                "UPDATE workflow_executions SET status = 'cancelled', error = 'Execution cancelled by user' WHERE id = ?",
                [executionId]
            );
            
            // Broadcast cancellation
            if (execution.organizationId) {
                broadcastToOrganization(execution.organizationId, {
                    type: 'execution_cancelled',
                    executionId,
                    workflowId: execution.workflowId,
                    message: 'Execution cancelled by user'
                });
            }
            
            return res.json({
                success: true,
                executionId,
                message: 'Execution cancelled successfully',
                previousStatus: execution.status
            });
        }
    } catch (error) {
        console.error('Error cancelling execution:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel execution' });
    }
});

// Execute a single node (authenticated)
app.post('/api/workflow/:id/execute-node', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nodeId, nodeType, node, inputData, recursive } = req.body;

        if (!nodeId) {
            return res.status(400).json({ error: 'nodeId is required' });
        }

        console.log(`[WorkflowExecutor] Single node execution: ${nodeId} (recursive: ${recursive})`);

        // Try to use Prefect service if available
        const prefectAvailable = await prefectClient.isAvailable();
        
        if (prefectAvailable && !recursive) {
            // Use Prefect for single node execution (optimized)
            try {
                const result = await prefectClient.executeNode({
                    workflowId: id,
                    nodeId: nodeId,
                    nodeType: nodeType,
                    node: node,
                    inputData: inputData || {}
                });

                console.log('[Prefect] Single node execution completed via Prefect');

                return res.json({
                    success: result.success,
                    nodeId: result.nodeId,
                    output: result.output,
                    error: result.error,
                    mode: 'prefect'
                });
            } catch (prefectError) {
                console.warn('[Prefect] Failed to execute via Prefect, falling back to local:', prefectError.message);
                // Fall through to local execution
            }
        }

        // Fallback: Use local WorkflowExecutor
        const workflow = await db.get('SELECT organizationId FROM workflows WHERE id = ?', [id]);
        const executor = new WorkflowExecutor(db, null, workflow?.organizationId || req.user.orgId, req.user.sub);
        const result = await executor.executeSingleNode(id, nodeId, inputData, recursive || false);

        res.json({
            success: true,
            executionId: result.executionId,
            nodeId: result.nodeId,
            result: result.result,
            mode: 'local'
        });
    } catch (error) {
        console.error('Error executing node:', error);
        res.status(500).json({ error: error.message || 'Failed to execute node' });
    }
});

// Get execution status (works for both local and Prefect executions)
app.get('/api/workflow/execution/:execId', authenticateToken, async (req, res) => {
    try {
        const { execId } = req.params;
        const execution = await db.get('SELECT * FROM workflow_executions WHERE id = ?', [execId]);

        if (!execution) {
            return res.status(404).json({ error: 'Execution not found' });
        }

        // Parse JSON fields
        execution.inputs = execution.inputs ? JSON.parse(execution.inputs) : null;
        execution.nodeResults = execution.nodeResults ? JSON.parse(execution.nodeResults) : null;
        execution.finalOutput = execution.finalOutput ? JSON.parse(execution.finalOutput) : null;

        // If using Prefect, try to get additional progress info
        if (execution.status === 'running' || execution.status === 'pending') {
            try {
                const prefectStatus = await prefectClient.getExecutionStatus(execId);
                if (prefectStatus.progress) {
                    execution.progress = prefectStatus.progress;
                }
            } catch (e) {
                // Prefect service might not be available, that's ok
                console.log('[API] Could not fetch Prefect status:', e.message);
            }
        }

        res.json(execution);
    } catch (error) {
        console.error('Error fetching execution:', error);
        res.status(500).json({ error: 'Failed to fetch execution' });
    }
});

// Get execution logs (works for both local and Prefect executions)
app.get('/api/workflow/execution/:execId/logs', authenticateToken, async (req, res) => {
    try {
        const { execId } = req.params;
        const logs = await db.all(
            'SELECT * FROM execution_logs WHERE executionId = ? ORDER BY timestamp ASC',
            [execId]
        );

        // Parse JSON fields
        logs.forEach(log => {
            log.inputData = log.inputData ? JSON.parse(log.inputData) : null;
            log.outputData = log.outputData ? JSON.parse(log.outputData) : null;
        });

        res.json(logs);
    } catch (error) {
        console.error('Error fetching execution logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Check Prefect service health
app.get('/api/prefect/health', authenticateToken, async (req, res) => {
    try {
        const isAvailable = await prefectClient.isAvailable();
        
        res.json({
            available: isAvailable,
            serviceUrl: process.env.PREFECT_SERVICE_URL || 'http://localhost:8000',
            message: isAvailable 
                ? 'Prefect service is running - background execution enabled' 
                : 'Prefect service is not available - using local execution only'
        });
    } catch (error) {
        res.json({
            available: false,
            error: error.message,
            message: 'Prefect service is not available - using local execution only'
        });
    }
});

// Get execution history for a workflow (public - for webhook debugging)
app.get('/api/workflow/:id/executions', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 20;
        
        const executions = await db.all(`
            SELECT id, status, triggerType, inputs, nodeResults, finalOutput, createdAt, startedAt, completedAt, error
            FROM workflow_executions 
            WHERE workflowId = ?
            ORDER BY createdAt DESC
            LIMIT ?
        `, [id, limit]);

        // Parse JSON fields
        const parsed = executions.map(e => ({
            ...e,
            inputs: e.inputs ? JSON.parse(e.inputs) : null,
            nodeResults: e.nodeResults ? JSON.parse(e.nodeResults) : null,
            finalOutput: e.finalOutput ? JSON.parse(e.finalOutput) : null
        }));

        res.json(parsed);
    } catch (error) {
        console.error('Error fetching executions:', error);
        res.status(500).json({ error: 'Failed to fetch executions' });
    }
});

// Overview statistics endpoint
app.get('/api/overview/stats', authenticateToken, async (req, res) => {
    try {
        const orgId = req.user.orgId;
        
        // Get workflow count
        const workflowCount = await db.get(
            'SELECT COUNT(*) as count FROM workflows WHERE organizationId = ?',
            [orgId]
        );
        
        // Get total executions count (events triggered)
        const executionsCount = await db.get(
            'SELECT COUNT(*) as count FROM workflow_executions WHERE workflowId IN (SELECT id FROM workflows WHERE organizationId = ?)',
            [orgId]
        );
        
        // Get executions from last 7 days for chart
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const dailyExecutions = await db.all(`
            SELECT 
                DATE(createdAt) as date,
                COUNT(*) as count
            FROM workflow_executions 
            WHERE workflowId IN (SELECT id FROM workflows WHERE organizationId = ?)
                AND createdAt >= ?
            GROUP BY DATE(createdAt)
            ORDER BY date ASC
        `, [orgId, sevenDaysAgo.toISOString()]);
        
        // Get recent workflows with execution counts
        let recentWorkflowsRaw = [];
        try {
            recentWorkflowsRaw = await db.all(`
                SELECT 
                    w.id,
                    w.name,
                    w.updatedAt,
                    COALESCE(COUNT(e.id), 0) as executionCount,
                    MAX(e.createdAt) as lastExecutionAt,
                    COALESCE(SUM(CASE WHEN e.status = 'running' THEN 1 ELSE 0 END), 0) as runningCount,
                    COALESCE(SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END), 0) as completedCount,
                    COALESCE(SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END), 0) as failedCount
                FROM workflows w
                LEFT JOIN workflow_executions e ON w.id = e.workflowId
                WHERE w.organizationId = ?
                GROUP BY w.id, w.name, w.updatedAt
                ORDER BY COALESCE(MAX(e.createdAt), w.updatedAt) DESC
                LIMIT 10
            `, [orgId]);
        } catch (error) {
            console.error('[Overview Stats] Error fetching workflows:', error);
            // If query fails, try simpler query without joins
            try {
                recentWorkflowsRaw = await db.all(`
                    SELECT 
                        id,
                        name,
                        updatedAt
                    FROM workflows 
                    WHERE organizationId = ?
                    ORDER BY updatedAt DESC
                    LIMIT 10
                `, [orgId]);
                // Add default values
                recentWorkflowsRaw = recentWorkflowsRaw.map(w => ({
                    ...w,
                    executionCount: 0,
                    lastExecutionAt: null,
                    runningCount: 0,
                    completedCount: 0,
                    failedCount: 0
                }));
            } catch (e) {
                console.error('[Overview Stats] Error with fallback query:', e);
                recentWorkflowsRaw = [];
            }
        }
        
        console.log('[Overview Stats] Found workflows:', recentWorkflowsRaw.length);
        
        // Calculate percentage changes (comparing last 7 days vs previous 7 days)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        
        const recentExecutions = await db.get(`
            SELECT COUNT(*) as count FROM workflow_executions 
            WHERE workflowId IN (SELECT id FROM workflows WHERE organizationId = ?)
                AND createdAt >= ? AND createdAt < ?
        `, [orgId, sevenDaysAgo.toISOString(), new Date().toISOString()]);
        
        const previousExecutions = await db.get(`
            SELECT COUNT(*) as count FROM workflow_executions 
            WHERE workflowId IN (SELECT id FROM workflows WHERE organizationId = ?)
                AND createdAt >= ? AND createdAt < ?
        `, [orgId, fourteenDaysAgo.toISOString(), sevenDaysAgo.toISOString()]);
        
        const eventsChange = previousExecutions.count > 0 
            ? ((recentExecutions.count - previousExecutions.count) / previousExecutions.count * 100).toFixed(1)
            : recentExecutions.count > 0 ? '100.0' : '0.0';
        
        res.json({
            activeWorkflows: workflowCount?.count || 0,
            eventsTriggered: recentExecutions?.count || 0,
            eventsChange: parseFloat(eventsChange) || 0,
            dailyExecutions: (dailyExecutions || []).map(row => ({
                date: row.date,
                count: row.count
            })),
            recentWorkflows: (recentWorkflowsRaw || []).map(w => ({
                id: w.id,
                name: w.name,
                executionCount: w.executionCount || 0,
                lastExecutionAt: w.lastExecutionAt || null,
                status: w.runningCount > 0 ? 'running' : (w.failedCount > 0 ? 'error' : (w.completedCount > 0 ? 'paused' : 'paused'))
            }))
        });
    } catch (error) {
        console.error('Error fetching overview stats:', error);
        // Return empty stats instead of error to prevent UI issues
        res.json({
            activeWorkflows: 0,
            eventsTriggered: 0,
            eventsChange: 0,
            dailyExecutions: [],
            recentWorkflows: []
        });
    }
});

// Cancel execution
app.post('/api/workflow/execution/:execId/cancel', authenticateToken, async (req, res) => {
    try {
        const { execId } = req.params;
        
        await db.run(
            'UPDATE workflow_executions SET status = ?, completedAt = ? WHERE id = ? AND status IN (?, ?)',
            ['cancelled', new Date().toISOString(), execId, 'pending', 'running']
        );

        res.json({ success: true, message: 'Execution cancelled' });
    } catch (error) {
        console.error('Error cancelling execution:', error);
        res.status(500).json({ error: 'Failed to cancel execution' });
    }
});

// Resume paused execution (for human approval)
app.post('/api/workflow/execution/:execId/resume', authenticateToken, async (req, res) => {
    try {
        const { execId } = req.params;
        const { approved } = req.body;

        const execution = await db.get('SELECT * FROM workflow_executions WHERE id = ?', [execId]);
        
        if (!execution) {
            return res.status(404).json({ error: 'Execution not found' });
        }

        if (execution.status !== 'paused') {
            return res.status(400).json({ error: 'Execution is not paused' });
        }

        if (!approved) {
            // Rejected - mark as failed
            await db.run(
                'UPDATE workflow_executions SET status = ?, error = ?, completedAt = ? WHERE id = ?',
                ['failed', 'Rejected by human approval', new Date().toISOString(), execId]
            );
            return res.json({ success: true, message: 'Execution rejected' });
        }

        // Approved - continue execution from current node
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [execution.workflowId]);
        const executor = new WorkflowExecutor(db, execId, workflow?.organizationId || null, req.user.sub);
        
        // Load workflow data
        const workflowData = JSON.parse(workflow.data);
        executor.nodes = workflowData.nodes || [];
        executor.connections = workflowData.connections || [];
        executor.workflow = workflow;
        executor.nodeResults = execution.nodeResults ? JSON.parse(execution.nodeResults) : {};

        // Update status to running
        await db.run('UPDATE workflow_executions SET status = ? WHERE id = ?', ['running', execId]);

        // Get next nodes after the approval node and continue
        const nextNodes = executor.getNextNodes(execution.currentNodeId, { conditionResult: true });
        
        for (const nextNode of nextNodes) {
            await executor.executeNode(nextNode.id, null, true);
        }

        // Mark as completed
        await db.run(
            'UPDATE workflow_executions SET status = ?, completedAt = ?, nodeResults = ? WHERE id = ?',
            ['completed', new Date().toISOString(), JSON.stringify(executor.nodeResults), execId]
        );

        res.json({ success: true, message: 'Execution resumed and completed' });
    } catch (error) {
        console.error('Error resuming execution:', error);
        res.status(500).json({ error: error.message || 'Failed to resume execution' });
    }
});

// Pending Approvals Endpoints (Human in the Loop)
app.get('/api/pending-approvals', authenticateToken, async (req, res) => {
    try {
        const approvals = await db.all(`
            SELECT pa.*, w.name as workflowName 
            FROM pending_approvals pa
            LEFT JOIN workflows w ON pa.workflowId = w.id
            WHERE pa.assignedUserId = ? AND pa.status = 'pending' AND pa.organizationId = ?
            ORDER BY pa.createdAt DESC
        `, [req.user.id, req.user.orgId]);
        res.json(approvals || []);
    } catch (error) {
        console.error('Error fetching pending approvals:', error);
        res.json([]); // Return empty array instead of error
    }
});

app.post('/api/pending-approvals', authenticateToken, async (req, res) => {
    try {
        const { workflowId, nodeId, nodeLabel, assignedUserId, assignedUserName, inputDataPreview } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const createdAt = new Date().toISOString();
        
        await db.run(`
            INSERT INTO pending_approvals (id, workflowId, nodeId, nodeLabel, assignedUserId, assignedUserName, status, createdAt, inputDataPreview, organizationId)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        `, [id, workflowId, nodeId, nodeLabel, assignedUserId, assignedUserName, createdAt, JSON.stringify(inputDataPreview), req.user.orgId]);
        
        res.json({ id, status: 'pending', createdAt });
    } catch (error) {
        console.error('Error creating pending approval:', error);
        res.status(500).json({ error: 'Failed to create pending approval' });
    }
});

app.post('/api/pending-approvals/:id/approve', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.run(`
            UPDATE pending_approvals SET status = 'approved', updatedAt = ? 
            WHERE id = ? AND assignedUserId = ? AND organizationId = ?
        `, [new Date().toISOString(), id, req.user.id, req.user.orgId]);
        res.json({ message: 'Approved' });
    } catch (error) {
        console.error('Error approving:', error);
        res.status(500).json({ error: 'Failed to approve' });
    }
});

app.post('/api/pending-approvals/:id/reject', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.run(`
            UPDATE pending_approvals SET status = 'rejected', updatedAt = ? 
            WHERE id = ? AND assignedUserId = ? AND organizationId = ?
        `, [new Date().toISOString(), id, req.user.id, req.user.orgId]);
        res.json({ message: 'Rejected' });
    } catch (error) {
        console.error('Error rejecting:', error);
        res.status(500).json({ error: 'Failed to reject' });
    }
});

// HTTP Proxy Endpoint
app.post('/api/proxy', authenticateToken, async (req, res) => {
    const { url, method = 'GET', headers = {} } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const response = await fetch(url, {
            method,
            headers: {
                ...headers,
                'User-Agent': 'Intemic-Workflow-Agent/1.0'
            }
        });

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (!response.ok) {
            return res.status(response.status).json({ error: `Request failed: ${response.statusText}`, details: data });
        }

        res.json(data);
    } catch (error) {
        console.error('Proxy request error:', error);
        res.status(500).json({ error: error.message });
    }
});

// MySQL Query Endpoint
app.post('/api/mysql/query', authenticateToken, async (req, res) => {
    const { host, port, database, username, password, query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'SQL query is required' });
    }

    // Only allow SELECT queries for security
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT')) {
        return res.status(400).json({ error: 'Only SELECT queries are allowed for security reasons' });
    }

    try {
        const mysql = require('mysql2/promise');
        
        const connection = await mysql.createConnection({
            host: host || 'localhost',
            port: parseInt(port) || 3306,
            database: database,
            user: username,
            password: password,
            connectTimeout: 10000
        });

        const [rows] = await connection.execute(query);
        await connection.end();

        res.json({ results: rows });
    } catch (error) {
        console.error('MySQL query error:', error);
        res.status(500).json({ error: error.message || 'Failed to execute MySQL query' });
    }
});

// Send Email Endpoint
app.post('/api/email/send', authenticateToken, async (req, res) => {
    const { to, subject, body, smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

    if (!to) {
        return res.status(400).json({ error: 'Recipient email is required' });
    }

    if (!smtpUser || !smtpPass) {
        return res.status(400).json({ error: 'SMTP credentials are required. Configure SMTP settings in the node.' });
    }

    try {
        const nodemailer = require('nodemailer');

        // Create transporter with user-provided SMTP settings
        const transporter = nodemailer.createTransport({
            host: smtpHost || 'smtp.gmail.com',
            port: parseInt(smtpPort) || 587,
            secure: parseInt(smtpPort) === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });

        // Send email
        const info = await transporter.sendMail({
            from: smtpUser,
            to: to,
            subject: subject || '(No subject)',
            text: body || '',
            html: body ? body.replace(/\n/g, '<br>') : ''
        });

        console.log('Email sent:', info.messageId);
        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({ error: error.message || 'Failed to send email' });
    }
});

// Send SMS Endpoint (using Twilio)
app.post('/api/sms/send', authenticateToken, async (req, res) => {
    const { to, body, accountSid, authToken, fromNumber } = req.body;

    if (!to) {
        return res.status(400).json({ error: 'Recipient phone number is required' });
    }

    if (!accountSid || !authToken || !fromNumber) {
        return res.status(400).json({ error: 'Twilio credentials are required (Account SID, Auth Token, and From Number)' });
    }

    try {
        const twilio = require('twilio');
        const client = twilio(accountSid, authToken);

        const message = await client.messages.create({
            body: body || '',
            from: fromNumber,
            to: to
        });

        console.log('SMS sent:', message.sid);
        res.json({ 
            success: true, 
            messageSid: message.sid,
            status: message.status,
            to: message.to,
            from: message.from
        });
    } catch (error) {
        console.error('SMS send error:', error);
        res.status(500).json({ error: error.message || 'Failed to send SMS' });
    }
});

// Node Feedback Endpoints
app.post('/api/node-feedback', authenticateToken, async (req, res) => {
    try {
        const { nodeType, nodeLabel, feedbackText, workflowId, workflowName } = req.body;

        if (!nodeType || !feedbackText) {
            return res.status(400).json({ error: 'Node type and feedback text are required' });
        }

        const id = Math.random().toString(36).substr(2, 9);
        const createdAt = new Date().toISOString();

        await db.run(`
            INSERT INTO node_feedback (id, nodeType, nodeLabel, feedbackText, userId, userName, userEmail, organizationId, workflowId, workflowName, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, nodeType, nodeLabel || '', feedbackText, req.user.id, req.user.name || '', req.user.email || '', req.user.orgId, workflowId || null, workflowName || null, createdAt]);

        res.json({ success: true, id, message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Error saving node feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// Admin endpoint to get all node feedback
app.get('/api/admin/node-feedback', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const feedback = await db.all(`
            SELECT nf.*, o.name as organizationName
            FROM node_feedback nf
            LEFT JOIN organizations o ON nf.organizationId = o.id
            ORDER BY nf.createdAt DESC
        `);
        res.json(feedback);
    } catch (error) {
        console.error('Error fetching node feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

// Admin endpoint to delete node feedback
app.delete('/api/admin/node-feedback/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await db.run('DELETE FROM node_feedback WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting node feedback:', error);
        res.status(500).json({ error: 'Failed to delete feedback' });
    }
});

// ==================== STRIPE BILLING ENDPOINTS ====================

// Get current subscription plan for the organization
app.get('/api/billing/subscription', authenticateToken, async (req, res) => {
    try {
        const org = await db.get(
            'SELECT subscriptionPlan, stripeCustomerId, stripeSubscriptionId, subscriptionStatus, subscriptionCurrentPeriodEnd FROM organizations WHERE id = ?',
            [req.user.orgId]
        );

        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json({
            plan: org.subscriptionPlan || 'free',
            status: org.subscriptionStatus || 'active',
            currentPeriodEnd: org.subscriptionCurrentPeriodEnd,
            hasStripeCustomer: !!org.stripeCustomerId
        });
    } catch (error) {
        console.error('Error fetching subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

// Create Stripe Checkout Session for subscription
app.post('/api/billing/create-checkout-session', authenticateToken, async (req, res) => {
    try {
        const { plan } = req.body; // 'pro' or 'business'

        if (!plan || !['pro', 'business'].includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan. Must be "pro" or "business"' });
        }

        const priceId = STRIPE_PRICES[plan];
        if (!priceId || priceId.includes('placeholder')) {
            return res.status(400).json({ error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY and price IDs in environment variables.' });
        }

        // Get or create Stripe customer
        const org = await db.get('SELECT * FROM organizations WHERE id = ?', [req.user.orgId]);
        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.sub]);

        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let customerId = org.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: org.name,
                metadata: {
                    organizationId: org.id,
                    userId: user.id
                }
            });
            customerId = customer.id;

            await db.run(
                'UPDATE organizations SET stripeCustomerId = ? WHERE id = ?',
                [customerId, org.id]
            );
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1
            }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?billing=cancelled`,
            metadata: {
                organizationId: org.id,
                plan: plan
            }
        });

        res.json({ url: session.url, sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
});

// Create Stripe Customer Portal session (for managing subscription)
app.post('/api/billing/create-portal-session', authenticateToken, async (req, res) => {
    try {
        const org = await db.get('SELECT stripeCustomerId FROM organizations WHERE id = ?', [req.user.orgId]);

        if (!org?.stripeCustomerId) {
            return res.status(400).json({ error: 'No active subscription found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: org.stripeCustomerId,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings`
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating portal session:', error);
        res.status(500).json({ error: 'Failed to create portal session' });
    }
});

// Request quotation endpoint (sends email to sales team)
app.post('/api/request-quotation', authenticateToken, async (req, res) => {
    try {
        const { useCase } = req.body;

        if (!useCase || !useCase.trim()) {
            return res.status(400).json({ error: 'Use case is required' });
        }

        const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.sub]);
        const org = await db.get('SELECT * FROM organizations WHERE id = ?', [req.user.orgId]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Import Resend
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        // Send email to sales team
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #14b8a6;">Nueva solicitud de cotización</h2>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Usuario:</strong> ${user.name}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Organización:</strong> ${org ? org.name : 'N/A'}</p>
                    <p><strong>Plan actual:</strong> ${org ? org.subscriptionPlan || 'free' : 'N/A'}</p>
                </div>
                <div style="margin: 20px 0;">
                    <h3 style="color: #334155;">Caso de uso:</h3>
                    <p style="white-space: pre-wrap; background-color: #f8fafc; padding: 15px; border-radius: 8px;">${useCase}</p>
                </div>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
                    <p>Este email fue generado automáticamente desde la plataforma Intemic.</p>
                </div>
            </div>
        `;

        await resend.emails.send({
            from: 'Intemic Platform <onboarding@resend.dev>',
            to: ['a.mestre@intemic.com', 'm.alcazar@intemic.com'],
            subject: `Nueva solicitud de cotización - ${user.email}`,
            html: emailHtml
        });

        console.log('Quotation request email sent to sales team for user:', user.email);

        res.json({ 
            success: true, 
            message: 'Quotation request sent successfully' 
        });
    } catch (error) {
        console.error('Error sending quotation request:', error);
        res.status(500).json({ error: 'Failed to send quotation request' });
    }
});

// ==================== REPORT TEMPLATES ENDPOINTS ====================

// Get all templates for organization
app.get('/api/report-templates', authenticateToken, async (req, res) => {
    try {
        const templates = await db.all(
            `SELECT id, name, description, icon, createdBy, createdAt, updatedAt 
             FROM report_templates 
             WHERE organizationId = ? 
             ORDER BY updatedAt DESC`,
            [req.user.orgId]
        );
        
        // For each template, get its sections
        for (const template of templates) {
            template.sections = await db.all(
                `SELECT id, parentId, title, content, generationRules, sortOrder 
                 FROM template_sections 
                 WHERE templateId = ? 
                 ORDER BY sortOrder ASC`,
                [template.id]
            );
        }
        
        res.json(templates);
    } catch (error) {
        console.error('Error fetching report templates:', error);
        res.status(500).json({ error: 'Failed to fetch report templates' });
    }
});

// Get single template with sections
app.get('/api/report-templates/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const template = await db.get(
            `SELECT * FROM report_templates WHERE id = ? AND organizationId = ?`,
            [id, req.user.orgId]
        );
        
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        template.sections = await db.all(
            `SELECT id, parentId, title, content, generationRules, sortOrder 
             FROM template_sections 
             WHERE templateId = ? 
             ORDER BY sortOrder ASC`,
            [id]
        );
        
        res.json(template);
    } catch (error) {
        console.error('Error fetching template:', error);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// Create new template
app.post('/api/report-templates', authenticateToken, async (req, res) => {
    try {
        const { name, description, icon, sections } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(
            `INSERT INTO report_templates (id, organizationId, name, description, icon, createdBy, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.orgId, name, description || '', icon || 'FileText', req.user.sub, now, now]
        );
        
        // Insert sections if provided
        if (sections && sections.length > 0) {
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                const sectionId = Math.random().toString(36).substr(2, 9);
                await db.run(
                    `INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [sectionId, id, section.parentId || null, section.title, section.content || '', section.generationRules || '', i]
                );
                
                // Handle subsections
                if (section.items && section.items.length > 0) {
                    for (let j = 0; j < section.items.length; j++) {
                        const item = section.items[j];
                        const itemId = Math.random().toString(36).substr(2, 9);
                        await db.run(
                            `INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [itemId, id, sectionId, item.title, item.content || '', item.generationRules || '', j]
                        );
                    }
                }
            }
        }
        
        // Return the created template with sections
        const createdTemplate = await db.get('SELECT * FROM report_templates WHERE id = ?', [id]);
        createdTemplate.sections = await db.all(
            'SELECT * FROM template_sections WHERE templateId = ? ORDER BY sortOrder ASC',
            [id]
        );

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'template',
            resourceId: id,
            resourceName: name,
            details: { sectionCount: sections?.length || 0 },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json(createdTemplate);
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Get template usage (which reports use this template)
app.get('/api/report-templates/:id/usage', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify ownership
        const existing = await db.get(
            'SELECT id FROM report_templates WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Get all reports using this template
        const reports = await db.all(`
            SELECT r.id, r.name, r.status, r.createdAt, u.name as createdByName
            FROM reports r
            LEFT JOIN users u ON r.createdBy = u.id
            WHERE r.templateId = ?
            ORDER BY r.createdAt DESC
        `, [id]);
        
        res.json({ 
            inUse: reports.length > 0,
            reportCount: reports.length,
            reports 
        });
    } catch (error) {
        console.error('Error checking template usage:', error);
        res.status(500).json({ error: 'Failed to check template usage' });
    }
});

// Update template
app.put('/api/report-templates/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon, sections } = req.body;
        const now = new Date().toISOString();
        
        // Verify ownership
        const existing = await db.get(
            'SELECT id FROM report_templates WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        await db.run(
            `UPDATE report_templates SET name = ?, description = ?, icon = ?, updatedAt = ? WHERE id = ?`,
            [name, description || '', icon || 'FileText', now, id]
        );
        
        // Get existing section IDs
        const existingSections = await db.all(
            'SELECT id FROM template_sections WHERE templateId = ?',
            [id]
        );
        const existingSectionIds = existingSections.map(s => s.id);
        
        // Collect new section IDs that will be kept/created
        const newSectionIds = new Set();
        
        if (sections && sections.length > 0) {
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                const sectionId = section.id && existingSectionIds.includes(section.id) 
                    ? section.id 
                    : Math.random().toString(36).substr(2, 9);
                newSectionIds.add(sectionId);
                
                // Check if section exists
                const sectionExists = await db.get('SELECT id FROM template_sections WHERE id = ?', [sectionId]);
                
                if (sectionExists) {
                    // Update existing section
                    await db.run(
                        `UPDATE template_sections SET title = ?, content = ?, generationRules = ?, sortOrder = ?, parentId = NULL WHERE id = ?`,
                        [section.title, section.content || '', section.generationRules || '', i, sectionId]
                    );
                } else {
                    // Insert new section
                    await db.run(
                        `INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [sectionId, id, null, section.title, section.content || '', section.generationRules || '', i]
                    );
                }
                
                // Handle subsections (items)
                if (section.items && section.items.length > 0) {
                    for (let j = 0; j < section.items.length; j++) {
                        const item = section.items[j];
                        const itemId = item.id && existingSectionIds.includes(item.id)
                            ? item.id
                            : Math.random().toString(36).substr(2, 9);
                        newSectionIds.add(itemId);
                        
                        const itemExists = await db.get('SELECT id FROM template_sections WHERE id = ?', [itemId]);
                        
                        if (itemExists) {
                            await db.run(
                                `UPDATE template_sections SET title = ?, content = ?, generationRules = ?, sortOrder = ?, parentId = ? WHERE id = ?`,
                                [item.title, item.content || '', item.generationRules || '', j, sectionId, itemId]
                            );
                        } else {
                            await db.run(
                                `INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder)
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [itemId, id, sectionId, item.title, item.content || '', item.generationRules || '', j]
                            );
                        }
                    }
                }
            }
        }
        
        // Delete sections that are no longer in the template (only if not referenced)
        const sectionsToDelete = existingSectionIds.filter(sid => !newSectionIds.has(sid));
        
        for (const sectionId of sectionsToDelete) {
            // Check if this section is referenced by any report_sections
            const hasReferences = await db.get(
                'SELECT id FROM report_sections WHERE templateSectionId = ?',
                [sectionId]
            );
            
            if (hasReferences) {
                // Set the reference to NULL instead of failing
                await db.run(
                    'UPDATE report_sections SET templateSectionId = NULL WHERE templateSectionId = ?',
                    [sectionId]
                );
            }
            
            // Now safe to delete
            await db.run('DELETE FROM template_sections WHERE id = ?', [sectionId]);
        }
        
        res.json({ message: 'Template updated' });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

// Delete template
app.delete('/api/report-templates/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify ownership
        const existing = await db.get(
            'SELECT id FROM report_templates WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Sections will be cascade deleted
        await db.run('DELETE FROM report_templates WHERE id = ?', [id]);
        
        res.json({ message: 'Template deleted' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// ==================== REPORTS ENDPOINTS ====================

// Get all reports for organization
app.get('/api/reports', authenticateToken, async (req, res) => {
    try {
        const reports = await db.all(`
            SELECT r.*, 
                   u.name as createdByName, u.email as createdByEmail,
                   rev.name as reviewerName, rev.email as reviewerEmail,
                   t.name as templateName
            FROM reports r
            LEFT JOIN users u ON r.createdBy = u.id
            LEFT JOIN users rev ON r.reviewerId = rev.id
            LEFT JOIN report_templates t ON r.templateId = t.id
            WHERE r.organizationId = ?
            ORDER BY r.updatedAt DESC
        `, [req.user.orgId]);
        
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Get single report with all sections and contexts
app.get('/api/reports/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const report = await db.get(`
            SELECT r.*, 
                   u.name as createdByName, u.email as createdByEmail,
                   rev.name as reviewerName, rev.email as reviewerEmail,
                   t.name as templateName
            FROM reports r
            LEFT JOIN users u ON r.createdBy = u.id
            LEFT JOIN users rev ON r.reviewerId = rev.id
            LEFT JOIN report_templates t ON r.templateId = t.id
            WHERE r.id = ? AND r.organizationId = ?
        `, [id, req.user.orgId]);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Get template sections
        const templateSections = await db.all(`
            SELECT * FROM template_sections 
            WHERE templateId = ? 
            ORDER BY sortOrder ASC
        `, [report.templateId]);
        
        // Get report sections (generated content)
        const reportSections = await db.all(`
            SELECT * FROM report_sections 
            WHERE reportId = ?
        `, [id]);
        
        // Get contexts
        const contexts = await db.all(`
            SELECT id, fileName, fileSize, uploadedAt 
            FROM report_contexts 
            WHERE reportId = ?
            ORDER BY uploadedAt DESC
        `, [id]);
        
        // Create a map of template_section.id -> report_section.id (or template_section.id if no report_section exists)
        const templateToReportIdMap = {};
        templateSections.forEach(ts => {
            const rs = reportSections.find(r => r.templateSectionId === ts.id);
            templateToReportIdMap[ts.id] = rs?.id || ts.id;
        });
        
        // Merge template sections with report sections
        const sections = templateSections.map(ts => {
            const rs = reportSections.find(r => r.templateSectionId === ts.id);
            return {
                id: templateToReportIdMap[ts.id], // Use mapped ID
                templateSectionId: ts.id,
                title: ts.title,
                content: ts.content,
                generationRules: ts.generationRules,
                sortOrder: ts.sortOrder,
                parentId: ts.parentId ? templateToReportIdMap[ts.parentId] : null, // Map parentId too!
                generatedContent: rs?.content || null,
                userPrompt: rs?.userPrompt || null,
                sectionStatus: rs?.status || 'empty',
                generatedAt: rs?.generatedAt || null
            };
        });
        
        report.sections = sections;
        report.contexts = contexts;
        
        res.json(report);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Create new report
app.post('/api/reports', authenticateToken, async (req, res) => {
    try {
        const { name, description, templateId, reviewerId, deadline } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(`
            INSERT INTO reports (id, organizationId, templateId, name, description, status, createdBy, reviewerId, deadline, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
        `, [id, req.user.orgId, templateId, name, description || '', req.user.sub, reviewerId || null, deadline || null, now, now]);
        
        // Create empty report sections for each template section
        const templateSections = await db.all(
            'SELECT id FROM template_sections WHERE templateId = ? AND parentId IS NULL ORDER BY sortOrder',
            [templateId]
        );
        
        for (const section of templateSections) {
            const sectionId = Math.random().toString(36).substr(2, 9);
            await db.run(`
                INSERT INTO report_sections (id, reportId, templateSectionId, status)
                VALUES (?, ?, ?, 'empty')
            `, [sectionId, id, section.id]);
        }
        
        // Also create for subsections
        const subSections = await db.all(
            'SELECT id FROM template_sections WHERE templateId = ? AND parentId IS NOT NULL ORDER BY sortOrder',
            [templateId]
        );
        
        for (const section of subSections) {
            const sectionId = Math.random().toString(36).substr(2, 9);
            await db.run(`
                INSERT INTO report_sections (id, reportId, templateSectionId, status)
                VALUES (?, ?, ?, 'empty')
            `, [sectionId, id, section.id]);
        }

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'report',
            resourceId: id,
            resourceName: name,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ id, message: 'Report created' });
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});

// Update report metadata
app.put('/api/reports/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, reviewerId, deadline } = req.body;
        const now = new Date().toISOString();
        
        const existing = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        await db.run(`
            UPDATE reports 
            SET name = ?, description = ?, reviewerId = ?, deadline = ?, updatedAt = ?
            WHERE id = ?
        `, [name, description, reviewerId, deadline, now, id]);
        
        res.json({ message: 'Report updated' });
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// Update report status
app.put('/api/reports/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const now = new Date().toISOString();
        
        const validStatuses = ['draft', 'review', 'ready_to_send'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const existing = await db.get(
            'SELECT id, name, status as previousStatus FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        await db.run(
            'UPDATE reports SET status = ?, updatedAt = ? WHERE id = ?',
            [status, now, id]
        );

        // Log status change in audit trail
        const user = await db.get('SELECT name, email FROM users WHERE id = ?', [req.user.sub]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: user?.name || req.user.email,
            userEmail: user?.email || req.user.email,
            action: 'status_change',
            resourceType: 'report',
            resourceId: id,
            resourceName: existing.name,
            details: { previousStatus: existing.previousStatus, newStatus: status },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ message: 'Status updated', status });
    } catch (error) {
        console.error('Error updating report status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Get audit trail for a specific report
app.get('/api/reports/:id/audit-trail', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify report belongs to user's organization
        const existing = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        const logs = await db.all(`
            SELECT * FROM audit_logs 
            WHERE organizationId = ? AND resourceType = 'report' AND resourceId = ?
            ORDER BY createdAt DESC
        `, [req.user.orgId, id]);
        
        res.json(logs);
    } catch (error) {
        console.error('Error fetching report audit trail:', error);
        res.status(500).json({ error: 'Failed to fetch audit trail' });
    }
});

// Delete report
app.delete('/api/reports/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const existing = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Delete associated context files
        const contexts = await db.all('SELECT filePath FROM report_contexts WHERE reportId = ?', [id]);
        for (const ctx of contexts) {
            try {
                fs.unlinkSync(ctx.filePath);
            } catch (e) {
                // File might not exist
            }
        }
        
        await db.run('DELETE FROM reports WHERE id = ?', [id]);
        
        res.json({ message: 'Report deleted' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

// Upload context PDF for report
app.post('/api/reports/:id/context', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const existing = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Extract text from PDF
        let extractedText = '';
        try {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            extractedText = pdfData.text;
        } catch (e) {
            console.error('Error extracting PDF text:', e);
        }
        
        const contextId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(`
            INSERT INTO report_contexts (id, reportId, fileName, filePath, fileSize, extractedText, uploadedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [contextId, id, req.file.originalname, req.file.path, req.file.size, extractedText, now]);
        
        res.json({ 
            id: contextId, 
            fileName: req.file.originalname, 
            fileSize: req.file.size,
            uploadedAt: now,
            hasExtractedText: extractedText.length > 0
        });
    } catch (error) {
        console.error('Error uploading context:', error);
        res.status(500).json({ error: 'Failed to upload context' });
    }
});

// Delete context
app.delete('/api/reports/:id/context/:contextId', authenticateToken, async (req, res) => {
    try {
        const { id, contextId } = req.params;
        
        const context = await db.get(`
            SELECT rc.* FROM report_contexts rc
            JOIN reports r ON rc.reportId = r.id
            WHERE rc.id = ? AND r.id = ? AND r.organizationId = ?
        `, [contextId, id, req.user.orgId]);
        
        if (!context) {
            return res.status(404).json({ error: 'Context not found' });
        }
        
        // Delete file
        try {
            fs.unlinkSync(context.filePath);
        } catch (e) {
            // File might not exist
        }
        
        await db.run('DELETE FROM report_contexts WHERE id = ?', [contextId]);
        
        res.json({ message: 'Context deleted' });
    } catch (error) {
        console.error('Error deleting context:', error);
        res.status(500).json({ error: 'Failed to delete context' });
    }
});

// Generate content for a section
app.post('/api/reports/:id/sections/:sectionId/generate', authenticateToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const { prompt, mentionedEntityIds } = req.body;
        
        console.log('[Generate] Request received:', { reportId: id, sectionId, prompt: prompt?.slice(0, 50) });
        
        // Verify report ownership
        const report = await db.get(
            'SELECT * FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // First, try to find if sectionId is a report_sections.id (the new way)
        let reportSection = await db.get(
            'SELECT * FROM report_sections WHERE id = ?',
            [sectionId]
        );
        
        let templateSectionId;
        if (reportSection) {
            // sectionId is a report_sections.id, get the templateSectionId from it
            templateSectionId = reportSection.templateSectionId;
            console.log('[Generate] Found report section, templateSectionId:', templateSectionId);
        } else {
            // sectionId might be a templateSectionId (old way), try to find or create report_section
            templateSectionId = sectionId;
            reportSection = await db.get(
                'SELECT * FROM report_sections WHERE reportId = ? AND templateSectionId = ?',
                [id, templateSectionId]
            );
            console.log('[Generate] Using sectionId as templateSectionId:', templateSectionId);
        }
        
        // Get template section info
        const templateSection = await db.get(
            'SELECT * FROM template_sections WHERE id = ?',
            [templateSectionId]
        );
        
        if (!templateSection) {
            console.error('[Generate] Template section not found:', templateSectionId);
            return res.status(404).json({ error: 'Section not found' });
        }
        
        // Get all context texts for this report
        const contexts = await db.all(
            'SELECT extractedText FROM report_contexts WHERE reportId = ?',
            [id]
        );
        const contextText = contexts.map(c => c.extractedText).filter(Boolean).join('\n\n---\n\n');
        
        // Get entity data for mentioned entities
        let entityContext = '';
        if (mentionedEntityIds && mentionedEntityIds.length > 0) {
            for (const entityId of mentionedEntityIds) {
                const entity = await db.get('SELECT * FROM entities WHERE id = ?', [entityId]);
                if (entity) {
                    const records = await db.all(`
                        SELECT r.*, rv.propertyId, rv.value, p.name as propertyName
                        FROM records r
                        LEFT JOIN record_values rv ON r.id = rv.recordId
                        LEFT JOIN properties p ON rv.propertyId = p.id
                        WHERE r.entityId = ?
                    `, [entityId]);
                    
                    entityContext += `\n\n### ${entity.name} Data:\n`;
                    // Group records
                    const recordMap = new Map();
                    for (const rec of records) {
                        if (!recordMap.has(rec.id)) {
                            recordMap.set(rec.id, {});
                        }
                        if (rec.propertyName && rec.value) {
                            recordMap.get(rec.id)[rec.propertyName] = rec.value;
                        }
                    }
                    entityContext += JSON.stringify(Array.from(recordMap.values()), null, 2);
                }
            }
        }
        
        // Build the full prompt for AI
        const systemPrompt = `You are generating content for a professional report section.
Section Title: ${templateSection.title}
Section Description: ${templateSection.content || 'No specific description'}
Generation Rules: ${templateSection.generationRules || 'Write in a professional, clear manner'}

${contextText ? `CONTEXT DOCUMENTS:\n${contextText}\n\n` : ''}
${entityContext ? `ENTITY DATA:${entityContext}\n\n` : ''}

Based on the user's prompt and the context provided, generate appropriate content for this section.
Write in a professional tone suitable for a formal report.`;

        // Call OpenAI
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        console.log('[Generate] Calling OpenAI...');
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2000
        });
        
        const generatedContent = completion.choices[0]?.message?.content || '';
        const now = new Date().toISOString();
        
        console.log('[Generate] Content generated, length:', generatedContent.length);
        
        // Check if report_section exists, create or update
        const existingSection = await db.get(
            'SELECT id FROM report_sections WHERE reportId = ? AND templateSectionId = ?',
            [id, templateSectionId]
        );
        
        if (existingSection) {
            await db.run(`
                UPDATE report_sections 
                SET content = ?, userPrompt = ?, status = 'generated', generatedAt = ?
                WHERE id = ?
            `, [generatedContent, prompt, now, existingSection.id]);
            console.log('[Generate] Updated existing section:', existingSection.id);
        } else {
            const newSectionId = Math.random().toString(36).substr(2, 9);
            await db.run(`
                INSERT INTO report_sections (id, reportId, templateSectionId, content, userPrompt, status, generatedAt)
                VALUES (?, ?, ?, ?, ?, 'generated', ?)
            `, [newSectionId, id, templateSectionId, generatedContent, prompt, now]);
            console.log('[Generate] Created new section:', newSectionId);
        }
        
        // Update report timestamp
        await db.run('UPDATE reports SET updatedAt = ? WHERE id = ?', [now, id]);

        // Log generation in audit trail
        const userInfo = await db.get('SELECT name, email FROM users WHERE id = ?', [req.user.sub]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: userInfo?.name || req.user.email,
            userEmail: userInfo?.email || req.user.email,
            action: 'generate_content',
            resourceType: 'report',
            resourceId: id,
            resourceName: report.name,
            details: { sectionTitle: templateSection.title, prompt: prompt?.substring(0, 150) },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ content: generatedContent, generatedAt: now });
    } catch (error) {
        console.error('Error generating section:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

// Save/update section content manually
app.put('/api/reports/:id/sections/:sectionId', authenticateToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const { content } = req.body;
        const now = new Date().toISOString();
        
        console.log('[Update Section] Request:', { reportId: id, sectionId, contentLength: content?.length });
        
        const report = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Check if this is a report_section.id or a template_section.id
        // First try to find by report_section.id (the new way)
        const existingSection = await db.get(
            'SELECT id FROM report_sections WHERE id = ? AND reportId = ?',
            [sectionId, id]
        );
        
        if (existingSection) {
            console.log('[Update Section] Updating existing section:', existingSection.id);
            await db.run(`
                UPDATE report_sections 
                SET content = ?, status = 'edited', generatedAt = ?
                WHERE id = ?
            `, [content, now, existingSection.id]);
        } else {
            // If not found, try by templateSectionId (the old way for backward compatibility)
            const sectionByTemplate = await db.get(
                'SELECT id FROM report_sections WHERE reportId = ? AND templateSectionId = ?',
                [id, sectionId]
            );
            
            if (sectionByTemplate) {
                console.log('[Update Section] Updating by template:', sectionByTemplate.id);
                await db.run(`
                    UPDATE report_sections 
                    SET content = ?, status = 'edited', generatedAt = ?
                    WHERE id = ?
                `, [content, now, sectionByTemplate.id]);
            } else {
                console.log('[Update Section] Creating new section');
                const newSectionId = Math.random().toString(36).substr(2, 9);
                await db.run(`
                    INSERT INTO report_sections (id, reportId, templateSectionId, content, status, generatedAt)
                    VALUES (?, ?, ?, ?, 'edited', ?)
                `, [newSectionId, id, sectionId, content, now]);
            }
        }
        
        console.log('[Update Section] Section saved successfully');
        await db.run('UPDATE reports SET updatedAt = ? WHERE id = ?', [now, id]);
        
        res.json({ message: 'Section saved' });
    } catch (error) {
        console.error('Error saving section:', error);
        res.status(500).json({ error: 'Failed to save section' });
    }
});

// ==================== REPORT COMMENTS ENDPOINTS ====================

// Get all comments for a report
app.get('/api/reports/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const report = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        const comments = await db.all(`
            SELECT c.*, u.name as userName, u.email as userEmail,
                   resolver.name as resolvedByName
            FROM report_comments c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN users resolver ON c.resolvedBy = resolver.id
            WHERE c.reportId = ?
            ORDER BY c.createdAt DESC
        `, [id]);
        
        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Create a new comment
app.post('/api/reports/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sectionId, selectedText, startOffset, endOffset, commentText, suggestionText } = req.body;
        
        const report = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Get user info
        const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.sub]);
        
        const commentId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(`
            INSERT INTO report_comments (id, reportId, sectionId, userId, userName, selectedText, startOffset, endOffset, commentText, suggestionText, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
        `, [commentId, id, sectionId, req.user.sub, user?.name || 'Unknown', selectedText, startOffset, endOffset, commentText, suggestionText || null, now, now]);
        
        const comment = await db.get('SELECT * FROM report_comments WHERE id = ?', [commentId]);

        // Log comment creation in audit trail
        const reportInfo = await db.get('SELECT name FROM reports WHERE id = ?', [id]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: user?.name || req.user.email,
            userEmail: req.user.email,
            action: 'add_comment',
            resourceType: 'report',
            resourceId: id,
            resourceName: reportInfo?.name || id,
            details: { commentText: commentText?.substring(0, 100) },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json(comment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// Update a comment
app.put('/api/reports/:id/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const { commentText, suggestionText } = req.body;
        const now = new Date().toISOString();
        
        const comment = await db.get(`
            SELECT c.* FROM report_comments c
            JOIN reports r ON c.reportId = r.id
            WHERE c.id = ? AND r.id = ? AND r.organizationId = ?
        `, [commentId, id, req.user.orgId]);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Only the author can edit their comment
        if (comment.userId !== req.user.sub) {
            return res.status(403).json({ error: 'You can only edit your own comments' });
        }
        
        await db.run(`
            UPDATE report_comments SET commentText = ?, suggestionText = ?, updatedAt = ? WHERE id = ?
        `, [commentText, suggestionText || null, now, commentId]);
        
        res.json({ message: 'Comment updated' });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// Resolve/unresolve a comment
app.put('/api/reports/:id/comments/:commentId/resolve', authenticateToken, async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const { resolved } = req.body;
        const now = new Date().toISOString();
        
        const comment = await db.get(`
            SELECT c.* FROM report_comments c
            JOIN reports r ON c.reportId = r.id
            WHERE c.id = ? AND r.id = ? AND r.organizationId = ?
        `, [commentId, id, req.user.orgId]);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        if (resolved) {
            await db.run(`
                UPDATE report_comments SET status = 'resolved', resolvedAt = ?, resolvedBy = ?, updatedAt = ? WHERE id = ?
            `, [now, req.user.sub, now, commentId]);
        } else {
            await db.run(`
                UPDATE report_comments SET status = 'open', resolvedAt = NULL, resolvedBy = NULL, updatedAt = ? WHERE id = ?
            `, [now, commentId]);
        }

        // Log comment resolve/reopen in audit trail
        const reportInfo = await db.get('SELECT name FROM reports WHERE id = ?', [id]);
        const userInfo = await db.get('SELECT name, email FROM users WHERE id = ?', [req.user.sub]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: userInfo?.name || req.user.email,
            userEmail: userInfo?.email || req.user.email,
            action: resolved ? 'resolve_comment' : 'reopen_comment',
            resourceType: 'report',
            resourceId: id,
            resourceName: reportInfo?.name || id,
            details: { commentId },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ message: resolved ? 'Comment resolved' : 'Comment reopened' });
    } catch (error) {
        console.error('Error resolving comment:', error);
        res.status(500).json({ error: 'Failed to resolve comment' });
    }
});

// Delete a comment
app.delete('/api/reports/:id/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { id, commentId } = req.params;
        
        const comment = await db.get(`
            SELECT c.* FROM report_comments c
            JOIN reports r ON c.reportId = r.id
            WHERE c.id = ? AND r.id = ? AND r.organizationId = ?
        `, [commentId, id, req.user.orgId]);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Only the author can delete their comment
        if (comment.userId !== req.user.sub) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }
        
        await db.run('DELETE FROM report_comments WHERE id = ?', [commentId]);
        
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ==================== AI ASSISTANT ENDPOINTS ====================

// Configure storage for AI assistant files
const aiAssistantStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads', 'ai-assistant');
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

// Upload file for AI assistant context
app.post('/api/reports/:id/assistant/files', authenticateToken, aiUpload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify report belongs to organization
        const report = await db.get('SELECT * FROM reports WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Extract text from file if possible
        let extractedText = '';
        if (file.mimetype === 'application/pdf') {
            try {
                const dataBuffer = fs.readFileSync(file.path);
                const pdfData = await pdfParse(dataBuffer);
                extractedText = pdfData.text;
            } catch (err) {
                console.error('Error parsing PDF:', err);
            }
        } else if (file.mimetype === 'text/plain') {
            extractedText = fs.readFileSync(file.path, 'utf8');
        }
        
        const fileId = `aifile-${Date.now()}`;
        
        // Store file reference in database
        await db.run(`
            INSERT INTO ai_assistant_files (id, reportId, fileName, filePath, fileSize, extractedText, uploadedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [fileId, id, file.originalname, file.path, file.size, extractedText, new Date().toISOString()]);
        
        res.json({
            id: fileId,
            fileName: file.originalname,
            fileSize: file.size,
            uploadedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error uploading AI assistant file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Delete AI assistant file
app.delete('/api/reports/:id/assistant/files/:fileId', authenticateToken, async (req, res) => {
    try {
        const { id, fileId } = req.params;
        
        const file = await db.get(`
            SELECT af.* FROM ai_assistant_files af
            JOIN reports r ON af.reportId = r.id
            WHERE af.id = ? AND r.id = ? AND r.organizationId = ?
        `, [fileId, id, req.user.orgId]);
        
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Delete physical file
        if (fs.existsSync(file.filePath)) {
            fs.unlinkSync(file.filePath);
        }
        
        // Delete from database
        await db.run('DELETE FROM ai_assistant_files WHERE id = ?', [fileId]);
        
        res.json({ message: 'File deleted' });
    } catch (error) {
        console.error('Error deleting AI assistant file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// AI Assistant Chat endpoint
app.post('/api/reports/:id/assistant/chat', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { message, sectionId, contextFileIds, applyToContent } = req.body;
        
        console.log('[AI Assistant Chat] Request received:', { 
            reportId: id, 
            sectionId, 
            applyToContent, 
            messagePreview: message?.slice(0, 50) 
        });
        
        // Verify report belongs to organization
        const report = await db.get('SELECT * FROM reports WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Get all sections for context
        const sections = await db.all(`
            SELECT rs.id, rs.reportId, rs.templateSectionId, rs.content as generatedContent, 
                   rs.userPrompt, rs.status, rs.generatedAt, ts.title, ts.sortOrder 
            FROM report_sections rs 
            LEFT JOIN template_sections ts ON rs.templateSectionId = ts.id 
            WHERE rs.reportId = ? 
            ORDER BY ts.sortOrder
        `, [id]);
        
        console.log('[AI Assistant] Sections loaded:', sections.map(s => ({ id: s.id, title: s.title, hasContent: !!s.generatedContent })));
        
        // Get the specific section if provided
        const currentSection = sectionId ? sections.find(s => s.id === sectionId) : null;
        
        console.log('[AI Assistant] Looking for section:', sectionId);
        console.log('[AI Assistant] Available section IDs:', sections.map(s => s.id));
        
        if (currentSection) {
            console.log('[AI Assistant] Current section:', {
                title: currentSection.title,
                hasContent: !!currentSection.generatedContent,
                contentLength: currentSection.generatedContent?.length || 0
            });
        }
        
        // Get context files content
        let contextContent = '';
        if (contextFileIds && contextFileIds.length > 0) {
            const files = await db.all(`
                SELECT extractedText, fileName FROM ai_assistant_files 
                WHERE id IN (${contextFileIds.map(() => '?').join(',')}) AND reportId = ?
            `, [...contextFileIds, id]);
            
            contextContent = files.map(f => `[File: ${f.fileName}]\n${f.extractedText || '(No text extracted)'}`).join('\n\n');
        }
        
        // Build context for the AI
        const documentContext = sections.map(s => 
            `[Section: ${s.title}]\n${s.generatedContent || '(Empty)'}`
        ).join('\n\n---\n\n');
        
        // Check if user is asking for a suggestion/modification (English and Spanish)
        // OR if applyToContent mode is enabled (always treat as suggestion request)
        const keywordMatch = /suggest|improve|rewrite|modify|change|edit|fix|update|revise|mejorar|cambiar|modificar|editar|corregir|reescribir|traducir|translate|escribe|write|rehacer|actualizar/i.test(message);
        const isSuggestionRequest = applyToContent === true || keywordMatch;
        
        // Determine if we should force content generation mode
        const forceContentMode = applyToContent === true && currentSection && currentSection.generatedContent;
        
        console.log('[AI Assistant] Mode check:', {
            applyToContent,
            hasCurrentSection: !!currentSection,
            hasGeneratedContent: !!currentSection?.generatedContent,
            forceContentMode,
            isSuggestionRequest
        });
        
        // Prepare the prompt for OpenAI
        let systemPrompt;
        
        if (forceContentMode) {
            // When applyToContent is ON, ask AI to return ONLY the modified content
            systemPrompt = `You are an AI assistant that modifies document content based on user requests.

Current section: "${currentSection.title}"
Current content:
"""
${currentSection.generatedContent}
"""

${contextContent ? `Additional context files:\n${contextContent}\n\n` : ''}

CRITICAL INSTRUCTIONS:
- Apply the user's requested changes to the current content
- Return ONLY the complete modified content - nothing else
- Do NOT include explanations, introductions, or any text before or after the content
- Do NOT include phrases like "Here is the modified content:" or "Sure, here it is:"
- Just output the final content directly as if you were writing the document section
- Preserve the overall structure and tone unless specifically asked to change it
- If the request is unclear, make reasonable improvements while keeping the original meaning`;
        } else {
            systemPrompt = `You are an AI assistant helping users with document creation and review.
You have access to the full document with all its sections.

${contextContent ? `Additional context files provided:\n${contextContent}\n\n` : ''}

Current document sections:
${documentContext}

${currentSection ? `The user is currently viewing section: "${currentSection.title}"
Current content: ${currentSection.generatedContent || '(Empty)'}` : ''}

Instructions:
- Answer questions about the document content
- Help improve writing quality
- Suggest changes when asked
- Be concise and helpful
- If the user asks for changes to a section, provide the complete suggested content

${isSuggestionRequest && currentSection ? `
IMPORTANT: Since the user seems to be asking for a modification, if you want to suggest changes to the current section, 
respond with your explanation followed by a JSON block in this exact format:
\`\`\`suggestion
{
  "sectionId": "${currentSection.id}",
  "sectionTitle": "${currentSection.title}",
  "originalContent": "${(currentSection.generatedContent || '').replace(/"/g, '\\"').slice(0, 200)}...",
  "suggestedContent": "YOUR COMPLETE SUGGESTED CONTENT HERE"
}
\`\`\`
Only include this if you're making a concrete suggestion for content changes.
` : ''}`;
        }

        // Call OpenAI API
        const openaiApiKey = process.env.OPENAI_API_KEY;
        
        if (!openaiApiKey) {
            // Return a mock response for testing without API key
            let suggestionContent = null;
            if (isSuggestionRequest && currentSection && currentSection.generatedContent) {
                // Generate a meaningful mock suggestion based on the request
                const originalText = currentSection.generatedContent;
                let improvedText = originalText;
                
                // Simple transformations for demo purposes
                if (/translate|traducir|inglés|english/i.test(message)) {
                    improvedText = `[English translation of the content]\n\n${originalText}\n\n[This is a mock translation - connect OpenAI API for real translations]`;
                } else if (/mejorar|improve|better/i.test(message)) {
                    improvedText = `${originalText}\n\nAdditionally, this section has been enhanced with more professional language and clearer structure to improve readability and impact.`;
                } else if (/más largo|longer|expand|ampliar/i.test(message)) {
                    improvedText = `${originalText}\n\nFurthermore, expanding on the above points, it's important to note the following additional considerations and details that strengthen the overall narrative and provide more comprehensive coverage of the topic.`;
                } else if (/más corto|shorter|resume|summarize/i.test(message)) {
                    improvedText = originalText.split('.').slice(0, 2).join('.') + '.';
                } else {
                    improvedText = `${originalText}\n\n[Modified based on your request: "${message}"]`;
                }
                
                suggestionContent = {
                    sectionId: currentSection.id,
                    sectionTitle: currentSection.title,
                    originalContent: originalText,
                    suggestedContent: improvedText
                };
            }
            
            const mockResponse = {
                response: isSuggestionRequest && currentSection && currentSection.generatedContent
                    ? `I've prepared a suggested modification for the section "${currentSection.title}" based on your request. Please review the changes below and click Accept to apply them or Reject to keep the original content.`
                    : `I understand you're asking about the document. Based on the current content across ${sections.length} sections, I can help you improve or answer questions about any part of the document.\n\n${currentSection ? `You're currently viewing "${currentSection.title}".${currentSection.generatedContent ? ' Ask me to improve, translate, or modify this content.' : ' This section is empty - generate some content first.'}` : 'Please select a section for more specific assistance.'}`,
                suggestion: suggestionContent
            };
            return res.json(mockResponse);
        }
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        
        if (!openaiResponse.ok) {
            throw new Error('OpenAI API error');
        }
        
        const openaiData = await openaiResponse.json();
        const assistantResponse = openaiData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
        
        // Handle response based on mode
        let suggestion = null;
        let cleanResponse = assistantResponse;
        
        if (forceContentMode) {
            // In force content mode, the AI response IS the suggested content
            // Build the suggestion object programmatically
            suggestion = {
                sectionId: currentSection.id,
                sectionTitle: currentSection.title,
                originalContent: currentSection.generatedContent,
                suggestedContent: assistantResponse.trim()
            };
            
            // Don't save automatically - let the user Accept/Reject
            cleanResponse = `He preparado una sugerencia para la sección "${currentSection.title}". Revisa los cambios y haz clic en Aceptar para aplicarlos o Rechazar para descartarlos.`;
        } else {
            // Parse suggestion from response if present (legacy mode)
            const suggestionMatch = assistantResponse.match(/```suggestion\n([\s\S]*?)\n```/);
            if (suggestionMatch) {
                try {
                    suggestion = JSON.parse(suggestionMatch[1]);
                } catch (e) {
                    console.error('Error parsing suggestion:', e);
                }
            }
            // Clean response (remove suggestion block if present)
            cleanResponse = assistantResponse.replace(/```suggestion\n[\s\S]*?\n```/g, '').trim();
        }
        
        res.json({
            response: cleanResponse,
            suggestion
        });
        
        console.log('[AI Assistant] Response sent:', {
            hasSuggestion: !!suggestion,
            responseLength: cleanResponse?.length || 0
        });
        
    } catch (error) {
        console.error('Error in AI assistant chat:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// Stripe Webhook to handle subscription events
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        if (webhookSecret) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
            // For testing without webhook signature verification
            event = JSON.parse(req.body.toString());
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('[Stripe Webhook] Event received:', event.type);

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const orgId = session.metadata?.organizationId;
                const plan = session.metadata?.plan;

                if (orgId && plan) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    
                    await db.run(`
                        UPDATE organizations 
                        SET subscriptionPlan = ?, 
                            stripeSubscriptionId = ?,
                            subscriptionStatus = ?,
                            subscriptionCurrentPeriodEnd = ?
                        WHERE id = ?
                    `, [
                        plan,
                        subscription.id,
                        subscription.status,
                        new Date(subscription.current_period_end * 1000).toISOString(),
                        orgId
                    ]);
                    console.log(`[Stripe] Organization ${orgId} upgraded to ${plan}`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                const org = await db.get('SELECT id FROM organizations WHERE stripeCustomerId = ?', [customerId]);
                
                if (org) {
                    // Determine plan from price
                    let plan = 'free';
                    const priceId = subscription.items.data[0]?.price?.id;
                    if (priceId === STRIPE_PRICES.business) {
                        plan = 'business';
                    } else if (priceId === STRIPE_PRICES.pro) {
                        plan = 'pro';
                    }

                    await db.run(`
                        UPDATE organizations 
                        SET subscriptionPlan = ?,
                            subscriptionStatus = ?,
                            subscriptionCurrentPeriodEnd = ?
                        WHERE id = ?
                    `, [
                        plan,
                        subscription.status,
                        new Date(subscription.current_period_end * 1000).toISOString(),
                        org.id
                    ]);
                    console.log(`[Stripe] Subscription updated for org ${org.id}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;

                const org = await db.get('SELECT id FROM organizations WHERE stripeCustomerId = ?', [customerId]);
                
                if (org) {
                    await db.run(`
                        UPDATE organizations 
                        SET subscriptionPlan = 'free',
                            stripeSubscriptionId = NULL,
                            subscriptionStatus = 'cancelled'
                        WHERE id = ?
                    `, [org.id]);
                    console.log(`[Stripe] Subscription cancelled for org ${org.id}`);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const customerId = invoice.customer;

                const org = await db.get('SELECT id FROM organizations WHERE stripeCustomerId = ?', [customerId]);
                
                if (org) {
                    await db.run(`
                        UPDATE organizations 
                        SET subscriptionStatus = 'past_due'
                        WHERE id = ?
                    `, [org.id]);
                    console.log(`[Stripe] Payment failed for org ${org.id}`);
                }
                break;
            }
        }
    } catch (error) {
        console.error('[Stripe Webhook] Error processing event:', error);
    }

    res.json({ received: true });
});

// ==================== SLACK DATABASE ASSISTANT INTEGRATION ====================

// Helper function to send messages to Slack
async function sendSlackMessage(token, channel, text, threadTs = null) {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            channel,
            text,
            thread_ts: threadTs,
            unfurl_links: false,
            unfurl_media: false
        })
    });

    const data = await response.json();
    if (!data.ok) {
        console.error('[Slack] Failed to send message:', data.error);
        throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
}

// Get Slack integration status for an organization
app.get('/api/integrations/slack', authenticateToken, async (req, res) => {
    try {
        const org = await db.get(
            'SELECT slackBotToken, slackTeamId, slackTeamName, slackConnectedAt FROM organizations WHERE id = ?',
            [req.user.orgId]
        );

        if (!org || !org.slackBotToken) {
            return res.json({ connected: false });
        }

        res.json({
            connected: true,
            teamName: org.slackTeamName,
            teamId: org.slackTeamId,
            connectedAt: org.slackConnectedAt
        });
    } catch (error) {
        console.error('[Slack Integration] Error fetching status:', error);
        res.status(500).json({ error: 'Failed to fetch Slack integration status' });
    }
});

// Connect Slack to organization
app.post('/api/integrations/slack/connect', authenticateToken, async (req, res) => {
    try {
        const { botToken } = req.body;

        if (!botToken || !botToken.startsWith('xoxb-')) {
            return res.status(400).json({ error: 'Invalid bot token. It should start with xoxb-' });
        }

        // Verify the token by calling Slack API
        const authResponse = await fetch('https://slack.com/api/auth.test', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${botToken}`,
                'Content-Type': 'application/json'
            }
        });

        const authData = await authResponse.json();

        if (!authData.ok) {
            return res.status(400).json({ error: `Invalid token: ${authData.error}` });
        }

        // Save the token and team info
        await db.run(`
            UPDATE organizations 
            SET slackBotToken = ?, slackTeamId = ?, slackTeamName = ?, slackConnectedAt = ?
            WHERE id = ?
        `, [botToken, authData.team_id, authData.team, new Date().toISOString(), req.user.orgId]);

        console.log(`[Slack Integration] Connected org ${req.user.orgId} to team ${authData.team}`);

        res.json({
            success: true,
            teamName: authData.team,
            teamId: authData.team_id
        });
    } catch (error) {
        console.error('[Slack Integration] Error connecting:', error);
        res.status(500).json({ error: 'Failed to connect Slack' });
    }
});

// Disconnect Slack from organization
app.post('/api/integrations/slack/disconnect', authenticateToken, async (req, res) => {
    try {
        await db.run(`
            UPDATE organizations 
            SET slackBotToken = NULL, slackTeamId = NULL, slackTeamName = NULL, slackConnectedAt = NULL
            WHERE id = ?
        `, [req.user.orgId]);

        console.log(`[Slack Integration] Disconnected org ${req.user.orgId}`);

        res.json({ success: true });
    } catch (error) {
        console.error('[Slack Integration] Error disconnecting:', error);
        res.status(500).json({ error: 'Failed to disconnect Slack' });
    }
});

// Get the Slack webhook URL for setup
app.get('/api/integrations/slack/webhook-info', authenticateToken, async (req, res) => {
    const baseUrl = process.env.API_URL || 'http://localhost:3001';
    res.json({
        webhookUrl: `${baseUrl}/api/slack/database-assistant`,
        instructions: [
            "1. Go to api.slack.com/apps and create a new app",
            "2. In 'OAuth & Permissions', add these Bot Token Scopes: chat:write, app_mentions:read, im:history",
            "3. Install the app to your workspace and copy the Bot User OAuth Token",
            "4. Paste the token above and click Connect",
            "5. In 'Event Subscriptions', enable events and set the Request URL to:",
            `   ${baseUrl}/api/slack/database-assistant`,
            "6. Subscribe to bot events: app_mention, message.im",
            "7. Reinstall the app if prompted"
        ]
    });
});

// Slack Events endpoint - receives messages and queries the Database Assistant (MULTI-TENANT)
app.post('/api/slack/database-assistant', async (req, res) => {
    const slackEvent = req.body;

    // Slack URL verification challenge
    if (slackEvent.challenge) {
        console.log('[Slack DB Assistant] Responding to URL verification challenge');
        return res.status(200).json({ challenge: slackEvent.challenge });
    }

    // Acknowledge immediately to prevent Slack retries (3 second timeout)
    res.status(200).json({ ok: true });

    // Process the event asynchronously
    try {
        const event = slackEvent.event;
        const teamId = slackEvent.team_id;
        
        // Only process messages (not bot messages or message changes)
        if (!event || event.bot_id || event.subtype) {
            console.log('[Slack DB Assistant] Ignoring non-user message');
            return;
        }

        // Check for app_mention or direct message
        const isAppMention = event.type === 'app_mention';
        const isDirectMessage = event.channel_type === 'im';
        
        if (!isAppMention && !isDirectMessage) {
            console.log('[Slack DB Assistant] Not a mention or DM, ignoring');
            return;
        }

        // Find the organization by Slack team_id (MULTI-TENANT)
        const org = await db.get(
            'SELECT id, slackBotToken FROM organizations WHERE slackTeamId = ?',
            [teamId]
        );

        if (!org || !org.slackBotToken) {
            console.error(`[Slack DB Assistant] No organization found for team ${teamId}`);
            return;
        }

        const slackBotToken = org.slackBotToken;
        const orgId = org.id;

        // Extract the question (remove the @mention if present)
        let question = event.text || '';
        question = question.replace(/<@[A-Z0-9]+>/g, '').trim();

        if (!question) {
            console.log('[Slack DB Assistant] No question text found');
            return;
        }

        console.log(`[Slack DB Assistant] Processing question for org ${orgId}: "${question}"`);

        // Check OpenAI is configured
        if (!process.env.OPENAI_API_KEY) {
            await sendSlackMessage(slackBotToken, event.channel,
                "❌ AI service is not configured. Please contact your administrator.",
                event.ts
            );
            return;
        }

        // Fetch database context for the organization
        const entities = await db.all('SELECT * FROM entities WHERE organizationId = ?', [orgId]);
        
        if (entities.length === 0) {
            await sendSlackMessage(slackBotToken, event.channel,
                "📭 No database entities found. Please set up your database first in Intemic.",
                event.ts
            );
            return;
        }

        const databaseContext = {};
        
        for (const entity of entities) {
            const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entity.id]);
            const records = await db.all('SELECT * FROM records WHERE entityId = ?', [entity.id]);
            
            const recordsWithValues = await Promise.all(records.map(async (record) => {
                const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [record.id]);
                const valuesMap = {};
                
                for (const v of values) {
                    const prop = properties.find(p => p.id === v.propertyId);
                    const key = prop ? prop.name : v.propertyId;
                    valuesMap[key] = v.value;
                }
                
                return valuesMap;
            }));
            
            databaseContext[entity.name] = {
                description: entity.description,
                properties: properties.map(p => ({
                    name: p.name,
                    type: p.type
                })),
                recordCount: records.length,
                records: recordsWithValues.slice(0, 50)
            };
        }

        // Call OpenAI to answer the question
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const systemPrompt = `You are a helpful database assistant for Intemic platform, responding via Slack.

DATABASE SCHEMA AND DATA:
${JSON.stringify(databaseContext, null, 2)}

INSTRUCTIONS:
1. Answer questions about the data clearly and concisely
2. When counting records, be precise
3. Format your response for Slack (use *bold*, _italic_, bullet points with •)
4. Keep responses concise but informative (Slack has character limits)
5. If the question is unclear, ask for clarification
6. Be friendly and helpful

RESPONSE FORMAT:
- Use Slack markdown: *bold*, _italic_, \`code\`
- Use bullet points with • for lists
- Keep it under 2000 characters
- Be conversational`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question }
            ],
            temperature: 0.3,
            max_tokens: 800
        });

        const answer = completion.choices[0]?.message?.content || 'Sorry, I could not process your question.';

        // Send the response back to Slack
        await sendSlackMessage(slackBotToken, event.channel, answer, event.ts);
        console.log('[Slack DB Assistant] Response sent successfully');

    } catch (error) {
        console.error('[Slack DB Assistant] Error:', error);
        
        // Try to send error message if we have the token
        try {
            const teamId = req.body.team_id;
            if (teamId) {
                const org = await db.get('SELECT slackBotToken FROM organizations WHERE slackTeamId = ?', [teamId]);
                if (org?.slackBotToken && req.body.event?.channel) {
                    await sendSlackMessage(org.slackBotToken, req.body.event.channel,
                        "❌ Sorry, I encountered an error processing your question. Please try again.",
                        req.body.event.ts
                    );
                }
            }
        } catch (e) {
            console.error('[Slack DB Assistant] Failed to send error message:', e);
        }
    }
});
