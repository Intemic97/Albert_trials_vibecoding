/**
 * Entity & Record Routes
 * 
 * Handles: entities CRUD, properties, records CRUD, entity audit trail.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth');
const { generateId, logActivity } = require('../utils/helpers');
const { openDb } = require('../db');

module.exports = function({ db }) {

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

router.get('/entities', authenticateToken, async (req, res) => {
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

// GET single entity
router.get('/entities/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const entity = await db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!entity) return res.status(404).json({ error: 'Entity not found' });
        const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [id]);
        res.json({ ...entity, properties });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch entity' });
    }
});

// PUT update entity name/description
router.put('/entities/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, description, entityType } = req.body;
    try {
        const entity = await db.get('SELECT id FROM entities WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!entity) return res.status(404).json({ error: 'Entity not found' });
        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description); }
        if (entityType !== undefined) { updates.push('entityType = ?'); params.push(entityType); }
        updates.push("lastEdited = ?"); params.push(new Date().toISOString());
        params.push(id);
        await db.run(`UPDATE entities SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ message: 'Entity updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update entity' });
    }
});

// POST create entity
router.post('/entities', authenticateToken, async (req, res) => {
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
                    [prop.id, id, prop.name, prop.type || 'text', prop.defaultValue ?? '', prop.relatedEntityId ?? null, prop.unit ?? null]
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
router.delete('/entities/:id', authenticateToken, async (req, res) => {
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
router.post('/properties', authenticateToken, async (req, res) => {
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

// PUT update property
router.put('/properties/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, type, unit } = req.body;
    try {
        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (type !== undefined) { updates.push('type = ?'); params.push(type); }
        if (unit !== undefined) { updates.push('unit = ?'); params.push(unit); }
        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
        params.push(id);
        await db.run(`UPDATE properties SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ message: 'Property updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update property' });
    }
});

// DELETE property
router.delete('/properties/:id', authenticateToken, async (req, res) => {
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
router.get('/entities/:id/audit', authenticateToken, async (req, res) => {
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
router.get('/entities/:id/records', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const includeTotal = req.query.includeTotal === 'true';
    try {
        // Verify entity belongs to user's organization
        const entity = await db.get('SELECT id FROM entities WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!entity) {
            return res.status(404).json({ error: 'Entity not found or access denied' });
        }

        // Get total count if requested
        let totalCount = null;
        if (includeTotal && limit && limit > 0) {
            const countResult = await db.get('SELECT COUNT(*) as count FROM records WHERE entityId = ?', [id]);
            totalCount = countResult?.count || 0;
        }

        // Apply limit and offset if specified
        let records;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        if (limit && limit > 0) {
            records = await db.all('SELECT * FROM records WHERE entityId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?', [id, limit, offset]);
        } else {
            records = await db.all('SELECT * FROM records WHERE entityId = ?', [id]);
        }

        const recordsWithValues = await Promise.all(records.map(async (record) => {
            const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [record.id]);
            const valuesMap = {};
            values.forEach(v => {
                valuesMap[v.propertyId] = v.value;
            });
            return { ...record, values: valuesMap };
        }));

        // If includeTotal is requested, return object with records and total
        if (includeTotal && totalCount !== null) {
            res.json({ records: recordsWithValues, total: totalCount });
        } else {
            res.json(recordsWithValues);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
});

// POST /api/entities/:id/records - Create record(s) with property names (single object or array for batch)
router.post('/entities/:id/records', authenticateToken, async (req, res) => {
    const { id: entityId } = req.params;
    let body = req.body;
    // Support both raw array and { records: [] }
    if (body && typeof body === 'object' && !Array.isArray(body) && Array.isArray(body.records)) {
        body = body.records;
    }
    const isBatch = Array.isArray(body);
    const recordsToCreate = isBatch ? body : [body];

    try {
        // Verify entity belongs to user's organization
        const entity = await db.get('SELECT id FROM entities WHERE id = ? AND organizationId = ?', [entityId, req.user.orgId]);
        if (!entity) {
            return res.status(403).json({ error: 'Access denied to this entity' });
        }

        // Get entity properties to map names to IDs
        const properties = await db.all('SELECT id, name, type FROM properties WHERE entityId = ?', [entityId]);
        const propertyMap = {};
        properties.forEach(prop => {
            propertyMap[prop.name.toLowerCase()] = prop;
        });

        const createdIds = [];

        for (const recordData of recordsToCreate) {
            if (!recordData || typeof recordData !== 'object' || Array.isArray(recordData)) continue;

            const recordId = Math.random().toString(36).substr(2, 9);
            const createdAt = new Date().toISOString();

            await db.run(
                'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
                [recordId, entityId, createdAt]
            );
            createdIds.push(recordId);

            for (const [key, val] of Object.entries(recordData)) {
                if (key === 'id' || key === 'createdAt' || key === 'entityId') continue;
                const prop = propertyMap[key.toLowerCase()];
                if (prop) {
                    const valueId = Math.random().toString(36).substr(2, 9);
                    await db.run(
                        'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                        [valueId, recordId, prop.id, String(val)]
                    );
                }
            }
        }

        if (isBatch) {
            return res.status(201).json({ message: 'Records created', created: createdIds.length, ids: createdIds });
        }
        res.status(201).json({
            message: 'Record created',
            id: createdIds[0],
            savedFields: createdIds.length ? Object.keys(recordsToCreate[0] || {}).filter(k => !['id', 'createdAt', 'entityId'].includes(k)).length : 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create record' });
    }
});

// POST /api/records
// POST /api/records
router.post('/records', authenticateToken, async (req, res) => {
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
router.put('/records/:id', authenticateToken, async (req, res) => {
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
router.put('/records/:id/tags', authenticateToken, async (req, res) => {
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
router.delete('/records/:id', authenticateToken, async (req, res) => {
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

// Entity AI command (also registered here so /api/entity-ai-command is always available)
router.post('/entity-ai-command', authenticateToken, async (req, res) => {
    try {
        const { message, context } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'message is required' });
        }
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const ctx = context || {};
        const entityName = ctx.entityName || 'this entity';
        const properties = Array.isArray(ctx.properties) ? ctx.properties : [];
        const propList = properties.map(p => `${p.name} (${p.type || 'text'})`).join(', ') || 'none';
        const recordCount = typeof ctx.recordCount === 'number' ? ctx.recordCount : 0;
        const sampleRecords = Array.isArray(ctx.sampleRecords) ? ctx.sampleRecords.slice(0, 5) : [];
        const systemPrompt = `You are an assistant that helps users structure and edit their data (entities = tables, properties = columns, records = rows).

Current context:
- Entity name: ${entityName}
- Columns (properties): ${propList}
- Number of existing rows: ${recordCount}
${sampleRecords.length ? `- Sample row keys: ${Object.keys(sampleRecords[0] || {}).join(', ')}` : ''}

You must respond with a JSON object that has exactly two keys:
1. "actions": an array of actions to perform (can be empty [] if the request is not about changing data).
2. "summary": a short human-readable sentence describing what was done.

Allowed action types:
- "replace_schema": { "type": "replace_schema", "name": "Entity Name", "properties": [ { "name": "Name", "type": "text" }, ... ] }
- "add_column": { "type": "add_column", "name": "Column Name", "dataType": "text" }
- "add_records": { "type": "add_records", "records": [ { "Name": "Item 1", "Status": "Active" }, ... ] }
- "create_entity": { "type": "create_entity", "name": "New Table Name", "properties": [ ... ], "records": [ ... ] (optional) }

If the user message cannot be interpreted as a data change, return { "actions": [], "summary": "No changes made." }.
Output ONLY valid JSON, no markdown, no explanation.`;
        const userContent = sampleRecords.length
            ? `User said: ${message}\n\nSample data (first row): ${JSON.stringify(sampleRecords[0])}`
            : `User said: ${message}`;
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3
        });
        const raw = completion.choices[0].message.content;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            return res.status(500).json({ error: 'Invalid AI response', raw: raw?.slice(0, 200) });
        }
        const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
        const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Done';
        res.json({ actions, summary });
    } catch (error) {
        console.error('Error in entity-ai-command:', error);
        res.status(500).json({ error: 'Failed to process command' });
    }
});

    return router;
};
