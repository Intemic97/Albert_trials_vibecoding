const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const { WebSocketServer } = require('ws');
const { initDb } = require('./db');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cookieParser = require('cookie-parser');
const { register, login, logout, authenticateToken, getMe, getOrganizations, switchOrganization, getOrganizationUsers, inviteUser, updateProfile, requireAdmin, completeOnboarding } = require('./auth');

const app = express();
const server = http.createServer(app);
const PORT = 3001;

// ==================== WEBSOCKET SETUP ====================
const wss = new WebSocketServer({ server, path: '/ws' });

// Track users per workflow: { workflowId: Map<socketId, { ws, user, cursor }> }
const workflowRooms = new Map();

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
                case 'join': {
                    // User joins a workflow canvas
                    const { workflowId, orgId, user } = message;
                    
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
                                user: {
                                    id: user.id,
                                    name: user.name || user.email?.split('@')[0] || 'Anonymous',
                                    color: CURSOR_COLORS[colorIndex],
                                    profilePhoto: user.profilePhoto
                                },
                                cursor: null
                            });
                            
                            console.log(`[WS] User ${user.name || user.id} joined workflow ${workflowId} (${room.size} users)`);
                            
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
                                users: existingUsers,
                                yourId: socketId,
                                yourColor: CURSOR_COLORS[colorIndex]
                            }));
                            
                            // Notify others about new user (exclude other tabs of the same user)
                            broadcastToRoom(workflowId, {
                                type: 'user_joined',
                                id: socketId,
                                user: room.get(socketId).user
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
                        // Broadcast node movement to others
                        broadcastToRoom(currentWorkflowId, {
                            type: 'node_update',
                            nodeId,
                            x,
                            y,
                            movedBy: socketId
                        }, socketId);
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
        leaveRoom(socketId, currentWorkflowId);
    });
    
    ws.on('error', (err) => {
        console.error(`[WS] Error for socket ${socketId}:`, err);
        leaveRoom(socketId, currentWorkflowId);
    });
});

