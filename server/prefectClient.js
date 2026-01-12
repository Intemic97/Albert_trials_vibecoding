/**
 * Prefect Client - Communicates with the Prefect Worker Service
 * 
 * This client delegates workflow execution to the Python/Prefect microservice
 */

const http = require('http');
const https = require('https');

class PrefectClient {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }

    /**
     * Execute a workflow using the Prefect service
     */
    async executeWorkflow(workflowId, inputs = {}, organizationId = null) {
        try {
            console.log(`[PrefectClient] Delegating workflow ${workflowId} to Prefect service`);
            
            const response = await this.makeRequest('/api/workflows/execute', {
                method: 'POST',
                body: {
                    workflowId,
                    inputs,
                    organizationId
                }
            });

            console.log(`[PrefectClient] Workflow scheduled: ${response.executionId}`);

            return {
                success: true,
                executionId: response.executionId,
                status: response.status,
                message: response.message,
                usingPrefect: true
            };

        } catch (error) {
            console.error('[PrefectClient] Error delegating to Prefect:', error.message);
            throw new Error(`Prefect service error: ${error.message}`);
        }
    }

    /**
     * Get execution status from Prefect service
     */
    async getExecutionStatus(executionId) {
        try {
            const response = await this.makeRequest(`/api/executions/${executionId}`, {
                method: 'GET'
            });

            return response;

        } catch (error) {
            console.error('[PrefectClient] Error fetching execution status:', error.message);
            throw new Error(`Failed to get execution status: ${error.message}`);
        }
    }

    /**
     * Get execution logs from Prefect service
     */
    async getExecutionLogs(executionId) {
        try {
            const response = await this.makeRequest(`/api/executions/${executionId}/logs`, {
                method: 'GET'
            });

            return response.logs || [];

        } catch (error) {
            console.error('[PrefectClient] Error fetching execution logs:', error.message);
            throw new Error(`Failed to get execution logs: ${error.message}`);
        }
    }

    /**
     * Check if Prefect service is available
     */
    async isAvailable() {
        try {
            const response = await this.makeRequest('/', { method: 'GET' });
            return response.status === 'running';
        } catch (error) {
            console.log('[PrefectClient] Prefect service not available:', error.message);
            return false;
        }
    }

    /**
     * Make HTTP request to Prefect service
     */
    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;

            const requestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                timeout: options.timeout || 30000
            };

            const req = client.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(parsed.detail || parsed.error || `HTTP ${res.statusCode}`));
                        }
                    } catch (e) {
                        reject(new Error(`Invalid JSON response: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }
}

// Singleton instance
const prefectClient = new PrefectClient(
    process.env.PREFECT_SERVICE_URL || 'http://localhost:8000'
);

module.exports = { PrefectClient, prefectClient };

