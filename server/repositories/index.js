/**
 * Repository Index
 * Initializes all repositories with the database instance.
 * 
 * Usage:
 *   const { initRepositories } = require('./repositories');
 *   const repos = initRepositories(db);
 *   // repos.entity.findAllByOrg(orgId)
 *   // repos.workflow.findById(id, orgId)
 *   // etc.
 */

const { EntityRepository } = require('./entity.repository');
const { WorkflowRepository } = require('./workflow.repository');
const { ExecutionRepository } = require('./execution.repository');
const { UserRepository } = require('./user.repository');
const { ReportRepository } = require('./report.repository');
const { DashboardRepository } = require('./dashboard.repository');
const { KnowledgeRepository } = require('./knowledge.repository');
const { NotificationRepository } = require('./notification.repository');

function initRepositories(db) {
  return {
    entity: new EntityRepository(db),
    workflow: new WorkflowRepository(db),
    execution: new ExecutionRepository(db),
    user: new UserRepository(db),
    report: new ReportRepository(db),
    dashboard: new DashboardRepository(db),
    knowledge: new KnowledgeRepository(db),
    notification: new NotificationRepository(db),
  };
}

module.exports = {
  initRepositories,
  EntityRepository,
  WorkflowRepository,
  ExecutionRepository,
  UserRepository,
  ReportRepository,
  DashboardRepository,
  KnowledgeRepository,
  NotificationRepository,
};
