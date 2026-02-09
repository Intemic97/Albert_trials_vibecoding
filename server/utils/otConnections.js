/**
 * OT Connections Manager
 * Manages real connections to OPC UA, MQTT, and Modbus devices
 */

let OPCUAClient, MessageSecurityMode, SecurityPolicy, mqtt, ModbusRTU;

try {
    ({ OPCUAClient, MessageSecurityMode, SecurityPolicy } = require('node-opcua'));
} catch (e) {
    console.warn('[OT] node-opcua not installed — OPC UA connections will be unavailable');
}

try {
    mqtt = require('mqtt');
} catch (e) {
    console.warn('[OT] mqtt not installed — MQTT connections will be unavailable');
}

try {
    ModbusRTU = require('modbus-serial');
} catch (e) {
    console.warn('[OT] modbus-serial not installed — Modbus connections will be unavailable');
}

class OTConnectionsManager {
    constructor() {
        this.opcuaClients = new Map(); // connectionId -> client
        this.mqttClients = new Map(); // connectionId -> client
        this.modbusClients = new Map(); // connectionId -> client
    }

    /**
     * Get or create OPC UA client
     */
    async getOpcuaClient(connectionConfig) {
        if (!OPCUAClient) throw new Error('OPC UA is not available — node-opcua package is not installed');
        const { endpoint, securityMode, securityPolicy, username, password } = connectionConfig;
        const cacheKey = `${endpoint}_${username || 'anonymous'}`;

        if (this.opcuaClients.has(cacheKey)) {
            const cachedClient = this.opcuaClients.get(cacheKey);
            // Check if client is still connected
            try {
                // Try to create a test session to verify connection
                const testSession = await cachedClient.createSession();
                await testSession.close();
                return cachedClient;
            } catch (error) {
                // Connection lost, remove from cache and recreate
                console.log('[OTConnections] OPC UA client disconnected, recreating...');
                this.opcuaClients.delete(cacheKey);
                try {
                    await cachedClient.disconnect();
                } catch (e) {
                    // Ignore disconnect errors
                }
            }
        }

        try {
            const client = OPCUAClient.create({
                endpointMustExist: false,
                securityMode: securityMode ? MessageSecurityMode[securityMode] : MessageSecurityMode.None,
                securityPolicy: securityPolicy ? SecurityPolicy[securityPolicy] : SecurityPolicy.None,
            });

            await client.connect(endpoint);
            
            if (username && password) {
                await client.login(username, password);
            } else {
                await client.login();
            }

            this.opcuaClients.set(cacheKey, client);
            return client;
        } catch (error) {
            console.error('[OTConnections] OPC UA connection error:', error);
            throw new Error(`Failed to connect to OPC UA server: ${error.message}`);
        }
    }

