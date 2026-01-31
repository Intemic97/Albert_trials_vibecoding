/**
 * Structured Logger Middleware
 * Provides consistent, structured logging for all requests
 */

// ============================================================================
// LOG LEVELS
// ============================================================================

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

// ============================================================================
// COLOR CODES (for terminal output)
// ============================================================================

const COLORS = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

const STATUS_COLORS = {
    '2xx': COLORS.green,
    '3xx': COLORS.cyan,
    '4xx': COLORS.yellow,
    '5xx': COLORS.red
};

const METHOD_COLORS = {
    GET: COLORS.blue,
    POST: COLORS.green,
    PUT: COLORS.yellow,
    PATCH: COLORS.yellow,
    DELETE: COLORS.red
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getStatusColor = (statusCode) => {
    if (statusCode >= 500) return STATUS_COLORS['5xx'];
    if (statusCode >= 400) return STATUS_COLORS['4xx'];
    if (statusCode >= 300) return STATUS_COLORS['3xx'];
    return STATUS_COLORS['2xx'];
};

const formatDuration = (ms) => {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
};

const sanitizeHeaders = (headers) => {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    for (const header of sensitiveHeaders) {
        if (sanitized[header]) {
            sanitized[header] = '[REDACTED]';
        }
    }
    
    return sanitized;
};

const sanitizeBody = (body) => {
    if (!body) return body;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
    
    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }
    
    return sanitized;
};

// ============================================================================
// LOGGER CLASS
// ============================================================================

class Logger {
    constructor(context = 'APP') {
        this.context = context;
    }
    
    _format(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            context: this.context,
            message,
            ...meta
        };
        
        return logEntry;
    }
    
    _output(level, levelName, message, meta, color) {
        if (LOG_LEVELS[levelName] > currentLogLevel) return;
        
        const entry = this._format(levelName, message, meta);
        const prefix = `${color}[${levelName}]${COLORS.reset}`;
        const contextStr = `${COLORS.dim}[${this.context}]${COLORS.reset}`;
        
        if (level === 'error') {
            console.error(`${prefix} ${contextStr} ${message}`, meta.stack ? `\n${meta.stack}` : '');
        } else if (level === 'warn') {
            console.warn(`${prefix} ${contextStr} ${message}`);
        } else {
            console.log(`${prefix} ${contextStr} ${message}`);
        }
        
        // In production, output JSON for log aggregation
        if (process.env.LOG_FORMAT === 'json') {
            console.log(JSON.stringify(entry));
        }
    }
    
    error(message, meta = {}) {
        this._output('error', 'ERROR', message, meta, COLORS.red);
    }
    
    warn(message, meta = {}) {
        this._output('warn', 'WARN', message, meta, COLORS.yellow);
    }
    
    info(message, meta = {}) {
        this._output('log', 'INFO', message, meta, COLORS.cyan);
    }
    
    debug(message, meta = {}) {
        this._output('log', 'DEBUG', message, meta, COLORS.dim);
    }
    
    request(req, res, duration) {
        const statusCode = res.statusCode;
        const statusColor = getStatusColor(statusCode);
        const methodColor = METHOD_COLORS[req.method] || COLORS.white;
        
        const message = `${methodColor}${req.method}${COLORS.reset} ${req.originalUrl} ${statusColor}${statusCode}${COLORS.reset} ${COLORS.dim}${formatDuration(duration)}${COLORS.reset}`;
        
        this.info(message, {
            method: req.method,
            url: req.originalUrl,
            statusCode,
            duration,
            userId: req.user?.id,
            orgId: req.user?.currentOrganizationId
        });
    }
}

// ============================================================================
// REQUEST LOGGER MIDDLEWARE
// ============================================================================

/**
 * HTTP request logger middleware
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const logger = new Logger('HTTP');
    
    // Skip health check and static files
    const skipPaths = ['/health', '/favicon.ico', '/static'];
    if (skipPaths.some(path => req.originalUrl.startsWith(path))) {
        return next();
    }
    
    // Store request info
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.startTime = startTime;
    
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.request(req, res, duration);
        
        // Log slow requests
        if (duration > 5000) {
            logger.warn(`Slow request detected: ${req.method} ${req.originalUrl}`, {
                duration,
                requestId: req.requestId
            });
        }
    });
    
    next();
};

/**
 * Verbose request logger (for debugging)
 */
const verboseRequestLogger = (req, res, next) => {
    if (process.env.LOG_LEVEL !== 'DEBUG') {
        return next();
    }
    
    const logger = new Logger('HTTP-DEBUG');
    
    logger.debug(`Request: ${req.method} ${req.originalUrl}`, {
        headers: sanitizeHeaders(req.headers),
        body: sanitizeBody(req.body),
        query: req.query,
        params: req.params
    });
    
    next();
};

// ============================================================================
// CREATE LOGGER FOR MODULES
// ============================================================================

const createLogger = (context) => new Logger(context);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    Logger,
    createLogger,
    requestLogger,
    verboseRequestLogger,
    LOG_LEVELS
};
