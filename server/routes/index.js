/**
 * Routes Index
 * Mounts all route modules on the Express app.
 * 
 * Note: This is designed to be used alongside the existing server/index.js
 * during the migration period. New routes are added here; existing routes
 * in server/index.js continue to work.
 * 
 * Eventually, ALL routes will be moved here and server/index.js will only
 * contain Express setup + middleware.
 */

const { createEntityRoutes } = require('./entity.routes');
const { createWorkflowRoutes } = require('./workflow.routes');

function mountRoutes(app, authenticateToken, services, repos) {
  // Entity routes (entities, properties, records)
  // NOTE: These are mounted at /api prefix but the routes themselves include /entities etc.
  // During migration, these NEW route handlers will be used IF the old ones are removed.
  // For now, they serve as the reference implementation.
  
  // Uncomment to activate (replacing old inline routes in index.js):
  // app.use('/api', createEntityRoutes(authenticateToken, services, repos));
  // app.use('/api', createWorkflowRoutes(authenticateToken, services, repos));
  
  console.log('[Routes] Route modules loaded (entity, workflow). Ready to activate.');
}

module.exports = { mountRoutes, createEntityRoutes, createWorkflowRoutes };
