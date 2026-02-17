/**
 * Knowledge Base Routes
 * 
 * Handles: knowledge documents, folders, search, entity extraction.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticateToken } = require('../auth');
const { generateId, logActivity } = require('../utils/helpers');
const { extractStructuredFromText } = require('../services/langExtractService');

module.exports = function({ db }) {

    // Configure multer for knowledge uploads
    const knowledgeUpload = multer({ 
        dest: 'server/uploads/knowledge/',
        limits: { fileSize: 50 * 1024 * 1024 }
    });

// ==================== KNOWLEDGE BASE ENDPOINTS ====================

// Get all knowledge documents
router.get('/knowledge/documents', authenticateToken, async (req, res) => {
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
router.get('/knowledge/documents/:id', authenticateToken, async (req, res) => {
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
router.post('/knowledge/documents', authenticateToken, knowledgeUpload.single('file'), async (req, res) => {
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
router.delete('/knowledge/documents/:id', authenticateToken, async (req, res) => {
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
router.post('/knowledge/search', authenticateToken, async (req, res) => {
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
router.post('/knowledge/documents/:id/relate', authenticateToken, async (req, res) => {
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

// Structured extraction for a knowledge document (LangExtract + fallback)
router.post('/knowledge/documents/:id/extract-structured', authenticateToken, async (req, res) => {
    try {
        const { force = false, mode = 'auto', maxChars = 60000 } = req.body || {};

        const doc = await db.get(
            `SELECT id, name, extractedText, metadata
             FROM knowledge_documents
             WHERE id = ? AND organizationId = ?`,
            [req.params.id, req.user.orgId]
        );

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (!doc.extractedText || !String(doc.extractedText).trim()) {
            return res.status(400).json({ error: 'Document has no extracted text to process' });
        }

        const currentMetadata = doc.metadata ? JSON.parse(doc.metadata) : {};
        if (!force && currentMetadata.structuredExtraction) {
            return res.json({
                success: true,
                reused: true,
                structuredExtraction: currentMetadata.structuredExtraction
            });
        }

        let structuredExtraction = await extractStructuredFromText(doc.extractedText, {
            mode,
            maxChars
        });
        if (structuredExtraction.extractedParameters && !structuredExtraction.extractions) {
            structuredExtraction = { ...structuredExtraction, extractions: structuredExtraction.extractedParameters };
        }

        const mergedMetadata = {
            ...currentMetadata,
            structuredExtraction,
            structuredExtractionUpdatedAt: new Date().toISOString()
        };

        await db.run(
            'UPDATE knowledge_documents SET metadata = ?, updatedAt = ? WHERE id = ?',
            [JSON.stringify(mergedMetadata), new Date().toISOString(), req.params.id]
        );

        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'update',
            resourceType: 'document',
            resourceId: req.params.id,
            resourceName: doc.name || 'Unknown',
            details: {
                operation: 'extract-structured',
                mode,
                provider: structuredExtraction.provider || 'unknown',
                extractedItems:
                    structuredExtraction?.stats?.extractedItems ||
                    (Array.isArray(structuredExtraction.extractions) ? structuredExtraction.extractions.length : 0)
            },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            reused: false,
            structuredExtraction
        });
    } catch (error) {
        console.error('Error extracting structured knowledge:', error);
        res.status(500).json({
            error: 'Failed to extract structured data',
            details: error.message
        });
    }
});

// AI-assisted extraction: focus or filter by natural language instruction (e.g. "solo datos de sensores")
router.post('/knowledge/documents/:id/extract-with-instruction', authenticateToken, async (req, res) => {
    try {
        const { instruction } = req.body || {};
        if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
            return res.status(400).json({ error: 'instruction is required' });
        }
        if (!process.env.OPENAI_API_KEY) {
            return res.status(503).json({ error: 'OpenAI API Key not configured' });
        }

        const doc = await db.get(
            'SELECT id, name, extractedText FROM knowledge_documents WHERE id = ? AND organizationId = ?',
            [req.params.id, req.user.orgId]
        );
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        const text = doc.extractedText && String(doc.extractedText).trim();
        if (!text) return res.status(400).json({ error: 'Document has no extracted text' });

        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const truncated = text.length > 45000 ? text.slice(0, 45000) + '\n[... texto truncado ...]' : text;

        const systemPrompt = `You extract structured data from document text. The user will give an instruction to focus or filter what to extract (e.g. "solo datos de sensores", "solo parámetros de proceso", "solo límites de calidad", "sensor data only").
Output a JSON object with a single key "extractions" whose value is an array of objects. Each object must have:
- "extraction_class": string (short category, e.g. process_parameter, sensor_data, quality_limit)
- "extraction_text": string (the exact or summarized text fragment)
- "attributes": object with string keys and string/number values (e.g. parameter, value, unit, sensor_id)
Use the user instruction to decide what to extract and how to name extraction_class and attributes. Output ONLY valid JSON, no markdown.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Instruction: ${instruction.trim()}\n\nDocument text:\n${truncated}` }
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
        const extractions = Array.isArray(parsed.extractions) ? parsed.extractions : [];

        res.json({
            success: true,
            structuredExtraction: {
                provider: 'openai-instruction',
                generatedAt: new Date().toISOString(),
                extractions
            }
        });
    } catch (error) {
        console.error('Error in extract-with-instruction:', error);
        res.status(500).json({ error: 'Failed to extract with instruction', details: error.message });
    }
});

// ==================== KNOWLEDGE FOLDERS ENDPOINTS ====================

// Get all folders
router.get('/knowledge/folders', authenticateToken, async (req, res) => {
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
router.get('/knowledge/folders/:id', authenticateToken, async (req, res) => {
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
router.post('/knowledge/folders', authenticateToken, async (req, res) => {
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
router.put('/knowledge/folders/:id', authenticateToken, async (req, res) => {
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
router.delete('/knowledge/folders/:id', authenticateToken, async (req, res) => {
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
router.post('/knowledge/folders/:id/add', authenticateToken, async (req, res) => {
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
router.post('/knowledge/folders/:id/remove', authenticateToken, async (req, res) => {
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


    return router;
};
