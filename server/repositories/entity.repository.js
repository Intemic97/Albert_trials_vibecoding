/**
 * Entity Repository
 * Data access layer for entities, properties, records, and record_values tables.
 * NO business logic here - only SQL queries.
 */

class EntityRepository {
  constructor(db) {
    this.db = db;
  }

  // ============================================================
  // ENTITIES
  // ============================================================

  async findAllByOrg(orgId) {
    return this.db.all('SELECT * FROM entities WHERE organizationId = ?', [orgId]);
  }

  async findById(id, orgId) {
    return this.db.get('SELECT * FROM entities WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async findByIdUnsafe(id) {
    return this.db.get('SELECT * FROM entities WHERE id = ?', [id]);
  }

  async findNameById(id) {
    return this.db.get('SELECT name FROM entities WHERE id = ?', [id]);
  }

  async countByOrg(orgId) {
    return this.db.get('SELECT COUNT(*) as count FROM entities WHERE organizationId = ?', [orgId]);
  }

  async countAll() {
    return this.db.get('SELECT COUNT(*) as count FROM entities');
  }

  async create({ id, organizationId, name, description, author, lastEdited, entityType }) {
    return this.db.run(
      'INSERT INTO entities (id, organizationId, name, description, author, lastEdited, entityType) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, organizationId, name, description, author, lastEdited, entityType || 'generic']
    );
  }

  async delete(id) {
    await this.db.run('DELETE FROM entities WHERE id = ?', [id]);
    await this.db.run('DELETE FROM properties WHERE entityId = ?', [id]);
  }

  async deleteByCreator(userId) {
    return this.db.run('DELETE FROM entities WHERE createdBy = ?', [userId]);
  }

  // ============================================================
  // PROPERTIES
  // ============================================================

  async findPropertiesByEntityId(entityId) {
    return this.db.all('SELECT * FROM properties WHERE entityId = ?', [entityId]);
  }

  async findPropertyNameById(propId) {
    return this.db.get('SELECT name FROM properties WHERE id = ?', [propId]);
  }

  async findOutgoingRelations(entityId) {
    return this.db.all(
      'SELECT relatedEntityId FROM properties WHERE entityId = ? AND type = ? AND relatedEntityId IS NOT NULL',
      [entityId, 'relation']
    );
  }

  async findIncomingRelations(entityId) {
    return this.db.all(
      'SELECT DISTINCT entityId FROM properties WHERE type = ? AND relatedEntityId = ?',
      ['relation', entityId]
    );
  }

  async findPropertyIdsByEntityId(entityId) {
    return this.db.all('SELECT id, name, type FROM properties WHERE entityId = ?', [entityId]);
  }

  async createProperty({ id, entityId, name, type, defaultValue, relatedEntityId, unit }) {
    return this.db.run(
      'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, entityId, name, type, defaultValue, relatedEntityId, unit]
    );
  }

  async deleteProperty(propId) {
    return this.db.run('DELETE FROM properties WHERE id = ?', [propId]);
  }

  // ============================================================
  // RECORDS
  // ============================================================

  async findRecordsByEntityId(entityId) {
    const records = await this.db.all('SELECT * FROM records WHERE entityId = ?', [entityId]);
    for (const record of records) {
      const values = await this.db.all('SELECT * FROM record_values WHERE recordId = ?', [record.id]);
      record.values = {};
      values.forEach(v => { record.values[v.propertyId] = v.value; });
    }
    return records;
  }

  async findRecordsByEntityIdLimited(entityId, limit = 50) {
    return this.db.all('SELECT * FROM records WHERE entityId = ? LIMIT ?', [entityId, limit]);
  }

  async findRecordWithOrgCheck(recordId, orgId) {
    return this.db.get(
      `SELECT r.id FROM records r JOIN entities e ON r.entityId = e.id WHERE r.id = ? AND e.organizationId = ?`,
      [recordId, orgId]
    );
  }

  async findRecordEntityId(recordId) {
    return this.db.get('SELECT entityId FROM records WHERE id = ?', [recordId]);
  }

  async createRecord({ id, entityId, createdAt }) {
    return this.db.run('INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)', [id, entityId, createdAt]);
  }

  async updateRecordTags(recordId, tags) {
    return this.db.run('UPDATE records SET tags = ? WHERE id = ?', [JSON.stringify(tags), recordId]);
  }

  async deleteRecord(recordId) {
    await this.db.run('DELETE FROM record_values WHERE recordId = ?', [recordId]);
    return this.db.run('DELETE FROM records WHERE id = ?', [recordId]);
  }

  // ============================================================
  // RECORD VALUES
  // ============================================================

  async findRecordValues(recordId) {
    return this.db.all('SELECT * FROM record_values WHERE recordId = ?', [recordId]);
  }

  async findRecordValue(recordId, propertyId) {
    return this.db.get(
      'SELECT id, value FROM record_values WHERE recordId = ? AND propertyId = ?',
      [recordId, propertyId]
    );
  }

  async createRecordValue({ id, recordId, propertyId, value }) {
    return this.db.run(
      'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
      [id, recordId, propertyId, String(value)]
    );
  }

  async updateRecordValue(id, value) {
    return this.db.run('UPDATE record_values SET value = ? WHERE id = ?', [String(value), id]);
  }

  // ============================================================
  // COMPOSITE QUERIES (used by AI/generate endpoints)
  // ============================================================

  async findEntitiesWithPropsAndRecords(orgId, entityIds = null, recordLimit = 50) {
    let query = 'SELECT * FROM entities WHERE organizationId = ?';
    const params = [orgId];

    if (entityIds && entityIds.length > 0) {
      const placeholders = entityIds.map(() => '?').join(',');
      query += ` AND id IN (${placeholders})`;
      params.push(...entityIds);
    }

    const entities = await this.db.all(query, params);

    return Promise.all(entities.map(async (entity) => {
      const properties = await this.findPropertiesByEntityId(entity.id);
      const records = await this.findRecordsByEntityIdLimited(entity.id, recordLimit);
      const recordsWithValues = await Promise.all(records.map(async (r) => {
        const values = await this.findRecordValues(r.id);
        return { ...r, values };
      }));
      return { ...entity, properties, records: recordsWithValues };
    }));
  }

  // ============================================================
  // AUDIT LOG (entity-specific)
  // ============================================================

  async findAuditLog(entityId, orgId) {
    return this.db.all(
      'SELECT * FROM audit_log WHERE entityId = ? AND organizationId = ? ORDER BY timestamp DESC LIMIT 100',
      [entityId, orgId]
    );
  }

  async createAuditEntry({ id, organizationId, entityId, recordId, action, field, oldValue, newValue, userId, userName, timestamp }) {
    return this.db.run(
      'INSERT INTO audit_log (id, organizationId, entityId, recordId, action, field, oldValue, newValue, userId, userName, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, organizationId, entityId, recordId, action, field, oldValue, newValue, userId, userName, timestamp]
    );
  }
}

module.exports = { EntityRepository };
