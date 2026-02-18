/**
 * File Upload, Parse & GCS Routes
 * 
 * Handles: file uploads, spreadsheet/PDF parsing, GCS storage,
 * file content extraction.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const { authenticateToken } = require('../auth');
const { gcsService } = require('../gcsService');

module.exports = function({ db, upload, uploadsDir }) {

    // Helper function to parse CSV lines (handles quoted values with commas)
// Helper function to parse CSV lines (handles quoted values with commas)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
}

    // Helper function to extract text from files
async function extractFileContent(filename) {
    const filePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    const ext = path.extname(filename).toLowerCase();
    
    try {
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return {
                type: 'pdf',
                text: data.text,
                pages: data.numpages,
                info: data.info
            };
        } else if (ext === '.txt' || ext === '.csv') {
            const text = fs.readFileSync(filePath, 'utf8');
            return {
                type: ext.slice(1),
                text: text
            };
        } else {
            // For other file types, return info only
            return {
                type: ext.slice(1),
                text: null,
                message: 'Text extraction not supported for this file type'
            };
        }
    } catch (error) {
        console.error('Error extracting file content:', error);
        return {
            type: ext.slice(1),
            text: null,
            error: error.message
        };
    }
}

// File Upload Endpoint
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Return file info
        res.json({
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            url: `/api/files/${req.file.filename}`
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Helper: check if a file belongs to the authenticated user's organization
async function verifyFileOwnership(db, filename, orgId) {
    try {
        // Check knowledge_documents (filePath contains full path or just filename)
        const knowledgeDoc = await db.get(
            `SELECT organizationId FROM knowledge_documents WHERE filePath LIKE ? LIMIT 1`,
            [`%${filename}`]
        );
        if (knowledgeDoc) {
            return knowledgeDoc.organizationId === orgId;
        }

        // Check report_contexts
        const reportCtx = await db.get(
            `SELECT r.organizationId FROM report_contexts rc 
             JOIN reports r ON rc.reportId = r.id 
             WHERE rc.filePath LIKE ? LIMIT 1`,
            [`%${filename}`]
        );
        if (reportCtx) {
            return reportCtx.organizationId === orgId;
        }

        // Check ai_assistant_files
        const aiFile = await db.get(
            `SELECT r.organizationId FROM ai_assistant_files af 
             JOIN reports r ON af.reportId = r.id 
             WHERE af.filePath LIKE ? LIMIT 1`,
            [`%${filename}`]
        );
        if (aiFile) {
            return aiFile.organizationId === orgId;
        }

        // Check entity_records (file data stored as JSON in value field)
        const entityRecord = await db.get(
            `SELECT e.organizationId FROM entity_records er 
             JOIN entities e ON er.entityId = e.id 
             WHERE er.value LIKE ? LIMIT 1`,
            [`%${filename}%`]
        );
        if (entityRecord) {
            return entityRecord.organizationId === orgId;
        }

        // File not tracked in any table — allow access (orphaned/legacy file)
        // Authenticated users can access untracked files; this avoids breaking edge cases
        return true;
    } catch (err) {
        console.error('[FileOwnership] Error checking file ownership:', err.message);
        // On error, allow access (fail-open for availability) but log it
        return true;
    }
}

// File Serve Endpoint (requires authentication + org ownership)
router.get('/files/:filename', authenticateToken, async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Verify the file belongs to the user's organization
    const isOwner = await verifyFileOwnership(db, filename, req.user.orgId);
    if (!isOwner) {
        console.warn(`[SECURITY] Cross-org file access blocked: user ${req.user.sub} (org ${req.user.orgId}) tried to access ${filename}`);
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.sendFile(filePath);
});

// File Download Endpoint (requires authentication + org ownership)
router.get('/files/:filename/download', authenticateToken, async (req, res) => {
    const { filename } = req.params;
    const { originalName } = req.query;
    const filePath = path.join(uploadsDir, filename);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Verify the file belongs to the user's organization
    const isOwner = await verifyFileOwnership(db, filename, req.user.orgId);
    if (!isOwner) {
        console.warn(`[SECURITY] Cross-org file download blocked: user ${req.user.sub} (org ${req.user.orgId}) tried to download ${filename}`);
        return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath, originalName || filename);
});

// Parse Excel/CSV file endpoint
router.post('/parse-spreadsheet', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = path.join(uploadsDir, req.file.filename);
        const ext = path.extname(req.file.originalname).toLowerCase();

        let data = [];
        let headers = [];

        if (ext === '.csv') {
            // Parse CSV
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            if (lines.length > 0) {
                // First line is headers
                headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                
                // Parse data rows
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    if (values.length > 0) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            row[header] = values[idx] || '';
                        });
                        data.push(row);
                    }
                }
            }
        } else if (ext === '.xlsx' || ext === '.xls') {
            // Parse Excel
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON with header row
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length > 0) {
                headers = jsonData[0].map(h => String(h || '').trim());
                
                for (let i = 1; i < jsonData.length; i++) {
                    const rowData = jsonData[i];
                    if (rowData && rowData.some(cell => cell !== null && cell !== undefined && cell !== '')) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            const value = rowData[idx];
                            row[header] = value !== null && value !== undefined ? String(value) : '';
                        });
                        data.push(row);
                    }
                }
            }
        } else {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Unsupported file format. Please upload .csv, .xlsx, or .xls files.' });
        }

        // Clean up uploaded file after parsing
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            headers,
            data,
            rowCount: data.length
        });

    } catch (error) {
        console.error('Error parsing spreadsheet:', error);
        res.status(500).json({ error: 'Failed to parse spreadsheet: ' + error.message });
    }
});

// Parse PDF file endpoint (with optional GCS upload for large PDFs)
router.post('/parse-pdf', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = path.join(uploadsDir, req.file.filename);
        const ext = path.extname(req.file.originalname).toLowerCase();

        if (ext !== '.pdf') {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Unsupported file format. Please upload .pdf files.' });
        }

        // Read PDF file
        const dataBuffer = fs.readFileSync(filePath);
        
        // Parse PDF
        const pdfData = await pdfParse(dataBuffer);

        // Clean up uploaded file after parsing
        fs.unlinkSync(filePath);

        const { workflowId, nodeId } = req.body;
        const pdfTextLength = (pdfData.text || '').length;

        // If workflowId/nodeId provided and text is large, try GCS upload
        if (workflowId && nodeId && pdfTextLength > 5000) {
            const gcsAvailable = await gcsService.init();

            if (gcsAvailable) {
                const uploadResult = await gcsService.uploadWorkflowData(
                    workflowId,
                    nodeId,
                    {
                        text: pdfData.text,
                        pages: pdfData.numpages,
                        info: pdfData.info,
                        metadata: pdfData.metadata,
                        fileName: req.file.originalname
                    },
                    req.file.originalname.replace('.pdf', '_pdf_text')
                );

                if (uploadResult.success) {
                    const previewText = pdfData.text.substring(0, 500) + (pdfTextLength > 500 ? '...' : '');
                    console.log(`[PDF] Uploaded to GCS: ${uploadResult.gcsPath} (${(pdfTextLength / 1024).toFixed(1)} KB text)`);
                    
                    res.json({
                        success: true,
                        useGCS: true,
                        gcsPath: uploadResult.gcsPath,
                        pdfTextPreview: previewText,
                        textLength: pdfTextLength,
                        pages: pdfData.numpages,
                        info: pdfData.info,
                        metadata: pdfData.metadata,
                        fileName: req.file.originalname
                    });
                    return;
                } else {
                    console.warn('[PDF] GCS upload failed, falling back to inline:', uploadResult.error);
                }
            }
        }

        // Fallback: return full text inline (small files or GCS unavailable)
        res.json({
            success: true,
            useGCS: false,
            text: pdfData.text,
            pages: pdfData.numpages,
            info: pdfData.info,
            metadata: pdfData.metadata,
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error('Error parsing PDF:', error);
        res.status(500).json({ error: 'Failed to parse PDF: ' + error.message });
    }
});


// ==================== GCS ENDPOINTS ====================

// Upload spreadsheet data to GCS (for large files)
router.post('/upload-spreadsheet-gcs', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { workflowId, nodeId } = req.body;
        if (!workflowId || !nodeId) {
            return res.status(400).json({ error: 'workflowId and nodeId are required' });
        }

        const filePath = path.join(uploadsDir, req.file.filename);
        const ext = path.extname(req.file.originalname).toLowerCase();

        let data = [];
        let headers = [];

        // Parse the file
        if (ext === '.csv') {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const lines = fileContent.split('\n').filter(line => line.trim());
            
            if (lines.length > 0) {
                headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    if (values.length > 0) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            row[header] = values[idx] || '';
                        });
                        data.push(row);
                    }
                }
            }
        } else if (ext === '.xlsx' || ext === '.xls') {
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length > 0) {
                headers = jsonData[0].map(h => String(h || '').trim());
                
                for (let i = 1; i < jsonData.length; i++) {
                    const rowData = jsonData[i];
                    if (rowData && rowData.some(cell => cell !== null && cell !== undefined && cell !== '')) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            const value = rowData[idx];
                            row[header] = value !== null && value !== undefined ? String(value) : '';
                        });
                        data.push(row);
                    }
                }
            }
        } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Unsupported file format. Please upload .csv, .xlsx, or .xls files.' });
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        // Check if GCS is available
        const gcsAvailable = await gcsService.init();
        
        if (gcsAvailable && data.length > 50) {
            // Upload full data to GCS
            const uploadResult = await gcsService.uploadWorkflowData(
                workflowId,
                nodeId,
                data,
                req.file.originalname
            );

            if (uploadResult.success) {
                // Return preview (first 100 rows) + GCS reference
                const previewData = data.slice(0, 100);
                
                res.json({
                    success: true,
                    useGCS: true,
                    gcsPath: uploadResult.gcsPath,
                    headers,
                    previewData,
                    totalRows: data.length,
                    previewRows: previewData.length,
                    fileName: req.file.originalname,
                    message: `Uploaded ${data.length} rows to cloud storage`
                });
                return;
            } else {
                console.warn('[GCS] Upload failed, falling back to inline:', uploadResult.error);
            }
        }

        // Fallback: return all data inline (for small files or GCS unavailable)
        res.json({
            success: true,
            useGCS: false,
            headers,
            data,
            rowCount: data.length,
            fileName: req.file.originalname
        });

    } catch (error) {
        console.error('Error uploading spreadsheet:', error);
        res.status(500).json({ error: 'Failed to upload spreadsheet: ' + error.message });
    }
});

// Download data from GCS
router.get('/gcs-data/:gcsPath(*)', authenticateToken, async (req, res) => {
    try {
        const { gcsPath } = req.params;
        
        if (!gcsPath) {
            return res.status(400).json({ error: 'gcsPath is required' });
        }

        const gcsAvailable = await gcsService.init();
        if (!gcsAvailable) {
            return res.status(503).json({ error: 'Cloud storage not available' });
        }

        const result = await gcsService.downloadWorkflowData(gcsPath);
        
        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }

        res.json({
            success: true,
            data: result.data,
            rowCount: result.rowCount
        });

    } catch (error) {
        console.error('Error downloading from GCS:', error);
        res.status(500).json({ error: 'Failed to download data: ' + error.message });
    }
});

// Delete GCS data for a workflow
router.delete('/gcs-workflow/:workflowId', authenticateToken, async (req, res) => {
    try {
        const { workflowId } = req.params;
        
        const gcsAvailable = await gcsService.init();
        if (!gcsAvailable) {
            return res.json({ success: true, message: 'GCS not configured' });
        }

        const result = await gcsService.deleteWorkflowFolder(workflowId);
        
        res.json({
            success: true,
            deletedCount: result.deletedCount || 0
        });

    } catch (error) {
        console.error('Error deleting GCS data:', error);
        res.status(500).json({ error: 'Failed to delete data: ' + error.message });
    }
});

// Check GCS status
router.get('/gcs-status', authenticateToken, async (req, res) => {
    try {
        const gcsAvailable = await gcsService.init();
        res.json({
            available: gcsAvailable,
            bucket: gcsAvailable ? gcsService.bucketName : null
        });
    } catch (error) {
        res.json({ available: false, error: error.message });
    }
});

// ==================== END GCS ENDPOINTS ====================

// File Content Extraction Endpoint
router.get('/files/:filename/content', authenticateToken, async (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);
    
    // Security check: prevent directory traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    
    const content = await extractFileContent(filename);
    res.json(content);
});


    return router;
};
