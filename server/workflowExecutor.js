/**
 * Workflow Executor - Executes workflows in the backend
 * Supports both full workflow execution and individual node execution
 */

const crypto = require('crypto');

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
            saveRecords: () => this.handleSaveRecords(node, inputData),
            addField: () => this.handleAddField(node, inputData),
            condition: () => this.handleCondition(node, inputData),
            join: () => this.handleJoin(node, inputData),
            http: () => this.handleHttp(node, inputData),
            llm: () => this.handleLLM(node, inputData),
            mysql: () => this.handleMySQL(node, inputData),
            sendEmail: () => this.handleSendEmail(node, inputData),
            esios: () => this.handleEsios(node, inputData),
            climatiq: () => this.handleClimatiq(node, inputData),
            splitColumns: () => this.handleSplitColumns(node, inputData),
            comment: () => this.handleComment(node, inputData),
            humanApproval: () => this.handleHumanApproval(node, inputData),
            webhook: () => this.handleWebhook(node, inputData),
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

    async handleSaveRecords(node, inputData) {
        const tableName = node.config?.tableName || node.config?.entityName || 'saved_records';
        const mode = node.config?.saveMode || 'insert'; // insert, upsert, update
        
        try {
            // Ensure table exists
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS ${tableName} (
                    id TEXT PRIMARY KEY,
                    data TEXT,
                    workflowId TEXT,
                    executionId TEXT,
                    createdAt TEXT,
                    updatedAt TEXT
                )
            `);

            let savedCount = 0;
            const records = Array.isArray(inputData) ? inputData : [inputData];
            const savedIds = [];

            for (const record of records) {
                const recordId = record.id || generateId();
                const now = new Date().toISOString();
                
                if (mode === 'upsert' && record.id) {
                    // Check if exists
                    const existing = await this.db.get(
                        `SELECT id FROM ${tableName} WHERE id = ?`,
                        [record.id]
                    );
                    
                    if (existing) {
                        await this.db.run(
                            `UPDATE ${tableName} SET data = ?, updatedAt = ? WHERE id = ?`,
                            [JSON.stringify(record), now, record.id]
                        );
                    } else {
                        await this.db.run(
                            `INSERT INTO ${tableName} (id, data, workflowId, executionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
                            [recordId, JSON.stringify(record), this.workflow?.id, this.executionId, now, now]
                        );
                    }
                } else {
                    await this.db.run(
                        `INSERT INTO ${tableName} (id, data, workflowId, executionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
                        [recordId, JSON.stringify(record), this.workflow?.id, this.executionId, now, now]
                    );
                }
                
                savedIds.push(recordId);
                savedCount++;
            }

            return {
                success: true,
                message: `Saved ${savedCount} record(s) to '${tableName}'`,
                outputData: inputData,
                savedIds,
                tableName
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