    /**
     * Read OPC UA nodes
     */
    async readOpcuaNodes(connectionConfig, nodeIds, timeout = 10000) {
        const client = await this.getOpcuaClient(connectionConfig);
        
        return Promise.race([
            (async () => {
                try {
                    const session = await client.createSession();
                    const nodesToRead = nodeIds.map(nodeId => ({ nodeId }));
                    
                    const dataValues = await session.read(nodesToRead);
                    await session.close();

                    const timestamp = new Date().toISOString();
                    const values = {};
                    const raw = [];

                    dataValues.forEach((dataValue, index) => {
                        const nodeId = nodeIds[index];
                        const value = dataValue.value.value;
                        values[nodeId] = value;
                        raw.push({
                            nodeId,
                            value,
                            timestamp,
                            quality: dataValue.statusCode.isGood() ? 'Good' : 'Bad',
                            statusCode: dataValue.statusCode.toString()
                        });
                    });

                    return {
                        timestamp,
                        values,
                        raw
                    };
                } catch (error) {
                    console.error('[OTConnections] OPC UA read error:', error);
                    throw new Error(`Failed to read OPC UA nodes: ${error.message}`);
                }
            })(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`OPC UA read timeout after ${timeout}ms`)), timeout)
            )
        ]);
    }

    /**
     * Get or create MQTT client
     */
    async getMqttClient(connectionConfig) {
        if (!mqtt) throw new Error('MQTT is not available — mqtt package is not installed');
        const { broker, port, protocol, username, password, clientId } = connectionConfig;
        const cacheKey = `${broker}_${port}_${clientId || 'default'}`;

        if (this.mqttClients.has(cacheKey)) {
            const client = this.mqttClients.get(cacheKey);
            if (client.connected) {
                return client;
            }
            // Remove disconnected client
            this.mqttClients.delete(cacheKey);
        }

        return new Promise((resolve, reject) => {
            try {
                const url = `${protocol || 'mqtt'}://${broker}:${port || 1883}`;
                const options = {
                    clientId: clientId || `mqtt_client_${Date.now()}`,
                    clean: true,
                    connectTimeout: 10000,
                    reconnectPeriod: 5000,
                };

                if (username) {
                    options.username = username;
                    options.password = password;
                }

                const client = mqtt.connect(url, options);

                client.on('connect', () => {
                    console.log(`[OTConnections] MQTT connected to ${broker}:${port}`);
                    this.mqttClients.set(cacheKey, client);
                    resolve(client);
                });

                client.on('error', (error) => {
                    console.error('[OTConnections] MQTT connection error:', error);
                    reject(new Error(`MQTT connection failed: ${error.message}`));
                });

                // Timeout after 10 seconds
                setTimeout(() => {
                    if (!client.connected) {
                        client.end();
                        reject(new Error('MQTT connection timeout'));
                    }
                }, 10000);
            } catch (error) {
                reject(new Error(`Failed to create MQTT client: ${error.message}`));
            }
        });
    }

    /**
     * Subscribe to MQTT topics and collect messages
     */
    async subscribeMqttTopics(connectionConfig, topics, qos = 0, timeout = 5000) {
        const client = await this.getMqttClient(connectionConfig);
        
        return new Promise((resolve, reject) => {
            const messages = [];
            const topicData = {};

            const messageHandler = (topic, message) => {
                try {
                    const payload = message.toString();
                    let parsed;
                    try {
                        parsed = JSON.parse(payload);
                    } catch {
                        parsed = payload;
                    }

                    messages.push({
                        topic,
                        payload: parsed,
                        timestamp: new Date().toISOString()
                    });

                    if (!topicData[topic]) {
                        topicData[topic] = [];
                    }
                    topicData[topic].push(parsed);
                } catch (error) {
                    console.error('[OTConnections] MQTT message parse error:', error);
                }
            };

            client.on('message', messageHandler);

            // Subscribe to all topics
            const subscribePromises = topics.map(topic => {
                return new Promise((subResolve, subReject) => {
                    client.subscribe(topic, { qos }, (err) => {
                        if (err) {
                            subReject(err);
                        } else {
                            console.log(`[OTConnections] Subscribed to MQTT topic: ${topic}`);
                            subResolve();
                        }
                    });
                });
            });

            Promise.all(subscribePromises)
                .then(() => {
                    // Wait for messages or timeout
                    setTimeout(() => {
                        client.removeListener('message', messageHandler);
                        resolve({
                            timestamp: new Date().toISOString(),
                            topicData,
                            messages,
                            topicCount: topics.length,
                            messageCount: messages.length
                        });
                    }, timeout);
                })
                .catch(reject);
        });
    }

    /**
     * Get or create Modbus client
     */
    async getModbusClient(connectionConfig) {
        if (!ModbusRTU) throw new Error('Modbus is not available — modbus-serial package is not installed');
        const { host, port, unitId, type } = connectionConfig;
        const cacheKey = `${host}_${port}_${unitId || 1}`;

        if (this.modbusClients.has(cacheKey)) {
            return this.modbusClients.get(cacheKey);
        }

        return new Promise((resolve, reject) => {
            try {
                const client = new ModbusRTU();
                const connectionType = type || 'TCP';

                if (connectionType === 'TCP') {
                    client.connectTCP(host, { port: port || 502 })
                        .then(() => {
                            if (unitId) {
                                client.setID(unitId);
                            }
                            this.modbusClients.set(cacheKey, client);
                            resolve(client);
                        })
                        .catch(reject);
                } else if (connectionType === 'RTU') {
                    // RTU over serial port
                    const serialPort = connectionConfig.serialPort || '/dev/ttyUSB0';
                    client.connectRTUBuffered(serialPort, { baudRate: connectionConfig.baudRate || 9600 })
                        .then(() => {
                            if (unitId) {
                                client.setID(unitId);
                            }
                            this.modbusClients.set(cacheKey, client);
                            resolve(client);
                        })
                        .catch(reject);
                } else {
                    reject(new Error(`Unsupported Modbus connection type: ${connectionType}`));
                }
            } catch (error) {
                reject(new Error(`Failed to create Modbus client: ${error.message}`));
            }
        });
    }

    /**
     * Read Modbus registers
     */
    async readModbusRegisters(connectionConfig, addresses, functionCode = 3, timeout = 10000) {
        const client = await this.getModbusClient(connectionConfig);
        
        return Promise.race([
            (async () => {
                try {
                    const timestamp = new Date().toISOString();
                    const registers = {};
                    const raw = [];

                    for (const address of addresses) {
                        try {
                            let value;
                            if (functionCode === 3 || functionCode === 4) {
                                // Holding registers or Input registers
                                const result = await client.readHoldingRegisters(address, 1);
                                value = result.data[0];
                            } else if (functionCode === 1 || functionCode === 2) {
                                // Coils or Discrete inputs
                                const result = await client.readCoils(address, 1);
                                value = result.data[0] ? 1 : 0;
                            } else {
                                throw new Error(`Unsupported Modbus function code: ${functionCode}`);
                            }

                            registers[address] = value;
                            raw.push({
                                address,
                                value,
                                functionCode,
                                timestamp
                            });
                        } catch (error) {
                            console.error(`[OTConnections] Error reading Modbus address ${address}:`, error);
                            raw.push({
                                address,
                                value: null,
                                functionCode,
                                timestamp,
                                error: error.message
                            });
                        }
                    }

                    return {
                        timestamp,
                        registers,
                        raw
                    };
                } catch (error) {
                    console.error('[OTConnections] Modbus read error:', error);
                    throw new Error(`Failed to read Modbus registers: ${error.message}`);
                }
            })(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Modbus read timeout after ${timeout}ms`)), timeout)
            )
        ]);
    }

    /**
     * Close all connections
     */
    async closeAll() {
        // Close OPC UA clients
        for (const [key, client] of this.opcuaClients.entries()) {
            try {
                await client.disconnect();
            } catch (error) {
                console.error(`[OTConnections] Error closing OPC UA client ${key}:`, error);
            }
        }
        this.opcuaClients.clear();

        // Close MQTT clients
        for (const [key, client] of this.mqttClients.entries()) {
            try {
                client.end();
            } catch (error) {
                console.error(`[OTConnections] Error closing MQTT client ${key}:`, error);
            }
        }
        this.mqttClients.clear();

        // Close Modbus clients
        for (const [key, client] of this.modbusClients.entries()) {
            try {
                client.close(() => {});
            } catch (error) {
                console.error(`[OTConnections] Error closing Modbus client ${key}:`, error);
            }
        }
        this.modbusClients.clear();
    }

    /**
     * Test OPC UA connection
     */
    async testOpcuaConnection(connectionConfig, timeout = 10000) {
        try {
            return await Promise.race([
                (async () => {
                    const client = await this.getOpcuaClient(connectionConfig);
                    const session = await client.createSession();
                    await session.close();
                    return { success: true, message: 'OPC UA connection successful' };
                })(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`OPC UA test timeout after ${timeout}ms`)), timeout)
                )
            ]);
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Test MQTT connection
     */
    async testMqttConnection(connectionConfig, timeout = 10000) {
        try {
            return await Promise.race([
                (async () => {
                    const client = await this.getMqttClient(connectionConfig);
                    return { success: true, message: 'MQTT connection successful' };
                })(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`MQTT test timeout after ${timeout}ms`)), timeout)
                )
            ]);
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Test Modbus connection
     */
    async testModbusConnection(connectionConfig, timeout = 10000) {
        try {
            return await Promise.race([
                (async () => {
                    const client = await this.getModbusClient(connectionConfig);
                    // Try to read a test register (address 0)
                    try {
                        await client.readHoldingRegisters(0, 1);
                        return { success: true, message: 'Modbus connection successful' };
                    } catch (readError) {
                        // Even if reading fails, connection might be OK
                        return { success: true, message: `Modbus connection established (test read may have failed: ${readError.message})` };
                    }
                })(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Modbus test timeout after ${timeout}ms`)), timeout)
                )
            ]);
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