function broadcastToRoom(workflowId, message, excludeSocketId = null, excludeUserId = null) {
    if (!workflowRooms.has(workflowId)) return;
    
    const room = workflowRooms.get(workflowId);
    const messageStr = JSON.stringify(message);
    
    room.forEach((data, id) => {
        // Skip if this is the excluded socket
        if (id === excludeSocketId) return;
        // Skip if this user should be excluded (all their tabs)
        if (excludeUserId && data.user && data.user.id === excludeUserId) return;
        // Send if connection is open
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
        console.log(`[WS] User ${userData?.user?.name || socketId} left workflow ${workflowId} (${room.size - 1} users remaining)`);
        
        room.delete(socketId);
        
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

// ==================== END WEBSOCKET SETUP ====================

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
        // Allow common file types
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
            'image/jpeg',
            'image/png',
            'image/gif'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'), false);
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
app.use(express.json());
app.use(cookieParser());

let db;

// Initialize DB and start server
initDb().then(database => {
    db = database;
    console.log('Database initialized');

    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});

// --- Routes ---

// Auth Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/me', authenticateToken, getMe);
app.get('/api/auth/organizations', authenticateToken, getOrganizations);
app.post('/api/auth/switch-org', authenticateToken, switchOrganization);
app.get('/api/organization/users', authenticateToken, getOrganizationUsers);
app.post('/api/organization/invite', authenticateToken, inviteUser);
app.put('/api/profile', authenticateToken, updateProfile);
app.post('/api/auth/onboarding', authenticateToken, completeOnboarding);

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
    const { id, name, description, author, lastEdited, properties } = req.body;

    try {
        await db.run(
            'INSERT INTO entities (id, organizationId, name, description, author, lastEdited) VALUES (?, ?, ?, ?, ?, ?)',
            [id, req.user.orgId, name, description, author, lastEdited]
        );

        if (properties && properties.length > 0) {
            for (const prop of properties) {
                await db.run(
                    'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId) VALUES (?, ?, ?, ?, ?, ?)',
                    [prop.id, id, prop.name, prop.type, prop.defaultValue, prop.relatedEntityId]
                );
            }
        }

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
        await db.run('DELETE FROM entities WHERE id = ?', [id]);
        await db.run('DELETE FROM properties WHERE entityId = ?', [id]);
        res.json({ message: 'Entity deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete entity' });
    }
});

// POST add property
app.post('/api/properties', authenticateToken, async (req, res) => {
    const { id, entityId, name, type, defaultValue, relatedEntityId } = req.body;
    try {
        await db.run(
            'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId) VALUES (?, ?, ?, ?, ?, ?)',
            [id, entityId, name, type, defaultValue, relatedEntityId]
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

        if (values) {
            for (const [propId, val] of Object.entries(values)) {
                const existing = await db.get(
                    'SELECT id FROM record_values WHERE recordId = ? AND propertyId = ?',
                    [id, propId]
                );

                if (existing) {
                    await db.run(
                        'UPDATE record_values SET value = ? WHERE id = ?',
                        [String(val), existing.id]
                    );
                } else {
                    const valueId = Math.random().toString(36).substr(2, 9);
                    await db.run(
                        'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                        [valueId, id, propId, String(val)]
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
        'codecs', 'unicodedata', 'difflib', 'textwrap', 'pprint'
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
        const { prompt, mentionedEntityIds } = req.body;
        console.log('Widget Prompt:', prompt);

        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        // 1. Fetch data context (Reuse logic - ideally refactor into function)
        let contextData = {};
        if (mentionedEntityIds && mentionedEntityIds.length > 0) {
            const entityPromises = mentionedEntityIds.map(async (entityId) => {
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
            
            for (const entityId of mentionedEntityIds) {
                const relationProps = await db.all(
                    'SELECT relatedEntityId FROM properties WHERE entityId = ? AND type = ? AND relatedEntityId IS NOT NULL',
                    [entityId, 'relation']
                );
                relationProps.forEach(p => relatedEntityIds.add(p.relatedEntityId));
            }

            for (const entityId of mentionedEntityIds) {
                const incomingProps = await db.all(
                    'SELECT DISTINCT entityId FROM properties WHERE type = ? AND relatedEntityId = ?',
                    ['relation', entityId]
                );
                incomingProps.forEach(p => relatedEntityIds.add(p.entityId));
            }

            mentionedEntityIds.forEach(id => relatedEntityIds.delete(id));

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

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a data visualization expert.
            You have access to the following data context: ${JSON.stringify(contextData)}.
            Based on the user's prompt, generate a JSON configuration for a chart.
            
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
            
            Ensure the data is aggregated or formatted correctly for the chosen chart type.
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
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating dashboard:', error);
        res.status(500).json({ error: 'Failed to update dashboard' });
    }
});

app.delete('/api/dashboards/:id', authenticateToken, async (req, res) => {
    try {
        await db.run('DELETE FROM dashboards WHERE id = ? AND organizationId = ?', [req.params.id, req.user.orgId]);
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
        
        await db.run(
            'UPDATE dashboards SET isPublic = 1, shareToken = ?, updatedAt = ? WHERE id = ? AND organizationId = ?',
            [shareToken, now, req.params.id, req.user.orgId]
        );
        
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
        
        await db.run(
            'UPDATE dashboards SET isPublic = 0, shareToken = NULL, updatedAt = ? WHERE id = ? AND organizationId = ?',
            [now, req.params.id, req.user.orgId]
        );
        
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
            'SELECT id, title, description, config, position, createdAt FROM widgets WHERE dashboardId = ? ORDER BY position ASC',
            [req.params.id]
        );
        
        // Parse config JSON
        const parsedWidgets = widgets.map(w => ({
            ...w,
            config: JSON.parse(w.config || '{}')
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
        const { id: widgetId, title, description, config } = req.body;
        const now = new Date().toISOString();
        
        // Get max position
        const maxPos = await db.get('SELECT MAX(position) as maxPos FROM widgets WHERE dashboardId = ?', [req.params.id]);
        const position = (maxPos?.maxPos || 0) + 1;
        
        await db.run(
            'INSERT INTO widgets (id, dashboardId, title, description, config, position, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [widgetId, req.params.id, title, description || '', JSON.stringify(config), position, now]
        );
        
        // Update dashboard updatedAt
        await db.run('UPDATE dashboards SET updatedAt = ? WHERE id = ?', [now, req.params.id]);
        
        res.json({ id: widgetId, title, description, config, position, createdAt: now });
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
            'SELECT id, title, description, config, position FROM widgets WHERE dashboardId = ? ORDER BY position ASC',
            [dashboard.id]
        );
        
        const parsedWidgets = widgets.map(w => ({
            ...w,
            config: JSON.parse(w.config || '{}')
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

// Workflow Management Endpoints
app.get('/api/workflows', authenticateToken, async (req, res) => {
    try {
        const workflows = await db.all('SELECT id, name, createdAt, updatedAt, createdBy, createdByName, lastEditedBy, lastEditedByName FROM workflows WHERE organizationId = ? ORDER BY updatedAt DESC', [req.user.orgId]);
        res.json(workflows);
    } catch (error) {
        console.error('Error fetching workflows:', error);
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
});

app.get('/api/workflows/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        // Parse JSON data before sending
        workflow.data = JSON.parse(workflow.data);
        res.json(workflow);
    } catch (error) {
        console.error('Error fetching workflow:', error);
        res.status(500).json({ error: 'Failed to fetch workflow' });
    }
});

app.post('/api/workflows', authenticateToken, async (req, res) => {
    try {
        const { name, data, createdByName } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        // Store data as JSON string
        await db.run(
            'INSERT INTO workflows (id, organizationId, name, data, createdAt, updatedAt, createdBy, createdByName) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, req.user.orgId, name, JSON.stringify(data), now, now, req.user.sub, createdByName || 'Unknown']
        );

        res.json({ id, name, createdAt: now, updatedAt: now, createdBy: req.user.sub, createdByName: createdByName || 'Unknown' });
    } catch (error) {
        console.error('Error saving workflow:', error);
        res.status(500).json({ error: 'Failed to save workflow' });
    }
});

app.put('/api/workflows/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, data, lastEditedByName } = req.body;
        const now = new Date().toISOString();

        await db.run(
            'UPDATE workflows SET name = ?, data = ?, updatedAt = ?, lastEditedBy = ?, lastEditedByName = ? WHERE id = ? AND organizationId = ?',
            [name, JSON.stringify(data), now, req.user.sub, lastEditedByName || 'Unknown', id, req.user.orgId]
        );

        res.json({ message: 'Workflow updated' });
    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(500).json({ error: 'Failed to update workflow' });
    }
});

app.delete('/api/workflows/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.run('DELETE FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        res.json({ message: 'Workflow deleted' });
    } catch (error) {
        console.error('Error deleting workflow:', error);
        res.status(500).json({ error: 'Failed to delete workflow' });
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
