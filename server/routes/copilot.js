/**
 * Copilot & Database Assistant Routes
 * 
 * Handles: database assistant, copilot chats, agents, AI ask, text generation.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const { authenticateToken } = require('../auth');
const { generateId, logActivity } = require('../utils/helpers');
const agentOrchestrator = require('../services/agentOrchestrator');
const agentService = require('../services/agentService');

module.exports = function({ db, aiRateLimit }) {

    const uploadsDir = path.join(__dirname, '..', 'uploads');

    // Helper to resolve relation values
    async function resolveRelationValue(db, value, relatedEntityId) {
        if (!value || !relatedEntityId) return value;
        try {
            let ids = [];
            try { const parsed = JSON.parse(value); ids = Array.isArray(parsed) ? parsed : [value]; } catch { ids = [value]; }
            const names = [];
            for (const id of ids) {
                const relatedValues = await db.all('SELECT * FROM record_values WHERE recordId = ?', [id]);
                if (relatedValues.length === 0) { names.push(id); continue; }
                const relatedProps = await db.all('SELECT * FROM properties WHERE entityId = ?', [relatedEntityId]);
                let nameVal = null;
                const nameProp = relatedProps.find(p => p.name.toLowerCase() === 'name' || p.name.toLowerCase() === 'title');
                if (nameProp) { const valRow = relatedValues.find(rv => rv.propertyId === nameProp.id); if (valRow) nameVal = valRow.value; }
                if (!nameVal) { const textProp = relatedProps.find(p => p.type === 'text'); if (textProp) { const valRow = relatedValues.find(rv => rv.propertyId === textProp.id); if (valRow) nameVal = valRow.value; } }
                names.push(nameVal || id);
            }
            return names.length === 1 ? names[0] : names.join(', ');
        } catch (e) { console.error('Error resolving relation value:', e); return value; }
    }

    // Helper function to extract text from files
    async function extractFileContent(filename) {
        const filePath = path.join(uploadsDir, filename);
        if (!fs.existsSync(filePath)) return null;
        const ext = path.extname(filename).toLowerCase();
        try {
            if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);
                return { type: 'pdf', text: data.text, pages: data.numpages, info: data.info };
            } else if (ext === '.txt' || ext === '.csv') {
                const text = fs.readFileSync(filePath, 'utf8');
                return { type: ext.slice(1), text };
            } else {
                return { type: ext.slice(1), text: null, message: 'Text extraction not supported for this file type' };
            }
        } catch (error) {
            console.error('Error extracting file content:', error);
            return { type: ext.slice(1), text: null, error: error.message };
        }
    }

    // Helper: merge entity lists for ask
function mergeEntitiesForAsk(allowed, mentioned) {
    if (mentioned && mentioned.length > 0) {
        if (allowed && allowed.length > 0) return [...new Set([...allowed, ...mentioned])];
        return mentioned;
    }
    return allowed;
}

// Multi-agent ask (orchestrator + analyst + specialist + synthesis)

// ==================== DATABASE ASSISTANT ENDPOINT ====================

// Database Assistant - Answer questions about the database using AI
router.post('/database/ask', authenticateToken, async (req, res) => {
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
router.get('/copilot/chats', authenticateToken, async (req, res) => {
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
                    agentIds: chat.agentIds ? JSON.parse(chat.agentIds) : null,
                    useChatMemory: chat.useChatMemory === undefined || chat.useChatMemory === 1,
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
                    agentIds: null,
                    useChatMemory: chat.useChatMemory === undefined || chat.useChatMemory === 1,
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
router.post('/copilot/chats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const orgId = req.user.orgId;
        const { id, title, messages, createdAt, updatedAt } = req.body;
        const { instructions, allowedEntities, isFavorite, tags, agentId, useChatMemory } = req.body;
        
        await db.run(
            `INSERT INTO copilot_chats (id, userId, organizationId, title, messages, instructions, allowedEntities, agentId, useChatMemory, isFavorite, tags, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, 
                userId, 
                orgId, 
                title, 
                JSON.stringify(messages), 
                instructions || null,
                allowedEntities ? JSON.stringify(allowedEntities) : null,
                agentId || null,
                useChatMemory !== false ? 1 : 0,
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
router.put('/copilot/chats/:chatId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const orgId = req.user.orgId;
        const { chatId } = req.params;
        const { title, messages, updatedAt, createdAt, instructions, allowedEntities, isFavorite, tags, agentId, useChatMemory } = req.body;

        const safeTitle = title != null ? String(title) : 'Nuevo Chat';
        const safeMessages = Array.isArray(messages) ? messages : [];
        const safeUpdatedAt = updatedAt || new Date().toISOString();
        const useChatMemoryVal = useChatMemory !== false ? 1 : 0;

        const chat = await db.get(
            'SELECT * FROM copilot_chats WHERE id = ? AND organizationId = ?',
            [chatId, orgId]
        );

        if (!chat) {
            // Chat doesn't exist, create it (upsert behavior)
            console.log('[Copilot] Chat not found, creating new chat:', chatId);
            await db.run(
                `INSERT INTO copilot_chats (id, userId, organizationId, title, messages, instructions, allowedEntities, agentId, useChatMemory, isFavorite, tags, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    chatId,
                    userId,
                    orgId,
                    safeTitle,
                    JSON.stringify(safeMessages),
                    instructions || null,
                    allowedEntities ? JSON.stringify(allowedEntities) : null,
                    agentId || null,
                    useChatMemoryVal,
                    isFavorite ? 1 : 0,
                    tags ? JSON.stringify(tags) : null,
                    createdAt || safeUpdatedAt,
                    safeUpdatedAt
                ]
            );
        } else {
            // Chat exists, update it
            await db.run(
                `UPDATE copilot_chats SET title = ?, messages = ?, instructions = ?, allowedEntities = ?, agentId = ?, useChatMemory = ?, isFavorite = ?, tags = ?, updatedAt = ? WHERE id = ?`,
                [
                    safeTitle,
                    JSON.stringify(safeMessages),
                    instructions || null,
                    allowedEntities ? JSON.stringify(allowedEntities) : null,
                    agentId || null,
                    useChatMemoryVal,
                    isFavorite ? 1 : 0,
                    tags ? JSON.stringify(tags) : null,
                    safeUpdatedAt,
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
router.delete('/copilot/chats/:chatId', authenticateToken, async (req, res) => {
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

// ==================== MULTI-AGENT COPILOT ====================

// List agents for org
router.get('/copilot/agents', authenticateToken, async (req, res) => {
    try {
        const agents = await agentService.list(db, req.user.orgId);
        res.json({ agents });
    } catch (error) {
        console.error('[Copilot Agents] Error listing:', error);
        res.status(500).json({ error: 'Failed to list agents' });
    }
});

// Get single agent
router.get('/copilot/agents/:id', authenticateToken, async (req, res) => {
    try {
        const agent = await agentService.get(db, req.params.id, req.user.orgId);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        res.json(agent);
    } catch (error) {
        console.error('[Copilot Agents] Error get:', error);
        res.status(500).json({ error: 'Failed to get agent' });
    }
});

// Generate agent instructions with AI
router.post('/copilot/agents/generate-instructions', authenticateToken, async (req, res) => {
    try {
        const { userDescription, agentName, agentDescription } = req.body;
        
        if (!userDescription) {
            return res.status(400).json({ error: 'userDescription is required' });
        }
        if (!process.env.OPENAI_API_KEY) {
            return res.status(503).json({ error: 'OPENAI_API_KEY no configurada. Configura la variable de entorno en el servidor para usar Generar con IA.' });
        }

        const systemPrompt = `Eres un experto en diseñar agentes de IA especializados para empresas. 
Tu tarea es generar instrucciones claras y profesionales para un agente basándote en la descripción del usuario.

Las instrucciones deben:
- Ser claras y específicas sobre el rol del agente
- Incluir 3-5 puntos clave de lo que hace
- Usar viñetas para facilitar lectura
- Ser profesionales pero concisas
- Incluir orientaciones sobre cómo debe responder o analizar

NO incluyas saludos ni despedidas, solo las instrucciones directas.`;

        const userPrompt = `Genera instrucciones para un agente con estas características:

Nombre: ${agentName || 'Agente especializado'}
${agentDescription ? `Descripción: ${agentDescription}` : ''}

Lo que el usuario quiere que haga:
${userDescription}

Genera las instrucciones del agente:`;

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const instructions = response.data.choices[0]?.message?.content?.trim() || '';
        
        res.json({ instructions });
    } catch (error) {
        console.error('[Copilot Agents] Error generating instructions:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate instructions' });
    }
});

// Create agent
router.post('/copilot/agents', authenticateToken, async (req, res) => {
    try {
        const payload = { ...req.body, createdBy: req.user.sub, createdByName: req.user.email || req.user.name || 'Unknown' };
        const agent = await agentService.create(db, req.user.orgId, payload);
        res.status(201).json(agent);
    } catch (error) {
        console.error('[Copilot Agents] Error create:', error);
        res.status(500).json({ error: error.message || 'Failed to create agent' });
    }
});

// Agent memory endpoints
router.get('/copilot/agents/:id/memory', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const memory = await agentService.getMemory(db, req.params.id, limit);
        res.json({ memory });
    } catch (error) {
        console.error('[Agent Memory] Error get:', error);
        res.status(500).json({ error: 'Failed to get agent memory' });
    }
});

router.delete('/copilot/agents/:id/memory', authenticateToken, async (req, res) => {
    try {
        await agentService.clearMemory(db, req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('[Agent Memory] Error clear:', error);
        res.status(500).json({ error: 'Failed to clear agent memory' });
    }
});

// Update agent
router.put('/copilot/agents/:id', authenticateToken, async (req, res) => {
    try {
        const agent = await agentService.update(db, req.params.id, req.user.orgId, req.body);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        res.json(agent);
    } catch (error) {
        if (error.message === 'System agents cannot be modified') {
            return res.status(400).json({ error: error.message });
        }
        console.error('[Copilot Agents] Error update:', error);
        res.status(500).json({ error: 'Failed to update agent' });
    }
});

// Delete agent
router.delete('/copilot/agents/:id', authenticateToken, async (req, res) => {
    try {
        // Prevent deleting the default seed agent
        if (req.params.id.startsWith('agent_default_')) {
            return res.status(400).json({ error: 'The default agent cannot be deleted' });
        }
        await agentService.remove(db, req.params.id, req.user.orgId);
        res.json({ success: true });
    } catch (error) {
        if (error.message === 'System agents cannot be deleted') {
            return res.status(400).json({ error: error.message });
        }
        console.error('[Copilot Agents] Error delete:', error);
        res.status(500).json({ error: 'Failed to delete agent' });
    }
});

router.post('/copilot/ask', authenticateToken, aiRateLimit, async (req, res) => {
    console.log('[Copilot Ask] Request received');
    try {
        const { question, conversationHistory, chatId, instructions, allowedEntities, mentionedEntities, useChatMemory, useMultiAgent = true } = req.body;
        const orgId = req.user.orgId;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'OpenAI API Key not configured' });
        }

        let chatInstructions = instructions;
        let chatAllowedEntities = allowedEntities;
        let chatUseChatMemory = useChatMemory;
        if (chatId) {
            const chat = await db.get(
                'SELECT instructions, allowedEntities, useChatMemory FROM copilot_chats WHERE id = ? AND organizationId = ?',
                [chatId, orgId]
            );
            if (chat) {
                chatInstructions = chatInstructions || chat.instructions;
                chatAllowedEntities = chatAllowedEntities || (chat.allowedEntities ? JSON.parse(chat.allowedEntities) : null);
                if (chatUseChatMemory === undefined) chatUseChatMemory = chat.useChatMemory === undefined || chat.useChatMemory === 1;
            }
        }

        if (useMultiAgent) {
            try {
                const userRow = await db.get('SELECT locale FROM users WHERE id = ?', [req.user.sub]);
                const userLocale = userRow?.locale || 'es';
                let agentId = req.body.agentId;
                if (!agentId && chatId) {
                    const chat = await db.get('SELECT agentId FROM copilot_chats WHERE id = ? AND organizationId = ?', [chatId, orgId]);
                    agentId = chat?.agentId;
                }
                if (!agentId) {
                    const agents = await agentService.list(db, orgId);
                    agentId = agents[0]?.id;
                }
                if (!agentId) {
                    throw new Error('No agent available. Create an agent first.');
                }
                const result = await agentOrchestrator.process(db, {
                    orgId,
                    agentId,
                    userMessage: question,
                    chatId,
                    conversationHistory: conversationHistory || [],
                    instructions: chatInstructions,
                    allowedEntities: chatAllowedEntities,
                    mentionedEntities: mentionedEntities || [],
                    useChatMemory: chatUseChatMemory,
                    userId: req.user.sub,
                    userEmail: req.user.email,
                    locale: userLocale
                });
                return res.json({
                    answer: result.answer,
                    explanation: result.explanation,
                    entitiesUsed: result.entitiesUsed,
                    agentConversation: result.agentConversation,
                    entitiesAnalyzed: result.entitiesUsed?.length || 0,
                    totalRecords: 0
                });
            } catch (orchError) {
                console.warn('[Copilot Ask] Multi-agent failed, falling back to single LLM:', orchError.message);
            }
        }

        const { buildDatabaseContext } = require('../services/agentPromptBuilder');
        const effectiveEntities = mergeEntitiesForAsk(chatAllowedEntities, mentionedEntities || []);
        const databaseContext = await buildDatabaseContext(db, orgId, effectiveEntities);
        const customInstructions = chatInstructions
            ? `\n\nCUSTOM INSTRUCTIONS:\n${chatInstructions}\n\n`
            : '';
        const userRow = await db.get('SELECT locale FROM users WHERE id = ?', [req.user.sub]);
        const userLocale = userRow?.locale || 'es';
        const languageInstruction = userLocale === 'en'
            ? 'Always answer in English unless the user explicitly asks for another language.'
            : 'Responde siempre en español salvo que el usuario pida explícitamente otro idioma.';
        const systemPrompt = `You are a helpful database assistant. You have access to the user's database.

DATABASE SCHEMA AND DATA:
${JSON.stringify(databaseContext, null, 2)}
${customInstructions}
${languageInstruction}

Respond in valid JSON: { "answer": "...", "explanation": "...", "entitiesUsed": [...] }`;
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                ...(conversationHistory || []).slice(-6).map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: question }
            ],
            temperature: 0.3,
            max_tokens: 1500,
            response_format: { type: 'json_object' }
        });
        const text = completion.choices[0]?.message?.content || '{}';
        let parsed;
        try { parsed = JSON.parse(text); } catch (_) {
            parsed = { answer: text, explanation: '', entitiesUsed: Object.keys(databaseContext) };
        }
        return res.json({
            answer: parsed.answer || text,
            explanation: parsed.explanation || '',
            entitiesUsed: parsed.entitiesUsed || Object.keys(databaseContext),
            agentConversation: [],
            entitiesAnalyzed: Object.keys(databaseContext).length,
            totalRecords: Object.values(databaseContext).reduce((s, e) => s + (e.recordCount || 0), 0)
        });
    } catch (error) {
        console.error('[Copilot Ask] Error:', error);
        res.status(500).json({
            error: 'Failed to process your question.',
            details: error.message
        });
    }
});

// Get agent conversation for a chat turn
router.get('/copilot/chats/:chatId/turns/:turnIndex/agent-conversation', authenticateToken, async (req, res) => {
    try {
        const { chatId, turnIndex } = req.params;
        const chat = await db.get(
            'SELECT id FROM copilot_chats WHERE id = ? AND organizationId = ?',
            [chatId, req.user.orgId]
        );
        if (!chat) return res.status(404).json({ error: 'Chat not found' });
        const rows = await db.all(
            'SELECT * FROM agent_conversations WHERE chatId = ? AND turnIndex = ? ORDER BY createdAt ASC',
            [chatId, parseInt(turnIndex, 10)]
        );
        res.json({ messages: rows });
    } catch (error) {
        console.error('[Copilot] Error fetching agent conversation:', error);
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

// OpenAI Generation Endpoint
router.post('/generate', authenticateToken, async (req, res) => {
    console.log('Received generation request');
    console.time('Total Request Time');
    try {
        const { prompt, mentionedEntityIds, additionalContext, outputType, enumOptions } = req.body;
        console.log('Prompt:', prompt);
        console.log('Mentioned IDs:', mentionedEntityIds);
        console.log('Additional Context Present:', !!additionalContext);
        console.log('Output Type:', outputType || 'text');
        if (enumOptions?.length) console.log('Enum Options:', enumOptions);

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

        // Add output type constraint
        const effectiveOutputType = outputType || 'text';
        if (effectiveOutputType === 'number') {
            systemPrompt += `\n\nIMPORTANT: Your response MUST be a single numeric value (integer or decimal). Do not include any text, units, explanation, or markdown — output ONLY the number.`;
        } else if (effectiveOutputType === 'date') {
            systemPrompt += `\n\nIMPORTANT: Your response MUST be a single date in ISO 8601 format (YYYY-MM-DD). Do not include any text, explanation, or markdown — output ONLY the date.`;
        } else if (effectiveOutputType === 'enum' && enumOptions && enumOptions.length > 0) {
            systemPrompt += `\n\nIMPORTANT: Your response MUST be exactly ONE of these options: ${enumOptions.map(o => `"${o}"`).join(', ')}. Do not include any text, explanation, or markdown — output ONLY one of the listed options exactly as written.`;
        } else {
            systemPrompt += `\n\nAnswer the user's question based on this data. 
            If the answer is not in the data, say so.
            Format your response in Markdown.`;
        }

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

        let responseText = completion.choices[0].message.content || '';

        // Post-process based on output type
        if (effectiveOutputType === 'number') {
            const num = parseFloat(responseText.replace(/[^0-9.\-]/g, ''));
            if (!isNaN(num)) responseText = String(num);
        } else if (effectiveOutputType === 'date') {
            const dateMatch = responseText.match(/\d{4}-\d{2}-\d{2}/);
            if (dateMatch) responseText = dateMatch[0];
        } else if (effectiveOutputType === 'enum' && enumOptions && enumOptions.length > 0) {
            const trimmed = responseText.trim().replace(/^["']|["']$/g, '');
            const match = enumOptions.find(o => o.toLowerCase() === trimmed.toLowerCase());
            if (match) responseText = match;
        }

        res.json({ response: responseText });

    } catch (error) {
        console.error('Error generating response:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// Python Execution Endpoint - Secure Sandbox

    return router;
};
