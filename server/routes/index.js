/**
 * Routes Index
 * 
 * Centralized export of all route modules.
 * Each module is a factory function that receives dependencies
 * and returns an Express Router.
 */

module.exports = {
    authRoutes: require('./auth'),
    notificationRoutes: require('./notifications'),
    adminRoutes: require('./admin'),
    fileRoutes: require('./files'),
    entityRoutes: require('./entities'),
    copilotRoutes: require('./copilot'),
    aiRoutes: require('./ai'),
    dashboardRoutes: require('./dashboards'),
    simulationRoutes: require('./simulations'),
    knowledgeRoutes: require('./knowledge'),
    dataConnectionRoutes: require('./dataConnections'),
    workflowRoutes: require('./workflows'),
    integrationRoutes: require('./integrations'),
    billingRoutes: require('./billing'),
    reportRoutes: require('./reports'),
};
