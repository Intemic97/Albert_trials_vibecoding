/**
 * Error Handler Middleware
 * Centralized error handling for consistent API responses
 */

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base API Error
 */
class ApiError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
        
        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }
    
    toJSON() {
        return {
            error: this.message,
            code: this.code,
            details: this.details,
            timestamp: this.timestamp
        };
    }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends ApiError {
    constructor(resource = 'Resource', id = null) {
        const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

/**
 * Validation Error (400)
 */
class ValidationError extends ApiError {
    constructor(message = 'Validation failed', details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

/**
 * Authentication Error (401)
 */
class AuthenticationError extends ApiError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization Error (403)
 */
class AuthorizationError extends ApiError {
    constructor(message = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends ApiError {
    constructor(message = 'Resource conflict', details = null) {
        super(message, 409, 'CONFLICT_ERROR', details);
        this.name = 'ConflictError';
    }
}

/**
 * Rate Limit Error (429)
 */
class RateLimitError extends ApiError {
    constructor(message = 'Too many requests', retryAfter = 60) {
        super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

/**
 * External Service Error (502)
 */
class ExternalServiceError extends ApiError {
    constructor(service = 'External service', originalError = null) {
        super(`${service} is unavailable`, 502, 'EXTERNAL_SERVICE_ERROR', {
            service,
            originalMessage: originalError?.message
        });
        this.name = 'ExternalServiceError';
    }
}

// ============================================================================
// ERROR HANDLER MIDDLEWARE
// ============================================================================

/**
 * Main error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    // Log the error
    const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        userId: req.user?.id,
        orgId: req.user?.currentOrganizationId,
        error: {
            name: err.name,
            message: err.message,
            code: err.code,
            statusCode: err.statusCode
        }
    };
    
    // Only log stack traces for unexpected errors
    if (!(err instanceof ApiError)) {
        logData.stack = err.stack;
        console.error('[ERROR] Unexpected error:', JSON.stringify(logData, null, 2));
    } else if (err.statusCode >= 500) {
        console.error('[ERROR] Server error:', JSON.stringify(logData, null, 2));
    } else {
        console.warn('[ERROR] Client error:', JSON.stringify(logData, null, 2));
    }
    
    // Handle different error types
    if (err instanceof ApiError) {
        // Custom API errors
        const response = err.toJSON();
        
        if (err instanceof RateLimitError) {
            res.set('Retry-After', err.retryAfter);
        }
        
        return res.status(err.statusCode).json(response);
    }
    
    // SQLite errors
    if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({
            error: 'Database constraint violation',
            code: 'DATABASE_CONSTRAINT',
            details: err.message,
            timestamp: new Date().toISOString()
        });
    }
    
    if (err.code === 'SQLITE_ERROR') {
        console.error('[DB ERROR]', err.message);
        return res.status(500).json({
            error: 'Database error',
            code: 'DATABASE_ERROR',
            timestamp: new Date().toISOString()
        });
    }
    
    // Multer (file upload) errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: 'File too large',
            code: 'FILE_TOO_LARGE',
            details: { maxSize: err.limit },
            timestamp: new Date().toISOString()
        });
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            error: 'Unexpected file field',
            code: 'UNEXPECTED_FILE',
            timestamp: new Date().toISOString()
        });
    }
    
    // JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'Invalid JSON',
            code: 'INVALID_JSON',
            timestamp: new Date().toISOString()
        });
    }
    
    // Default error response
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    return res.status(500).json({
        error: isDevelopment ? err.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
        ...(isDevelopment && { stack: err.stack }),
        timestamp: new Date().toISOString()
    });
};

/**
 * Async handler wrapper to catch errors in async routes
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: `Route ${req.method} ${req.originalUrl} not found`,
        code: 'ROUTE_NOT_FOUND',
        timestamp: new Date().toISOString()
    });
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Error classes
    ApiError,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    
    // Middleware
    errorHandler,
    asyncHandler,
    notFoundHandler
};
