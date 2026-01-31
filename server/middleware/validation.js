/**
 * Request Validation Middleware
 * Centralized validation for API requests
 */

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const SCHEMAS = {
    // Entity schemas
    entity: {
        create: {
            name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            properties: { type: 'array' }
        },
        update: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            properties: { type: 'array' }
        }
    },
    
    // Workflow schemas
    workflow: {
        create: {
            name: { required: true, type: 'string', minLength: 1, maxLength: 255 }
        },
        update: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            data: { type: 'object' },
            tags: { type: 'array' }
        }
    },
    
    // Dashboard schemas
    dashboard: {
        create: {
            name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
            widgets: { type: 'array' }
        }
    },
    
    // User schemas
    user: {
        register: {
            email: { required: true, type: 'email' },
            password: { required: true, type: 'string', minLength: 8 },
            name: { required: true, type: 'string', minLength: 1 },
            organizationName: { required: true, type: 'string', minLength: 1 }
        },
        login: {
            email: { required: true, type: 'email' },
            password: { required: true, type: 'string', minLength: 1 }
        },
        updateProfile: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            bio: { type: 'string', maxLength: 500 }
        }
    },
    
    // Record schemas
    record: {
        create: {
            data: { required: true, type: 'object' }
        },
        update: {
            data: { required: true, type: 'object' }
        }
    },
    
    // Copilot schemas
    copilot: {
        create: {
            name: { required: true, type: 'string', minLength: 1 },
            instructions: { type: 'string' },
            availableEntityIds: { type: 'array' }
        }
    }
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate email format
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate a single field against its schema
 */
const validateField = (value, fieldName, schema) => {
    const errors = [];
    
    // Check required
    if (schema.required && (value === undefined || value === null || value === '')) {
        errors.push(`${fieldName} is required`);
        return errors;
    }
    
    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
        return errors;
    }
    
    // Type validation
    switch (schema.type) {
        case 'string':
            if (typeof value !== 'string') {
                errors.push(`${fieldName} must be a string`);
            } else {
                if (schema.minLength && value.length < schema.minLength) {
                    errors.push(`${fieldName} must be at least ${schema.minLength} characters`);
                }
                if (schema.maxLength && value.length > schema.maxLength) {
                    errors.push(`${fieldName} must be at most ${schema.maxLength} characters`);
                }
                if (schema.pattern && !schema.pattern.test(value)) {
                    errors.push(`${fieldName} format is invalid`);
                }
            }
            break;
            
        case 'email':
            if (typeof value !== 'string' || !isValidEmail(value)) {
                errors.push(`${fieldName} must be a valid email address`);
            }
            break;
            
        case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
                errors.push(`${fieldName} must be a number`);
            } else {
                if (schema.min !== undefined && value < schema.min) {
                    errors.push(`${fieldName} must be at least ${schema.min}`);
                }
                if (schema.max !== undefined && value > schema.max) {
                    errors.push(`${fieldName} must be at most ${schema.max}`);
                }
            }
            break;
            
        case 'boolean':
            if (typeof value !== 'boolean') {
                errors.push(`${fieldName} must be a boolean`);
            }
            break;
            
        case 'array':
            if (!Array.isArray(value)) {
                errors.push(`${fieldName} must be an array`);
            } else {
                if (schema.minLength && value.length < schema.minLength) {
                    errors.push(`${fieldName} must have at least ${schema.minLength} items`);
                }
                if (schema.maxLength && value.length > schema.maxLength) {
                    errors.push(`${fieldName} must have at most ${schema.maxLength} items`);
                }
            }
            break;
            
        case 'object':
            if (typeof value !== 'object' || Array.isArray(value) || value === null) {
                errors.push(`${fieldName} must be an object`);
            }
            break;
            
        case 'uuid':
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (typeof value !== 'string' || !uuidRegex.test(value)) {
                errors.push(`${fieldName} must be a valid UUID`);
            }
            break;
    }
    
    // Custom validator
    if (schema.validate && typeof schema.validate === 'function') {
        const customError = schema.validate(value);
        if (customError) {
            errors.push(customError);
        }
    }
    
    return errors;
};

/**
 * Validate request body against a schema
 */
const validateBody = (body, schema) => {
    const errors = [];
    
    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        const fieldErrors = validateField(body[fieldName], fieldName, fieldSchema);
        errors.push(...fieldErrors);
    }
    
    return errors;
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Create a validation middleware for a specific schema
 */
const validate = (schemaPath) => {
    return (req, res, next) => {
        const [resource, action] = schemaPath.split('.');
        const schema = SCHEMAS[resource]?.[action];
        
        if (!schema) {
            console.error(`[VALIDATION] Schema not found: ${schemaPath}`);
            return next();
        }
        
        const errors = validateBody(req.body, schema);
        
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors,
                code: 'VALIDATION_ERROR'
            });
        }
        
        next();
    };
};

/**
 * Validate ID parameters
 */
const validateId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        
        if (!id) {
            return res.status(400).json({
                error: `Missing ${paramName} parameter`,
                code: 'MISSING_PARAM'
            });
        }
        
        // Allow both UUIDs and numeric IDs
        const isValidId = /^[0-9a-f-]{36}$/i.test(id) || /^\d+$/.test(id);
        
        if (!isValidId) {
            return res.status(400).json({
                error: `Invalid ${paramName} format`,
                code: 'INVALID_PARAM'
            });
        }
        
        next();
    };
};

/**
 * Sanitize request body (remove undefined/null fields, trim strings)
 */
const sanitize = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(req.body)) {
            if (value !== undefined && value !== null) {
                if (typeof value === 'string') {
                    sanitized[key] = value.trim();
                } else {
                    sanitized[key] = value;
                }
            }
        }
        
        req.body = sanitized;
    }
    
    next();
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    validate,
    validateId,
    sanitize,
    validateBody,
    validateField,
    SCHEMAS
};