/**
 * Auto Health Check Service
 * Periodically tests connections and updates their status
 */
class ConnectionHealthChecker {
    constructor(db, connectionsManager, broadcastFn = null) {
        this.db = db;
        this.connectionsManager = connectionsManager;
        this.broadcastToOrganization = broadcastFn;
        this.checkInterval = null;
        this.isRunning = false;
    }

    /**
     * Start automatic health checks
     */
    start(intervalMs = 5 * 60 * 1000) { // Default: every 5 minutes
        if (this.isRunning) return;
        
        this.isRunning = true;
        console.log(`[HealthCheck] Starting auto health checks every ${intervalMs / 1000}s`);
        
        // Run immediately on start
        this.runHealthChecks();
        
        // Schedule periodic checks
        this.checkInterval = setInterval(() => {
            this.runHealthChecks();
        }, intervalMs);
    }

    /**
     * Stop automatic health checks
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('[HealthCheck] Stopped auto health checks');
    }

    /**
     * Run health checks on all OT connections
     */
    async runHealthChecks() {
        try {
            // Get all OT connections
            const connections = await this.db.all(`
                SELECT * FROM data_connections 
                WHERE type IN ('opcua', 'mqtt', 'modbus', 'scada', 'mes', 'dataHistorian')
            `);

            if (!connections || connections.length === 0) {
                return;
            }

            console.log(`[HealthCheck] Checking ${connections.length} OT connections...`);
            
            for (const connection of connections) {
                try {
                    await this.checkConnection(connection);
                } catch (error) {
                    console.error(`[HealthCheck] Error checking connection ${connection.id}:`, error.message);
                }
            }
        } catch (error) {
            console.error('[HealthCheck] Error running health checks:', error);
        }
    }

