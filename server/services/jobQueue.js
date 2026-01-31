/**
 * Job Queue Service
 * In-memory job queue with retry logic, prioritization, and monitoring
 */

const { EventEmitter } = require('events');

// ============================================================================
// JOB STATES
// ============================================================================

const JOB_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    RETRYING: 'retrying',
    CANCELLED: 'cancelled',
    TIMEOUT: 'timeout'
};

const JOB_PRIORITY = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    CRITICAL: 3
};

// ============================================================================
// JOB CLASS
// ============================================================================

class Job {
    constructor(id, type, data, options = {}) {
        this.id = id;
        this.type = type;
        this.data = data;
        this.priority = options.priority || JOB_PRIORITY.NORMAL;
        this.status = JOB_STATUS.PENDING;
        this.attempts = 0;
        this.maxAttempts = options.maxAttempts || 3;
        this.timeout = options.timeout || 5 * 60 * 1000; // 5 minutes default
        this.delay = options.delay || 0;
        this.backoff = options.backoff || 'exponential'; // 'exponential' | 'linear' | 'fixed'
        this.backoffDelay = options.backoffDelay || 1000;
        this.result = null;
        this.error = null;
        this.createdAt = new Date();
        this.startedAt = null;
        this.completedAt = null;
        this.progress = 0;
        this.logs = [];
        this.metadata = options.metadata || {};
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            status: this.status,
            priority: this.priority,
            attempts: this.attempts,
            maxAttempts: this.maxAttempts,
            progress: this.progress,
            error: this.error,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            metadata: this.metadata
        };
    }
}

// ============================================================================
// JOB QUEUE CLASS
// ============================================================================

