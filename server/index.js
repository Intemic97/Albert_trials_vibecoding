const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

let db;

// Initialize DB and start server
initDb().then(database => {
    db = database;
    console.log('Database initialized');

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});

// --- Routes ---

// GET all entities (with properties)
app.get('/api/entities', async (req, res) => {
    try {
        const entities = await db.all('SELECT * FROM entities');

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
app.post('/api/entities', async (req, res) => {
    const { id, name, description, author, lastEdited, properties } = req.body;

    try {
        await db.run(
            'INSERT INTO entities (id, name, description, author, lastEdited) VALUES (?, ?, ?, ?, ?)',
            [id, name, description, author, lastEdited]
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
app.delete('/api/entities/:id', async (req, res) => {
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
app.post('/api/properties', async (req, res) => {
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
app.delete('/api/properties/:id', async (req, res) => {
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
app.get('/api/entities/:id/records', async (req, res) => {
    const { id } = req.params;
    try {
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

// POST /api/records
app.post('/api/records', async (req, res) => {
    const { entityId, values } = req.body;
    const recordId = Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    try {
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
app.put('/api/records/:id', async (req, res) => {
    const { id } = req.params;
    const { values } = req.body;

    try {
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
app.delete('/api/records/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run('DELETE FROM records WHERE id = ?', [id]);
        res.json({ message: 'Record deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete record' });
    }
});

// OpenAI Generation Endpoint
app.post('/api/generate', async (req, res) => {
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
                // Get Entity Metadata
                const entity = await db.get('SELECT * FROM entities WHERE id = ?', [entityId]);
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

// Python Execution Endpoint
app.post('/api/python/execute', async (req, res) => {
    const { code, inputData } = req.body;
    const fs = require('fs');
    const path = require('path');
    const { spawn } = require('child_process');

    try {
        // Create a wrapper script that imports the user's code and runs it
        const wrapperCode = `
import json
import sys

# User code
${code}

if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        
        # Execute user function (assuming it's named 'process')
        if 'process' in locals():
            result = process(input_data)
            print(json.dumps(result))
        else:
            print(json.dumps({"error": "Function 'process(data)' not found in code"}))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))
`;

        // Write to temp file
        const tempFile = path.join(__dirname, `temp_${Date.now()}.py`);
        fs.writeFileSync(tempFile, wrapperCode);

        // Execute python script
        const pythonProcess = spawn('python', [tempFile]);

        let stdoutData = '';
        let stderrData = '';

        // Send input data to stdin
        pythonProcess.stdin.write(JSON.stringify(inputData || []));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            // Cleanup temp file
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.error('Error deleting temp file:', e);
            }

            if (code !== 0) {
                return res.status(500).json({ error: stderrData || 'Python execution failed' });
            }

            try {
                const result = JSON.parse(stdoutData);
                res.json({ result });
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse Python output: ' + stdoutData });
            }
        });

    } catch (error) {
        console.error('Error executing Python:', error);
        res.status(500).json({ error: 'Internal server error during execution' });
    }
});

// Python Code Generation Endpoint
app.post('/api/python/generate', async (req, res) => {
    const { prompt } = req.body;

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API Key not configured' });
    }

    try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a Python expert. Write a Python function named \`process(data)\` that takes a list of records (dictionaries) as input and returns a modified list. 
                    
                    Rules:
                    1. The function MUST be named \`process\`.
                    2. It MUST accept one argument \`data\`.
                    3. It MUST return a list of dictionaries.
                    4. Do NOT include any markdown formatting (like \`\`\`python).
                    5. Do NOT include explanations. Just the code.
                    6. Import any standard libraries you need inside the function or at the top.`
                },
                { role: "user", content: prompt }
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
app.post('/api/generate-widget', async (req, res) => {
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
                const entity = await db.get('SELECT * FROM entities WHERE id = ?', [entityId]);
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
            const results = await Promise.all(entityPromises);
            results.forEach(result => { if (result) contextData[result.name] = result.data; });
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

// Workflow Management Endpoints
app.get('/api/workflows', async (req, res) => {
    try {
        const workflows = await db.all('SELECT id, name, createdAt, updatedAt FROM workflows ORDER BY updatedAt DESC');
        res.json(workflows);
    } catch (error) {
        console.error('Error fetching workflows:', error);
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
});

app.get('/api/workflows/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [id]);
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

app.post('/api/workflows', async (req, res) => {
    try {
        const { name, data } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

        // Store data as JSON string
        await db.run(
            'INSERT INTO workflows (id, name, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
            [id, name, JSON.stringify(data), now, now]
        );

        res.json({ id, name, createdAt: now, updatedAt: now });
    } catch (error) {
        console.error('Error saving workflow:', error);
        res.status(500).json({ error: 'Failed to save workflow' });
    }
});

app.put('/api/workflows/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, data } = req.body;
        const now = new Date().toISOString();

        await db.run(
            'UPDATE workflows SET name = ?, data = ?, updatedAt = ? WHERE id = ?',
            [name, JSON.stringify(data), now, id]
        );

        res.json({ message: 'Workflow updated' });
    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(500).json({ error: 'Failed to update workflow' });
    }
});

app.delete('/api/workflows/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.run('DELETE FROM workflows WHERE id = ?', [id]);
        res.json({ message: 'Workflow deleted' });
    } catch (error) {
        console.error('Error deleting workflow:', error);
        res.status(500).json({ error: 'Failed to delete workflow' });
    }
});

