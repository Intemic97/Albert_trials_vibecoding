/**
 * Secrets Manager Abstraction Layer
 * 
 * Provides a unified interface for secret retrieval.
 * Currently uses environment variables as the backend.
 * 
 * Can be extended to use:
 * - AWS Secrets Manager
 * - HashiCorp Vault
 * - Azure Key Vault
 * - Google Cloud Secret Manager
 * 
 * To switch providers, set SECRETS_PROVIDER env var:
 * - 'env' (default): Environment variables
 * - 'aws': AWS Secrets Manager
 * - 'vault': HashiCorp Vault
 */

const crypto = require('crypto');

const PROVIDER = process.env.SECRETS_PROVIDER || 'env';

// Cache for secrets (with TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get a secret value by key
 */
async function getSecret(key) {
    // Check cache first
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.value;
    }

    let value;

    switch (PROVIDER) {
        case 'aws':
            value = await getFromAWS(key);
            break;
        case 'vault':
            value = await getFromVault(key);
            break;
        case 'env':
        default:
            value = process.env[key];
            break;
    }

    // Cache the result
    if (value) {
        cache.set(key, { value, timestamp: Date.now() });
    }

    return value;
}

/**
 * Get multiple secrets at once
 */
async function getSecrets(keys) {
    const results = {};
    await Promise.all(
        keys.map(async (key) => {
            results[key] = await getSecret(key);
        })
    );
    return results;
}

/**
 * Clear the secrets cache (call after rotation)
 */
function clearCache() {
    cache.clear();
    console.log('[SecretsManager] Cache cleared');
}

/**
 * Generate a cryptographically strong random secret
 */
function generateSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex');
}

// ==================== Provider Implementations ====================

async function getFromAWS(key) {
    try {
        const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
        const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'eu-west-1' });
        const secretName = process.env.AWS_SECRET_PREFIX ? `${process.env.AWS_SECRET_PREFIX}/${key}` : key;
        
        const command = new GetSecretValueCommand({ SecretId: secretName });
        const response = await client.send(command);
        
        if (response.SecretString) {
            // Try to parse as JSON (AWS SM supports JSON secrets)
            try {
                const parsed = JSON.parse(response.SecretString);
                return parsed[key] || response.SecretString;
            } catch (_) {
                return response.SecretString;
            }
        }
        return null;
    } catch (error) {
        console.error(`[SecretsManager] AWS error for ${key}:`, error.message);
        // Fallback to env var
        return process.env[key];
    }
}

async function getFromVault(key) {
    try {
        const vaultAddr = process.env.VAULT_ADDR || 'http://127.0.0.1:8200';
        const vaultToken = process.env.VAULT_TOKEN;
        const vaultPath = process.env.VAULT_SECRET_PATH || 'secret/data/intemic';

        if (!vaultToken) {
            console.warn('[SecretsManager] VAULT_TOKEN not set, falling back to env var');
            return process.env[key];
        }

        const response = await fetch(`${vaultAddr}/v1/${vaultPath}`, {
            headers: { 'X-Vault-Token': vaultToken }
        });
        
        if (!response.ok) throw new Error(`Vault responded with ${response.status}`);
        
        const data = await response.json();
        return data.data?.data?.[key] || null;
    } catch (error) {
        console.error(`[SecretsManager] Vault error for ${key}:`, error.message);
        // Fallback to env var
        return process.env[key];
    }
}

// ==================== Health Check ====================

async function healthCheck() {
    const results = {
        provider: PROVIDER,
        status: 'ok',
        timestamp: new Date().toISOString(),
    };

    try {
        // Try to retrieve a known key
        const jwtSecret = await getSecret('JWT_SECRET');
        results.canRetrieveSecrets = !!jwtSecret;
    } catch (error) {
        results.status = 'error';
        results.error = error.message;
    }

    return results;
}

module.exports = { getSecret, getSecrets, clearCache, generateSecret, healthCheck };
