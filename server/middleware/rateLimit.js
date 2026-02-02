/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

// ============================================================================
// IN-MEMORY STORE (for development/single-instance)
// ============================================================================

class MemoryStore {
    constructor() {
        this.hits = new Map();
        this.blocked = new Map();
        
        // Cleanup old entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
    
    /**
     * Increment hit count for a key
     */
    increment(key, windowMs) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Get or create entry
        let entry = this.hits.get(key);
        if (!entry) {
            entry = { hits: [], resetTime: now + windowMs };
            this.hits.set(key, entry);
        }
        
        // Remove old hits
        entry.hits = entry.hits.filter(timestamp => timestamp > windowStart);
        
        // Add new hit
        entry.hits.push(now);
        
        return {
            count: entry.hits.length,
            resetTime: entry.resetTime
        };
    }
    
    /**
     * Get current hit count
     */
    get(key, windowMs) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        const entry = this.hits.get(key);
        if (!entry) return { count: 0, resetTime: now + windowMs };
        
        // Filter and count valid hits
        entry.hits = entry.hits.filter(timestamp => timestamp > windowStart);
        
        return {
            count: entry.hits.length,
            resetTime: entry.resetTime
        };
    }
    
    /**
     * Block a key temporarily
     */
    block(key, durationMs) {
        this.blocked.set(key, Date.now() + durationMs);
    }
    
    /**
     * Check if a key is blocked
     */
    isBlocked(key) {
        const blockedUntil = this.blocked.get(key);
        if (!blockedUntil) return false;
        
        if (Date.now() > blockedUntil) {
            this.blocked.delete(key);
            return false;
        }
        
        return blockedUntil;
    }
    
    /**
     * Clean up old entries
     */
    cleanup() {
        const now = Date.now();
        
        // Clean hits
        for (const [key, entry] of this.hits.entries()) {
            if (entry.hits.length === 0 || entry.resetTime < now) {
                this.hits.delete(key);
            }
        }
        
        // Clean blocked
        for (const [key, blockedUntil] of this.blocked.entries()) {
            if (blockedUntil < now) {
                this.blocked.delete(key);
            }
        }
    }
    
    /**
     * Clear all data (for testing)
     */
    clear() {
        this.hits.clear();
        this.blocked.clear();
    }
    
    /**
     * Stop cleanup interval
     */
    shutdown() {
        clearInterval(this.cleanupInterval);
    }
}

// Global store instance
const store = new MemoryStore();

// ============================================================================
// RATE LIMIT CONFIGURATIONS
// ============================================================================

const RATE_LIMITS = {
    // General API limits
    api: {
        windowMs: 60 * 1000,      // 1 minute
        max: 100,                  // 100 requests per minute
        message: 'Too many API requests, please try again later'
    },
    
    // Auth endpoints (stricter)
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10,                   // 10 login attempts per 15 minutes
        message: 'Too many authentication attempts, please try again later',
        blockDuration: 30 * 60 * 1000 // Block for 30 minutes after exceeding
    },
    
    // AI/LLM endpoints (expensive operations)
    ai: {
        windowMs: 60 * 1000,      // 1 minute
        max: 20,                   // 20 AI requests per minute
        message: 'AI request limit reached, please try again later'
    },
    
    // File uploads
    upload: {
        windowMs: 60 * 1000,      // 1 minute
        max: 10,                   // 10 uploads per minute
        message: 'Upload limit reached, please try again later'
    },
    
    // Workflow execution
    execution: {
        windowMs: 60 * 1000,      // 1 minute
        max: 30,                   // 30 executions per minute
        message: 'Execution limit reached, please try again later'
    },
    
    // Export/Download operations
    export: {
        windowMs: 60 * 1000,      // 1 minute
        max: 5,                    // 5 exports per minute
        message: 'Export limit reached, please try again later'
    }
};

// ============================================================================
// RATE LIMIT MIDDLEWARE FACTORY
// ============================================================================

/**
 * Generate a unique key for rate limiting
 */
const getKey = (req, options) => {
    const parts = [];
    
    // Use user ID if authenticated, otherwise IP
    if (req.user?.id) {
        parts.push(`user:${req.user.id}`);
    } else {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        parts.push(`ip:${ip}`);
    }
    
    // Optionally include organization
    if (options.byOrganization && req.user?.currentOrganizationId) {
        parts.push(`org:${req.user.currentOrganizationId}`);
    }
    
    // Include endpoint group
    if (options.keyPrefix) {
        parts.push(options.keyPrefix);
    }
    
    return parts.join(':');
};

/**
 * Create a rate limiter middleware
 */
const rateLimit = (configName, customOptions = {}) => {
    const config = RATE_LIMITS[configName] || RATE_LIMITS.api;
    const options = { ...config, ...customOptions };
    
    return (req, res, next) => {
        const key = getKey(req, options);
        
        // Check if blocked
        const blockedUntil = store.isBlocked(key);
        if (blockedUntil) {
            const retryAfter = Math.ceil((blockedUntil - Date.now()) / 1000);
            res.set('Retry-After', retryAfter);
            res.set('X-RateLimit-Limit', options.max);
            res.set('X-RateLimit-Remaining', 0);
            res.set('X-RateLimit-Reset', new Date(blockedUntil).toISOString());
            
            return res.status(429).json({
                error: options.message || 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter,
                timestamp: new Date().toISOString()
            });
        }
        
        // Increment and check
        const { count, resetTime } = store.increment(key, options.windowMs);
        const remaining = Math.max(0, options.max - count);
        
        // Set rate limit headers
        res.set('X-RateLimit-Limit', options.max);
        res.set('X-RateLimit-Remaining', remaining);
        res.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
        
        // Check if limit exceeded
        if (count > options.max) {
            const retryAfter = Math.ceil(options.windowMs / 1000);
            res.set('Retry-After', retryAfter);
            
            // Block if configured
            if (options.blockDuration) {
                store.block(key, options.blockDuration);
            }
            
            console.warn(`[RATE LIMIT] Exceeded for ${key}: ${count}/${options.max}`);
            
            return res.status(429).json({
                error: options.message || 'Too many requests',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter,
                timestamp: new Date().toISOString()
            });
        }
        
        next();
    };
};

// ============================================================================
// HELPER MIDDLEWARE
// ============================================================================

/**
 * Skip rate limiting for certain conditions
 */
const skipRateLimit = (condition) => {
    return (req, res, next) => {
        if (typeof condition === 'function' && condition(req)) {
            return next();
        }
        return next('route'); // Skip to next matching route
    };
};

/**
 * Custom rate limit for specific routes
 */
const customRateLimit = (options) => {
    return rateLimit('api', options);
};

// ============================================================================
// PRE-CONFIGURED LIMITERS
// ============================================================================

const apiLimiter = rateLimit('api');
const authLimiter = rateLimit('auth');
const aiLimiter = rateLimit('ai');
const uploadLimiter = rateLimit('upload');
const executionLimiter = rateLimit('execution');
const exportLimiter = rateLimit('export');

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    rateLimit,
    customRateLimit,
    skipRateLimit,
    
    // Pre-configured limiters
    apiLimiter,
    authLimiter,
    aiLimiter,
    uploadLimiter,
    executionLimiter,
    exportLimiter,
    
    // For testing
    store,
    RATE_LIMITS
};
