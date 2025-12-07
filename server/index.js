const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let db;

// Initialize DB
initDb().then(database => {
    db = database;
    console.log('Database initialized');
});

// --- Routes ---

// GET all entities (with properties)
app.get('/api/entities', async (req, res) => {
    try {
        const entities = await db.all('SELECT * FROM entities');

        // Fetch properties for each entity
        // Note: In a production app, we might use a JOIN or a separate query more efficiently,
        // but for this scale, iterating is fine or a single join query.
        // Let's use a simple loop for clarity and matching the frontend structure.

        const entitiesWithProps = await Promise.all(entities.map(async (entity) => {
            const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', entity.id);
            return { ...entity, properties };
        }));

        res.json(entitiesWithProps);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch entities' });
    }
});

// POST create entity
app.post('/api/entities', async (req, res) => {
    const { id, name, description, author, lastEdited, properties } = req.body;

    try {
        await db.run(
            'INSERT INTO entities (id, name, description, author, lastEdited) VALUES (?, ?, ?, ?, ?)',
            id, name, description, author, lastEdited
        );

        // Insert properties if any (though usually new entities might start empty)
        if (properties && properties.length > 0) {
            for (const prop of properties) {
                await db.run(
                    'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId) VALUES (?, ?, ?, ?, ?, ?)',
                    prop.id, id, prop.name, prop.type, prop.defaultValue, prop.relatedEntityId
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
app.delete('/api/entities/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM entities WHERE id = ?', id);
        // Cascade delete should handle properties, but let's be safe if foreign keys aren't enabled by default in some sqlite versions
        await db.run('DELETE FROM properties WHERE entityId = ?', id);
        res.json({ message: 'Entity deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete entity' });
    }
});

// POST add property
app.post('/api/properties', async (req, res) => {
    const { id, entityId, name, type, defaultValue, relatedEntityId } = req.body;
    try {
        await db.run(
            'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId) VALUES (?, ?, ?, ?, ?, ?)',
            id, entityId, name, type, defaultValue, relatedEntityId
        );
        res.status(201).json({ message: 'Property added' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add property' });
    }
});

// DELETE property
app.delete('/api/properties/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM properties WHERE id = ?', id);
        res.json({ message: 'Property deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete property' });
    }
});

// --- Records Endpoints ---

// GET /api/entities/:id/records
app.get('/api/entities/:id/records', async (req, res) => {
    const { id } = req.params;
    try {
        const records = await db.all('SELECT * FROM records WHERE entityId = ?', id);

        const recordsWithValues = await Promise.all(records.map(async (record) => {
            const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', record.id);
            // Convert array of values to object: { propertyId: value }
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

// POST /api/records
app.post('/api/records', async (req, res) => {
    const { entityId, values } = req.body; // values is { propertyId: value }
    const recordId = Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    try {
        await db.run(
            'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
            recordId, entityId, createdAt
        );

        if (values) {
            for (const [propId, val] of Object.entries(values)) {
                const valueId = Math.random().toString(36).substr(2, 9);
                await db.run(
                    'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                    valueId, recordId, propId, String(val)
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
app.put('/api/records/:id', async (req, res) => {
    const { id } = req.params;
    const { values } = req.body; // values is { propertyId: value }

    try {
        // We don't strictly need to update the 'records' table unless we track 'lastEdited' there.
        // For now, we just update the values.

        if (values) {
            for (const [propId, val] of Object.entries(values)) {
                // Check if value exists for this record and property
                const existing = await db.get(
                    'SELECT id FROM record_values WHERE recordId = ? AND propertyId = ?',
                    id, propId
                );

                if (existing) {
                    await db.run(
                        'UPDATE record_values SET value = ? WHERE id = ?',
                        String(val), existing.id
                    );
                } else {
                    const valueId = Math.random().toString(36).substr(2, 9);
                    await db.run(
                        'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                        valueId, id, propId, String(val)
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
app.delete('/api/records/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM records WHERE id = ?', id);
        // Cascade delete handles record_values
        res.json({ message: 'Record deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete record' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
