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
router.post('/entities/:id/records', authenticateToken, async (req, res) => {
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


    return router;
};