class JobQueue extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.name = options.name || 'default';
        this.concurrency = options.concurrency || 3;
        this.handlers = new Map();
        this.jobs = new Map();
        this.pendingQueue = [];
        this.runningJobs = new Set();
        this.isProcessing = false;
        this.isPaused = false;
        
        // Statistics
        this.stats = {
            processed: 0,
            completed: 0,
            failed: 0,
            retried: 0
        };
        
        // Auto-start processing
        if (options.autoStart !== false) {
            this.start();
        }
    }

    /**
     * Register a handler for a job type
     */
    process(type, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
        this.handlers.set(type, handler);
        console.log(`[JobQueue:${this.name}] Registered handler for '${type}'`);
    }

    /**
     * Add a job to the queue
     */
    add(type, data, options = {}) {
        const id = options.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (this.jobs.has(id)) {
            throw new Error(`Job with ID ${id} already exists`);
        }
        
        const job = new Job(id, type, data, options);
        this.jobs.set(id, job);
        
        // Add to queue (sorted by priority)
        this.pendingQueue.push(job);
        this.pendingQueue.sort((a, b) => b.priority - a.priority);
        
        console.log(`[JobQueue:${this.name}] Job added: ${id} (type: ${type}, priority: ${job.priority})`);
        this.emit('job:added', job);
        
        // Trigger processing
        this._processNext();
        
        return job;
    }

    /**
     * Get a job by ID
     */
    getJob(id) {
        return this.jobs.get(id);
    }

    /**
     * Get all jobs with optional filtering
     */
    getJobs(filter = {}) {
        let jobs = Array.from(this.jobs.values());
        
        if (filter.status) {
            jobs = jobs.filter(j => j.status === filter.status);
        }
        if (filter.type) {
            jobs = jobs.filter(j => j.type === filter.type);
        }
        
        return jobs;
    }

    /**
     * Cancel a job
     */
    cancel(id) {
        const job = this.jobs.get(id);
        if (!job) return false;
        
        if (job.status === JOB_STATUS.RUNNING) {
            // Cannot cancel running job directly
            console.warn(`[JobQueue:${this.name}] Cannot cancel running job: ${id}`);
            return false;
        }
        
        job.status = JOB_STATUS.CANCELLED;
        job.completedAt = new Date();
        
        // Remove from pending queue
        const idx = this.pendingQueue.findIndex(j => j.id === id);
        if (idx !== -1) {
            this.pendingQueue.splice(idx, 1);
        }
        
        this.emit('job:cancelled', job);
        return true;
    }

    /**
     * Retry a failed job
     */
    retry(id) {
        const job = this.jobs.get(id);
        if (!job) return false;
        
        if (job.status !== JOB_STATUS.FAILED && job.status !== JOB_STATUS.CANCELLED) {
            return false;
        }
        
        job.status = JOB_STATUS.PENDING;
        job.attempts = 0;
        job.error = null;
        this.pendingQueue.push(job);
        this.pendingQueue.sort((a, b) => b.priority - a.priority);
        
        this._processNext();
        return true;
    }

    /**
     * Start processing the queue
     */
    start() {
        this.isPaused = false;
        this._processNext();
        console.log(`[JobQueue:${this.name}] Started`);
    }

    /**
     * Pause processing
     */
    pause() {
        this.isPaused = true;
        console.log(`[JobQueue:${this.name}] Paused`);
    }

    /**
     * Get queue statistics
     */
    getStats() {
        return {
            ...this.stats,
            pending: this.pendingQueue.length,
            running: this.runningJobs.size,
            total: this.jobs.size
        };
    }

    /**
     * Clear completed/failed jobs
     */
    clean(olderThan = 3600000) { // 1 hour default
        const now = Date.now();
        const toRemove = [];
        
        for (const [id, job] of this.jobs.entries()) {
            if (
                (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.FAILED) &&
                job.completedAt &&
                now - job.completedAt.getTime() > olderThan
            ) {
                toRemove.push(id);
            }
        }
        
        for (const id of toRemove) {
            this.jobs.delete(id);
        }
        
        console.log(`[JobQueue:${this.name}] Cleaned ${toRemove.length} old jobs`);
        return toRemove.length;
    }

    // ========================================================================
    // INTERNAL METHODS
    // ========================================================================

    async _processNext() {
        if (this.isPaused || this.isProcessing) return;
        if (this.runningJobs.size >= this.concurrency) return;
        if (this.pendingQueue.length === 0) return;
        
        this.isProcessing = true;
        
        try {
            while (
                !this.isPaused &&
                this.runningJobs.size < this.concurrency &&
                this.pendingQueue.length > 0
            ) {
                const job = this._getNextJob();
                if (!job) break;
                
                // Don't await - run in parallel
                this._processJob(job).catch(err => {
                    console.error(`[JobQueue:${this.name}] Unexpected error processing job ${job.id}:`, err);
                });
            }
        } finally {
            this.isProcessing = false;
        }
    }

    _getNextJob() {
        const now = Date.now();
        
        for (let i = 0; i < this.pendingQueue.length; i++) {
            const job = this.pendingQueue[i];
            
            // Check if job has delay
            if (job.delay && job.createdAt.getTime() + job.delay > now) {
                continue;
            }
            
            // Remove from queue and return
            this.pendingQueue.splice(i, 1);
            return job;
        }
        
        return null;
    }

    async _processJob(job) {
        const handler = this.handlers.get(job.type);
        
        if (!handler) {
            job.status = JOB_STATUS.FAILED;
            job.error = `No handler registered for job type: ${job.type}`;
            job.completedAt = new Date();
            this.stats.failed++;
            this.emit('job:failed', job, new Error(job.error));
            return;
        }
        
        job.status = JOB_STATUS.RUNNING;
        job.startedAt = new Date();
        job.attempts++;
        this.runningJobs.add(job.id);
        
        this.emit('job:started', job);
        
        // Create job context with progress and logging
        const context = {
            job,
            progress: (percent) => {
                job.progress = Math.min(100, Math.max(0, percent));
                this.emit('job:progress', job);
            },
            log: (message) => {
                job.logs.push({ timestamp: new Date(), message });
            }
        };
        
        // Set up timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Job timeout')), job.timeout);
        });
        
        try {
            // Race between handler and timeout
            const result = await Promise.race([
                handler(job.data, context),
                timeoutPromise
            ]);
            
            job.status = JOB_STATUS.COMPLETED;
            job.result = result;
            job.completedAt = new Date();
            job.progress = 100;
            this.stats.completed++;
            this.stats.processed++;
            
            this.emit('job:completed', job);
            
        } catch (error) {
            const isTimeout = error.message === 'Job timeout';
            
            if (isTimeout) {
                job.status = JOB_STATUS.TIMEOUT;
            }
            
            job.error = error.message;
            
            // Check if we should retry
            if (job.attempts < job.maxAttempts && !isTimeout) {
                job.status = JOB_STATUS.RETRYING;
                
                // Calculate backoff delay
                const backoffMs = this._calculateBackoff(job);
                job.delay = backoffMs;
                job.createdAt = new Date(); // Reset for delay calculation
                
                // Re-queue
                this.pendingQueue.push(job);
                this.pendingQueue.sort((a, b) => b.priority - a.priority);
                this.stats.retried++;
                
                this.emit('job:retrying', job, error);
                console.log(`[JobQueue:${this.name}] Job ${job.id} will retry in ${backoffMs}ms (attempt ${job.attempts}/${job.maxAttempts})`);
                
            } else {
                job.status = JOB_STATUS.FAILED;
                job.completedAt = new Date();
                this.stats.failed++;
                this.stats.processed++;
                
                this.emit('job:failed', job, error);
            }
            
        } finally {
            this.runningJobs.delete(job.id);
            this._processNext();
        }
    }

    _calculateBackoff(job) {
        const attempt = job.attempts;
        const baseDelay = job.backoffDelay;
        
        switch (job.backoff) {
            case 'exponential':
                return baseDelay * Math.pow(2, attempt - 1);
            case 'linear':
                return baseDelay * attempt;
            case 'fixed':
            default:
                return baseDelay;
        }
    }
}

