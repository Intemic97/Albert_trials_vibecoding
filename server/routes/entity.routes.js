/**
 * Entity Routes
 * Handles: entities, properties, records, record_values
 * 
 * All routes use the service layer - NO direct SQL queries.
 */

const express = require('express');

function createEntityRoutes(authenticateToken, services, repos) {
  const router = express.Router();

  // GET /api/entities - List all entities with properties
  router.get('/entities', authenticateToken, async (req, res) => {
    try {
      const entities = await services.entity.getAllEntities(req.user.orgId);
      res.json(entities);
    } catch (error) {
      console.error('Error fetching entities:', error);
      res.status(500).json({ error: 'Failed to fetch entities' });
    }
  });

  // POST /api/entities - Create entity
  router.post('/entities', authenticateToken, async (req, res) => {
    try {
      const entity = await services.entity.createEntity(req.body, req.user.orgId);
      res.status(201).json(entity);
    } catch (error) {
      console.error('Error creating entity:', error);
      res.status(500).json({ error: 'Failed to create entity' });
    }
  });

  // DELETE /api/entities/:id - Delete entity
  router.delete('/entities/:id', authenticateToken, async (req, res) => {
    try {
      await services.entity.deleteEntity(req.params.id, req.user.orgId);
      res.json({ message: 'Entity deleted' });
    } catch (error) {
      console.error('Error deleting entity:', error);
      res.status(500).json({ error: 'Failed to delete entity' });
    }
  });

  // POST /api/properties - Add property
  router.post('/properties', authenticateToken, async (req, res) => {
    try {
      const prop = await services.entity.addProperty(req.body.entityId, req.body);
      res.status(201).json({ message: 'Property added', ...prop });
    } catch (error) {
      console.error('Error adding property:', error);
      res.status(500).json({ error: 'Failed to add property' });
    }
  });

  // DELETE /api/properties/:id - Delete property
  router.delete('/properties/:id', authenticateToken, async (req, res) => {
    try {
      await services.entity.deleteProperty(req.params.id);
      res.json({ message: 'Property deleted' });
    } catch (error) {
      console.error('Error deleting property:', error);
      res.status(500).json({ error: 'Failed to delete property' });
    }
  });

  // GET /api/entities/:id/records - Get records
  router.get('/entities/:id/records', authenticateToken, async (req, res) => {
    try {
      const records = await services.entity.getRecords(req.params.id, req.user.orgId);
      res.json(records);
    } catch (error) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      console.error('Error fetching records:', error);
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  });

  // POST /api/entities/:id/records - Create record (property names as keys)
  router.post('/entities/:id/records', authenticateToken, async (req, res) => {
    try {
      const record = await services.entity.createRecord(req.params.id, req.body, req.user.orgId);
      res.status(201).json(record);
    } catch (error) {
      if (error.message.includes('access denied')) return res.status(403).json({ error: error.message });
      console.error('Error creating record:', error);
      res.status(500).json({ error: 'Failed to create record' });
    }
  });

  // POST /api/records - Create record (property IDs as keys)
  router.post('/records', authenticateToken, async (req, res) => {
    try {
      const { entityId, values } = req.body;
      const record = await services.entity.createRecord(entityId, values, req.user.orgId);
      res.status(201).json(record);
    } catch (error) {
      console.error('Error creating record:', error);
      res.status(500).json({ error: 'Failed to create record' });
    }
  });

  // PUT /api/records/:id - Update record
  router.put('/records/:id', authenticateToken, async (req, res) => {
    try {
      const result = await services.entity.updateRecord(
        req.params.id, req.body.values, req.user.orgId, req.user.sub, req.user.email
      );
      res.json(result);
    } catch (error) {
      if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
      console.error('Error updating record:', error);
      res.status(500).json({ error: 'Failed to update record' });
    }
  });

  // PUT /api/records/:id/tags - Update record tags
  router.put('/records/:id/tags', authenticateToken, async (req, res) => {
    try {
      await services.entity.updateRecordTags(req.params.id, req.body.tags, req.user.orgId);
      res.json({ message: 'Tags updated' });
    } catch (error) {
      console.error('Error updating tags:', error);
      res.status(500).json({ error: 'Failed to update tags' });
    }
  });

  // DELETE /api/records/:id - Delete record
  router.delete('/records/:id', authenticateToken, async (req, res) => {
    try {
      await services.entity.deleteRecord(req.params.id, req.user.orgId);
      res.json({ message: 'Record deleted' });
    } catch (error) {
      console.error('Error deleting record:', error);
      res.status(500).json({ error: 'Failed to delete record' });
    }
  });

  // GET /api/entities/:id/audit - Get audit log
  router.get('/entities/:id/audit', authenticateToken, async (req, res) => {
    try {
      const logs = await services.entity.getAuditLog(req.params.id, req.user.orgId);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  });

  return router;
}

module.exports = { createEntityRoutes };
