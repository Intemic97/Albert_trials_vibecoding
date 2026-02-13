/**
 * Field-Level Encryption Module
 * 
 * Provides AES-256-GCM encryption for sensitive fields in the database.
 * Used for: connection credentials, API keys, SSO secrets, etc.
 * 
 * The encryption key is derived from ENCRYPTION_KEY env var.
 * In production, this should come from a secrets manager.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

// Derive encryption key from environment variable
function getEncryptionKey() {
    const envKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!envKey) {
        throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set for field encryption');
    }
    // Derive a proper 256-bit key using PBKDF2
    const salt = 'intemic-field-encryption-v1'; // Static salt for deterministic key derivation
    return crypto.pbkdf2Sync(envKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a plaintext string
 * Returns: base64 encoded string (iv:authTag:ciphertext)
 */
function encrypt(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') return plaintext;
    
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        
        // Format: ENC:iv:authTag:ciphertext (prefix to identify encrypted values)
        return `ENC:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
        console.error('[Encryption] Failed to encrypt:', error.message);
        throw new Error('Encryption failed');
    }
}

/**
 * Decrypt an encrypted string
 * Accepts: ENC:iv:authTag:ciphertext format
 */
function decrypt(encryptedText) {
    if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
    
    // If not encrypted (legacy data), return as-is
    if (!encryptedText.startsWith('ENC:')) {
        return encryptedText;
    }
    
    try {
        const key = getEncryptionKey();
        const parts = encryptedText.split(':');
        if (parts.length !== 4) throw new Error('Invalid encrypted format');
        
        const iv = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');
        const ciphertext = parts[3];
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('[Encryption] Failed to decrypt:', error.message);
        throw new Error('Decryption failed - data may be corrupted or key may have changed');
    }
}

/**
 * Check if a string is already encrypted
 */
function isEncrypted(value) {
    return typeof value === 'string' && value.startsWith('ENC:');
}

/**
 * Encrypt an object's sensitive fields
 * @param {Object} obj - The object to encrypt
 * @param {string[]} fields - Field names to encrypt
 */
function encryptFields(obj, fields) {
    if (!obj) return obj;
    const result = { ...obj };
    for (const field of fields) {
        if (result[field] && !isEncrypted(result[field])) {
            result[field] = encrypt(result[field]);
        }
    }
    return result;
}

/**
 * Decrypt an object's sensitive fields
 * @param {Object} obj - The object to decrypt
 * @param {string[]} fields - Field names to decrypt
 */
function decryptFields(obj, fields) {
    if (!obj) return obj;
    const result = { ...obj };
    for (const field of fields) {
        if (result[field] && isEncrypted(result[field])) {
            result[field] = decrypt(result[field]);
        }
    }
    return result;
}

module.exports = { encrypt, decrypt, isEncrypted, encryptFields, decryptFields };
