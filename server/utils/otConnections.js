/**
 * OT Connections Manager
 * Manages real connections to OPC UA, MQTT, and Modbus devices
 */

const { OPCUAClient, MessageSecurityMode, SecurityPolicy } = require('node-opcua');
const mqtt = require('mqtt');
const ModbusRTU = require('modbus-serial');

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

// Singleton instance
let instance = null;

function getOTConnectionsManager() {
    if (!instance) {
        instance = new OTConnectionsManager();
    }
    return instance;
}

module.exports = {
    getOTConnectionsManager,
    OTConnectionsManager
};
