/**
 * Workflow Executor - Executes workflows in the backend
 * Supports both full workflow execution and individual node execution
 */

const crypto = require('crypto');
const { gcsService } = require('./gcsService');
const { isTimeSeriesData: detectTimeSeriesData, normalizeTimeSeriesData } = require('./utils/timeSeriesHelper');

// Generate unique ID
const generateId = () => crypto.randomBytes(8).toString('hex');

class WorkflowExecutor {
    constructor(db, executionId = null) {
        this.db = db;
        this.executionId = executionId;
        this.workflow = null;
        this.nodes = [];
        this.connections = [];
        this.nodeResults = {};
        this.execution = null;
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

            // Mark as completed
            await this.updateExecutionStatus('completed', {
                completedAt: new Date().toISOString(),
                finalOutput: JSON.stringify(this.nodeResults),
                nodeResults: JSON.stringify(this.nodeResults)
            });

            return {
                executionId: this.executionId,
                status: 'completed',
                results: this.nodeResults
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
            addField: () => this.handleAddField(node, inputData),
            condition: () => this.handleCondition(node, inputData),
            join: () => this.handleJoin(node, inputData),
            http: () => this.handleHttp(node, inputData),
            llm: () => this.handleLLM(node, inputData),
            mysql: () => this.handleMySQL(node, inputData),
            sendEmail: () => this.handleSendEmail(node, inputData),
            sendSMS: () => this.handleSendSMS(node, inputData),
            dataVisualization: () => this.handleDataVisualization(node, inputData),
            esios: () => this.handleEsios(node, inputData),
            climatiq: () => this.handleClimatiq(node, inputData),
            splitColumns: () => this.handleSplitColumns(node, inputData),
            comment: () => this.handleComment(node, inputData),
            humanApproval: () => this.handleHumanApproval(node, inputData),
            webhook: () => this.handleWebhook(node, inputData),
            // OT/Industrial nodes
            opcua: () => this.handleOpcua(node, inputData),
            mqtt: () => this.handleMqtt(node, inputData),
            modbus: () => this.handleModbus(node, inputData),
            scada: () => this.handleScada(node, inputData),
            mes: () => this.handleMes(node, inputData),
            dataHistorian: () => this.handleDataHistorian(node, inputData),
            timeSeriesAggregator: () => this.handleTimeSeriesAggregator(node, inputData),
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
        
        if (config.parsedText) {
            return {
                success: true,
                message: `Loaded PDF: ${config.fileName || 'file'} (${config.pages || '?'} pages)`,
                outputData: {
                    text: config.parsedText,
                    fileName: config.fileName,
                    pages: config.pages
                }
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
     * Save records to entity using the entities API structure
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

            // Save each record (in a real implementation, this would call the API)
            // For now, we'll use the database directly
            let savedCount = 0;
            const savedIds = [];

            for (const record of normalizedRecords) {
                // Get entity properties
                const properties = await this.db.all(
                    'SELECT id, name, type FROM properties WHERE entityId = ?',
                    [entityId]
                );

                // Create property name mapping
                const propertyMap = {};
                properties.forEach(prop => {
                    propertyMap[prop.name.toLowerCase()] = prop;
                });

                // Create record
                const recordId = generateId();
                const createdAt = record.timestamp || record.createdAt || new Date().toISOString();

                await this.db.run(
                    'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
                    [recordId, entityId, createdAt]
                );

                // Save property values
                for (const [key, val] of Object.entries(record)) {
                    if (key === 'id' || key === 'createdAt' || key === 'entityId' || key === 'timestamp') {
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
                message: `Saved ${savedCount} record(s) to entity '${entityId}'${isTimeSeriesData ? ' (time-series optimized)' : ''}`,
                outputData: inputData,
                savedIds,
                entityId,
                isTimeSeries: isTimeSeriesData
            };
        } catch (error) {
            console.error('[SaveToEntity] Error:', error);
            throw error;
        }
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

        try {
            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey });

            // Build context from input data
            let context = '';
            if (inputData) {
                context = `\n\nContext data:\n${JSON.stringify(inputData, null, 2)}`;
            }

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'user', content: prompt + context }
                ]
            });

            const response = completion.choices[0]?.message?.content || '';

