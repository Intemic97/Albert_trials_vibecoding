/**
 * Workflow Executor - Executes workflows in the backend
 * Supports both full workflow execution and individual node execution
 */

const crypto = require('crypto');
const { gcsService } = require('./gcsService');
const { isTimeSeriesData: detectTimeSeriesData, normalizeTimeSeriesData } = require('./utils/timeSeriesHelper');
const { getOTConnectionsManager } = require('./utils/otConnections');
const { getOTAlertsManager } = require('./utils/otAlerts');

// WebSocket broadcast function (will be set from server/index.js)
let broadcastToOrganizationFn = null;

function setBroadcastToOrganization(fn) {
    broadcastToOrganizationFn = fn;
}

// Generate unique ID
const generateId = () => crypto.randomBytes(8).toString('hex');

class WorkflowExecutor {
    constructor(db, executionId = null, organizationId = null, userId = null) {
        this.db = db;
        this.executionId = executionId;
        this.workflow = null;
        this.nodes = [];
        this.connections = [];
        this.nodeResults = {};
        this.execution = null;
        this.organizationId = organizationId;
        this.userId = userId;
        this.otAlertsManager = getOTAlertsManager(db, broadcastToOrganizationFn);
    }

    /**
     * Create a new execution record and execute the workflow
     */
    async executeWorkflow(workflowId, inputs = {}, organizationId = null) {
        // Create execution record
        this.executionId = generateId();
        const now = new Date().toISOString();

        await this.db.run(`
            INSERT INTO workflow_executions (id, workflowId, organizationId, status, inputs, createdAt)
            VALUES (?, ?, ?, 'pending', ?, ?)
        `, [this.executionId, workflowId, organizationId, JSON.stringify(inputs), now]);

        try {
            // Load workflow
            this.workflow = await this.db.get('SELECT * FROM workflows WHERE id = ?', [workflowId]);
            if (!this.workflow) {
                throw new Error('Workflow not found');
            }

            // Parse workflow data
            const workflowData = JSON.parse(this.workflow.data);
            this.nodes = workflowData.nodes || [];
            this.connections = workflowData.connections || [];

            // Apply inputs to manualInput nodes
            this.applyInputs(inputs);

            // Update status to running
            await this.updateExecutionStatus('running', { startedAt: now });

            // Find starting node(s) - trigger, webhook, or nodes with no incoming connections
            const triggerNode = this.nodes.find(n => n.type === 'trigger');
            const webhookNode = this.nodes.find(n => n.type === 'webhook');
            
            if (triggerNode) {
                // Start from trigger
                await this.executeNode(triggerNode.id, null, true);
            } else if (webhookNode) {
                // Start from webhook - pass webhook data as input
                const webhookInput = inputs._webhookData || {};
                await this.executeNode(webhookNode.id, webhookInput, true);
            } else {
                // No trigger or webhook - find root nodes (nodes with no incoming connections)
                const nodesWithIncoming = new Set(this.connections.map(c => c.toNodeId));
                const rootNodes = this.nodes.filter(n => 
                    !nodesWithIncoming.has(n.id) && n.type !== 'comment'
                );

                if (rootNodes.length === 0) {
                    // Fallback: start with manualInput nodes
                    const inputNodes = this.nodes.filter(n => n.type === 'manualInput');
                    if (inputNodes.length === 0) {
                        throw new Error('No starting nodes found in workflow');
                    }
                    for (const node of inputNodes) {
                        await this.executeNode(node.id, null, true);
                    }
                } else {
                    // Execute all root nodes
                    for (const node of rootNodes) {
                        await this.executeNode(node.id, null, true);
                    }
                }
            }

            // Check if any node produced a webhookResponse
            let webhookResponseData = null;
            for (const [nodeId, result] of Object.entries(this.nodeResults)) {
                if (result && result.isWebhookResponse) {
                    webhookResponseData = {
                        statusCode: result.webhookResponseStatusCode || 200,
                        headers: result.webhookResponseHeaders || {},
                        body: result.webhookResponseBody
                    };
                    break;
                }
            }

            // Mark as completed
            await this.updateExecutionStatus('completed', {
                completedAt: new Date().toISOString(),
                finalOutput: JSON.stringify(this.nodeResults),
                nodeResults: JSON.stringify(this.nodeResults)
            });

            return {
                executionId: this.executionId,
                status: 'completed',
                results: this.nodeResults,
                webhookResponse: webhookResponseData
            };

        } catch (error) {
            console.error('[WorkflowExecutor] Error:', error);
            await this.updateExecutionStatus('failed', {
                error: error.message,
                completedAt: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Execute a single node (can be recursive or not)
     */
    async executeSingleNode(workflowId, nodeId, inputData = null, recursive = false) {
        // Load workflow if not loaded
        if (!this.workflow) {
            this.workflow = await this.db.get('SELECT * FROM workflows WHERE id = ?', [workflowId]);
            if (!this.workflow) {
                throw new Error('Workflow not found');
            }
            const workflowData = JSON.parse(this.workflow.data);
            this.nodes = workflowData.nodes || [];
            this.connections = workflowData.connections || [];
        }

        // Create execution record for single node
        if (!this.executionId) {
            this.executionId = generateId();
            const now = new Date().toISOString();
            await this.db.run(`
                INSERT INTO workflow_executions (id, workflowId, status, triggerType, inputs, createdAt, startedAt)
                VALUES (?, ?, 'running', 'single_node', ?, ?, ?)
            `, [this.executionId, workflowId, JSON.stringify({ nodeId, inputData }), now, now]);
        }

        try {
            const result = await this.executeNode(nodeId, inputData, recursive);

            await this.updateExecutionStatus('completed', {
                completedAt: new Date().toISOString(),
                finalOutput: JSON.stringify(result),
                nodeResults: JSON.stringify(this.nodeResults)
            });

            return {
                executionId: this.executionId,
                status: 'completed',
                nodeId,
                result
            };
        } catch (error) {
            await this.updateExecutionStatus('failed', {
                error: error.message,
                completedAt: new Date().toISOString()
            });
            throw error;
        }
    }

    /**
     * Execute a node and optionally continue to connected nodes
     */
    async executeNode(nodeId, inputData = null, recursive = true) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) {
            throw new Error(`Node ${nodeId} not found`);
        }

        const startTime = Date.now();
        await this.logNodeStart(node);

        try {
            // Update current node in execution
            await this.db.run(
                'UPDATE workflow_executions SET currentNodeId = ? WHERE id = ?',
                [nodeId, this.executionId]
            );

            // Execute based on node type
            const result = await this.runNodeHandler(node, inputData);

            // Process OT alerts if this is an OT node
            const otNodeTypes = ['opcua', 'mqtt', 'modbus', 'scada', 'mes', 'dataHistorian'];
            if (otNodeTypes.includes(node.type) && result.success && result.outputData && this.organizationId) {
                try {
                    const alerts = await this.otAlertsManager.processNodeAlerts(
                        node,
                        result.outputData,
                        this.organizationId,
                        this.userId
                    );
                    if (alerts.length > 0) {
                        result.metadata = result.metadata || {};
                        result.metadata.alerts = alerts.map(a => ({
                            id: a.id,
                            fieldName: a.fieldName,
                            value: a.value,
                            severity: a.severity,
                            message: a.message
                        }));
                    }
                } catch (alertError) {
                    console.error(`[executeNode] Error processing alerts for node ${nodeId}:`, alertError);
                    // Don't fail the node execution if alert processing fails
                }
            }

            // Store result
            this.nodeResults[nodeId] = result;

            // Log completion
            await this.logNodeComplete(node, inputData, result, Date.now() - startTime);

            // If recursive, execute connected nodes
            if (recursive) {
                const nextNodes = this.getNextNodes(nodeId, result);
                for (const nextNode of nextNodes) {
                    await this.executeNode(nextNode.id, result.outputData, true);
                }
            }

            return result;

        } catch (error) {
            await this.logNodeError(node, inputData, error, Date.now() - startTime);
            throw error;
        }
    }

    /**
     * Run the appropriate handler for a node type
     */
    async runNodeHandler(node, inputData) {
        const handlers = {
            trigger: () => this.handleTrigger(node, inputData),
            manualInput: () => this.handleManualInput(node, inputData),
            output: () => this.handleOutput(node, inputData),
            fetchData: () => this.handleFetchData(node, inputData),
            excelInput: () => this.handleExcelInput(node, inputData),
            pdfInput: () => this.handlePdfInput(node, inputData),
            saveRecords: () => this.handleSaveRecords(node, inputData),
            action: () => this.handleRenameColumns(node, inputData),
            addField: () => this.handleAddField(node, inputData),
            condition: () => this.handleCondition(node, inputData),
            join: () => this.handleJoin(node, inputData),
            http: () => this.handleHttp(node, inputData),
            llm: () => this.handleLLM(node, inputData),
            mysql: () => this.handleMySQL(node, inputData),
            sendEmail: () => this.handleSendEmail(node, inputData),
            sendSMS: () => this.handleSendSMS(node, inputData),
            sendWhatsApp: () => this.handleSendWhatsApp(node, inputData),
            sendSlack: () => this.handleSendSlack(node, inputData),
            sendDiscord: () => this.handleSendDiscord(node, inputData),
            sendTeams: () => this.handleSendTeams(node, inputData),
            sendTelegram: () => this.handleSendTelegram(node, inputData),
            googleSheets: () => this.handleGoogleSheets(node, inputData),
            dataVisualization: () => this.handleDataVisualization(node, inputData),
            esios: () => this.handleEsios(node, inputData),
            climatiq: () => this.handleClimatiq(node, inputData),
            splitColumns: () => this.handleSplitColumns(node, inputData),
            comment: () => this.handleComment(node, inputData),
            humanApproval: () => this.handleHumanApproval(node, inputData),
            webhook: () => this.handleWebhook(node, inputData),
            webhookResponse: () => this.handleWebhookResponse(node, inputData),
            // OT/Industrial nodes
            opcua: () => this.handleOpcua(node, inputData),
            mqtt: () => this.handleMqtt(node, inputData),
            modbus: () => this.handleModbus(node, inputData),
            scada: () => this.handleScada(node, inputData),
            mes: () => this.handleMes(node, inputData),
            dataHistorian: () => this.handleDataHistorian(node, inputData),
            timeSeriesAggregator: () => this.handleTimeSeriesAggregator(node, inputData),
            jsCode: () => this.handleJsCode(node, inputData),
            specializedAgent: () => this.handleSpecializedAgent(node, inputData),
        };

        const handler = handlers[node.type];
        if (!handler) {
            return {
                success: true,
                message: `Node type '${node.type}' not implemented yet`,
                outputData: inputData
            };
        }

        return await handler();
    }

    // ==================== NODE HANDLERS ====================

    async handleTrigger(node, inputData) {
        return {
            success: true,
            message: 'Workflow triggered',
            outputData: inputData || {}
        };
    }

    async handleManualInput(node, inputData) {
        const varName = node.config?.inputVarName || node.config?.variableName || 'input';
        const value = node.config?.inputVarValue || node.config?.variableValue || '';
        
        return {
            success: true,
            message: `Set ${varName} = ${value}`,
            outputData: { [varName]: value }
        };
    }

    async handleOutput(node, inputData) {
        return {
            success: true,
            message: 'Output received',
            outputData: inputData,
            isFinal: true
        };
    }

    async handleFetchData(node, inputData) {
        const entityId = node.config?.entityId || node.config?.selectedEntityId;
        if (!entityId) {
            throw new Error('No entity configured for fetchData node');
        }

        // Fetch records from database
        const records = await this.db.all(`
            SELECT r.id, r.createdAt, rv.propertyId, rv.value
            FROM records r
            LEFT JOIN record_values rv ON r.id = rv.recordId
            WHERE r.entityId = ?
        `, [entityId]);

        // Group by record
        const recordMap = {};
        records.forEach(row => {
            if (!recordMap[row.id]) {
                recordMap[row.id] = { id: row.id, createdAt: row.createdAt };
            }
            if (row.propertyId) {
                recordMap[row.id][row.propertyId] = row.value;
            }
        });

        const data = Object.values(recordMap);

        return {
            success: true,
            message: `Fetched ${data.length} records`,
            outputData: data,
            recordCount: data.length
        };
    }

    async handleExcelInput(node, inputData) {
        const config = node.config || {};
        
        // Check if data is stored in GCS
        if (config.gcsPath) {
            console.log(`[ExcelInput] Loading data from GCS: ${config.gcsPath}`);
            
            const gcsAvailable = await gcsService.init();
            if (!gcsAvailable) {
                throw new Error('Cloud storage not available');
            }

            const result = await gcsService.downloadWorkflowData(config.gcsPath);
            
            if (!result.success) {
                throw new Error(`Failed to load data from cloud: ${result.error}`);
            }

            return {
                success: true,
                message: `Loaded ${result.rowCount} rows from ${config.fileName || 'cloud storage'}`,
                outputData: result.data,
                rowCount: result.rowCount,
                source: 'gcs'
            };
        }

        // Fallback: use inline parsedData
        if (config.parsedData && Array.isArray(config.parsedData)) {
            return {
                success: true,
                message: `Loaded ${config.parsedData.length} rows from ${config.fileName || 'file'}`,
                outputData: config.parsedData,
                rowCount: config.parsedData.length,
                source: 'inline'
            };
        }

        // No data available
        throw new Error('No data configured for Excel/CSV node. Please upload a file.');
    }

    async handlePdfInput(node, inputData) {
        const config = node.config || {};
        
        // Check if PDF text is stored in GCS
        if (config.gcsPath && config.useGCS) {
            console.log(`[PdfInput] Loading PDF data from GCS: ${config.gcsPath}`);
            
            const gcsAvailable = await gcsService.init();
            if (!gcsAvailable) {
                throw new Error('Cloud storage not available');
            }

            const result = await gcsService.downloadWorkflowData(config.gcsPath);
            
            if (!result.success) {
                throw new Error(`Failed to load PDF from cloud: ${result.error}`);
            }

            const pdfData = result.data;
            return {
                success: true,
                message: `Loaded PDF: ${pdfData.fileName || config.fileName || 'file'} (${pdfData.pages || '?'} pages) from cloud`,
                outputData: {
                    text: pdfData.text,
                    fileName: pdfData.fileName || config.fileName,
                    pages: pdfData.pages
                },
                source: 'gcs'
            };
        }

        // Fallback: use inline text (pdfText or parsedText)
        const pdfText = config.pdfText || config.parsedText;
        if (pdfText) {
            return {
                success: true,
                message: `Loaded PDF: ${config.fileName || 'file'} (${config.pages || '?'} pages)`,
                outputData: {
                    text: pdfText,
                    fileName: config.fileName,
                    pages: config.pages
                },
                source: 'inline'
            };
        }

        throw new Error('No PDF data configured. Please upload a PDF file.');
    }

    async handleSaveRecords(node, inputData) {
        const entityId = node.config?.entityId;
        const tableName = node.config?.tableName || node.config?.entityName || 'saved_records';
        const mode = node.config?.saveMode || 'insert'; // insert, upsert, update
        
        // Detect if this is time-series data from OT nodes
        const isTimeSeriesData = this.detectTimeSeriesData(inputData);
        
        try {
            // If entityId is provided, use the entities API endpoint
            if (entityId) {
                return await this.saveToEntity(entityId, inputData, isTimeSeriesData);
            }

            // Fallback to generic table storage
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS ${tableName} (
                    id TEXT PRIMARY KEY,
                    data TEXT,
                    workflowId TEXT,
                    executionId TEXT,
                    createdAt TEXT,
                    updatedAt TEXT${isTimeSeriesData ? ', timestamp TEXT' : ''}
                )
            `);

            let savedCount = 0;
            const records = Array.isArray(inputData) ? inputData : [inputData];
            const savedIds = [];

            for (const record of records) {
                const recordId = record.id || generateId();
                const now = new Date().toISOString();
                const timestamp = record.timestamp || record.createdAt || now;
                
                if (mode === 'upsert' && record.id) {
                    // Check if exists
                    const existing = await this.db.get(
                        `SELECT id FROM ${tableName} WHERE id = ?`,
                        [record.id]
                    );
                    
                    if (existing) {
                        const updateQuery = isTimeSeriesData
                            ? `UPDATE ${tableName} SET data = ?, updatedAt = ?, timestamp = ? WHERE id = ?`
                            : `UPDATE ${tableName} SET data = ?, updatedAt = ? WHERE id = ?`;
                        const updateParams = isTimeSeriesData
                            ? [JSON.stringify(record), now, timestamp, record.id]
                            : [JSON.stringify(record), now, record.id];
                        
                        await this.db.run(updateQuery, updateParams);
                    } else {
                        const insertQuery = isTimeSeriesData
                            ? `INSERT INTO ${tableName} (id, data, workflowId, executionId, createdAt, updatedAt, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`
                            : `INSERT INTO ${tableName} (id, data, workflowId, executionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`;
                        const insertParams = isTimeSeriesData
                            ? [recordId, JSON.stringify(record), this.workflow?.id, this.executionId, now, now, timestamp]
                            : [recordId, JSON.stringify(record), this.workflow?.id, this.executionId, now, now];
                        
                        await this.db.run(insertQuery, insertParams);
                    }
                } else {
                    const insertQuery = isTimeSeriesData
                        ? `INSERT INTO ${tableName} (id, data, workflowId, executionId, createdAt, updatedAt, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`
                        : `INSERT INTO ${tableName} (id, data, workflowId, executionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`;
                    const insertParams = isTimeSeriesData
                        ? [recordId, JSON.stringify(record), this.workflow?.id, this.executionId, now, now, timestamp]
                        : [recordId, JSON.stringify(record), this.workflow?.id, this.executionId, now, now];
                    
                    await this.db.run(insertQuery, insertParams);
                }
                
                savedIds.push(recordId);
                savedCount++;
            }

            return {
                success: true,
                message: `Saved ${savedCount} record(s) to '${tableName}'${isTimeSeriesData ? ' (time-series optimized)' : ''}`,
                outputData: inputData,
                savedIds,
                tableName,
                isTimeSeries: isTimeSeriesData
            };
        } catch (error) {
            console.error('[SaveRecords] Error:', error);
            return {
                success: false,
                message: `Failed to save records: ${error.message}`,
                outputData: inputData,
                error: error.message
            };
        }
    }

    /**
     * Detect if input data is time-series data from OT nodes
     * Uses the timeSeriesHelper utility
     */
    detectTimeSeriesData(inputData) {
        return detectTimeSeriesData(inputData);
    }

    /**
     * Infer property type from a JS value
     */
    inferPropertyType(value) {
        if (value === null || value === undefined) return 'text';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'text';
        if (typeof value === 'string') {
            if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
            const num = Number(value);
            if (!isNaN(num) && value.trim() !== '') return 'number';
        }
        return 'text';
    }

    /**
     * Save records to entity using the entities API structure.
     * Auto-creates missing properties when data columns don't match existing ones.
     */
    async saveToEntity(entityId, inputData, isTimeSeriesData) {
        try {
            // Normalize data for entity storage
            let normalizedRecords;
            if (isTimeSeriesData) {
                normalizedRecords = normalizeTimeSeriesData(inputData);
            } else {
                const records = Array.isArray(inputData) ? inputData : [inputData];
                normalizedRecords = records.map(record => {
                    const { metadata, raw, ...rest } = record;
                    return rest;
                });
            }

            // --- Auto-create missing properties ---
            // Collect all unique keys from all records
            const skipKeys = new Set(['id', 'createdAt', 'updatedAt', 'entityId', 'metadata', 'raw', '__index']);
            const allKeys = new Set();
            for (const record of normalizedRecords) {
                if (record && typeof record === 'object') {
                    for (const key of Object.keys(record)) {
                        if (!skipKeys.has(key)) allKeys.add(key);
                    }
                }
            }

            // Get existing properties once
            let properties = await this.db.all(
                'SELECT id, name, type FROM properties WHERE entityId = ?',
                [entityId]
            );
            const existingNames = new Set(properties.map(p => p.name.toLowerCase()));

            // Create any missing properties
            let createdProps = 0;
            for (const key of allKeys) {
                if (!existingNames.has(key.toLowerCase())) {
                    // Find a sample value to infer type
                    let sampleValue = undefined;
                    for (const rec of normalizedRecords) {
                        if (rec[key] !== null && rec[key] !== undefined) { sampleValue = rec[key]; break; }
                    }
                    const propId = generateId();
                    const propType = this.inferPropertyType(sampleValue);
                    await this.db.run(
                        'INSERT INTO properties (id, entityId, name, type, defaultValue) VALUES (?, ?, ?, ?, ?)',
                        [propId, entityId, key, propType, '']
                    );
                    createdProps++;
                }
            }

            // Re-fetch properties if we created new ones
            if (createdProps > 0) {
                properties = await this.db.all(
                    'SELECT id, name, type FROM properties WHERE entityId = ?',
                    [entityId]
                );
                console.log(`[SaveToEntity] Auto-created ${createdProps} new properties for entity ${entityId}`);
            }

            // Build property name mapping
            const propertyMap = {};
            properties.forEach(prop => {
                propertyMap[prop.name.toLowerCase()] = prop;
            });

            // Save each record
            let savedCount = 0;
            const savedIds = [];

            for (const record of normalizedRecords) {
                // Create record
                const recordId = generateId();
                const createdAt = record.timestamp || record.createdAt || new Date().toISOString();

                await this.db.run(
                    'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
                    [recordId, entityId, createdAt]
                );

                // Save property values
                for (const [key, val] of Object.entries(record)) {
                    if (skipKeys.has(key)) {
                        // Handle timestamp specially if needed
                        if (key === 'timestamp') {
                            const timestampProp = propertyMap['timestamp'] || propertyMap['time'] || propertyMap['createdat'];
                            if (timestampProp) {
                                const valueId = generateId();
                                await this.db.run(
                                    'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                                    [valueId, recordId, timestampProp.id, String(val)]
                                );
                            }
                        }
                        continue;
                    }

                    const prop = propertyMap[key.toLowerCase()];
                    if (prop) {
                        const valueId = generateId();
                        const value = typeof val === 'object' ? JSON.stringify(val) : String(val);
                        await this.db.run(
                            'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                            [valueId, recordId, prop.id, value]
                        );
                    }
                }

                savedIds.push(recordId);
                savedCount++;
            }

            return {
                success: true,
                message: `Saved ${savedCount} record(s) to entity '${entityId}'${createdProps > 0 ? ` (${createdProps} properties auto-created)` : ''}${isTimeSeriesData ? ' (time-series optimized)' : ''}`,
                outputData: inputData,
                savedIds,
                entityId,
                createdProperties: createdProps,
                isTimeSeries: isTimeSeriesData
            };
        } catch (error) {
            console.error('[SaveToEntity] Error:', error);
            throw error;
        }
    }

    async handleRenameColumns(node, inputData) {
        const renames = node.config?.columnRenames || [];
        
        if (!renames.length) {
            return {
                success: true,
                message: 'No column renames configured',
                outputData: inputData
            };
        }

        if (!inputData || !Array.isArray(inputData)) {
            return {
                success: true,
                message: 'No input data to rename',
                outputData: inputData || []
            };
        }

        const renamedData = inputData.map(row => {
            const newRow = {};
            for (const key of Object.keys(row)) {
                const rename = renames.find(r => r.oldName === key);
                newRow[rename ? rename.newName : key] = row[key];
            }
            return newRow;
        });

        return {
            success: true,
            message: `Renamed ${renames.length} column(s): ${renames.map(r => `${r.oldName} → ${r.newName}`).join(', ')}`,
            outputData: renamedData
        };
    }

    async handleAddField(node, inputData) {
        const fieldName = node.config?.fieldName || 'newField';
        const fieldValue = node.config?.fieldValue || '';

        // If inputData is array, add field to each record
        if (Array.isArray(inputData)) {
            const result = inputData.map(record => ({
                ...record,
                [fieldName]: this.evaluateExpression(fieldValue, record)
            }));
            return {
                success: true,
                message: `Added field '${fieldName}' to ${result.length} records`,
                outputData: result
            };
        }

        return {
            success: true,
            message: `Added field '${fieldName}'`,
            outputData: { ...inputData, [fieldName]: fieldValue }
        };
    }

    async handleJsCode(node, inputData) {
        const code = node.config?.jsCode || node.config?.code || '';
        if (!code) {
            return { success: true, message: 'No code configured', outputData: inputData };
        }

        try {
            // Build a safe execution context with inputs from previous nodes
            const inputs = {};
            if (inputData && typeof inputData === 'object') {
                if (Array.isArray(inputData)) {
                    inputs._data = inputData;
                } else {
                    Object.assign(inputs, inputData);
                }
            }
            // Also gather all node results so the code can access any variable
            for (const [nodeId, result] of Object.entries(this.nodeResults || {})) {
                if (result?.outputData && typeof result.outputData === 'object' && !Array.isArray(result.outputData)) {
                    Object.assign(inputs, result.outputData);
                }
            }

            // Execute with Function constructor (sandboxed enough for local dev)
            const fn = new Function('inputs', `
                ${code}
                return typeof output !== 'undefined' ? output : (typeof result !== 'undefined' ? result : inputs);
            `);

            const output = fn(inputs);

            return {
                success: true,
                message: 'JavaScript code executed successfully',
                outputData: output
            };
        } catch (error) {
            console.error('[JsCode] Error executing code:', error.message);
            throw new Error(`JavaScript execution error: ${error.message}`);
        }
    }

    async handleCondition(node, inputData) {
        const field = node.config?.conditionField;
        const operator = node.config?.conditionOperator || 'equals';
        const value = node.config?.conditionValue;

        // Process mode: batch or perRow
        const processingMode = node.config?.processingMode || 'batch';

        if (processingMode === 'perRow' && Array.isArray(inputData)) {
            // Filter records
            const trueRecords = inputData.filter(record => 
                this.evaluateCondition(record[field], operator, value)
            );
            const falseRecords = inputData.filter(record => 
                !this.evaluateCondition(record[field], operator, value)
            );

            return {
                success: true,
                message: `Filtered: ${trueRecords.length} true, ${falseRecords.length} false`,
                outputData: trueRecords,
                conditionResult: trueRecords.length > 0,
                trueRecords,
                falseRecords
            };
        }

        // Batch mode - evaluate single condition
        const testValue = Array.isArray(inputData) ? inputData[0]?.[field] : inputData?.[field];
        const result = this.evaluateCondition(testValue, operator, value);

        return {
            success: true,
            message: `Condition: ${field} ${operator} ${value} = ${result}`,
            outputData: inputData,
            conditionResult: result
        };
    }

    async handleJoin(node, inputData) {
        // inputData should have { A: [...], B: [...] }
        const dataA = inputData?.A || [];
        const dataB = inputData?.B || [];
        const strategy = node.config?.joinStrategy || 'concat';
        const joinKey = node.config?.joinKey;

        let result;
        if (strategy === 'concat') {
            result = [...dataA, ...dataB];
        } else if (strategy === 'mergeByKey' && joinKey) {
            // Merge by key
            const merged = dataA.map(a => {
                const match = dataB.find(b => b[joinKey] === a[joinKey]);
                return match ? { ...a, ...match } : a;
            });
            result = merged;
        } else {
            result = [...dataA, ...dataB];
        }

        return {
            success: true,
            message: `Joined ${dataA.length} + ${dataB.length} = ${result.length} records`,
            outputData: result
        };
    }

    async handleHttp(node, inputData) {
        const url = node.config?.httpUrl;
        const method = node.config?.httpMethod || 'GET';

        if (!url) {
            throw new Error('No URL configured for HTTP node');
        }

        try {
            const options = { method };
            if (method === 'POST' && inputData) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(inputData);
            }

            const response = await fetch(url, options);
            const data = await response.json();

            return {
                success: true,
                message: `HTTP ${method} ${url} - Status ${response.status}`,
                outputData: data,
                statusCode: response.status
            };
        } catch (error) {
            throw new Error(`HTTP request failed: ${error.message}`);
        }
    }

    async handleLLM(node, inputData) {
        const prompt = node.config?.llmPrompt || node.config?.prompt;
        if (!prompt) {
            throw new Error('No prompt configured for LLM node');
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const outputType = node.config?.outputType || 'text';
        const enumOptions = node.config?.enumOptions || [];

        try {
            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey });

            // Build context from input data
            let context = '';
            if (inputData) {
                context = `\n\nContext data:\n${JSON.stringify(inputData, null, 2)}`;
            }

            // Build output format instruction based on outputType
            let outputInstruction = '';
            if (outputType === 'number') {
                outputInstruction = '\n\nIMPORTANT: Your response MUST be a single numeric value (integer or decimal). Do not include any text, units, or explanation — only the number.';
            } else if (outputType === 'date') {
                outputInstruction = '\n\nIMPORTANT: Your response MUST be a single date in ISO 8601 format (YYYY-MM-DD). Do not include any text or explanation — only the date.';
            } else if (outputType === 'enum' && enumOptions.length > 0) {
                outputInstruction = `\n\nIMPORTANT: Your response MUST be exactly ONE of these options: ${enumOptions.map(o => `"${o}"`).join(', ')}. Do not include any text or explanation — only one of the listed options exactly as written.`;
            }

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'user', content: prompt + context + outputInstruction }
                ]
            });

            let response = completion.choices[0]?.message?.content || '';

            // Post-process based on output type
            if (outputType === 'number') {
                const num = parseFloat(response.replace(/[^0-9.\-]/g, ''));
                response = isNaN(num) ? response : String(num);
            } else if (outputType === 'date') {
                // Try to extract a date pattern
                const dateMatch = response.match(/\d{4}-\d{2}-\d{2}/);
                if (dateMatch) response = dateMatch[0];
            } else if (outputType === 'enum' && enumOptions.length > 0) {
                // Try to match the response to one of the allowed options
                const trimmed = response.trim().replace(/^["']|["']$/g, '');
                const match = enumOptions.find(o => o.toLowerCase() === trimmed.toLowerCase());
                if (match) response = match;
            }

            return {
                success: true,
                message: 'LLM response generated',
                outputData: { response, outputType, inputData },
                llmResponse: response
            };
        } catch (error) {
            throw new Error(`LLM request failed: ${error.message}`);
        }
    }

    async handleSpecializedAgent(node, inputData) {
        const config = node.config || {};
        const { agentId, task, includeInput, memoryEnabled, maxMemoryMessages, model, language, contextEntities } = config;

        if (!agentId) {
            throw new Error('No agent selected for Specialized Agent node');
        }
        if (!task) {
            throw new Error('No task configured for Specialized Agent node');
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        try {
            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey });

            // Fetch agent config from DB
            let agentConfig = null;
            if (this.db) {
                agentConfig = await this.db.get('SELECT * FROM copilot_agents WHERE id = ?', [agentId]);
            }

            // Build system prompt from agent instructions
            const agentName = agentConfig?.name || 'Specialized Agent';
            const agentInstructions = agentConfig?.instructions || '';
            const languageInstruction = language === 'en'
                ? 'Always answer in English unless explicitly asked otherwise.'
                : language === 'es'
                    ? 'Responde siempre en español salvo instrucción explícita en otro idioma.'
                    : 'Answer in the same language as the task unless explicitly asked otherwise.';
            const systemPrompt = [
                `You are "${agentName}", a specialized AI agent.`,
                agentInstructions ? `\nYour instructions:\n${agentInstructions}` : '',
                '\nYou must complete the task given to you precisely and return a clear, structured response.',
                '\nIf provided with input data, use it as context for your task.',
                `\n${languageInstruction}`,
            ].join('');

            // Build context
            let contextParts = [];

            // Input data context
            if (includeInput && inputData) {
                contextParts.push(`\n\nInput data:\n${JSON.stringify(inputData, null, 2)}`);
            }

            // Entity context (knowledge base)
            if (contextEntities?.length > 0 && this.db) {
                try {
                    const placeholders = contextEntities.map(() => '?').join(',');
                    const entities = await this.db.all(`SELECT id, name FROM entities WHERE id IN (${placeholders})`, contextEntities);
                    for (const entity of entities) {
                        const records = await this.db.all(
                            `SELECT rv.value, p.name as propertyName FROM record_values rv 
                             JOIN records r ON rv.recordId = r.id
                             JOIN properties p ON rv.propertyId = p.id 
                             WHERE r.entityId = ? LIMIT 100`, [entity.id]
                        );
                        if (records.length > 0) {
                            contextParts.push(`\n\nEntity "${entity.name}" data:\n${JSON.stringify(records.slice(0, 50), null, 2)}`);
                        }
                    }
                } catch (err) {
                    console.warn('[SpecializedAgent] Error loading entity context:', err.message);
                }
            }

            // Memory: load agent's persistent memory (across all chats/workflows)
            let memoryMessages = [];
            if (memoryEnabled && this.db) {
                try {
                    const agentServiceMod = require('./services/agentService');
                    const limit = maxMemoryMessages || 10;
                    const memEntries = await agentServiceMod.getMemory(this.db, agentId, limit);
                    memoryMessages = memEntries.map(m => ({ role: m.role, content: m.content }));
                } catch (_) {
                    // Memory table may not exist, continue without it
                }
            }

            // Resolve task template
            let resolvedTask = task;
            if (inputData) {
                resolvedTask = resolvedTask.replace(/\{\{input\}\}/g, JSON.stringify(inputData));
            }

            const context = contextParts.join('');
            const messages = [
                { role: 'system', content: systemPrompt },
                ...memoryMessages,
                { role: 'user', content: resolvedTask + context }
            ];

            const completion = await openai.chat.completions.create({
                model: model || 'gpt-4o-mini',
                messages,
                temperature: 0.3,
            });

            const response = completion.choices[0]?.message?.content || '';

            // Persist to agent's memory
            if (memoryEnabled && this.db) {
                try {
                    const agentServiceMod = require('./services/agentService');
                    const orgRow = await this.db.get('SELECT organizationId FROM copilot_agents WHERE id = ?', [agentId]);
                    const memOrgId = orgRow?.organizationId || '';
                    await agentServiceMod.addMemory(this.db, agentId, memOrgId, 'user', resolvedTask, 'workflow', { workflowId: this.workflowId, nodeId: node.id });
                    await agentServiceMod.addMemory(this.db, agentId, memOrgId, 'assistant', response, 'workflow', { workflowId: this.workflowId, nodeId: node.id });
                } catch (_) {}
            }

            return {
                success: true,
                message: `Agent "${agentName}" completed the task`,
                outputData: { response, agentName, agentId, inputData },
                llmResponse: response
            };
        } catch (error) {
            throw new Error(`Specialized Agent failed: ${error.message}`);
        }
    }

    async handleMySQL(node, inputData) {
        const config = node.config || {};
        const { mysqlHost, mysqlPort, mysqlDatabase, mysqlUsername, mysqlPassword, mysqlQuery } = config;

        if (!mysqlQuery) {
            throw new Error('No query configured for MySQL node');
        }

        try {
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({
                host: mysqlHost || 'localhost',
                port: parseInt(mysqlPort) || 3306,
                database: mysqlDatabase,
                user: mysqlUsername,
                password: mysqlPassword,
                connectTimeout: 10000
            });

            const [rows] = await connection.execute(mysqlQuery);
            await connection.end();

            return {
                success: true,
                message: `MySQL query returned ${rows.length} rows`,
                outputData: rows,
                rowCount: rows.length
            };
        } catch (error) {
            throw new Error(`MySQL query failed: ${error.message}`);
        }
    }

    async handleSendEmail(node, inputData) {
        const config = node.config || {};
        const { emailTo, emailSubject, emailBody, emailSmtpHost, emailSmtpPort, emailSmtpUser, emailSmtpPass } = config;

        if (!emailTo || !emailSmtpUser || !emailSmtpPass) {
            throw new Error('Email configuration incomplete');
        }

        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: emailSmtpHost || 'smtp.gmail.com',
                port: parseInt(emailSmtpPort) || 587,
                secure: parseInt(emailSmtpPort) === 465,
                auth: { user: emailSmtpUser, pass: emailSmtpPass }
            });

            await transporter.sendMail({
                from: emailSmtpUser,
                to: emailTo,
                subject: emailSubject || '(No subject)',
                text: emailBody || '',
                html: emailBody ? emailBody.replace(/\n/g, '<br>') : ''
            });

            return {
                success: true,
                message: `Email sent to ${emailTo}`,
                outputData: inputData
            };
        } catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    async handleSendSMS(node, inputData) {
        const config = node.config || {};
        const { smsTo, smsBody, twilioAccountSid, twilioAuthToken, twilioFromNumber } = config;

        if (!smsTo || !twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
            throw new Error('SMS configuration incomplete. Please provide Twilio credentials and phone numbers.');
        }

        try {
            const twilio = require('twilio');
            const client = twilio(twilioAccountSid, twilioAuthToken);

            const message = await client.messages.create({
                body: smsBody || '',
                from: twilioFromNumber,
                to: smsTo
            });

            return {
                success: true,
                message: `SMS sent to ${smsTo}`,
                outputData: inputData,
                messageSid: message.sid,
                status: message.status
            };
        } catch (error) {
            throw new Error(`Failed to send SMS: ${error.message}`);
        }
    }

    async handleSendWhatsApp(node, inputData) {
        const config = node.config || {};
        const { whatsappTo, whatsappBody, whatsappTwilioAccountSid, whatsappTwilioAuthToken, whatsappTwilioFromNumber } = config;

        if (!whatsappTo || !whatsappTwilioAccountSid || !whatsappTwilioAuthToken || !whatsappTwilioFromNumber) {
            throw new Error('WhatsApp configuration incomplete. Please provide Twilio credentials and phone numbers.');
        }

        try {
            const twilio = require('twilio');
            const client = twilio(whatsappTwilioAccountSid, whatsappTwilioAuthToken);

            const message = await client.messages.create({
                body: whatsappBody || '',
                from: `whatsapp:${whatsappTwilioFromNumber}`,
                to: `whatsapp:${whatsappTo}`
            });

            return {
                success: true,
                message: `WhatsApp sent to ${whatsappTo}`,
                outputData: inputData,
                messageSid: message.sid,
                status: message.status
            };
        } catch (error) {
            throw new Error(`Failed to send WhatsApp: ${error.message}`);
        }
    }

    async handleSendSlack(node, inputData) {
        const config = node.config || {};
        const { slackWebhookUrl, slackChannel, slackMessage, slackUsername, slackIconEmoji } = config;

        if (!slackWebhookUrl) {
            throw new Error('Slack webhook URL not configured');
        }

        if (!slackMessage) {
            throw new Error('Slack message is empty');
        }

        // Replace placeholders in message with input data
        let message = slackMessage;
        if (inputData && typeof inputData === 'object') {
            for (const [key, value] of Object.entries(inputData)) {
                const placeholder = `{{${key}}}`;
                if (message.includes(placeholder)) {
                    message = message.replace(new RegExp(placeholder, 'g'), String(value));
                }
            }
        }

        // Build Slack payload
        const payload = {
            text: message,
            username: slackUsername || 'Workflow Bot',
            icon_emoji: slackIconEmoji || ':robot_face:'
        };

        if (slackChannel) {
            payload.channel = slackChannel;
        }

        // Add attachments if we have structured data
        if (inputData && typeof inputData === 'object') {
            const fields = [];
            for (const [key, value] of Object.entries(inputData)) {
                if (!['_webhookData', 'response'].includes(key)) {
                    fields.push({
                        title: key,
                        value: String(value).substring(0, 100),
                        short: true
                    });
                }
            }

            if (fields.length > 0) {
                payload.attachments = [{
                    color: '#36a64f',
                    fields: fields.slice(0, 10)
                }];
            }
        }

        try {
            const response = await fetch(slackWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Slack API error: ${errorText}`);
            }

            return {
                success: true,
                message: `Slack message sent${slackChannel ? ' to ' + slackChannel : ''}`,
                outputData: inputData
            };
        } catch (error) {
            throw new Error(`Failed to send Slack message: ${error.message}`);
        }
    }

    async handleSendDiscord(node, inputData) {
        const config = node.config || {};
        const { discordWebhookUrl, discordMessage, discordUsername, discordAvatarUrl, discordEmbedTitle, discordEmbedColor } = config;

        if (!discordWebhookUrl) {
            throw new Error('Discord webhook URL not configured');
        }

        if (!discordMessage && !discordEmbedTitle) {
            throw new Error('Discord message or embed title is required');
        }

        // Replace placeholders in message with input data
        let message = discordMessage || '';
        let embedTitle = discordEmbedTitle || '';
        if (inputData && typeof inputData === 'object') {
            for (const [key, value] of Object.entries(inputData)) {
                const placeholder = `{{${key}}}`;
                message = message.replace(new RegExp(placeholder, 'g'), String(value));
                embedTitle = embedTitle.replace(new RegExp(placeholder, 'g'), String(value));
            }
        }

        // Build Discord payload
        const payload = {
            username: discordUsername || 'Workflow Bot',
        };

        if (message) {
            payload.content = message;
        }

        if (discordAvatarUrl) {
            payload.avatar_url = discordAvatarUrl;
        }

        // Add embed if we have structured data or embed title
        if (embedTitle || (inputData && typeof inputData === 'object')) {
            const colorHex = (discordEmbedColor || '5865F2').replace('#', '');
            const embed = {
                color: parseInt(colorHex, 16),
                timestamp: new Date().toISOString()
            };

            if (embedTitle) {
                embed.title = embedTitle;
            }

            if (inputData && typeof inputData === 'object') {
                const fields = [];
                for (const [key, value] of Object.entries(inputData)) {
                    if (!['_webhookData', 'response'].includes(key)) {
                        fields.push({
                            name: key,
                            value: String(value).substring(0, 1024),
                            inline: true
                        });
                    }
                }
                if (fields.length > 0) {
                    embed.fields = fields.slice(0, 25);
                }
            }

            payload.embeds = [embed];
        }

        try {
            const response = await fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok && response.status !== 204) {
                const errorText = await response.text();
                throw new Error(`Discord API error: ${errorText}`);
            }

            return {
                success: true,
                message: 'Discord message sent successfully',
                outputData: inputData
            };
        } catch (error) {
            throw new Error(`Failed to send Discord message: ${error.message}`);
        }
    }

    async handleSendTeams(node, inputData) {
        const config = node.config || {};
        const { teamsWebhookUrl, teamsMessage, teamsTitle, teamsThemeColor } = config;

        if (!teamsWebhookUrl) {
            throw new Error('Teams webhook URL not configured');
        }

        if (!teamsMessage) {
            throw new Error('Teams message is empty');
        }

        // Replace placeholders in message with input data
        let message = teamsMessage;
        let title = teamsTitle || 'Workflow Notification';
        if (inputData && typeof inputData === 'object') {
            for (const [key, value] of Object.entries(inputData)) {
                const placeholder = `{{${key}}}`;
                message = message.replace(new RegExp(placeholder, 'g'), String(value));
                title = title.replace(new RegExp(placeholder, 'g'), String(value));
            }
        }

        // Build Teams MessageCard payload
        const payload = {
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            themeColor: (teamsThemeColor || '0078D4').replace('#', ''),
            summary: title,
            sections: [{
                activityTitle: title,
                text: message,
                markdown: true
            }]
        };

        // Add facts if we have structured data
        if (inputData && typeof inputData === 'object') {
            const facts = [];
            for (const [key, value] of Object.entries(inputData)) {
                if (!['_webhookData', 'response'].includes(key)) {
                    facts.push({
                        name: key,
                        value: String(value).substring(0, 500)
                    });
                }
            }
            if (facts.length > 0) {
                payload.sections[0].facts = facts.slice(0, 10);
            }
        }

        try {
            const response = await fetch(teamsWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Teams API error: ${errorText}`);
            }

            return {
                success: true,
                message: 'Teams message sent successfully',
                outputData: inputData
            };
        } catch (error) {
            throw new Error(`Failed to send Teams message: ${error.message}`);
        }
    }

    async handleSendTelegram(node, inputData) {
        const config = node.config || {};
        const { telegramBotToken, telegramChatId, telegramMessage, telegramParseMode } = config;

        const botToken = telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
        
        if (!botToken) {
            throw new Error('Telegram bot token not configured');
        }

        if (!telegramChatId) {
            throw new Error('Telegram chat ID not configured');
        }

        if (!telegramMessage) {
            throw new Error('Telegram message is empty');
        }

        // Replace placeholders in message with input data
        let message = telegramMessage;
        if (inputData && typeof inputData === 'object') {
            for (const [key, value] of Object.entries(inputData)) {
                const placeholder = `{{${key}}}`;
                message = message.replace(new RegExp(placeholder, 'g'), String(value));
            }
        }

        try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: telegramChatId,
                    text: message,
                    parse_mode: telegramParseMode || 'HTML'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
            }

            const result = await response.json();

            return {
                success: true,
                message: `Telegram message sent to chat ${telegramChatId}`,
                outputData: inputData,
                messageId: result.result?.message_id
            };
        } catch (error) {
            throw new Error(`Failed to send Telegram message: ${error.message}`);
        }
    }

    async handleGoogleSheets(node, inputData) {
        const config = node.config || {};
        const { spreadsheetId, sheetRange, operation } = config;
        const apiKey = config.googleApiKey || process.env.GOOGLE_API_KEY;

        if (!spreadsheetId) {
            throw new Error('Google Sheets spreadsheet ID not configured');
        }

        const range = sheetRange || 'Sheet1!A1:Z1000';
        const op = operation || 'read';
        const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

        try {
            if (op === 'read') {
                const url = `${baseUrl}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
                const params = apiKey ? `?key=${apiKey}` : '';
                
                const response = await fetch(url + params);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Google Sheets API error: ${errorText}`);
                }

                const data = await response.json();
                const values = data.values || [];

                // Convert to list of dicts using first row as headers
                let outputData;
                if (values.length > 1) {
                    const headers = values[0];
                    outputData = values.slice(1).map(row => {
                        const record = {};
                        headers.forEach((header, i) => {
                            record[header] = row[i] || '';
                        });
                        return record;
                    });
                } else {
                    outputData = values;
                }

                return {
                    success: true,
                    message: `Read ${values.length} rows from Google Sheets`,
                    outputData,
                    rowCount: values.length
                };

            } else if (op === 'append' || op === 'write') {
                if (!inputData) {
                    throw new Error('No data to write to Google Sheets');
                }

                // Convert input data to 2D array
                let values;
                if (Array.isArray(inputData) && inputData.length > 0) {
                    if (typeof inputData[0] === 'object') {
                        const headers = Object.keys(inputData[0]);
                        values = [headers];
                        inputData.forEach(record => {
                            values.push(headers.map(h => String(record[h] || '')));
                        });
                    } else {
                        values = inputData;
                    }
                } else if (typeof inputData === 'object') {
                    const headers = Object.keys(inputData);
                    values = [headers, headers.map(h => String(inputData[h] || ''))];
                } else {
                    values = [[String(inputData)]];
                }

                const endpoint = op === 'append' ? 'append' : 'update';
                const url = `${baseUrl}/${spreadsheetId}/values/${encodeURIComponent(range)}:${endpoint}`;
                const params = apiKey ? `?valueInputOption=USER_ENTERED&key=${apiKey}` : '?valueInputOption=USER_ENTERED';

                const response = await fetch(url + params, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ values })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Google Sheets API error: ${errorText}`);
                }

                return {
                    success: true,
                    message: `${op === 'append' ? 'Appended' : 'Wrote'} ${values.length} rows to Google Sheets`,
                    outputData: inputData,
                    rowCount: values.length
                };

            } else {
                throw new Error(`Unknown operation: ${op}`);
            }
        } catch (error) {
            throw new Error(`Google Sheets operation failed: ${error.message}`);
        }
    }

    async handleDataVisualization(node, inputData) {
        const config = node.config || {};
        const { generatedWidget, visualizationPrompt } = config;

        // Data visualization nodes don't transform data, they just display it
        // The visualization config is pre-generated in the frontend
        return {
            success: true,
            message: generatedWidget ? `Visualization: ${generatedWidget.title}` : 'Visualization node (configure in editor)',
            outputData: inputData,
            widget: generatedWidget,
            prompt: visualizationPrompt
        };
    }

    async handleEsios(node, inputData) {
        const archiveId = node.config?.esiosArchiveId;
        if (!archiveId) {
            throw new Error('No ESIOS archive ID configured');
        }

        try {
            const response = await fetch(`https://api.esios.ree.es/archives/${archiveId}/download`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();

            return {
                success: true,
                message: 'ESIOS data fetched',
                outputData: data
            };
        } catch (error) {
            throw new Error(`ESIOS request failed: ${error.message}`);
        }
    }

    async handleClimatiq(node, inputData) {
        const query = node.config?.climatiqQuery;
        if (!query) {
            throw new Error('No Climatiq query configured');
        }

        try {
            const response = await fetch(`https://beta3.api.climatiq.io/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.CLIMATIQ_API_KEY || ''}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            return {
                success: true,
                message: 'Climatiq data fetched',
                outputData: data
            };
        } catch (error) {
            throw new Error(`Climatiq request failed: ${error.message}`);
        }
    }

    async handleSplitColumns(node, inputData) {
        const columnsA = node.config?.columnsOutputA || [];
        const columnsB = node.config?.columnsOutputB || [];

        if (!Array.isArray(inputData)) {
            return {
                success: true,
                message: 'No array data to split',
                outputData: inputData
            };
        }

        const outputA = inputData.map(record => {
            const filtered = {};
            columnsA.forEach(col => { if (record[col] !== undefined) filtered[col] = record[col]; });
            return filtered;
        });

        const outputB = inputData.map(record => {
            const filtered = {};
            columnsB.forEach(col => { if (record[col] !== undefined) filtered[col] = record[col]; });
            return filtered;
        });

        return {
            success: true,
            message: `Split into ${columnsA.length} and ${columnsB.length} columns`,
            outputData: outputA,
            outputA,
            outputB
        };
    }

    async handleComment(node, inputData) {
        return {
            success: true,
            message: 'Comment node (no action)',
            outputData: inputData
        };
    }

    async handleHumanApproval(node, inputData) {
        // For human approval, we pause the execution
        await this.updateExecutionStatus('paused', {
            currentNodeId: node.id
        });

        return {
            success: true,
            message: 'Waiting for human approval',
            outputData: inputData,
            requiresApproval: true,
            paused: true
        };
    }

    async handleWebhook(node, inputData) {
        // Webhook node receives external data
        // inputData comes directly from the webhook POST body
        const webhookData = inputData || node.config?.webhookData || this.webhookData || {};
        
        console.log('[Webhook] Processing data:', JSON.stringify(webhookData));
        
        return {
            success: true,
            message: `Webhook received ${Object.keys(webhookData).length} fields`,
            outputData: webhookData,
            data: webhookData, // Also include as 'data' for compatibility
            webhookId: node.config?.webhookId || node.id,
            receivedAt: new Date().toISOString()
        };
    }

    async handleWebhookResponse(node, inputData) {
        const config = node.config || {};
        const mode = config.webhookResponseMode || 'passthrough';
        const statusCode = config.webhookResponseStatusCode || 200;
        const customHeaders = config.webhookResponseHeaders || [];

        let responseBody;

        if (mode === 'passthrough') {
            // Return all input data as-is
            responseBody = inputData;
        } else if (mode === 'selected') {
            // Return only selected fields
            const fields = config.webhookResponseFields || [];
            responseBody = {};
            if (inputData && typeof inputData === 'object') {
                for (const field of fields) {
                    if (field in inputData) {
                        responseBody[field] = inputData[field];
                    }
                }
            }
        } else if (mode === 'template') {
            // Apply template with placeholders
            let template = config.webhookResponseTemplate || '{}';
            if (inputData && typeof inputData === 'object') {
                for (const [key, value] of Object.entries(inputData)) {
                    const placeholder = `{{${key}}}`;
                    // Replace with JSON value for objects/arrays, string for primitives
                    const replacement = typeof value === 'object' ? JSON.stringify(value) : String(value);
                    template = template.split(placeholder).join(replacement);
                }
            }
            try {
                responseBody = JSON.parse(template);
            } catch (e) {
                // If template is not valid JSON after substitution, return as string
                responseBody = { rawResponse: template };
            }
        } else {
            responseBody = inputData;
        }

        // Build headers map
        const headersMap = {};
        for (const h of customHeaders) {
            if (h.key && h.value) {
                headersMap[h.key] = h.value;
            }
        }

        console.log('[WebhookResponse] Prepared response:', JSON.stringify(responseBody).substring(0, 200));

        return {
            success: true,
            message: `Webhook response prepared (${statusCode})`,
            outputData: responseBody,
            isFinal: true,
            isWebhookResponse: true,
            webhookResponseStatusCode: statusCode,
            webhookResponseHeaders: headersMap,
            webhookResponseBody: responseBody
        };
    }

    // ==================== OT/INDUSTRIAL NODE HANDLERS ====================

    /**
     * Get connection configuration from database
     */
    async getConnection(connectionId) {
        if (!connectionId) return null;
        
        try {
            const connection = await this.db.get(
                'SELECT * FROM data_connections WHERE id = ?',
                [connectionId]
            );
            
            if (!connection) {
                throw new Error(`Connection ${connectionId} not found`);
            }
            
            // Parse config JSON
            if (connection.config) {
                try {
                    connection.config = JSON.parse(connection.config);
                } catch (e) {
                    connection.config = {};
                }
            } else {
                connection.config = {};
            }
            
            // Check if connection is active
            if (connection.status !== 'active') {
                throw new Error(`Connection ${connection.name || connectionId} is not active (status: ${connection.status})`);
            }
            
            return connection;
        } catch (error) {
            console.error(`[getConnection] Error fetching connection ${connectionId}:`, error);
            throw error;
        }
    }

    async handleOpcua(node, inputData) {
        const connectionId = node.config?.opcuaConnectionId;
        const nodeIds = node.config?.opcuaNodeIds || [];
        const pollingInterval = node.config?.opcuaPollingInterval || 5000;

        if (!connectionId || nodeIds.length === 0) {
            throw new Error('OPC UA node requires connectionId and nodeIds configuration');
        }

        // Get connection configuration
        let connection = null;
        try {
            connection = await this.getConnection(connectionId);
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                outputData: inputData,
                error: error.message
            };
        }

        // Use real OPC UA connection
        try {
            const otManager = getOTConnectionsManager();
            const timeout = node.config?.opcuaTimeout || connection.config?.timeout || 10000;
            const outputData = await otManager.readOpcuaNodes(connection.config, nodeIds, timeout);

            return {
                success: true,
                message: `Read ${nodeIds.length} OPC UA nodes from ${connection?.name || connectionId}`,
                outputData,
                metadata: {
                    connectionId,
                    connectionName: connection?.name,
                    pollingInterval,
                    nodeCount: nodeIds.length
                }
            };
        } catch (error) {
            console.error('[handleOpcua] Error reading OPC UA nodes:', error);
            // Fallback to simulation if real connection fails
            const timestamp = new Date().toISOString();
            const simulatedData = nodeIds.map(nodeId => ({
                nodeId,
                value: Math.random() * 100,
                timestamp,
                quality: 'Good'
            }));

            return {
                success: false,
                message: `OPC UA read failed: ${error.message}. Using simulated data.`,
                outputData: {
                    timestamp,
                    values: simulatedData.reduce((acc, item) => {
                        acc[item.nodeId] = item.value;
                        return acc;
                    }, {}),
                    raw: simulatedData
                },
                metadata: {
                    connectionId,
                    connectionName: connection?.name,
                    pollingInterval,
                    nodeCount: nodeIds.length,
                    error: error.message,
                    simulated: true
                }
            };
        }
    }

    async handleMqtt(node, inputData) {
        const connectionId = node.config?.mqttConnectionId;
        const topics = node.config?.mqttTopics || [];
        const qos = node.config?.mqttQos || 0;

        if (!connectionId || topics.length === 0) {
            throw new Error('MQTT node requires connectionId and topics configuration');
        }

        // Get connection configuration
        let connection = null;
        try {
            connection = await this.getConnection(connectionId);
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                outputData: inputData,
                error: error.message
            };
        }

        // Use real MQTT connection
        try {
            const otManager = getOTConnectionsManager();
            const timeout = node.config?.mqttTimeout || 5000;
            const outputData = await otManager.subscribeMqttTopics(connection.config, topics, qos, timeout);

            return {
                success: true,
                message: `Received ${outputData.messageCount} MQTT messages from ${connection?.name || connectionId}`,
                outputData,
                metadata: {
                    connectionId,
                    connectionName: connection?.name,
                    qos,
                    topicCount: topics.length,
                    messageCount: outputData.messageCount
                }
            };
        } catch (error) {
            console.error('[handleMqtt] Error subscribing to MQTT topics:', error);
            // Fallback to simulation if real connection fails
            const timestamp = new Date().toISOString();
            const simulatedMessages = topics.map(topic => ({
                topic,
                payload: JSON.stringify({
                    value: Math.random() * 100,
                    timestamp,
                    sensorId: topic.split('/').pop()
                }),
                qos,
                timestamp
            }));

            return {
                success: false,
                message: `MQTT subscription failed: ${error.message}. Using simulated data.`,
                outputData: {
                    timestamp,
                    messages: simulatedMessages,
                    topicData: simulatedMessages.reduce((acc, msg) => {
                        const data = JSON.parse(msg.payload);
                        acc[msg.topic] = data.value;
                        return acc;
                    }, {})
                },
                metadata: {
                    connectionId,
                    connectionName: connection?.name,
                    qos,
                    topicCount: topics.length,
                    error: error.message,
                    simulated: true
                }
            };
        }
    }

    async handleModbus(node, inputData) {
        const connectionId = node.config?.modbusConnectionId;
        const addresses = node.config?.modbusAddresses || [];
        const functionCode = node.config?.modbusFunctionCode || 3; // Holding registers

        if (!connectionId || addresses.length === 0) {
            throw new Error('Modbus node requires connectionId and addresses configuration');
        }

        // Get connection configuration
        let connection = null;
        try {
            connection = await this.getConnection(connectionId);
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                outputData: inputData,
                error: error.message
            };
        }

        // Use real Modbus connection
        try {
            const otManager = getOTConnectionsManager();
            const timeout = node.config?.modbusTimeout || connection.config?.timeout || 10000;
            const outputData = await otManager.readModbusRegisters(connection.config, addresses, functionCode, timeout);

            return {
                success: true,
                message: `Read ${addresses.length} Modbus registers from ${connection?.name || connectionId}`,
                outputData,
                metadata: {
                    connectionId,
                    connectionName: connection?.name,
                    functionCode,
                    addressCount: addresses.length
                }
            };
        } catch (error) {
            console.error('[handleModbus] Error reading Modbus registers:', error);
            // Fallback to simulation if real connection fails
            const timestamp = new Date().toISOString();
            const simulatedData = addresses.map(addr => ({
                address: addr,
                value: Math.floor(Math.random() * 65535),
                functionCode,
                timestamp
            }));

            return {
                success: false,
                message: `Modbus read failed: ${error.message}. Using simulated data.`,
                outputData: {
                    timestamp,
                    registers: simulatedData.reduce((acc, item) => {
                        acc[item.address] = item.value;
                        return acc;
                    }, {}),
                    raw: simulatedData
                },
                metadata: {
                    connectionId,
                    connectionName: connection?.name,
                    functionCode,
                    addressCount: addresses.length,
                    error: error.message,
                    simulated: true
                }
            };
        }
    }

    async handleScada(node, inputData) {
        const connectionId = node.config?.scadaConnectionId;
        const tags = node.config?.scadaTags || [];
        const pollingInterval = node.config?.scadaPollingInterval || 5000;

        if (!connectionId || tags.length === 0) {
            throw new Error('SCADA node requires connectionId and tags configuration');
        }

        // Get connection configuration
        let connection = null;
        try {
            connection = await this.getConnection(connectionId);
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                outputData: inputData,
                error: error.message
            };
        }

        // TODO: Implement actual SCADA connection (OPC UA/Modbus/API based)
        // For now, simulate reading SCADA tags using connection config
        const timestamp = new Date().toISOString();
        const simulatedData = tags.map(tag => ({
            tag,
            value: Math.random() * 100,
            timestamp,
            quality: 'Good'
        }));

        const outputData = {
            timestamp,
            tags: simulatedData.reduce((acc, item) => {
                acc[item.tag] = item.value;
                return acc;
            }, {}),
            raw: simulatedData
        };

        return {
            success: true,
            message: `Read ${tags.length} SCADA tags from ${connection?.name || connectionId}`,
            outputData,
            metadata: {
                connectionId,
                connectionName: connection?.name,
                pollingInterval,
                tagCount: tags.length
            }
        };
    }

    async handleMes(node, inputData) {
        const connectionId = node.config?.mesConnectionId;
        const endpoint = node.config?.mesEndpoint;
        const query = node.config?.mesQuery;

        if (!connectionId || !endpoint) {
            throw new Error('MES node requires connectionId and endpoint configuration');
        }

        // Get connection configuration
        let connection = null;
        try {
            connection = await this.getConnection(connectionId);
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                outputData: inputData,
                error: error.message
            };
        }

        // TODO: Implement actual MES API connection
        // For now, simulate fetching production data from MES using connection config
        const timestamp = new Date().toISOString();
        const simulatedData = {
            productionOrder: `PO-${Date.now()}`,
            quantity: Math.floor(Math.random() * 1000),
            status: 'In Progress',
            startTime: timestamp,
            equipment: 'Line-01',
            operator: 'Operator-123'
        };

        const outputData = {
            timestamp,
            ...simulatedData,
            query: query || 'production-status'
        };

        return {
            success: true,
            message: `Fetched production data from MES (${connection?.name || connectionId})`,
            outputData,
            metadata: {
                connectionId,
                connectionName: connection?.name,
                endpoint,
                query
            }
        };
    }

    async handleDataHistorian(node, inputData) {
        const connectionId = node.config?.dataHistorianConnectionId;
        const tags = node.config?.dataHistorianTags || [];
        const startTime = node.config?.dataHistorianStartTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const endTime = node.config?.dataHistorianEndTime || new Date().toISOString();
        const aggregation = node.config?.dataHistorianAggregation || 'raw';

        if (!connectionId || tags.length === 0) {
            throw new Error('Data Historian node requires connectionId and tags configuration');
        }

        // Get connection configuration
        let connection = null;
        try {
            connection = await this.getConnection(connectionId);
        } catch (error) {
            return {
                success: false,
                message: `Connection error: ${error.message}`,
                outputData: inputData,
                error: error.message
            };
        }

        // TODO: Implement actual Data Historian query (PI/Wonderware/InfluxDB)
        // For now, simulate historical time-series data using connection config
        const dataPoints = [];
        const start = new Date(startTime);
        const end = new Date(endTime);
        const interval = aggregation === 'raw' ? 60000 : 3600000; // 1min or 1h
        let current = new Date(start);

        while (current <= end) {
            tags.forEach(tag => {
                dataPoints.push({
                    tag,
                    timestamp: current.toISOString(),
                    value: Math.random() * 100
                });
            });
            current = new Date(current.getTime() + interval);
        }

        const outputData = {
            startTime,
            endTime,
            aggregation,
            dataPoints,
            tags: tags.reduce((acc, tag) => {
                acc[tag] = dataPoints.filter(dp => dp.tag === tag).map(dp => ({
                    timestamp: dp.timestamp,
                    value: dp.value
                }));
                return acc;
            }, {})
        };

        return {
            success: true,
            message: `Queried ${dataPoints.length} historical data points for ${tags.length} tags from ${connection?.name || connectionId}`,
            outputData,
            metadata: {
                connectionId,
                connectionName: connection?.name,
                tagCount: tags.length,
                pointCount: dataPoints.length,
                aggregation
            }
        };
    }

    async handleTimeSeriesAggregator(node, inputData) {
        const aggregationType = node.config?.timeSeriesAggregationType || 'avg';
        const interval = node.config?.timeSeriesInterval || '5m';
        const fields = node.config?.timeSeriesFields || [];

        if (!inputData || !inputData.timestamp) {
            // If no time-series data, try to aggregate from array input
            if (Array.isArray(inputData)) {
                return this.aggregateTimeSeriesArray(inputData, aggregationType, interval, fields);
            }
            throw new Error('Time-Series Aggregator requires time-series data with timestamp');
        }

        // TODO: Implement proper time-series aggregation
        // For now, simple aggregation logic
        const timestamp = inputData.timestamp;
        const values = { ...inputData };
        delete values.timestamp;

        const aggregated = {};
        Object.keys(values).forEach(key => {
            if (fields.length === 0 || fields.includes(key)) {
                const value = Number(values[key]);
                if (!isNaN(value)) {
                    aggregated[key] = this.aggregateValue(value, aggregationType);
                }
            }
        });

        return {
            success: true,
            message: `Aggregated time-series data using ${aggregationType}`,
            outputData: {
                timestamp,
                interval,
                ...aggregated
            },
            metadata: {
                aggregationType,
                interval,
                fieldCount: Object.keys(aggregated).length
            }
        };
    }

    aggregateTimeSeriesArray(dataArray, aggregationType, interval, fields) {
        if (!Array.isArray(dataArray) || dataArray.length === 0) {
            return {
                success: true,
                message: 'No data to aggregate',
                outputData: {}
            };
        }

        // Group by interval and aggregate
        const grouped = {};
        dataArray.forEach(item => {
            const timestamp = new Date(item.timestamp || item.createdAt || Date.now());
            const intervalKey = this.getIntervalKey(timestamp, interval);
            
            if (!grouped[intervalKey]) {
                grouped[intervalKey] = [];
            }
            grouped[intervalKey].push(item);
        });

        const aggregated = {};
        Object.keys(grouped).forEach(intervalKey => {
            const group = grouped[intervalKey];
            const keys = fields.length > 0 ? fields : Object.keys(group[0] || {}).filter(k => k !== 'timestamp' && k !== 'createdAt');
            
            keys.forEach(key => {
                const values = group.map(item => Number(item[key])).filter(v => !isNaN(v));
                if (values.length > 0) {
                    if (!aggregated[key]) aggregated[key] = [];
                    aggregated[key].push({
                        interval: intervalKey,
                        value: this.aggregateValueArray(values, aggregationType),
                        count: values.length
                    });
                }
            });
        });

        return {
            success: true,
            message: `Aggregated ${dataArray.length} data points into ${Object.keys(grouped).length} intervals`,
            outputData: aggregated,
            metadata: {
                aggregationType,
                interval,
                inputCount: dataArray.length,
                outputIntervals: Object.keys(grouped).length
            }
        };
    }

    aggregateValue(value, type) {
        // For single value, return as-is (will be aggregated with other values in interval)
        return value;
    }

    aggregateValueArray(values, type) {
        switch (type) {
            case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
            case 'min': return Math.min(...values);
            case 'max': return Math.max(...values);
            case 'sum': return values.reduce((a, b) => a + b, 0);
            case 'count': return values.length;
            default: return values.reduce((a, b) => a + b, 0) / values.length;
        }
    }

    getIntervalKey(timestamp, interval) {
        const date = new Date(timestamp);
        const intervalMs = this.parseInterval(interval);
        const intervalStart = Math.floor(date.getTime() / intervalMs) * intervalMs;
        return new Date(intervalStart).toISOString();
    }

    parseInterval(interval) {
        const match = interval.match(/^(\d+)([smhd])$/);
        if (!match) return 5 * 60 * 1000; // Default 5 minutes
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 5 * 60 * 1000;
        }
    }

    // ==================== HELPER METHODS ====================

    applyInputs(inputs) {
        // Apply form inputs to manualInput nodes
        Object.entries(inputs).forEach(([nodeId, value]) => {
            // Skip special keys
            if (nodeId.startsWith('_')) return;
            
            const node = this.nodes.find(n => n.id === nodeId);
            if (node && node.type === 'manualInput') {
                if (!node.config) node.config = {};
                node.config.inputVarValue = value;
                node.config.variableValue = value;
            }
        });

        // Apply webhook data to webhook nodes
        if (inputs._webhookData) {
            const webhookNodes = this.nodes.filter(n => n.type === 'webhook');
            webhookNodes.forEach(node => {
                if (!node.config) node.config = {};
                node.config.webhookData = inputs._webhookData;
            });
            this.webhookData = inputs._webhookData;
        }
    }

    getNextNodes(nodeId, result) {
        // Get connections from this node
        const outgoing = this.connections.filter(c => c.fromNodeId === nodeId);
        
        console.log(`[getNextNodes] Node ${nodeId} has ${outgoing.length} outgoing connections`);
        console.log(`[getNextNodes] All connections:`, JSON.stringify(this.connections.map(c => ({from: c.fromNodeId, to: c.toNodeId}))));
        
        // For condition nodes, filter by conditionResult
        if (result?.conditionResult !== undefined) {
            return outgoing
                .filter(c => {
                    if (result.conditionResult && c.fromPort === 'true') return true;
                    if (!result.conditionResult && c.fromPort === 'false') return true;
                    if (c.fromPort !== 'true' && c.fromPort !== 'false') return true;
                    return false;
                })
                .map(c => this.nodes.find(n => n.id === c.toNodeId))
                .filter(Boolean);
        }

        const nextNodes = outgoing
            .map(c => this.nodes.find(n => n.id === c.toNodeId))
            .filter(Boolean);
        
        console.log(`[getNextNodes] Next nodes to execute:`, nextNodes.map(n => ({id: n.id, type: n.type, label: n.label})));
        
        return nextNodes;
    }

    evaluateCondition(actual, operator, expected) {
        switch (operator) {
            case 'equals': return String(actual) === String(expected);
            case 'notEquals': return String(actual) !== String(expected);
            case 'contains': return String(actual).includes(String(expected));
            case 'greaterThan': return Number(actual) > Number(expected);
            case 'lessThan': return Number(actual) < Number(expected);
            case 'greaterOrEqual': return Number(actual) >= Number(expected);
            case 'lessOrEqual': return Number(actual) <= Number(expected);
            case 'isEmpty': return !actual || actual === '';
            case 'isNotEmpty': return actual && actual !== '';
            default: return String(actual) === String(expected);
        }
    }

    evaluateExpression(expression, record) {
        // Simple expression evaluation - replace {{field}} with values
        if (!expression || typeof expression !== 'string') return expression;
        
        return expression.replace(/\{\{(\w+)\}\}/g, (match, field) => {
            return record[field] !== undefined ? record[field] : match;
        });
    }

    async updateExecutionStatus(status, extra = {}) {
        const updates = { status, ...extra };
        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), this.executionId];

        await this.db.run(
            `UPDATE workflow_executions SET ${setClauses} WHERE id = ?`,
            values
        );
    }

    async logNodeStart(node) {
        await this.db.run(`
            INSERT INTO execution_logs (id, executionId, nodeId, nodeType, nodeLabel, status, timestamp)
            VALUES (?, ?, ?, ?, ?, 'running', ?)
        `, [generateId(), this.executionId, node.id, node.type, node.label, new Date().toISOString()]);
    }

    async logNodeComplete(node, inputData, result, duration) {
        await this.db.run(`
            INSERT INTO execution_logs (id, executionId, nodeId, nodeType, nodeLabel, status, inputData, outputData, duration, timestamp)
            VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)
        `, [
            generateId(),
            this.executionId,
            node.id,
            node.type,
            node.label,
            JSON.stringify(inputData),
            JSON.stringify(result),
            duration,
            new Date().toISOString()
        ]);
    }

    async logNodeError(node, inputData, error, duration) {
        await this.db.run(`
            INSERT INTO execution_logs (id, executionId, nodeId, nodeType, nodeLabel, status, inputData, error, duration, timestamp)
            VALUES (?, ?, ?, ?, ?, 'error', ?, ?, ?, ?)
        `, [
            generateId(),
            this.executionId,
            node.id,
            node.type,
            node.label,
            JSON.stringify(inputData),
            error.message,
            duration,
            new Date().toISOString()
        ]);
    }
}

module.exports = { WorkflowExecutor, setBroadcastToOrganization };

