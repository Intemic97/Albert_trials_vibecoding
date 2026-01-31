/**
 * Middleware Module
 * 
 * Centralized exports for all middleware
 */

// Validation
const {
    validate,
    validateId,
    sanitize,
    validateBody,
    validateField,
    SCHEMAS
} = require('./validation');

// Error Handling
const {
    ApiError,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    errorHandler,
    asyncHandler,
    notFoundHandler
} = require('./errorHandler');

// Logging
const {
    Logger,
    createLogger,
    requestLogger,
    verboseRequestLogger,
    LOG_LEVELS
} = require('./logger');

// Rate Limiting
const {
    rateLimit,
    customRateLimit,
    skipRateLimit,
    apiLimiter,
    authLimiter,
    aiLimiter,
    uploadLimiter,
    executionLimiter,
    exportLimiter,
    RATE_LIMITS
} = require('./rateLimit');

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Validation
    validate,
    validateId,
    sanitize,
    validateBody,
    validateField,
    SCHEMAS,
    
    // Error Classes
    ApiError,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    
    // Error Middleware
    errorHandler,
    asyncHandler,
    notFoundHandler,
    
    // Logging
    Logger,
    createLogger,
    requestLogger,
    verboseRequestLogger,
    LOG_LEVELS,
    
    // Rate Limiting
    rateLimit,
    customRateLimit,
    skipRateLimit,
    apiLimiter,
    authLimiter,
    aiLimiter,
    uploadLimiter,
    executionLimiter,
    exportLimiter,
    RATE_LIMITS
};