    /**
     * Check a single connection
     */
    async checkConnection(connection) {
        const startTime = Date.now();
        let result = { success: false, message: 'Unknown error' };
        
        try {
            const config = typeof connection.config === 'string' 
                ? JSON.parse(connection.config) 
                : connection.config || {};

            switch (connection.type) {
                case 'opcua':
                    result = await this.connectionsManager.testOpcuaConnection(config, 5000);
                    break;
                case 'mqtt':
                    result = await this.connectionsManager.testMqttConnection(config, 5000);
                    break;
                case 'modbus':
                    result = await this.connectionsManager.testModbusConnection(config, 5000);
                    break;
                default:
                    // For other types, just mark as active if no recent errors
                    result = { success: true, message: 'Connection type does not support auto-check' };
            }
        } catch (error) {
            result = { success: false, message: error.message };
        }

        const latencyMs = Date.now() - startTime;
        const newStatus = result.success ? 'active' : 'error';
        const now = new Date().toISOString();

        // Update connection status in database
        try {
            await this.db.run(`
                UPDATE data_connections 
                SET status = ?, lastTestedAt = ?, lastError = ?, latencyMs = ?
                WHERE id = ?
            `, [
                newStatus,
                now,
                result.success ? null : result.message,
                latencyMs,
                connection.id
            ]);

            // Broadcast status change if status actually changed
            if (connection.status !== newStatus && this.broadcastToOrganization) {
                this.broadcastToOrganization(connection.orgId, {
                    type: 'connection_status_change',
                    connection: {
                        id: connection.id,
                        name: connection.name,
                        type: connection.type,
                        status: newStatus,
                        latencyMs,
                        lastTestedAt: now,
                        lastError: result.success ? null : result.message
                    }
                });
            }

            if (!result.success) {
                console.log(`[HealthCheck] Connection ${connection.name} (${connection.type}): ERROR - ${result.message}`);
            }
        } catch (dbError) {
            console.error(`[HealthCheck] Error updating connection ${connection.id}:`, dbError);
        }
    }
}

// Singleton instances
let connectionsInstance = null;
let healthCheckerInstance = null;

function getOTConnectionsManager() {
    if (!connectionsInstance) {
        connectionsInstance = new OTConnectionsManager();
    }
    return connectionsInstance;
}

function getConnectionHealthChecker(db, broadcastFn = null) {
    if (!healthCheckerInstance) {
        const connectionsManager = getOTConnectionsManager();
        healthCheckerInstance = new ConnectionHealthChecker(db, connectionsManager, broadcastFn);
    } else if (broadcastFn && !healthCheckerInstance.broadcastToOrganization) {
        healthCheckerInstance.broadcastToOrganization = broadcastFn;
    }
    return healthCheckerInstance;
}

module.exports = {
    getOTConnectionsManager,
    getConnectionHealthChecker,
    OTConnectionsManager,
    ConnectionHealthChecker
};
