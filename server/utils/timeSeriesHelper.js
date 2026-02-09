/**
 * Time-Series Helper Utilities
 * Utilities for working with time-series data from OT/Industrial nodes
 */

/**
 * Detect if data structure is time-series format
 */
function isTimeSeriesData(data) {
    if (!data) return false;
    
    const record = Array.isArray(data) ? data[0] : data;
    if (!record) return false;
    
    // Check for timestamp field
    const hasTimestamp = record.timestamp || record.createdAt || record.time;
    
    // Check for OT node output structure
    const hasOTStructure = 
        record.values ||           // OPC UA format
        record.tags ||             // SCADA format
        record.registers ||        // Modbus format
        record.topicData ||        // MQTT format
        record.messages ||         // MQTT messages
        (record.raw && Array.isArray(record.raw)); // Raw data array
    
    // Check for metadata indicating OT source
    const hasOTMetadata = record.metadata && (
        record.metadata.connectionId ||
        record.metadata.nodeCount ||
        record.metadata.tagCount
    );
    
    return !!(hasTimestamp && (hasOTStructure || hasOTMetadata));
}

/**
 * Normalize time-series data from different OT node formats to a flat structure
 */
function normalizeTimeSeriesData(data) {
    if (!data) return null;
    
    const records = Array.isArray(data) ? data : [data];
    
    return records.map(record => {
        const normalized = {
            timestamp: record.timestamp || record.createdAt || new Date().toISOString()
        };
        
        // Extract values based on format
        if (record.values) {
            // OPC UA format: { values: { nodeId: value } }
            Object.assign(normalized, record.values);
        } else if (record.tags) {
            // SCADA format: { tags: { tag: value } }
            Object.assign(normalized, record.tags);
        } else if (record.registers) {
            // Modbus format: { registers: { address: value } }
            Object.assign(normalized, record.registers);
        } else if (record.topicData) {
            // MQTT format: { topicData: { topic: value } }
            Object.assign(normalized, record.topicData);
        } else if (record.messages && Array.isArray(record.messages)) {
            // MQTT messages format
            record.messages.forEach(msg => {
                try {
                    const payload = typeof msg.payload === 'string' 
                        ? JSON.parse(msg.payload) 
                        : msg.payload;
                    if (payload.value !== undefined) {
                        normalized[msg.topic.replace(/\//g, '_')] = payload.value;
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            });
        } else if (record.raw && Array.isArray(record.raw)) {
            // Raw array format
            record.raw.forEach(item => {
                if (item.nodeId) {
                    normalized[item.nodeId.replace(/[^a-zA-Z0-9_]/g, '_')] = item.value;
                } else if (item.tag) {
                    normalized[item.tag.replace(/[^a-zA-Z0-9_]/g, '_')] = item.value;
                } else if (item.address) {
                    normalized[`register_${item.address}`] = item.value;
                }
            });
        } else {
            // Fallback: copy numeric/string fields
            Object.keys(record).forEach(key => {
                if (key !== 'metadata' && key !== 'raw' && key !== 'timestamp' && 
                    key !== 'createdAt' && key !== 'messages' && key !== 'dataPoints') {
                    const value = record[key];
                    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
                        normalized[key] = value;
                    }
                }
            });
        }
        
        return normalized;
    });
}

/**
 * Generate entity properties schema from time-series data
 */
function generateTimeSeriesSchema(normalizedRecords, entityName = 'TimeSeriesData') {
    if (!normalizedRecords || normalizedRecords.length === 0) {
        return {
            name: entityName,
            properties: [
                { name: 'timestamp', type: 'TEXT', description: 'Timestamp of the data point' }
            ]
        };
    }
    
    // Collect all unique field names from all records
    const fieldSet = new Set(['timestamp']);
    normalizedRecords.forEach(record => {
        Object.keys(record).forEach(key => {
            if (key !== 'id' && key !== 'createdAt') {
                fieldSet.add(key);
            }
        });
    });
    
    // Generate properties
    const properties = Array.from(fieldSet).map(fieldName => {
        // Sample values to detect type
        const sampleValues = normalizedRecords
            .map(r => r[fieldName])
            .filter(v => v !== null && v !== undefined)
            .slice(0, 10);
        
        let type = 'TEXT';
        if (sampleValues.length > 0) {
            const firstValue = sampleValues[0];
            if (typeof firstValue === 'number') {
                type = 'NUMBER';
            } else if (typeof firstValue === 'boolean') {
                type = 'TEXT'; // SQLite doesn't have boolean, use TEXT
            } else if (typeof firstValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(firstValue)) {
                type = 'TEXT'; // Date strings
            }
        }
        
        return {
            name: fieldName,
            type: type,
            description: fieldName === 'timestamp' 
                ? 'Timestamp of the data point' 
                : `Value for ${fieldName}`
        };
    });
    
    return {
        name: entityName,
        properties: properties
    };
}

/**
 * Suggest optimal aggregation interval based on data frequency
 */
function suggestAggregationInterval(dataPoints, targetPoints = 1000) {
    if (!dataPoints || dataPoints.length === 0) return '5m';
    
    // Estimate data frequency
    const timestamps = dataPoints
        .map(d => new Date(d.timestamp || d.createdAt || Date.now()))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a - b);
    
    if (timestamps.length < 2) return '5m';
    
    // Calculate average interval
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const totalTime = timestamps[timestamps.length - 1] - timestamps[0];
    const currentPoints = timestamps.length;
    
    // Calculate target interval to get ~targetPoints
    const targetInterval = totalTime / targetPoints;
    
    // Round to nearest standard interval
    const intervals_ms = {
        '1s': 1000,
        '5s': 5000,
        '30s': 30000,
        '1m': 60000,
        '5m': 300000,
        '15m': 900000,
        '1h': 3600000,
        '6h': 21600000,
        '1d': 86400000
    };
    
    let bestInterval = '5m';
    let bestDiff = Infinity;
    
    Object.entries(intervals_ms).forEach(([name, ms]) => {
        const diff = Math.abs(ms - targetInterval);
        if (diff < bestDiff && ms >= avgInterval) {
            bestDiff = diff;
            bestInterval = name;
        }
    });
    
    return bestInterval;
}

module.exports = {
    isTimeSeriesData,
    normalizeTimeSeriesData,
    generateTimeSeriesSchema,
    suggestAggregationInterval
};
