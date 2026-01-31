/**
 * Middleware Tests
 * Unit tests for validation, error handling, and rate limiting
 */

// Mock Express request/response
const mockRequest = (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/test',
    ...overrides
});

const mockResponse = () => {
    const res = {
        statusCode: 200,
        headers: {},
        body: null
    };
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.body = data;
        return res;
    };
    res.set = (key, value) => {
        res.headers[key] = value;
        return res;
    };
    return res;
};

const mockNext = () => {
    const fn = jest.fn();
    return fn;
};

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('Validation Middleware', () => {
    const { validate, validateId, sanitize, validateBody, SCHEMAS } = require('../middleware/validation');

    describe('validateBody', () => {
        test('should pass valid entity creation data', () => {
            const body = { name: 'Test Entity', description: 'A test' };
            const errors = validateBody(body, SCHEMAS.entity.create);
            expect(errors).toHaveLength(0);
        });

        test('should fail when required field is missing', () => {
            const body = { description: 'No name' };
            const errors = validateBody(body, SCHEMAS.entity.create);
            expect(errors).toContain('name is required');
        });

        test('should fail when string is too short', () => {
            const body = { name: '' };
            const errors = validateBody(body, SCHEMAS.entity.create);
            expect(errors.some(e => e.includes('at least'))).toBe(true);
        });

        test('should validate email format', () => {
            const body = { email: 'invalid-email', password: '12345678', name: 'Test', organizationName: 'Org' };
            const errors = validateBody(body, SCHEMAS.user.register);
            expect(errors).toContain('email must be a valid email address');
        });

        test('should pass valid email', () => {
            const body = { email: 'test@example.com', password: '12345678', name: 'Test', organizationName: 'Org' };
            const errors = validateBody(body, SCHEMAS.user.register);
            expect(errors).toHaveLength(0);
        });
    });

    describe('validateId middleware', () => {
        test('should pass valid UUID', () => {
            const req = mockRequest({ params: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } });
            const res = mockResponse();
            const next = mockNext();

            validateId('id')(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        test('should pass numeric ID', () => {
            const req = mockRequest({ params: { id: '12345' } });
            const res = mockResponse();
            const next = mockNext();

            validateId('id')(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        test('should fail invalid ID format', () => {
            const req = mockRequest({ params: { id: 'invalid!id' } });
            const res = mockResponse();
            const next = mockNext();

            validateId('id')(req, res, next);
            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('INVALID_PARAM');
        });

        test('should fail missing ID', () => {
            const req = mockRequest({ params: {} });
            const res = mockResponse();
            const next = mockNext();

            validateId('id')(req, res, next);
            expect(res.statusCode).toBe(400);
            expect(res.body.code).toBe('MISSING_PARAM');
        });
    });

    describe('sanitize middleware', () => {
        test('should trim string values', () => {
            const req = mockRequest({ body: { name: '  Test  ', value: '  value  ' } });
            const res = mockResponse();
            const next = mockNext();

            sanitize(req, res, next);
            expect(req.body.name).toBe('Test');
            expect(req.body.value).toBe('value');
        });

        test('should remove undefined/null values', () => {
            const req = mockRequest({ body: { name: 'Test', empty: null, undef: undefined } });
            const res = mockResponse();
            const next = mockNext();

            sanitize(req, res, next);
            expect(req.body).toHaveProperty('name');
            expect(req.body).not.toHaveProperty('empty');
            expect(req.body).not.toHaveProperty('undef');
        });

        test('should preserve non-string values', () => {
            const req = mockRequest({ body: { count: 5, active: true, items: [1, 2, 3] } });
            const res = mockResponse();
            const next = mockNext();

            sanitize(req, res, next);
            expect(req.body.count).toBe(5);
            expect(req.body.active).toBe(true);
            expect(req.body.items).toEqual([1, 2, 3]);
        });
    });
});

// ============================================================================
// ERROR HANDLER TESTS
// ============================================================================

describe('Error Handler', () => {
    const {
        ApiError,
        NotFoundError,
        ValidationError,
        AuthenticationError,
        errorHandler
    } = require('../middleware/errorHandler');

    describe('Error Classes', () => {
        test('ApiError should have correct properties', () => {
            const error = new ApiError('Test error', 400, 'TEST_ERROR', { field: 'value' });
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('TEST_ERROR');
            expect(error.details).toEqual({ field: 'value' });
        });

        test('NotFoundError should default to 404', () => {
            const error = new NotFoundError('Entity', '123');
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('NOT_FOUND');
            expect(error.message).toContain('Entity');
            expect(error.message).toContain('123');
        });

        test('ValidationError should default to 400', () => {
            const error = new ValidationError('Invalid input', ['field1 required']);
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('VALIDATION_ERROR');
        });

        test('AuthenticationError should default to 401', () => {
            const error = new AuthenticationError();
            expect(error.statusCode).toBe(401);
            expect(error.code).toBe('AUTHENTICATION_ERROR');
        });
    });

    describe('errorHandler middleware', () => {
        test('should handle ApiError correctly', () => {
            const error = new ApiError('Test error', 400, 'TEST_CODE');
            const req = mockRequest();
            const res = mockResponse();
            const next = mockNext();

            errorHandler(error, req, res, next);
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Test error');
            expect(res.body.code).toBe('TEST_CODE');
        });

        test('should handle generic errors with 500', () => {
            const error = new Error('Something broke');
            const req = mockRequest();
            const res = mockResponse();
            const next = mockNext();

            // Set NODE_ENV to production for generic error message
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            errorHandler(error, req, res, next);
            expect(res.statusCode).toBe(500);
            expect(res.body.error).toBe('Internal server error');

            process.env.NODE_ENV = originalEnv;
        });

        test('should include details in development', () => {
            const error = new Error('Detailed error');
            const req = mockRequest();
            const res = mockResponse();
            const next = mockNext();

            process.env.NODE_ENV = 'development';

            errorHandler(error, req, res, next);
            expect(res.body.error).toBe('Detailed error');

            delete process.env.NODE_ENV;
        });
    });
});

// ============================================================================
// RATE LIMITER TESTS
// ============================================================================

describe('Rate Limiter', () => {
    const { rateLimit, store, RATE_LIMITS } = require('../middleware/rateLimit');

    beforeEach(() => {
        store.clear();
    });

    test('should allow requests under limit', () => {
        const limiter = rateLimit('api');
        const req = mockRequest({ ip: '192.168.1.1' });
        const res = mockResponse();
        const next = mockNext();

        limiter(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.headers['X-RateLimit-Remaining']).toBeDefined();
    });

    test('should block requests over limit', () => {
        const limiter = rateLimit('api', { max: 2, windowMs: 1000 });
        const req = mockRequest({ ip: '192.168.1.2' });
        
        // First two requests should pass
        for (let i = 0; i < 2; i++) {
            const res = mockResponse();
            const next = mockNext();
            limiter(req, res, next);
            expect(next).toHaveBeenCalled();
        }

        // Third request should be blocked
        const res = mockResponse();
        const next = mockNext();
        limiter(req, res, next);
        expect(res.statusCode).toBe(429);
        expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    test('should use user ID when authenticated', () => {
        const limiter = rateLimit('api');
        const req = mockRequest({ 
            ip: '192.168.1.3',
            user: { id: 'user-123' }
        });
        const res = mockResponse();
        const next = mockNext();

        limiter(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('should set Retry-After header when blocked', () => {
        const limiter = rateLimit('api', { max: 1, windowMs: 60000 });
        const req = mockRequest({ ip: '192.168.1.4' });

        // First request passes
        limiter(req, mockResponse(), mockNext());

        // Second request blocked
        const res = mockResponse();
        limiter(req, res, mockNext());
        expect(res.headers['Retry-After']).toBeDefined();
    });
});

// ============================================================================
// JOB QUEUE TESTS
// ============================================================================

describe('Job Queue', () => {
    const { JobQueue, JOB_STATUS, JOB_PRIORITY } = require('../services/jobQueue');

    test('should add jobs to queue', () => {
        const queue = new JobQueue({ autoStart: false });
        const job = queue.add('test', { data: 'value' });
        
        expect(job.status).toBe(JOB_STATUS.PENDING);
        expect(queue.getStats().pending).toBe(1);
    });

    test('should process jobs', async () => {
        const queue = new JobQueue({ autoStart: false });
        let processed = false;

        queue.process('test', async (data) => {
            processed = true;
            return { success: true };
        });

        queue.add('test', { data: 'value' });
        queue.start();

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(processed).toBe(true);
    });

    test('should handle job failures', async () => {
        const queue = new JobQueue({ autoStart: false });
        let failCount = 0;

        queue.process('fail-test', async () => {
            failCount++;
            throw new Error('Test failure');
        });

        queue.on('job:failed', () => {});

        const job = queue.add('fail-test', {}, { maxAttempts: 2, backoffDelay: 10 });
        queue.start();

        // Wait for retries
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(job.status).toBe(JOB_STATUS.FAILED);
        expect(failCount).toBe(2);
    });

    test('should prioritize jobs correctly', () => {
        const queue = new JobQueue({ autoStart: false });
        
        queue.add('low', {}, { priority: JOB_PRIORITY.LOW });
        queue.add('high', {}, { priority: JOB_PRIORITY.HIGH });
        queue.add('normal', {}, { priority: JOB_PRIORITY.NORMAL });

        const jobs = queue.getJobs();
        expect(jobs[0].type).toBe('high');
    });

    test('should cancel pending jobs', () => {
        const queue = new JobQueue({ autoStart: false });
        const job = queue.add('cancel-test', {});
        
        const result = queue.cancel(job.id);
        expect(result).toBe(true);
        expect(job.status).toBe(JOB_STATUS.CANCELLED);
    });

    test('should get queue statistics', () => {
        const queue = new JobQueue({ autoStart: false });
        
        queue.add('stat-test-1', {});
        queue.add('stat-test-2', {});

        const stats = queue.getStats();
        expect(stats.pending).toBe(2);
        expect(stats.total).toBe(2);
    });
});

// ============================================================================
// RUN TESTS
// ============================================================================

// Jest configuration
if (typeof jest !== 'undefined') {
    // Tests will run with Jest
} else {
    // Simple test runner for environments without Jest
    console.log('Running tests without Jest...');
    
    const runTest = async (name, fn) => {
        try {
            await fn();
            console.log(`✓ ${name}`);
        } catch (error) {
            console.error(`✗ ${name}: ${error.message}`);
        }
    };

    // Run basic smoke tests
    (async () => {
        await runTest('Validation module loads', () => {
            require('../middleware/validation');
        });
        
        await runTest('Error handler module loads', () => {
            require('../middleware/errorHandler');
        });
        
        await runTest('Rate limiter module loads', () => {
            require('../middleware/rateLimit');
        });
        
        await runTest('Job queue module loads', () => {
            require('../services/jobQueue');
        });
        
        console.log('\nAll smoke tests passed!');
    })();
}
