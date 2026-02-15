/**
 * Simulations & Use Case Import Routes
 * 
 * Handles: use case package import/validation, simulations CRUD,
 * simulation chat, shared links.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId, logActivity } = require('../utils/helpers');
const { importUseCasePackage, validateUseCasePackage } = require('../useCaseImporter');

module.exports = function({ db, upload }) {

// ==================== USE CASE PACKAGE IMPORT ====================

// POST /api/use-case/import - Subir un package JSON para importar como use case (entidades, workflow, simulación, dashboard)
router.post('/use-case/import', authenticateToken, async (req, res) => {
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
router.post('/use-case/import-file', authenticateToken, upload.single('package'), async (req, res) => {
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
router.post('/use-case/validate', authenticateToken, async (req, res) => {
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
router.get('/simulations', authenticateToken, async (req, res) => {
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
router.get('/simulations/:id', authenticateToken, async (req, res) => {
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
router.post('/simulations', authenticateToken, async (req, res) => {
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
router.put('/simulations/:id', authenticateToken, async (req, res) => {
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
router.delete('/simulations/:id', authenticateToken, async (req, res) => {
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
router.post('/simulations/chat', authenticateToken, async (req, res) => {
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
router.get('/shared/:token', async (req, res) => {
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


    return router;
};
