/**
 * Services Module
 * Business logic layer. Services use repositories for data access.
 * 
 * Usage:
 *   const { initServices } = require('./services');
 *   const services = initServices(repos, { prefectClient, workflowExecutor });
 */

const {
    Job,
    JobQueue,
    WorkflowJobQueue,
    JOB_STATUS,
    JOB_PRIORITY
} = require('./jobQueue');

const { EntityService } = require('./entity.service');
const { WorkflowService } = require('./workflow.service');
const { ExecutionService, EXECUTION_STATES, VALID_TRANSITIONS } = require('./execution.service');
const { AuthService, ROLES, PERMISSIONS } = require('./auth.service');
const { RecordService, RECORD_TAGS } = require('./record.service');

function initServices(repos, options = {}) {
    return {
        entity: new EntityService(repos),
        workflow: new WorkflowService(repos),
        execution: new ExecutionService(repos, options),
        auth: new AuthService(repos),
        record: new RecordService(repos),
    };
}

module.exports = {
    // Service initializer
    initServices,
    
    // Individual services
    EntityService,
    WorkflowService,
    ExecutionService,
    AuthService,
    RecordService,
    
    // State machines / constants
    EXECUTION_STATES,
    VALID_TRANSITIONS,
    ROLES,
    PERMISSIONS,
    RECORD_TAGS,
    
    // Job Queue (legacy)
    Job,
    JobQueue,
    WorkflowJobQueue,
    JOB_STATUS,
    JOB_PRIORITY
};
