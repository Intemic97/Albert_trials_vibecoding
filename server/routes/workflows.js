/**
 * Workflow Routes
 * 
 * Handles: workflows CRUD, webhooks, public forms, execution,
 * execution history, Prefect health, approvals.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId, logActivity, logSecurityEvent } = require('../utils/helpers');
const { openDb } = require('../db');
const { WorkflowExecutor } = require('../workflowExecutor');
const { prefectClient } = require('../prefectClient');
const { getPollingService } = require('../executionPolling');
const workflowScheduler = require('../services/workflowScheduler');

// ==================== RATE LIMITING FOR PUBLIC ENDPOINTS ====================
const PUBLIC_RATE_LIMIT_PER_MIN = parseInt(process.env.PUBLIC_RATE_LIMIT_PER_MIN || '30', 10);
const publicRateLimitMap = new Map();

// Clean up stale entries every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of publicRateLimitMap.entries()) {
        if (now - data.windowStart > 120000) publicRateLimitMap.delete(key);
    }
}, 60000);

function publicRateLimit(req, res, next) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    let data = publicRateLimitMap.get(ip);
    if (!data || now - data.windowStart > 60000) {
        data = { count: 0, windowStart: now };
        publicRateLimitMap.set(ip, data);
    }
    data.count++;
    if (data.count > PUBLIC_RATE_LIMIT_PER_MIN) {
        console.warn(`[SECURITY] Rate limit exceeded for IP ${ip} on public endpoint ${req.path}`);
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
}

module.exports = function({ db, broadcastToOrganization }) {

router.get('/workflows', authenticateToken, async (req, res) => {
    try {
        const workflows = await db.all('SELECT id, name, createdAt, updatedAt, createdBy, createdByName, lastEditedBy, lastEditedByName, tags, publishedVersionId, isPublic FROM workflows WHERE organizationId = ? ORDER BY updatedAt DESC', [req.user.orgId]);
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

router.get('/workflows/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // First, try to get the workflow from user's organization
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!workflow) {
            // Check if workflow exists in another org (cross-tenant attempt)
            const exists = await db.get('SELECT id, organizationId FROM workflows WHERE id = ?', [id]);
            if (exists) {
                logSecurityEvent(db, {
                    organizationId: req.user.orgId,
                    userId: req.user.sub,
                    userEmail: req.user.email,
                    action: 'cross_tenant_access_blocked',
                    resourceType: 'workflow',
                    resourceId: id,
                    details: { targetOrg: exists.organizationId, endpoint: 'GET /workflows/:id' },
                    ipAddress: req.ip || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            }
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

router.post('/workflows', authenticateToken, async (req, res) => {
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

        // Sync schedule config if workflow has Schedule trigger
        try {
            await workflowScheduler.syncWorkflowSchedule(db, id, req.user.orgId, data);
        } catch (schedErr) {
            console.warn('[WorkflowScheduler] Sync failed:', schedErr.message);
        }

        res.json({ id, name, tags: tags || [], createdAt: now, updatedAt: now, createdBy: req.user.sub, createdByName: createdByName || 'Unknown' });
    } catch (error) {
        console.error('Error saving workflow:', error);
        res.status(500).json({ error: 'Failed to save workflow' });
    }
});

router.put('/workflows/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, data, tags, lastEditedByName, activeVersionNumber } = req.body;
        const now = new Date().toISOString();

        // Build dynamic update – include activeVersionNumber when explicitly provided
        const hasActiveVersion = activeVersionNumber !== undefined;
        const sql = hasActiveVersion
            ? 'UPDATE workflows SET name = ?, data = ?, tags = ?, updatedAt = ?, lastEditedBy = ?, lastEditedByName = ?, activeVersionNumber = ? WHERE id = ? AND organizationId = ?'
            : 'UPDATE workflows SET name = ?, data = ?, tags = ?, updatedAt = ?, lastEditedBy = ?, lastEditedByName = ? WHERE id = ? AND organizationId = ?';
        const params = hasActiveVersion
            ? [name, JSON.stringify(data), tags ? JSON.stringify(tags) : null, now, req.user.sub, lastEditedByName || 'Unknown', activeVersionNumber, id, req.user.orgId]
            : [name, JSON.stringify(data), tags ? JSON.stringify(tags) : null, now, req.user.sub, lastEditedByName || 'Unknown', id, req.user.orgId];
        await db.run(sql, params);

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

        // Sync schedule config for workflows with Schedule trigger
        try {
            await workflowScheduler.syncWorkflowSchedule(db, id, req.user.orgId, data);
        } catch (schedErr) {
            console.warn('[WorkflowScheduler] Sync failed:', schedErr.message);
        }

        res.json({ message: 'Workflow updated' });
    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(500).json({ error: 'Failed to update workflow' });
    }
});

router.delete('/workflows/:id', authenticateToken, async (req, res) => {
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

// Toggle workflow public access (for public forms)
router.put('/workflows/:id/public-access', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublic } = req.body;

        // Verify workflow belongs to user's organization
        const workflow = await db.get('SELECT id, name FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        await db.run('UPDATE workflows SET isPublic = ? WHERE id = ? AND organizationId = ?', [isPublic ? 1 : 0, id, req.user.orgId]);

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: isPublic ? 'make_public' : 'make_private',
            resourceType: 'workflow',
            resourceId: id,
            resourceName: workflow.name,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ message: `Workflow ${isPublic ? 'made public' : 'made private'}`, isPublic: !!isPublic });
    } catch (error) {
        console.error('Error toggling workflow public access:', error);
        res.status(500).json({ error: 'Failed to update workflow public access' });
    }
});

// Request access to a workflow from another organization
router.post('/workflows/:id/request-access', authenticateToken, async (req, res) => {
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

// Receive webhook and trigger workflow execution (rate limited)
router.post('/webhook/:workflowId', publicRateLimit, async (req, res) => {
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

        // If workflow has a webhookResponse node, use its configured response
        if (result.webhookResponse) {
            const wr = result.webhookResponse;
            // Set custom headers if any
            if (wr.headers && typeof wr.headers === 'object') {
                for (const [key, value] of Object.entries(wr.headers)) {
                    res.setHeader(key, value);
                }
            }
            return res.status(wr.statusCode || 200).json(wr.body);
        }

        // Default response (no webhookResponse node)
        res.json({
            success: true,
            executionId: result.executionId,
            status: result.status,
            results: result.results,
            message: 'Webhook processed successfully'
        });
    } catch (error) {
        console.error('[Webhook] Error:', error);
        res.status(500).json({ error: error.message || 'Webhook processing failed' });
    }
});

// Webhook with custom token for security (rate limited)
router.post('/webhook/:workflowId/:token', publicRateLimit, async (req, res) => {
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

        // If workflow has a webhookResponse node, use its configured response
        if (result.webhookResponse) {
            const wr = result.webhookResponse;
            if (wr.headers && typeof wr.headers === 'object') {
                for (const [key, value] of Object.entries(wr.headers)) {
                    res.setHeader(key, value);
                }
            }
            return res.status(wr.statusCode || 200).json(wr.body);
        }

        // Default response (no webhookResponse node)
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
router.get('/workflow/:id/webhook-url', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const baseUrl = process.env.API_URL || process.env.FRONTEND_URL?.replace(/:\d+/, ':3001') || 'http://localhost:3001';
        
        // Generate a secure HMAC-SHA256 token using env secret (NOT hardcoded)
        const crypto = require('crypto');
        const webhookSecret = process.env.WEBHOOK_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const token = crypto.createHmac('sha256', webhookSecret).update(id).digest('hex').substring(0, 24);

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

// Debug endpoint to see workflow data (protected - requires auth + org isolation)
router.get('/workflow/:id/debug', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        
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

// Get workflow info for public form (no auth required - but workflow must be marked as public)
router.get('/workflow/:id/public', publicRateLimit, async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await db.get('SELECT id, name, data, isPublic FROM workflows WHERE id = ?', [id]);
        
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // SECURITY: Only serve workflow data if explicitly marked as public
        if (!workflow.isPublic) {
            return res.status(403).json({ error: 'This workflow is not available publicly' });
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

// Run workflow from public form (no auth required, but workflow must be marked as public + rate limited)
router.post('/workflow/:id/run-public', publicRateLimit, async (req, res) => {
    try {
        const { id } = req.params;
        const { inputs } = req.body; // { nodeId: value, ... }

        // Get workflow to retrieve organizationId
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [id]);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // SECURITY: Only allow execution if workflow is explicitly marked as public
        if (!workflow.isPublic) {
            console.warn(`[SECURITY] Blocked public execution attempt on non-public workflow ${id} from IP ${req.ip}`);
            return res.status(403).json({ error: 'This workflow is not available for public execution' });
        }

        console.log(`[WorkflowExecutor] Public execution started for workflow ${id}`);

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
router.post('/workflow/:id/execute', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { inputs, usePrefect, versionNumber } = req.body;

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

        // Compute triggeredByName once for both execution paths
        // Look up user's name from DB for reliability (JWT may not always have it)
        let triggeredByName = req.user.name || req.user.email?.split('@')[0] || 'Unknown';
        try {
            const execUser = await db.get('SELECT name FROM users WHERE id = ?', [req.user.sub]);
            if (execUser?.name) triggeredByName = execUser.name;
        } catch (e) { /* ignore */ }

        // Check if we should use Prefect service (background execution)
        const shouldUsePrefect = usePrefect !== false; // Default to true

        if (shouldUsePrefect) {
            console.log(`[WorkflowExecutor] Delegating workflow ${id} to Prefect service (background mode)`);
            
            try {
                // Delegate to Prefect microservice for background execution
                const result = await prefectClient.executeWorkflow(id, inputs || {}, req.user.orgId);

                // Store triggeredByName and versionNumber in the execution record
                if (result.executionId) {
                    try {
                        await db.run(
                            'UPDATE workflow_executions SET triggeredByName = ?, versionNumber = ? WHERE id = ?',
                            [triggeredByName, versionNumber != null ? versionNumber : null, result.executionId]
                        );
                    } catch (e) { /* ignore */ }
                }

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

        const executor = new WorkflowExecutor(db, null, req.user.orgId, req.user.sub, triggeredByName);
        const result = await executor.executeWorkflow(id, inputs || {}, req.user.orgId, null, triggeredByName, versionNumber != null ? versionNumber : null);

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

// Get execution status (authenticated + org-scoped)
router.get('/executions/:executionId', authenticateToken, async (req, res) => {
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
                'SELECT * FROM workflow_executions WHERE id = ? AND organizationId = ?',
                [executionId, req.user.orgId]
            );
            
            if (!execution) {
                // Check cross-tenant attempt
                const exists = await db.get('SELECT id, organizationId FROM workflow_executions WHERE id = ?', [executionId]);
                if (exists) {
                    logSecurityEvent(db, {
                        organizationId: req.user.orgId,
                        userId: req.user.sub,
                        userEmail: req.user.email,
                        action: 'cross_tenant_access_blocked',
                        resourceType: 'workflow_execution',
                        resourceId: executionId,
                        details: { targetOrg: exists.organizationId, endpoint: 'GET /executions/:executionId' },
                        ipAddress: req.ip || req.headers['x-forwarded-for'],
                        userAgent: req.headers['user-agent']
                    });
                }
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
router.get('/executions/polling/active', authenticateToken, async (req, res) => {
    const pollingService = getPollingService();
    if (pollingService) {
        res.json({
            activeExecutions: pollingService.getActiveExecutions()
        });
    } else {
        res.json({ activeExecutions: [] });
    }
});

// Cancel a running execution (org-scoped)
router.post('/executions/:executionId/cancel', authenticateToken, async (req, res) => {
    try {
        const { executionId } = req.params;
        
        console.log(`[Execution] Cancel request for: ${executionId}`);
        
        // Verify execution belongs to user's organization FIRST
        const dbConn = await openDb();
        const execCheck = await dbConn.get(
            'SELECT id, organizationId, workflowId, status FROM workflow_executions WHERE id = ?',
            [executionId]
        );
        
        if (!execCheck || execCheck.organizationId !== req.user.orgId) {
            if (execCheck) {
                logSecurityEvent(dbConn, {
                    organizationId: req.user.orgId,
                    userId: req.user.sub,
                    userEmail: req.user.email,
                    action: 'cross_tenant_cancel_blocked',
                    resourceType: 'workflow_execution',
                    resourceId: executionId,
                    details: { targetOrg: execCheck.organizationId, endpoint: 'POST /executions/:executionId/cancel' },
                    ipAddress: req.ip || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            }
            return res.status(404).json({ error: 'Execution not found' });
        }
        
        // Try Prefect service first
        try {
            const result = await prefectClient.cancelExecution(executionId);
            
            // Stop polling if active
            const pollingService = getPollingService();
            if (pollingService) {
                pollingService.stopPolling(executionId);
            }
            
            // Broadcast cancellation via WebSocket
            broadcastToOrganization(req.user.orgId, {
                type: 'execution_cancelled',
                executionId,
                workflowId: execCheck.workflowId,
                message: 'Execution cancelled by user'
            });
            
            return res.json(result);
        } catch (prefectError) {
            console.warn('[Execution] Prefect cancel failed, trying local:', prefectError.message);
            
            if (!['pending', 'running'].includes(execCheck.status)) {
                return res.json({
                    success: false,
                    executionId,
                    message: `Cannot cancel execution with status '${execCheck.status}'`,
                    previousStatus: execCheck.status
                });
            }
            
            await dbConn.run(
                "UPDATE workflow_executions SET status = 'cancelled', error = 'Execution cancelled by user' WHERE id = ? AND organizationId = ?",
                [executionId, req.user.orgId]
            );
            
            // Broadcast cancellation
            broadcastToOrganization(req.user.orgId, {
                type: 'execution_cancelled',
                executionId,
                workflowId: execCheck.workflowId,
                message: 'Execution cancelled by user'
            });
            
            return res.json({
                success: true,
                executionId,
                message: 'Execution cancelled successfully',
                previousStatus: execCheck.status
            });
        }
    } catch (error) {
        console.error('Error cancelling execution:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel execution' });
    }
});

// Execute a single node (authenticated + org-scoped)
router.post('/workflow/:id/execute-node', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nodeId, nodeType, node, inputData, recursive } = req.body;

        if (!nodeId) {
            return res.status(400).json({ error: 'nodeId is required' });
        }

        // Verify workflow belongs to user's organization
        const wfCheck = await db.get('SELECT id, organizationId FROM workflows WHERE id = ?', [id]);
        if (!wfCheck || wfCheck.organizationId !== req.user.orgId) {
            if (wfCheck) {
                logSecurityEvent(db, {
                    organizationId: req.user.orgId,
                    userId: req.user.sub,
                    userEmail: req.user.email,
                    action: 'cross_tenant_execute_blocked',
                    resourceType: 'workflow',
                    resourceId: id,
                    details: { targetOrg: wfCheck.organizationId, endpoint: 'POST /workflow/:id/execute-node' },
                    ipAddress: req.ip || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            }
            return res.status(404).json({ error: 'Workflow not found' });
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

// Get execution status (works for both local and Prefect executions, org-scoped)
router.get('/workflow/execution/:execId', authenticateToken, async (req, res) => {
    try {
        const { execId } = req.params;
        const execution = await db.get('SELECT * FROM workflow_executions WHERE id = ? AND organizationId = ?', [execId, req.user.orgId]);

        if (!execution) {
            // Check cross-tenant attempt
            const exists = await db.get('SELECT id, organizationId FROM workflow_executions WHERE id = ?', [execId]);
            if (exists) {
                logSecurityEvent(db, {
                    organizationId: req.user.orgId,
                    userId: req.user.sub,
                    userEmail: req.user.email,
                    action: 'cross_tenant_access_blocked',
                    resourceType: 'workflow_execution',
                    resourceId: execId,
                    details: { targetOrg: exists.organizationId, endpoint: 'GET /workflow/execution/:execId' },
                    ipAddress: req.ip || req.headers['x-forwarded-for'],
                    userAgent: req.headers['user-agent']
                });
            }
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

// Get execution logs (works for both local and Prefect executions, org-scoped)
router.get('/workflow/execution/:execId/logs', authenticateToken, async (req, res) => {
    try {
        const { execId } = req.params;
        
        // Verify execution belongs to user's organization
        const execCheck = await db.get('SELECT organizationId FROM workflow_executions WHERE id = ? AND organizationId = ?', [execId, req.user.orgId]);
        if (!execCheck) {
            return res.status(404).json({ error: 'Execution not found' });
        }
        
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
router.get('/prefect/health', authenticateToken, async (req, res) => {
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

// Get execution history for a workflow (authenticated + org isolation)
router.get('/workflow/:id/executions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 20;

        // SECURITY: Verify the workflow belongs to the user's organization
        const workflow = await db.get('SELECT id FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        
        const executions = await db.all(`
            SELECT id, status, triggerType, inputs, nodeResults, finalOutput, createdAt, startedAt, completedAt, error, triggeredByName, versionNumber
            FROM workflow_executions 
            WHERE workflowId = ? AND organizationId = ?
            ORDER BY createdAt DESC
            LIMIT ?
        `, [id, req.user.orgId, limit]);

        // Parse JSON fields
        const parsed = executions.map(e => ({
            ...e,
            inputs: e.inputs ? JSON.parse(e.inputs) : null,
            nodeResults: e.nodeResults ? JSON.parse(e.nodeResults) : null,
            finalOutput: e.finalOutput ? JSON.parse(e.finalOutput) : null,
            triggeredByName: e.triggeredByName || null,
            versionNumber: e.versionNumber || null
        }));

        res.json(parsed);
    } catch (error) {
        console.error('Error fetching executions:', error);
        res.status(500).json({ error: 'Failed to fetch executions' });
    }
});

// Overview statistics endpoint
router.get('/overview/stats', authenticateToken, async (req, res) => {
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

// Cancel execution (org-scoped)
router.post('/workflow/execution/:execId/cancel', authenticateToken, async (req, res) => {
    try {
        const { execId } = req.params;
        
        // Org-scoped: only cancel executions belonging to user's org
        const result = await db.run(
            'UPDATE workflow_executions SET status = ?, completedAt = ? WHERE id = ? AND organizationId = ? AND status IN (?, ?)',
            ['cancelled', new Date().toISOString(), execId, req.user.orgId, 'pending', 'running']
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Execution not found or already completed' });
        }

        res.json({ success: true, message: 'Execution cancelled' });
    } catch (error) {
        console.error('Error cancelling execution:', error);
        res.status(500).json({ error: 'Failed to cancel execution' });
    }
});

// Resume paused execution (for human approval, org-scoped)
router.post('/workflow/execution/:execId/resume', authenticateToken, async (req, res) => {
    try {
        const { execId } = req.params;
        const { approved } = req.body;

        // Org-scoped: only resume executions belonging to user's org
        const execution = await db.get('SELECT * FROM workflow_executions WHERE id = ? AND organizationId = ?', [execId, req.user.orgId]);
        
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
router.get('/pending-approvals', authenticateToken, async (req, res) => {
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

router.post('/pending-approvals', authenticateToken, async (req, res) => {
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

router.post('/pending-approvals/:id/approve', authenticateToken, async (req, res) => {
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

router.post('/pending-approvals/:id/reject', authenticateToken, async (req, res) => {
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

// Notify assigned user via email for human approval (uses Resend)
router.post('/workflow/notify-approval-email', authenticateToken, async (req, res) => {
    try {
        const { assignedUserId, assignedUserName, nodeLabel, workflowId, workflowName } = req.body;
        if (!assignedUserId) {
            return res.status(400).json({ error: 'assignedUserId is required' });
        }

        // Look up user's email
        const targetUser = await db.get('SELECT email FROM users WHERE id = ?', [assignedUserId]);
        if (!targetUser || !targetUser.email) {
            return res.status(404).json({ error: 'User email not found' });
        }

        // If workflowName not provided, try to fetch it from DB
        let wfName = workflowName;
        if (!wfName && workflowId) {
            const wf = await db.get('SELECT name FROM workflows WHERE id = ?', [workflowId]);
            wfName = wf?.name || 'Workflow';
        }
        wfName = wfName || 'Workflow';

        const APP_URL = process.env.APP_URL || 'http://localhost:5173';
        const workflowLink = workflowId ? `${APP_URL}/workflow/${workflowId}` : APP_URL;

        const { sendEmail } = require('../utils/emailService');
        const result = await sendEmail({
            to: targetUser.email,
            subject: `Approval required: ${nodeLabel || 'Workflow step'} — ${wfName}`,
            html: `
                <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 20px;">
                    <div style="text-align: center; margin-bottom: 28px;">
                        <h1 style="color: #0d9488; margin: 0; font-size: 22px;">Approval Required</h1>
                    </div>
                    <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                        Hi ${assignedUserName || 'there'},
                    </p>
                    <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                        The step <strong>"${nodeLabel || 'Human Approval'}"</strong> in workflow
                        <strong>"${wfName}"</strong> is waiting for your approval.
                    </p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${workflowLink}" style="display: inline-block; padding: 12px 28px; background-color: #0d9488; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                            Open Workflow
                        </a>
                    </div>
                    <p style="color: #6b7280; font-size: 13px; line-height: 1.5; text-align: center;">
                        Or copy this link into your browser:<br/>
                        <a href="${workflowLink}" style="color: #0d9488; word-break: break-all;">${workflowLink}</a>
                    </p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #9ca3af; text-align: center;">This is an automated notification from Intemic.</p>
                </div>
            `,
        });

        res.json({ sent: result.success, provider: result.provider, error: result.error });
    } catch (error) {
        console.error('Error sending approval email:', error);
        res.status(500).json({ error: 'Failed to send approval email' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW VERSION CONTROL
// ═══════════════════════════════════════════════════════════════════════════

// List all versions for a workflow
router.get('/workflows/:id/versions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const versions = await db.all(
            `SELECT id, workflowId, version, name, description, createdBy, createdByName, createdAt, isProduction
             FROM workflow_versions
             WHERE workflowId = ? AND organizationId = ?
             ORDER BY version DESC`,
            [id, req.user.orgId]
        );
        res.json(versions);
    } catch (error) {
        console.error('Error fetching workflow versions:', error);
        res.status(500).json({ error: 'Failed to fetch versions' });
    }
});

// Get a specific version (includes full data)
router.get('/workflows/:id/versions/:versionId', authenticateToken, async (req, res) => {
    try {
        const { id, versionId } = req.params;
        const version = await db.get(
            `SELECT * FROM workflow_versions WHERE id = ? AND workflowId = ? AND organizationId = ?`,
            [versionId, id, req.user.orgId]
        );
        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }
        version.data = JSON.parse(version.data);
        res.json(version);
    } catch (error) {
        console.error('Error fetching version:', error);
        res.status(500).json({ error: 'Failed to fetch version' });
    }
});

// Create a new version snapshot (called on explicit save)
router.post('/workflows/:id/versions', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        // Get the current workflow data
        const workflow = await db.get(
            'SELECT * FROM workflows WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        // Determine next version number
        const lastVersion = await db.get(
            'SELECT MAX(version) as maxVer FROM workflow_versions WHERE workflowId = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        const nextVersion = (lastVersion?.maxVer || 0) + 1;

        const versionId = generateId();
        const now = new Date().toISOString();
        const createdByName = req.body.createdByName || req.user.email;
        const versionName = name || `v${nextVersion}`;

        await db.run(
            `INSERT INTO workflow_versions (id, workflowId, organizationId, version, name, data, description, createdBy, createdByName, createdAt, isProduction)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [versionId, id, req.user.orgId, nextVersion, versionName, workflow.data, description || null, req.user.sub, createdByName, now]
        );

        // Set activeVersionNumber on the workflow to the newly created version
        await db.run(
            'UPDATE workflows SET activeVersionNumber = ? WHERE id = ? AND organizationId = ?',
            [nextVersion, id, req.user.orgId]
        );

        res.json({
            id: versionId,
            version: nextVersion,
            name: versionName,
            description: description || null,
            createdBy: req.user.sub,
            createdByName,
            createdAt: now,
            isProduction: 0
        });
    } catch (error) {
        console.error('Error creating version:', error);
        res.status(500).json({ error: 'Failed to create version' });
    }
});

// Publish a version (set it as the production version)
router.put('/workflows/:id/versions/:versionId/publish', authenticateToken, async (req, res) => {
    try {
        const { id, versionId } = req.params;

        // Verify version exists
        const version = await db.get(
            'SELECT id, version FROM workflow_versions WHERE id = ? AND workflowId = ? AND organizationId = ?',
            [versionId, id, req.user.orgId]
        );
        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }

        // Unset any current production version for this workflow
        await db.run(
            'UPDATE workflow_versions SET isProduction = 0 WHERE workflowId = ? AND organizationId = ?',
            [id, req.user.orgId]
        );

        // Set this version as production
        await db.run(
            'UPDATE workflow_versions SET isProduction = 1 WHERE id = ?',
            [versionId]
        );

        // Update workflow's publishedVersionId
        await db.run(
            'UPDATE workflows SET publishedVersionId = ? WHERE id = ? AND organizationId = ?',
            [versionId, id, req.user.orgId]
        );

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'publish',
            resourceType: 'workflow_version',
            resourceId: versionId,
            resourceName: `v${version.version}`,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Version published', versionId, version: version.version });
    } catch (error) {
        console.error('Error publishing version:', error);
        res.status(500).json({ error: 'Failed to publish version' });
    }
});

// Unpublish (remove from production)
router.put('/workflows/:id/versions/:versionId/unpublish', authenticateToken, async (req, res) => {
    try {
        const { id, versionId } = req.params;

        await db.run(
            'UPDATE workflow_versions SET isProduction = 0 WHERE id = ? AND workflowId = ? AND organizationId = ?',
            [versionId, id, req.user.orgId]
        );
        await db.run(
            'UPDATE workflows SET publishedVersionId = NULL WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );

        res.json({ message: 'Version unpublished' });
    } catch (error) {
        console.error('Error unpublishing version:', error);
        res.status(500).json({ error: 'Failed to unpublish version' });
    }
});

// Delete a version
router.delete('/workflows/:id/versions/:versionId', authenticateToken, async (req, res) => {
    try {
        const { id, versionId } = req.params;

        const version = await db.get(
            'SELECT id, version, isProduction FROM workflow_versions WHERE id = ? AND workflowId = ? AND organizationId = ?',
            [versionId, id, req.user.orgId]
        );
        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }
        if (version.isProduction) {
            return res.status(400).json({ error: 'Cannot delete the production version. Unpublish it first.' });
        }

        await db.run('DELETE FROM workflow_versions WHERE id = ?', [versionId]);

        // If activeVersionNumber matches the deleted version, clear it
        const wf = await db.get('SELECT activeVersionNumber FROM workflows WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (wf && wf.activeVersionNumber === version.version) {
            await db.run('UPDATE workflows SET activeVersionNumber = NULL WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        }

        res.json({ message: 'Version deleted', versionId, version: version.version });
    } catch (error) {
        console.error('Error deleting version:', error);
        res.status(500).json({ error: 'Failed to delete version' });
    }
});

// Restore a version (loads its data into the current workflow)
router.post('/workflows/:id/versions/:versionId/restore', authenticateToken, async (req, res) => {
    try {
        const { id, versionId } = req.params;

        const version = await db.get(
            'SELECT * FROM workflow_versions WHERE id = ? AND workflowId = ? AND organizationId = ?',
            [versionId, id, req.user.orgId]
        );
        if (!version) {
            return res.status(404).json({ error: 'Version not found' });
        }

        const now = new Date().toISOString();
        const lastEditedByName = req.body.lastEditedByName || req.user.email;

        // Update the workflow with the version's data and set activeVersionNumber
        await db.run(
            'UPDATE workflows SET data = ?, updatedAt = ?, lastEditedBy = ?, lastEditedByName = ?, activeVersionNumber = ? WHERE id = ? AND organizationId = ?',
            [version.data, now, req.user.sub, lastEditedByName, version.version, id, req.user.orgId]
        );

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: lastEditedByName,
            userEmail: req.user.email,
            action: 'restore',
            resourceType: 'workflow_version',
            resourceId: versionId,
            resourceName: `v${version.version}`,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        // Return the restored data so frontend can update
        const restoredData = JSON.parse(version.data);
        res.json({ message: 'Version restored', data: restoredData, version: version.version });
    } catch (error) {
        console.error('Error restoring version:', error);
        res.status(500).json({ error: 'Failed to restore version' });
    }
});

// HTTP Proxy Endpoint

    return router;
};
