/**
 * Dashboard & Widget Routes
 * 
 * Handles: dashboards CRUD, widgets CRUD, dashboard-workflow connections,
 * widget grid, overview stats.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId, logActivity } = require('../utils/helpers');

module.exports = function({ db }) {

router.get('/dashboards', authenticateToken, async (req, res) => {
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

router.post('/dashboards', authenticateToken, async (req, res) => {
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

router.put('/dashboards/:id', authenticateToken, async (req, res) => {
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

router.delete('/dashboards/:id', authenticateToken, async (req, res) => {
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
router.post('/dashboards/:id/share', authenticateToken, async (req, res) => {
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
router.post('/dashboards/:id/unshare', authenticateToken, async (req, res) => {
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
router.get('/dashboards/:id/widgets', authenticateToken, async (req, res) => {
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
router.post('/dashboards/:id/widgets', authenticateToken, async (req, res) => {
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
router.delete('/widgets/:id', authenticateToken, async (req, res) => {
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

// Update widget (title/description/config)
router.put('/widgets/:id', authenticateToken, async (req, res) => {
    try {
        const { title, description, config } = req.body;

        // Verify widget belongs to user's org via dashboard
        const widget = await db.get(`
            SELECT w.id, w.dashboardId FROM widgets w
            JOIN dashboards d ON w.dashboardId = d.id
            WHERE w.id = ? AND d.organizationId = ?
        `, [req.params.id, req.user.orgId]);

        if (!widget) {
            return res.status(404).json({ error: 'Widget not found' });
        }

        await db.run(
            'UPDATE widgets SET title = ?, description = ?, config = ? WHERE id = ?',
            [title || 'Widget', description || '', JSON.stringify(config || {}), req.params.id]
        );

        // Touch dashboard updatedAt
        await db.run('UPDATE dashboards SET updatedAt = ? WHERE id = ?', [new Date().toISOString(), widget.dashboardId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating widget:', error);
        res.status(500).json({ error: 'Failed to update widget' });
    }
});


    // ==================== DASHBOARD-WORKFLOW CONNECTION ====================

// ==================== DASHBOARD-WORKFLOW CONNECTION ENDPOINTS ====================

// Connect widget to workflow output
router.post('/dashboards/:dashboardId/widgets/:widgetId/connect-workflow', authenticateToken, async (req, res) => {
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
router.get('/dashboards/:dashboardId/widgets/:widgetId/data', authenticateToken, async (req, res) => {
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
router.post('/dashboards/:dashboardId/generate-widget-from-workflow', authenticateToken, async (req, res) => {
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


    // ==================== WIDGET GRID ====================

router.put('/widgets/:id/grid', authenticateToken, async (req, res) => {
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

    // ==================== OVERVIEW STATS ====================

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

// Cancel execution

    return router;
};