// ============================================================================
// WORKFLOW JOB QUEUE (SPECIALIZED)
// ============================================================================

class WorkflowJobQueue extends JobQueue {
    constructor(workflowExecutor, options = {}) {
        super({
            name: 'workflows',
            concurrency: options.concurrency || 5,
            ...options
        });
        
        this.workflowExecutor = workflowExecutor;
        
        // Register workflow handler
        this.process('workflow:execute', async (data, context) => {
            const { workflowId, inputs, organizationId, userId } = data;
            
            context.log(`Starting workflow execution: ${workflowId}`);
            context.progress(10);
            
            const executor = new workflowExecutor.constructor(
                workflowExecutor.db,
                null
            );
            
            const result = await executor.executeWorkflow(workflowId, inputs, organizationId);
            
            context.progress(100);
            context.log(`Workflow completed: ${result.executionId}`);
            
            return result;
        });
        
        // Register single node execution handler
        this.process('workflow:executeNode', async (data, context) => {
            const { workflowId, nodeId, inputData, recursive } = data;
            
            context.log(`Executing node: ${nodeId} in workflow ${workflowId}`);
            
            const executor = new workflowExecutor.constructor(
                workflowExecutor.db,
                null
            );
            
            const result = await executor.executeSingleNode(workflowId, nodeId, inputData, recursive);
            
            return result;
        });
    }
    
    /**
     * Queue a workflow execution
     */
    queueWorkflow(workflowId, inputs = {}, options = {}) {
        return this.add('workflow:execute', {
            workflowId,
            inputs,
            organizationId: options.organizationId,
            userId: options.userId
        }, {
            priority: options.priority || JOB_PRIORITY.NORMAL,
            maxAttempts: options.maxAttempts || 3,
            timeout: options.timeout || 10 * 60 * 1000, // 10 minutes
            metadata: {
                workflowId,
                userId: options.userId,
                triggeredBy: options.triggeredBy || 'manual'
            }
        });
    }
    
    /**
     * Queue a node execution
     */
    queueNodeExecution(workflowId, nodeId, inputData = null, options = {}) {
        return this.add('workflow:executeNode', {
            workflowId,
            nodeId,
            inputData,
            recursive: options.recursive !== false
        }, {
            priority: options.priority || JOB_PRIORITY.NORMAL,
            maxAttempts: 1, // Don't retry individual node executions
            timeout: options.timeout || 5 * 60 * 1000 // 5 minutes
        });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    Job,
    JobQueue,
    WorkflowJobQueue,
    JOB_STATUS,
    JOB_PRIORITY
};
