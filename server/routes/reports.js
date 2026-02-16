/**
 * Reports & Report Templates Routes
 * 
 * Handles: report templates, reports CRUD, report sections,
 * comments, AI assistant for reports.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { authenticateToken } = require('../auth');
const { generateId, logActivity } = require('../utils/helpers');

module.exports = function({ db, upload }) {

    // Helper functions for report templates
function normalizeTemplateGenerationResult(raw, prompt) {
    const safePrompt = String(prompt || '').trim();
    const baseName = safePrompt
        ? safePrompt.split(/[.!?]/)[0].slice(0, 80).trim()
        : 'AI Generated Template';

    const sectionsInput = Array.isArray(raw?.sections) ? raw.sections : [];
    const normalizedSections = sectionsInput
        .map((section, index) => {
            const title = String(section?.title || '').trim();
            if (!title) return null;

            const itemsInput = Array.isArray(section?.items) ? section.items : [];
            const items = itemsInput
                .map((item) => {
                    const itemTitle = String(item?.title || '').trim();
                    if (!itemTitle) return null;
                    return {
                        title: itemTitle,
                        content: String(item?.content || '').trim(),
                        generationRules: String(item?.generationRules || '').trim()
                    };
                })
                .filter(Boolean);

            return {
                title,
                content: String(section?.content || '').trim(),
                generationRules: String(section?.generationRules || '').trim(),
                items,
                sortOrder: Number.isFinite(section?.sortOrder) ? Number(section.sortOrder) : index
            };
        })
        .filter(Boolean);

    const sections = normalizedSections.length > 0
        ? normalizedSections
        : [
            {
                title: 'Executive Summary',
                content: 'Summary of scope, objectives and key findings.',
                generationRules: 'Use concise, professional language and include measurable outcomes when possible.',
                items: [
                    { title: 'Scope and Objectives', content: '', generationRules: '' },
                    { title: 'Key Insights', content: '', generationRules: '' }
                ],
                sortOrder: 0
            },
            {
                title: 'Analysis',
                content: 'Main analytical section with evidence and interpretation.',
                generationRules: 'Reference available records and highlight trends or anomalies.',
                items: [
                    { title: 'Data Review', content: '', generationRules: '' },
                    { title: 'Root Cause Considerations', content: '', generationRules: '' }
                ],
                sortOrder: 1
            },
            {
                title: 'Action Plan',
                content: 'Recommended actions and follow-up.',
                generationRules: 'Prioritize actions by impact and effort, include owner and due date suggestions.',
                items: [
                    { title: 'Corrective Actions', content: '', generationRules: '' },
                    { title: 'Monitoring KPIs', content: '', generationRules: '' }
                ],
                sortOrder: 2
            }
        ];

    const suggestedEntitiesInput = Array.isArray(raw?.suggestedEntities) ? raw.suggestedEntities : [];
    const suggestedEntities = suggestedEntitiesInput
        .map((entity) => {
            const name = String(entity?.name || '').trim();
            if (!name) return null;

            const propertiesInput = Array.isArray(entity?.properties) ? entity.properties : [];
            const properties = propertiesInput
                .map((prop) => {
                    const propName = String(prop?.name || '').trim();
                    if (!propName) return null;
                    return {
                        name: propName,
                        type: String(prop?.type || 'text').trim() || 'text',
                        unit: String(prop?.unit || '').trim(),
                        defaultValue: prop?.defaultValue === undefined || prop?.defaultValue === null
                            ? ''
                            : String(prop.defaultValue)
                    };
                })
                .filter(Boolean);

            return {
                name,
                description: String(entity?.description || '').trim(),
                entityType: String(entity?.entityType || 'generic').trim() || 'generic',
                properties
            };
        })
        .filter(Boolean);

    const fallbackEntities = suggestedEntities.length > 0
        ? suggestedEntities
        : [
            {
                name: 'Batches',
                description: 'Production batches with quality and traceability fields.',
                entityType: 'generic',
                properties: [
                    { name: 'Batch code', type: 'text', unit: '', defaultValue: '' },
                    { name: 'Production date', type: 'date', unit: '', defaultValue: '' },
                    { name: 'Non-conformity count', type: 'number', unit: 'units', defaultValue: '0' }
                ]
            },
            {
                name: 'Quality checks',
                description: 'Inspection and lab checks linked to each production period.',
                entityType: 'generic',
                properties: [
                    { name: 'Check name', type: 'text', unit: '', defaultValue: '' },
                    { name: 'Result', type: 'text', unit: '', defaultValue: '' },
                    { name: 'Checked at', type: 'date', unit: '', defaultValue: '' }
                ]
            }
        ];

    const suggestedDocument = raw?.suggestedDocument && typeof raw.suggestedDocument === 'object'
        ? {
            name: String(raw.suggestedDocument.name || '').trim() || `${baseName} - Draft`,
            description: String(raw.suggestedDocument.description || '').trim()
        }
        : {
            name: `${baseName} - Draft`,
            description: ''
        };

    const templateName = String(raw?.name || '').trim() || baseName || 'AI Generated Template';

    return {
        name: templateName,
        description: String(raw?.description || '').trim() || `Template generated from prompt: ${safePrompt.slice(0, 180)}`,
        icon: String(raw?.icon || 'Sparkles').trim() || 'Sparkles',
        sections,
        suggestedDocument,
        suggestedEntities: fallbackEntities
    };
}

function buildFlatTemplateSections(sections) {
    const flat = [];
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const parentId = `sec_${Math.random().toString(36).slice(2, 11)}`;
        flat.push({
            id: parentId,
            parentId: null,
            title: section.title,
            content: section.content || '',
            generationRules: section.generationRules || '',
            sortOrder: Number.isFinite(section.sortOrder) ? section.sortOrder : i
        });

        const items = Array.isArray(section.items) ? section.items : [];
        for (let j = 0; j < items.length; j++) {
            const item = items[j];
            flat.push({
                id: `item_${Math.random().toString(36).slice(2, 11)}`,
                parentId,
                title: item.title,
                content: item.content || '',
                generationRules: item.generationRules || '',
                sortOrder: j
            });
        }
    }
    return flat;
}


    // Configure storage for AI assistant files
    const aiAssistantStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '..', 'uploads', 'ai-assistant');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + '-' + file.originalname);
        }
    });
    const aiUpload = multer({ storage: aiAssistantStorage });

router.post('/report-templates/generate', authenticateToken, async (req, res) => {
    try {
        const { prompt } = req.body || {};
        if (!prompt || !String(prompt).trim()) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        let generatedRaw = null;
        if (process.env.OPENAI_API_KEY) {
            try {
                const OpenAI = require('openai');
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    response_format: { type: 'json_object' },
                    messages: [
                        {
                            role: 'system',
                            content: `You are a senior reporting architect for industrial plants (petrochemical, plastics, polymers). You create structured report templates.

Return valid JSON only with this exact shape:
{
  "name": "string (concise template name)",
  "description": "string (1-2 sentence purpose)",
  "icon": "FileText|FlaskConical|Clipboard|Wrench|AlertTriangle|Sparkles",
  "suggestedDocument": { "name": "string", "description": "string" },
  "sections": [
    {
      "title": "string",
      "content": "string (what this section covers)",
      "generationRules": "string (instructions for auto-generating content from data)",
      "items": [
        { "title": "string", "content": "string", "generationRules": "string" }
      ]
    }
  ],
  "suggestedEntities": [
    {
      "name": "string",
      "description": "string",
      "entityType": "generic|event|ledger|machine|kpi",
      "properties": [
        { "name": "string", "type": "text|number|date|boolean", "unit": "string", "defaultValue": "string" }
      ]
    }
  ]
}

STRICT REQUIREMENTS:
- You MUST return between 4 and 6 sections. Never return just 1 section.
- Each section MUST have 2-4 items (subsections).
- Use industrial/process engineering terminology (MI, OEE, scrap, grade transitions, spec bands, etc.).
- generationRules should describe what data to pull and how to visualize (charts, tables, KPIs).
- suggestedEntities should include 2-3 relevant data entities with realistic properties.
- Keep the template actionable for a process engineer or quality manager.`
                        },
                        { role: 'user', content: String(prompt) }
                    ],
                    max_tokens: 4000
                });

                const content = completion.choices?.[0]?.message?.content || '{}';
                generatedRaw = JSON.parse(content);
            } catch (openAiError) {
                console.warn('[report-templates/generate] OpenAI failed, using heuristic fallback:', openAiError?.message);
            }
        }

        const normalized = normalizeTemplateGenerationResult(generatedRaw, prompt);
        const flatSections = buildFlatTemplateSections(normalized.sections);

        return res.json({
            id: `ai_${Date.now()}`,
            name: normalized.name,
            description: normalized.description,
            icon: normalized.icon,
            sections: flatSections,
            suggestedDocument: normalized.suggestedDocument,
            suggestedEntities: normalized.suggestedEntities
        });
    } catch (error) {
        console.error('Error generating report template with AI:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Get all templates for organization
router.get('/report-templates', authenticateToken, async (req, res) => {
    try {
        const templates = await db.all(
            `SELECT id, name, description, icon, createdBy, createdAt, updatedAt 
             FROM report_templates 
             WHERE organizationId = ? 
             ORDER BY updatedAt DESC`,
            [req.user.orgId]
        );
        
        // For each template, get its sections
        for (const template of templates) {
            template.sections = await db.all(
                `SELECT id, parentId, title, content, generationRules, sortOrder 
                 FROM template_sections 
                 WHERE templateId = ? 
                 ORDER BY sortOrder ASC`,
                [template.id]
            );
        }
        
        res.json(templates);
    } catch (error) {
        console.error('Error fetching report templates:', error);
        res.status(500).json({ error: 'Failed to fetch report templates' });
    }
});

// Get single template with sections
router.get('/report-templates/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const template = await db.get(
            `SELECT * FROM report_templates WHERE id = ? AND organizationId = ?`,
            [id, req.user.orgId]
        );
        
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        template.sections = await db.all(
            `SELECT id, parentId, title, content, generationRules, sortOrder 
             FROM template_sections 
             WHERE templateId = ? 
             ORDER BY sortOrder ASC`,
            [id]
        );
        
        res.json(template);
    } catch (error) {
        console.error('Error fetching template:', error);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

// Create new template
router.post('/report-templates', authenticateToken, async (req, res) => {
    try {
        const { name, description, icon, sections } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(
            `INSERT INTO report_templates (id, organizationId, name, description, icon, createdBy, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.orgId, name, description || '', icon || 'FileText', req.user.sub, now, now]
        );
        
        // Insert sections if provided
        if (sections && sections.length > 0) {
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                const sectionId = Math.random().toString(36).substr(2, 9);
                await db.run(
                    `INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [sectionId, id, section.parentId || null, section.title, section.content || '', section.generationRules || '', i]
                );
                
                // Handle subsections
                if (section.items && section.items.length > 0) {
                    for (let j = 0; j < section.items.length; j++) {
                        const item = section.items[j];
                        const itemId = Math.random().toString(36).substr(2, 9);
                        await db.run(
                            `INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [itemId, id, sectionId, item.title, item.content || '', item.generationRules || '', j]
                        );
                    }
                }
            }
        }
        
        // Return the created template with sections
        const createdTemplate = await db.get('SELECT * FROM report_templates WHERE id = ?', [id]);
        createdTemplate.sections = await db.all(
            'SELECT * FROM template_sections WHERE templateId = ? ORDER BY sortOrder ASC',
            [id]
        );

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'template',
            resourceId: id,
            resourceName: name,
            details: { sectionCount: sections?.length || 0 },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json(createdTemplate);
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Get template usage (which reports use this template)
router.get('/report-templates/:id/usage', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify ownership
        const existing = await db.get(
            'SELECT id FROM report_templates WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Get all reports using this template
        const reports = await db.all(`
            SELECT r.id, r.name, r.status, r.createdAt, u.name as createdByName
            FROM reports r
            LEFT JOIN users u ON r.createdBy = u.id
            WHERE r.templateId = ?
            ORDER BY r.createdAt DESC
        `, [id]);
        
        res.json({ 
            inUse: reports.length > 0,
            reportCount: reports.length,
            reports 
        });
    } catch (error) {
        console.error('Error checking template usage:', error);
        res.status(500).json({ error: 'Failed to check template usage' });
    }
});

// Update template
router.put('/report-templates/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon, sections } = req.body;
        const now = new Date().toISOString();
        
        // Verify ownership
        const existing = await db.get(
            'SELECT id FROM report_templates WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        await db.run(
            `UPDATE report_templates SET name = ?, description = ?, icon = ?, updatedAt = ? WHERE id = ?`,
            [name, description || '', icon || 'FileText', now, id]
        );
        
        // Get existing section IDs
        const existingSections = await db.all(
            'SELECT id FROM template_sections WHERE templateId = ?',
            [id]
        );
        const existingSectionIds = existingSections.map(s => s.id);
        
        // Collect new section IDs that will be kept/created
        const newSectionIds = new Set();
        
        if (sections && sections.length > 0) {
            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                const sectionId = section.id && existingSectionIds.includes(section.id) 
                    ? section.id 
                    : Math.random().toString(36).substr(2, 9);
                newSectionIds.add(sectionId);
                
                // Check if section exists
                const sectionExists = await db.get('SELECT id FROM template_sections WHERE id = ?', [sectionId]);
                
                if (sectionExists) {
                    // Update existing section
                    await db.run(
                        `UPDATE template_sections SET title = ?, content = ?, generationRules = ?, sortOrder = ?, parentId = NULL WHERE id = ?`,
                        [section.title, section.content || '', section.generationRules || '', i, sectionId]
                    );
                } else {
                    // Insert new section
                    await db.run(
                        `INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [sectionId, id, null, section.title, section.content || '', section.generationRules || '', i]
                    );
                }
                
                // Handle subsections (items)
                if (section.items && section.items.length > 0) {
                    for (let j = 0; j < section.items.length; j++) {
                        const item = section.items[j];
                        const itemId = item.id && existingSectionIds.includes(item.id)
                            ? item.id
                            : Math.random().toString(36).substr(2, 9);
                        newSectionIds.add(itemId);
                        
                        const itemExists = await db.get('SELECT id FROM template_sections WHERE id = ?', [itemId]);
                        
                        if (itemExists) {
                            await db.run(
                                `UPDATE template_sections SET title = ?, content = ?, generationRules = ?, sortOrder = ?, parentId = ? WHERE id = ?`,
                                [item.title, item.content || '', item.generationRules || '', j, sectionId, itemId]
                            );
                        } else {
                            await db.run(
                                `INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder)
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [itemId, id, sectionId, item.title, item.content || '', item.generationRules || '', j]
                            );
                        }
                    }
                }
            }
        }
        
        // Delete sections that are no longer in the template (only if not referenced)
        const sectionsToDelete = existingSectionIds.filter(sid => !newSectionIds.has(sid));
        
        for (const sectionId of sectionsToDelete) {
            // Check if this section is referenced by any report_sections
            const hasReferences = await db.get(
                'SELECT id FROM report_sections WHERE templateSectionId = ?',
                [sectionId]
            );
            
            if (hasReferences) {
                // Set the reference to NULL instead of failing
                await db.run(
                    'UPDATE report_sections SET templateSectionId = NULL WHERE templateSectionId = ?',
                    [sectionId]
                );
            }
            
            // Now safe to delete
            await db.run('DELETE FROM template_sections WHERE id = ?', [sectionId]);
        }
        
        res.json({ message: 'Template updated' });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

// Delete template
router.delete('/report-templates/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify ownership
        const existing = await db.get(
            'SELECT id FROM report_templates WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Sections will be cascade deleted
        await db.run('DELETE FROM report_templates WHERE id = ?', [id]);
        
        res.json({ message: 'Template deleted' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

// ==================== REPORTS ENDPOINTS ====================

// Get all reports for organization
router.get('/reports', authenticateToken, async (req, res) => {
    try {
        const reports = await db.all(`
            SELECT r.*, 
                   u.name as createdByName, u.email as createdByEmail,
                   rev.name as reviewerName, rev.email as reviewerEmail,
                   t.name as templateName
            FROM reports r
            LEFT JOIN users u ON r.createdBy = u.id
            LEFT JOIN users rev ON r.reviewerId = rev.id
            LEFT JOIN report_templates t ON r.templateId = t.id
            WHERE r.organizationId = ?
            ORDER BY r.updatedAt DESC
        `, [req.user.orgId]);
        
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Get single report with all sections and contexts
router.get('/reports/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const report = await db.get(`
            SELECT r.*, 
                   u.name as createdByName, u.email as createdByEmail,
                   rev.name as reviewerName, rev.email as reviewerEmail,
                   t.name as templateName
            FROM reports r
            LEFT JOIN users u ON r.createdBy = u.id
            LEFT JOIN users rev ON r.reviewerId = rev.id
            LEFT JOIN report_templates t ON r.templateId = t.id
            WHERE r.id = ? AND r.organizationId = ?
        `, [id, req.user.orgId]);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Get template sections
        const templateSections = await db.all(`
            SELECT * FROM template_sections 
            WHERE templateId = ? 
            ORDER BY sortOrder ASC
        `, [report.templateId]);
        
        // Get report sections (generated content)
        const reportSections = await db.all(`
            SELECT * FROM report_sections 
            WHERE reportId = ?
        `, [id]);
        
        // Get contexts
        const contexts = await db.all(`
            SELECT id, fileName, fileSize, uploadedAt 
            FROM report_contexts 
            WHERE reportId = ?
            ORDER BY uploadedAt DESC
        `, [id]);
        
        // Create a map of template_section.id -> report_section.id (or template_section.id if no report_section exists)
        const templateToReportIdMap = {};
        templateSections.forEach(ts => {
            const rs = reportSections.find(r => r.templateSectionId === ts.id);
            templateToReportIdMap[ts.id] = rs?.id || ts.id;
        });
        
        // Merge template sections with report sections
        const sections = templateSections.map(ts => {
            const rs = reportSections.find(r => r.templateSectionId === ts.id);
            return {
                id: templateToReportIdMap[ts.id], // Use mapped ID
                templateSectionId: ts.id,
                title: ts.title,
                content: ts.content,
                generationRules: ts.generationRules,
                sortOrder: ts.sortOrder,
                parentId: ts.parentId ? templateToReportIdMap[ts.parentId] : null, // Map parentId too!
                generatedContent: rs?.content || null,
                userPrompt: rs?.userPrompt || null,
                sectionStatus: rs?.status || 'empty',
                workflowStatus: rs?.workflowStatus || 'draft',
                generatedAt: rs?.generatedAt || null
            };
        });
        
        report.sections = sections;
        report.contexts = contexts;
        
        res.json(report);
    } catch (error) {
        console.error('Error fetching report:', error);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Create new report
router.post('/reports', authenticateToken, async (req, res) => {
    try {
        const { name, description, templateId, reviewerId, deadline } = req.body;
        const id = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(`
            INSERT INTO reports (id, organizationId, templateId, name, description, status, createdBy, reviewerId, deadline, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
        `, [id, req.user.orgId, templateId, name, description || '', req.user.sub, reviewerId || null, deadline || null, now, now]);
        
        // Create empty report sections for each template section
        const templateSections = await db.all(
            'SELECT id FROM template_sections WHERE templateId = ? AND parentId IS NULL ORDER BY sortOrder',
            [templateId]
        );
        
        for (const section of templateSections) {
            const sectionId = Math.random().toString(36).substr(2, 9);
            await db.run(`
                INSERT INTO report_sections (id, reportId, templateSectionId, status)
                VALUES (?, ?, ?, 'empty')
            `, [sectionId, id, section.id]);
        }
        
        // Also create for subsections
        const subSections = await db.all(
            'SELECT id FROM template_sections WHERE templateId = ? AND parentId IS NOT NULL ORDER BY sortOrder',
            [templateId]
        );
        
        for (const section of subSections) {
            const sectionId = Math.random().toString(36).substr(2, 9);
            await db.run(`
                INSERT INTO report_sections (id, reportId, templateSectionId, status)
                VALUES (?, ?, ?, 'empty')
            `, [sectionId, id, section.id]);
        }

        // Log activity
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: req.user.email,
            userEmail: req.user.email,
            action: 'create',
            resourceType: 'report',
            resourceId: id,
            resourceName: name,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ id, message: 'Report created' });
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});

// Update report metadata
router.put('/reports/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, reviewerId, deadline } = req.body;
        const now = new Date().toISOString();
        
        const existing = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        await db.run(`
            UPDATE reports 
            SET name = ?, description = ?, reviewerId = ?, deadline = ?, updatedAt = ?
            WHERE id = ?
        `, [name, description, reviewerId, deadline, now, id]);
        
        res.json({ message: 'Report updated' });
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

// Update report status
router.put('/reports/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const now = new Date().toISOString();
        
        const validStatuses = ['draft', 'review', 'ready_to_send'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const existing = await db.get(
            'SELECT id, name, status as previousStatus FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        await db.run(
            'UPDATE reports SET status = ?, updatedAt = ? WHERE id = ?',
            [status, now, id]
        );

        // Log status change in audit trail
        const user = await db.get('SELECT name, email FROM users WHERE id = ?', [req.user.sub]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: user?.name || req.user.email,
            userEmail: user?.email || req.user.email,
            action: 'status_change',
            resourceType: 'report',
            resourceId: id,
            resourceName: existing.name,
            details: { previousStatus: existing.previousStatus, newStatus: status },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ message: 'Status updated', status });
    } catch (error) {
        console.error('Error updating report status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Update section workflow status (per-section Draft/Review/Ready to Send)
router.put('/reports/:id/sections/:sectionId/workflow-status', authenticateToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const { workflowStatus } = req.body;
        const now = new Date().toISOString();
        
        const validStatuses = ['draft', 'review', 'ready_to_send'];
        if (!validStatuses.includes(workflowStatus)) {
            return res.status(400).json({ error: 'Invalid workflow status' });
        }
        
        const report = await db.get(
            'SELECT id, name FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Try by report_section.id first
        let section = await db.get(
            'SELECT rs.id, ts.title FROM report_sections rs JOIN template_sections ts ON rs.templateSectionId = ts.id WHERE rs.id = ? AND rs.reportId = ?',
            [sectionId, id]
        );
        
        if (section) {
            await db.run(
                'UPDATE report_sections SET workflowStatus = ? WHERE id = ?',
                [workflowStatus, section.id]
            );
        } else {
            // Try by templateSectionId
            section = await db.get(
                'SELECT rs.id, ts.title FROM report_sections rs JOIN template_sections ts ON rs.templateSectionId = ts.id WHERE rs.templateSectionId = ? AND rs.reportId = ?',
                [sectionId, id]
            );
            if (section) {
                await db.run(
                    'UPDATE report_sections SET workflowStatus = ? WHERE id = ?',
                    [workflowStatus, section.id]
                );
            } else {
                return res.status(404).json({ error: 'Section not found' });
            }
        }
        
        await db.run('UPDATE reports SET updatedAt = ? WHERE id = ?', [now, id]);

        // Log in audit trail
        const user = await db.get('SELECT name, email FROM users WHERE id = ?', [req.user.sub]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: user?.name || req.user.email,
            userEmail: user?.email || req.user.email,
            action: 'section_status_change',
            resourceType: 'report',
            resourceId: id,
            resourceName: report.name,
            details: { sectionTitle: section.title, newStatus: workflowStatus },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ message: 'Section workflow status updated', workflowStatus });
    } catch (error) {
        console.error('Error updating section workflow status:', error);
        res.status(500).json({ error: 'Failed to update section workflow status' });
    }
});

// Get audit trail for a specific report
router.get('/reports/:id/audit-trail', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify report belongs to user's organization
        const existing = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        const logs = await db.all(`
            SELECT * FROM audit_logs 
            WHERE organizationId = ? AND resourceType = 'report' AND resourceId = ?
            ORDER BY createdAt DESC
        `, [req.user.orgId, id]);
        
        res.json(logs);
    } catch (error) {
        console.error('Error fetching report audit trail:', error);
        res.status(500).json({ error: 'Failed to fetch audit trail' });
    }
});

// Delete report
router.delete('/reports/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const existing = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Delete associated context files
        const contexts = await db.all('SELECT filePath FROM report_contexts WHERE reportId = ?', [id]);
        for (const ctx of contexts) {
            try {
                fs.unlinkSync(ctx.filePath);
            } catch (e) {
                // File might not exist
            }
        }
        
        await db.run('DELETE FROM reports WHERE id = ?', [id]);
        
        res.json({ message: 'Report deleted' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

// Upload context PDF for report
router.post('/reports/:id/context', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        
        const existing = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!existing) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Extract text from PDF
        let extractedText = '';
        try {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            extractedText = pdfData.text;
        } catch (e) {
            console.error('Error extracting PDF text:', e);
        }
        
        const contextId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(`
            INSERT INTO report_contexts (id, reportId, fileName, filePath, fileSize, extractedText, uploadedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [contextId, id, req.file.originalname, req.file.path, req.file.size, extractedText, now]);
        
        res.json({ 
            id: contextId, 
            fileName: req.file.originalname, 
            fileSize: req.file.size,
            uploadedAt: now,
            hasExtractedText: extractedText.length > 0
        });
    } catch (error) {
        console.error('Error uploading context:', error);
        res.status(500).json({ error: 'Failed to upload context' });
    }
});

// Delete context
router.delete('/reports/:id/context/:contextId', authenticateToken, async (req, res) => {
    try {
        const { id, contextId } = req.params;
        
        const context = await db.get(`
            SELECT rc.* FROM report_contexts rc
            JOIN reports r ON rc.reportId = r.id
            WHERE rc.id = ? AND r.id = ? AND r.organizationId = ?
        `, [contextId, id, req.user.orgId]);
        
        if (!context) {
            return res.status(404).json({ error: 'Context not found' });
        }
        
        // Delete file
        try {
            fs.unlinkSync(context.filePath);
        } catch (e) {
            // File might not exist
        }
        
        await db.run('DELETE FROM report_contexts WHERE id = ?', [contextId]);
        
        res.json({ message: 'Context deleted' });
    } catch (error) {
        console.error('Error deleting context:', error);
        res.status(500).json({ error: 'Failed to delete context' });
    }
});

// Generate content for a section
router.post('/reports/:id/sections/:sectionId/generate', authenticateToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const { prompt, mentionedEntityIds } = req.body;
        
        console.log('[Generate] Request received:', { reportId: id, sectionId, prompt: prompt?.slice(0, 50) });
        
        // Verify report ownership
        const report = await db.get(
            'SELECT * FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // First, try to find if sectionId is a report_sections.id (the new way)
        let reportSection = await db.get(
            'SELECT * FROM report_sections WHERE id = ?',
            [sectionId]
        );
        
        let templateSectionId;
        if (reportSection) {
            // sectionId is a report_sections.id, get the templateSectionId from it
            templateSectionId = reportSection.templateSectionId;
            console.log('[Generate] Found report section, templateSectionId:', templateSectionId);
        } else {
            // sectionId might be a templateSectionId (old way), try to find or create report_section
            templateSectionId = sectionId;
            reportSection = await db.get(
                'SELECT * FROM report_sections WHERE reportId = ? AND templateSectionId = ?',
                [id, templateSectionId]
            );
            console.log('[Generate] Using sectionId as templateSectionId:', templateSectionId);
        }
        
        // Get template section info
        const templateSection = await db.get(
            'SELECT * FROM template_sections WHERE id = ?',
            [templateSectionId]
        );
        
        if (!templateSection) {
            console.error('[Generate] Template section not found:', templateSectionId);
            return res.status(404).json({ error: 'Section not found' });
        }
        
        // Get all context texts for this report
        const contexts = await db.all(
            'SELECT extractedText FROM report_contexts WHERE reportId = ?',
            [id]
        );
        const contextText = contexts.map(c => c.extractedText).filter(Boolean).join('\n\n---\n\n');
        
        // Get entity data for mentioned entities
        let entityContext = '';
        if (mentionedEntityIds && mentionedEntityIds.length > 0) {
            for (const entityId of mentionedEntityIds) {
                const entity = await db.get('SELECT * FROM entities WHERE id = ?', [entityId]);
                if (entity) {
                    const records = await db.all(`
                        SELECT r.*, rv.propertyId, rv.value, p.name as propertyName
                        FROM records r
                        LEFT JOIN record_values rv ON r.id = rv.recordId
                        LEFT JOIN properties p ON rv.propertyId = p.id
                        WHERE r.entityId = ?
                    `, [entityId]);
                    
                    entityContext += `\n\n### ${entity.name} Data:\n`;
                    // Group records
                    const recordMap = new Map();
                    for (const rec of records) {
                        if (!recordMap.has(rec.id)) {
                            recordMap.set(rec.id, {});
                        }
                        if (rec.propertyName && rec.value) {
                            recordMap.get(rec.id)[rec.propertyName] = rec.value;
                        }
                    }
                    entityContext += JSON.stringify(Array.from(recordMap.values()), null, 2);
                }
            }
        }
        
        // Build the full prompt for AI
        const systemPrompt = `You are generating content for a professional report section.
Section Title: ${templateSection.title}
Section Description: ${templateSection.content || 'No specific description'}
Generation Rules: ${templateSection.generationRules || 'Write in a professional, clear manner'}

${contextText ? `CONTEXT DOCUMENTS:\n${contextText}\n\n` : ''}
${entityContext ? `ENTITY DATA:${entityContext}\n\n` : ''}

Based on the user's prompt and the context provided, generate appropriate content for this section.
Write in a professional tone suitable for a formal report.`;

        // Call OpenAI
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        
        console.log('[Generate] Calling OpenAI...');
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2000
        });
        
        const generatedContent = completion.choices[0]?.message?.content || '';
        const now = new Date().toISOString();
        
        console.log('[Generate] Content generated, length:', generatedContent.length);
        
        // Check if report_section exists, create or update
        const existingSection = await db.get(
            'SELECT id FROM report_sections WHERE reportId = ? AND templateSectionId = ?',
            [id, templateSectionId]
        );
        
        if (existingSection) {
            await db.run(`
                UPDATE report_sections 
                SET content = ?, userPrompt = ?, status = 'generated', generatedAt = ?
                WHERE id = ?
            `, [generatedContent, prompt, now, existingSection.id]);
            console.log('[Generate] Updated existing section:', existingSection.id);
        } else {
            const newSectionId = Math.random().toString(36).substr(2, 9);
            await db.run(`
                INSERT INTO report_sections (id, reportId, templateSectionId, content, userPrompt, status, generatedAt)
                VALUES (?, ?, ?, ?, ?, 'generated', ?)
            `, [newSectionId, id, templateSectionId, generatedContent, prompt, now]);
            console.log('[Generate] Created new section:', newSectionId);
        }
        
        // Update report timestamp
        await db.run('UPDATE reports SET updatedAt = ? WHERE id = ?', [now, id]);

        // Log generation in audit trail
        const userInfo = await db.get('SELECT name, email FROM users WHERE id = ?', [req.user.sub]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: userInfo?.name || req.user.email,
            userEmail: userInfo?.email || req.user.email,
            action: 'generate_content',
            resourceType: 'report',
            resourceId: id,
            resourceName: report.name,
            details: { sectionTitle: templateSection.title, prompt: prompt?.substring(0, 150) },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ content: generatedContent, generatedAt: now });
    } catch (error) {
        console.error('Error generating section:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

// Save/update section content manually
router.put('/reports/:id/sections/:sectionId', authenticateToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const { content } = req.body;
        const now = new Date().toISOString();
        
        console.log('[Update Section] Request:', { reportId: id, sectionId, contentLength: content?.length });
        
        const report = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Check if this is a report_section.id or a template_section.id
        // First try to find by report_section.id (the new way)
        const existingSection = await db.get(
            'SELECT id FROM report_sections WHERE id = ? AND reportId = ?',
            [sectionId, id]
        );
        
        if (existingSection) {
            console.log('[Update Section] Updating existing section:', existingSection.id);
            await db.run(`
                UPDATE report_sections 
                SET content = ?, status = 'edited', generatedAt = ?
                WHERE id = ?
            `, [content, now, existingSection.id]);
        } else {
            // If not found, try by templateSectionId (the old way for backward compatibility)
            const sectionByTemplate = await db.get(
                'SELECT id FROM report_sections WHERE reportId = ? AND templateSectionId = ?',
                [id, sectionId]
            );
            
            if (sectionByTemplate) {
                console.log('[Update Section] Updating by template:', sectionByTemplate.id);
                await db.run(`
                    UPDATE report_sections 
                    SET content = ?, status = 'edited', generatedAt = ?
                    WHERE id = ?
                `, [content, now, sectionByTemplate.id]);
            } else {
                console.log('[Update Section] Creating new section');
                const newSectionId = Math.random().toString(36).substr(2, 9);
                await db.run(`
                    INSERT INTO report_sections (id, reportId, templateSectionId, content, status, generatedAt)
                    VALUES (?, ?, ?, ?, 'edited', ?)
                `, [newSectionId, id, sectionId, content, now]);
            }
        }
        
        console.log('[Update Section] Section saved successfully');
        await db.run('UPDATE reports SET updatedAt = ? WHERE id = ?', [now, id]);
        
        res.json({ message: 'Section saved' });
    } catch (error) {
        console.error('Error saving section:', error);
        res.status(500).json({ error: 'Failed to save section' });
    }
});

// ==================== REPORT COMMENTS ENDPOINTS ====================

// Get all comments for a report
router.get('/reports/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const report = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        const comments = await db.all(`
            SELECT c.*, u.name as userName, u.email as userEmail,
                   resolver.name as resolvedByName
            FROM report_comments c
            LEFT JOIN users u ON c.userId = u.id
            LEFT JOIN users resolver ON c.resolvedBy = resolver.id
            WHERE c.reportId = ?
            ORDER BY c.createdAt DESC
        `, [id]);
        
        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Create a new comment
router.post('/reports/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sectionId, selectedText, startOffset, endOffset, commentText, suggestionText } = req.body;
        
        const report = await db.get(
            'SELECT id FROM reports WHERE id = ? AND organizationId = ?',
            [id, req.user.orgId]
        );
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Get user info
        const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.sub]);
        
        const commentId = Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();
        
        await db.run(`
            INSERT INTO report_comments (id, reportId, sectionId, userId, userName, selectedText, startOffset, endOffset, commentText, suggestionText, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
        `, [commentId, id, sectionId, req.user.sub, user?.name || 'Unknown', selectedText, startOffset, endOffset, commentText, suggestionText || null, now, now]);
        
        const comment = await db.get('SELECT * FROM report_comments WHERE id = ?', [commentId]);

        // Log comment creation in audit trail
        const reportInfo = await db.get('SELECT name FROM reports WHERE id = ?', [id]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: user?.name || req.user.email,
            userEmail: req.user.email,
            action: 'add_comment',
            resourceType: 'report',
            resourceId: id,
            resourceName: reportInfo?.name || id,
            details: { commentText: commentText?.substring(0, 100) },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json(comment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// Update a comment
router.put('/reports/:id/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const { commentText, suggestionText } = req.body;
        const now = new Date().toISOString();
        
        const comment = await db.get(`
            SELECT c.* FROM report_comments c
            JOIN reports r ON c.reportId = r.id
            WHERE c.id = ? AND r.id = ? AND r.organizationId = ?
        `, [commentId, id, req.user.orgId]);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Only the author can edit their comment
        if (comment.userId !== req.user.sub) {
            return res.status(403).json({ error: 'You can only edit your own comments' });
        }
        
        await db.run(`
            UPDATE report_comments SET commentText = ?, suggestionText = ?, updatedAt = ? WHERE id = ?
        `, [commentText, suggestionText || null, now, commentId]);
        
        res.json({ message: 'Comment updated' });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// Resolve/unresolve a comment
router.put('/reports/:id/comments/:commentId/resolve', authenticateToken, async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const { resolved } = req.body;
        const now = new Date().toISOString();
        
        const comment = await db.get(`
            SELECT c.* FROM report_comments c
            JOIN reports r ON c.reportId = r.id
            WHERE c.id = ? AND r.id = ? AND r.organizationId = ?
        `, [commentId, id, req.user.orgId]);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        if (resolved) {
            await db.run(`
                UPDATE report_comments SET status = 'resolved', resolvedAt = ?, resolvedBy = ?, updatedAt = ? WHERE id = ?
            `, [now, req.user.sub, now, commentId]);
        } else {
            await db.run(`
                UPDATE report_comments SET status = 'open', resolvedAt = NULL, resolvedBy = NULL, updatedAt = ? WHERE id = ?
            `, [now, commentId]);
        }

        // Log comment resolve/reopen in audit trail
        const reportInfo = await db.get('SELECT name FROM reports WHERE id = ?', [id]);
        const userInfo = await db.get('SELECT name, email FROM users WHERE id = ?', [req.user.sub]);
        await logActivity(db, {
            organizationId: req.user.orgId,
            userId: req.user.sub,
            userName: userInfo?.name || req.user.email,
            userEmail: userInfo?.email || req.user.email,
            action: resolved ? 'resolve_comment' : 'reopen_comment',
            resourceType: 'report',
            resourceId: id,
            resourceName: reportInfo?.name || id,
            details: { commentId },
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });
        
        res.json({ message: resolved ? 'Comment resolved' : 'Comment reopened' });
    } catch (error) {
        console.error('Error resolving comment:', error);
        res.status(500).json({ error: 'Failed to resolve comment' });
    }
});

// Delete a comment
router.delete('/reports/:id/comments/:commentId', authenticateToken, async (req, res) => {
    try {
        const { id, commentId } = req.params;
        
        const comment = await db.get(`
            SELECT c.* FROM report_comments c
            JOIN reports r ON c.reportId = r.id
            WHERE c.id = ? AND r.id = ? AND r.organizationId = ?
        `, [commentId, id, req.user.orgId]);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Only the author can delete their comment
        if (comment.userId !== req.user.sub) {
            return res.status(403).json({ error: 'You can only delete your own comments' });
        }
        
        await db.run('DELETE FROM report_comments WHERE id = ?', [commentId]);
        
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ==================== AI ASSISTANT ENDPOINTS ====================

// Upload file for AI assistant context
router.post('/reports/:id/assistant/files', authenticateToken, aiUpload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify report belongs to organization
        const report = await db.get('SELECT * FROM reports WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Extract text from file if possible
        let extractedText = '';
        if (file.mimetype === 'application/pdf') {
            try {
                const dataBuffer = fs.readFileSync(file.path);
                const pdfData = await pdfParse(dataBuffer);
                extractedText = pdfData.text;
            } catch (err) {
                console.error('Error parsing PDF:', err);
            }
        } else if (file.mimetype === 'text/plain') {
            extractedText = fs.readFileSync(file.path, 'utf8');
        }
        
        const fileId = `aifile-${Date.now()}`;
        
        // Store file reference in database
        await db.run(`
            INSERT INTO ai_assistant_files (id, reportId, fileName, filePath, fileSize, extractedText, uploadedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [fileId, id, file.originalname, file.path, file.size, extractedText, new Date().toISOString()]);
        
        res.json({
            id: fileId,
            fileName: file.originalname,
            fileSize: file.size,
            uploadedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error uploading AI assistant file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Delete AI assistant file
router.delete('/reports/:id/assistant/files/:fileId', authenticateToken, async (req, res) => {
    try {
        const { id, fileId } = req.params;
        
        const file = await db.get(`
            SELECT af.* FROM ai_assistant_files af
            JOIN reports r ON af.reportId = r.id
            WHERE af.id = ? AND r.id = ? AND r.organizationId = ?
        `, [fileId, id, req.user.orgId]);
        
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Delete physical file
        if (fs.existsSync(file.filePath)) {
            fs.unlinkSync(file.filePath);
        }
        
        // Delete from database
        await db.run('DELETE FROM ai_assistant_files WHERE id = ?', [fileId]);
        
        res.json({ message: 'File deleted' });
    } catch (error) {
        console.error('Error deleting AI assistant file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// AI Assistant Chat endpoint
router.post('/reports/:id/assistant/chat', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { message, sectionId, contextFileIds, applyToContent } = req.body;
        
        console.log('[AI Assistant Chat] Request received:', { 
            reportId: id, 
            sectionId, 
            applyToContent, 
            messagePreview: message?.slice(0, 50) 
        });
        
        // Verify report belongs to organization
        const report = await db.get('SELECT * FROM reports WHERE id = ? AND organizationId = ?', [id, req.user.orgId]);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Get all sections for context
        const sections = await db.all(`
            SELECT rs.id, rs.reportId, rs.templateSectionId, rs.content as generatedContent, 
                   rs.userPrompt, rs.status, rs.generatedAt, ts.title, ts.sortOrder 
            FROM report_sections rs 
            LEFT JOIN template_sections ts ON rs.templateSectionId = ts.id 
            WHERE rs.reportId = ? 
            ORDER BY ts.sortOrder
        `, [id]);
        
        console.log('[AI Assistant] Sections loaded:', sections.map(s => ({ id: s.id, title: s.title, hasContent: !!s.generatedContent })));
        
        // Get the specific section if provided
        const currentSection = sectionId ? sections.find(s => s.id === sectionId) : null;
        
        console.log('[AI Assistant] Looking for section:', sectionId);
        console.log('[AI Assistant] Available section IDs:', sections.map(s => s.id));
        
        if (currentSection) {
            console.log('[AI Assistant] Current section:', {
                title: currentSection.title,
                hasContent: !!currentSection.generatedContent,
                contentLength: currentSection.generatedContent?.length || 0
            });
        }
        
        // Get context files content
        let contextContent = '';
        if (contextFileIds && contextFileIds.length > 0) {
            const files = await db.all(`
                SELECT extractedText, fileName FROM ai_assistant_files 
                WHERE id IN (${contextFileIds.map(() => '?').join(',')}) AND reportId = ?
            `, [...contextFileIds, id]);
            
            contextContent = files.map(f => `[File: ${f.fileName}]\n${f.extractedText || '(No text extracted)'}`).join('\n\n');
        }
        
        // Build context for the AI
        const documentContext = sections.map(s => 
            `[Section: ${s.title}]\n${s.generatedContent || '(Empty)'}`
        ).join('\n\n---\n\n');
        
        // Check if user is asking for a suggestion/modification (English and Spanish)
        // OR if applyToContent mode is enabled (always treat as suggestion request)
        const keywordMatch = /suggest|improve|rewrite|modify|change|edit|fix|update|revise|mejorar|cambiar|modificar|editar|corregir|reescribir|traducir|translate|escribe|write|rehacer|actualizar/i.test(message);
        const isSuggestionRequest = applyToContent === true || keywordMatch;
        
        // Determine if we should force content generation mode
        const forceContentMode = applyToContent === true && currentSection && currentSection.generatedContent;
        
        console.log('[AI Assistant] Mode check:', {
            applyToContent,
            hasCurrentSection: !!currentSection,
            hasGeneratedContent: !!currentSection?.generatedContent,
            forceContentMode,
            isSuggestionRequest
        });
        
        // Prepare the prompt for OpenAI
        let systemPrompt;
        
        if (forceContentMode) {
            // When applyToContent is ON, ask AI to return ONLY the modified content
            systemPrompt = `You are an AI assistant that modifies document content based on user requests.

Current section: "${currentSection.title}"
Current content:
"""
${currentSection.generatedContent}
"""

${contextContent ? `Additional context files:\n${contextContent}\n\n` : ''}

CRITICAL INSTRUCTIONS:
- Apply the user's requested changes to the current content
- Return ONLY the complete modified content - nothing else
- Do NOT include explanations, introductions, or any text before or after the content
- Do NOT include phrases like "Here is the modified content:" or "Sure, here it is:"
- Just output the final content directly as if you were writing the document section
- Preserve the overall structure and tone unless specifically asked to change it
- If the request is unclear, make reasonable improvements while keeping the original meaning`;
        } else {
            systemPrompt = `You are an AI assistant helping users with document creation and review.
You have access to the full document with all its sections.

${contextContent ? `Additional context files provided:\n${contextContent}\n\n` : ''}

Current document sections:
${documentContext}

${currentSection ? `The user is currently viewing section: "${currentSection.title}"
Current content: ${currentSection.generatedContent || '(Empty)'}` : ''}

Instructions:
- Answer questions about the document content
- Help improve writing quality
- Suggest changes when asked
- Be concise and helpful
- If the user asks for changes to a section, provide the complete suggested content

${isSuggestionRequest && currentSection ? `
IMPORTANT: Since the user seems to be asking for a modification, if you want to suggest changes to the current section, 
respond with your explanation followed by a JSON block in this exact format:
\`\`\`suggestion
{
  "sectionId": "${currentSection.id}",
  "sectionTitle": "${currentSection.title}",
  "originalContent": "${(currentSection.generatedContent || '').replace(/"/g, '\\"').slice(0, 200)}...",
  "suggestedContent": "YOUR COMPLETE SUGGESTED CONTENT HERE"
}
\`\`\`
Only include this if you're making a concrete suggestion for content changes.
` : ''}`;
        }

        // Call OpenAI API
        const openaiApiKey = process.env.OPENAI_API_KEY;
        
        if (!openaiApiKey) {
            // Return a mock response for testing without API key
            let suggestionContent = null;
            if (isSuggestionRequest && currentSection && currentSection.generatedContent) {
                // Generate a meaningful mock suggestion based on the request
                const originalText = currentSection.generatedContent;
                let improvedText = originalText;
                
                // Simple transformations for demo purposes
                if (/translate|traducir|inglés|english/i.test(message)) {
                    improvedText = `[English translation of the content]\n\n${originalText}\n\n[This is a mock translation - connect OpenAI API for real translations]`;
                } else if (/mejorar|improve|better/i.test(message)) {
                    improvedText = `${originalText}\n\nAdditionally, this section has been enhanced with more professional language and clearer structure to improve readability and impact.`;
                } else if (/más largo|longer|expand|ampliar/i.test(message)) {
                    improvedText = `${originalText}\n\nFurthermore, expanding on the above points, it's important to note the following additional considerations and details that strengthen the overall narrative and provide more comprehensive coverage of the topic.`;
                } else if (/más corto|shorter|resume|summarize/i.test(message)) {
                    improvedText = originalText.split('.').slice(0, 2).join('.') + '.';
                } else {
                    improvedText = `${originalText}\n\n[Modified based on your request: "${message}"]`;
                }
                
                suggestionContent = {
                    sectionId: currentSection.id,
                    sectionTitle: currentSection.title,
                    originalContent: originalText,
                    suggestedContent: improvedText
                };
            }
            
            const mockResponse = {
                response: isSuggestionRequest && currentSection && currentSection.generatedContent
                    ? `I've prepared a suggested modification for the section "${currentSection.title}" based on your request. Please review the changes below and click Accept to apply them or Reject to keep the original content.`
                    : `I understand you're asking about the document. Based on the current content across ${sections.length} sections, I can help you improve or answer questions about any part of the document.\n\n${currentSection ? `You're currently viewing "${currentSection.title}".${currentSection.generatedContent ? ' Ask me to improve, translate, or modify this content.' : ' This section is empty - generate some content first.'}` : 'Please select a section for more specific assistance.'}`,
                suggestion: suggestionContent
            };
            return res.json(mockResponse);
        }
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        
        if (!openaiResponse.ok) {
            throw new Error('OpenAI API error');
        }
        
        const openaiData = await openaiResponse.json();
        const assistantResponse = openaiData.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
        
        // Handle response based on mode
        let suggestion = null;
        let cleanResponse = assistantResponse;
        
        if (forceContentMode) {
            // In force content mode, the AI response IS the suggested content
            // Build the suggestion object programmatically
            suggestion = {
                sectionId: currentSection.id,
                sectionTitle: currentSection.title,
                originalContent: currentSection.generatedContent,
                suggestedContent: assistantResponse.trim()
            };
            
            // Don't save automatically - let the user Accept/Reject
            cleanResponse = `He preparado una sugerencia para la sección "${currentSection.title}". Revisa los cambios y haz clic en Aceptar para aplicarlos o Rechazar para descartarlos.`;
        } else {
            // Parse suggestion from response if present (legacy mode)
            const suggestionMatch = assistantResponse.match(/```suggestion\n([\s\S]*?)\n```/);
            if (suggestionMatch) {
                try {
                    suggestion = JSON.parse(suggestionMatch[1]);
                } catch (e) {
                    console.error('Error parsing suggestion:', e);
                }
            }
            // Clean response (remove suggestion block if present)
            cleanResponse = assistantResponse.replace(/```suggestion\n[\s\S]*?\n```/g, '').trim();
        }
        
        res.json({
            response: cleanResponse,
            suggestion
        });
        
        console.log('[AI Assistant] Response sent:', {
            hasSuggestion: !!suggestion,
            responseLength: cleanResponse?.length || 0
        });
        
    } catch (error) {
        console.error('Error in AI assistant chat:', error);
        res.status(500).json({ error: 'Failed to process message' });
    }
});

// Stripe Webhook to handle subscription events

    return router;
};