            return {
                success: true,
                message: 'LLM response generated',
                outputData: { response, inputData },
                llmResponse: response
            };
        } catch (error) {
            throw new Error(`LLM request failed: ${error.message}`);
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

    // ==================== OT/INDUSTRIAL NODE HANDLERS ====================

    async handleOpcua(node, inputData) {
        const connectionId = node.config?.opcuaConnectionId;
        const nodeIds = node.config?.opcuaNodeIds || [];
        const pollingInterval = node.config?.opcuaPollingInterval || 5000;

        if (!connectionId || nodeIds.length === 0) {
            throw new Error('OPC UA node requires connectionId and nodeIds configuration');
        }

        // TODO: Implement actual OPC UA connection using node-opcua library
        // For now, simulate reading from OPC UA server
        const timestamp = new Date().toISOString();
        const simulatedData = nodeIds.map(nodeId => ({
            nodeId,
            value: Math.random() * 100, // Simulated sensor value
            timestamp,
            quality: 'Good'
        }));

        const outputData = {
            timestamp,
            values: simulatedData.reduce((acc, item) => {
                acc[item.nodeId] = item.value;
                return acc;
            }, {}),
            raw: simulatedData
        };

        return {
            success: true,
            message: `Read ${nodeIds.length} OPC UA nodes`,
            outputData,
            metadata: {
                connectionId,
                pollingInterval,
                nodeCount: nodeIds.length
            }
        };
    }

    async handleMqtt(node, inputData) {
        const connectionId = node.config?.mqttConnectionId;
        const topics = node.config?.mqttTopics || [];
        const qos = node.config?.mqttQos || 0;

        if (!connectionId || topics.length === 0) {
            throw new Error('MQTT node requires connectionId and topics configuration');
        }

        // TODO: Implement actual MQTT subscription using mqtt library
        // For now, simulate receiving MQTT messages
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

        const outputData = {
            timestamp,
            messages: simulatedMessages,
            topicData: simulatedMessages.reduce((acc, msg) => {
                const data = JSON.parse(msg.payload);
                acc[msg.topic] = data.value;
                return acc;
            }, {})
        };

        return {
            success: true,
            message: `Received ${topics.length} MQTT messages`,
            outputData,
            metadata: {
                connectionId,
                qos,
                topicCount: topics.length
            }
        };
    }

    async handleModbus(node, inputData) {
        const connectionId = node.config?.modbusConnectionId;
        const addresses = node.config?.modbusAddresses || [];
        const functionCode = node.config?.modbusFunctionCode || 3; // Holding registers

        if (!connectionId || addresses.length === 0) {
            throw new Error('Modbus node requires connectionId and addresses configuration');
        }

        // TODO: Implement actual Modbus connection using modbus-serial library
        // For now, simulate reading from Modbus device
        const timestamp = new Date().toISOString();
        const simulatedData = addresses.map(addr => ({
            address: addr,
            value: Math.floor(Math.random() * 65535), // 16-bit value
            functionCode,
            timestamp
        }));

        const outputData = {
            timestamp,
            registers: simulatedData.reduce((acc, item) => {
                acc[item.address] = item.value;
                return acc;
            }, {}),
            raw: simulatedData
        };

        return {
            success: true,
            message: `Read ${addresses.length} Modbus registers`,
            outputData,
            metadata: {
                connectionId,
                functionCode,
                addressCount: addresses.length
            }
        };
    }

    async handleScada(node, inputData) {
        const connectionId = node.config?.scadaConnectionId;
        const tags = node.config?.scadaTags || [];
        const pollingInterval = node.config?.scadaPollingInterval || 5000;

        if (!connectionId || tags.length === 0) {
            throw new Error('SCADA node requires connectionId and tags configuration');
        }

        // TODO: Implement actual SCADA connection (OPC UA/Modbus/API based)
        // For now, simulate reading SCADA tags
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
            message: `Read ${tags.length} SCADA tags`,
            outputData,
            metadata: {
                connectionId,
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

        // TODO: Implement actual MES API connection
        // For now, simulate fetching production data from MES
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
            message: `Fetched production data from MES`,
            outputData,
            metadata: {
                connectionId,
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

        // TODO: Implement actual Data Historian query (PI/Wonderware/InfluxDB)
        // For now, simulate historical time-series data
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
            message: `Queried ${dataPoints.length} historical data points for ${tags.length} tags`,
            outputData,
            metadata: {
                connectionId,
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

module.exports = { WorkflowExecutor };

