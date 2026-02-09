/**
 * Entity Service
 * Business logic for entities, properties, records.
 * Uses EntityRepository for data access.
 */

class EntityService {
  constructor(repos) {
    this.entityRepo = repos.entity;
    this.notificationRepo = repos.notification;
  }

  // ============================================================
  // ENTITIES
  // ============================================================

  async getAllEntities(orgId) {
    const entities = await this.entityRepo.findAllByOrg(orgId);
    // Attach properties to each entity
    for (const entity of entities) {
      entity.properties = await this.entityRepo.findPropertiesByEntityId(entity.id);
    }
    return entities;
  }

  async getEntityById(id, orgId) {
    const entity = await this.entityRepo.findById(id, orgId);
    if (!entity) return null;
    entity.properties = await this.entityRepo.findPropertiesByEntityId(entity.id);
    return entity;
  }

  async createEntity(data, orgId) {
    const entityData = {
      id: data.id || this._generateId(),
      organizationId: orgId,
      name: data.name,
      description: data.description || '',
      author: data.author || 'System',
      lastEdited: data.lastEdited || new Date().toISOString(),
      entityType: data.entityType || 'generic',
    };

    await this.entityRepo.create(entityData);

    // Create properties if provided
    if (data.properties && data.properties.length > 0) {
      for (const prop of data.properties) {
        await this.entityRepo.createProperty({
          id: prop.id || this._generateId(),
          entityId: entityData.id,
          name: prop.name,
          type: prop.type || 'text',
          defaultValue: prop.defaultValue,
          relatedEntityId: prop.relatedEntityId,
          unit: prop.unit,
        });
      }
    }

    return entityData;
  }

  async deleteEntity(id, orgId) {
    const entity = await this.entityRepo.findNameById(id);
    if (!entity) throw new Error('Entity not found');
    await this.entityRepo.delete(id);
    return entity;
  }

  // ============================================================
  // PROPERTIES
  // ============================================================

  async addProperty(entityId, propData) {
    const prop = {
      id: propData.id || this._generateId(),
      entityId,
      name: propData.name,
      type: propData.type || 'text',
      defaultValue: propData.defaultValue,
      relatedEntityId: propData.relatedEntityId,
      unit: propData.unit,
    };
    await this.entityRepo.createProperty(prop);
    return prop;
  }

  async deleteProperty(propId) {
    return this.entityRepo.deleteProperty(propId);
  }

  // ============================================================
  // RECORDS
  // ============================================================

  async getRecords(entityId, orgId) {
    // Verify entity belongs to org
    const entity = await this.entityRepo.findById(entityId, orgId);
    if (!entity) throw new Error('Entity not found or access denied');
    return this.entityRepo.findRecordsByEntityId(entityId);
  }

  async createRecord(entityId, values, orgId) {
    const entity = await this.entityRepo.findById(entityId, orgId);
    if (!entity) throw new Error('Entity not found or access denied');

    const recordId = this._generateId();
    const createdAt = new Date().toISOString();
    await this.entityRepo.createRecord({ id: recordId, entityId, createdAt });

    if (values) {
      // If values use property names, map to IDs
      const properties = await this.entityRepo.findPropertyIdsByEntityId(entityId);
      const propMap = new Map(properties.map(p => [p.name, p.id]));

      for (const [key, val] of Object.entries(values)) {
        const propId = propMap.get(key) || key; // Try name first, fallback to ID
        await this.entityRepo.createRecordValue({
          id: this._generateId(),
          recordId,
          propertyId: propId,
          value: val,
        });
      }
    }

    return { id: recordId, entityId, createdAt };
  }

  async updateRecord(recordId, values, orgId, userId, userEmail) {
    // Verify access
    const access = await this.entityRepo.findRecordWithOrgCheck(recordId, orgId);
    if (!access) throw new Error('Record not found or access denied');

    const recordInfo = await this.entityRepo.findRecordEntityId(recordId);
    const entity = recordInfo ? await this.entityRepo.findByIdUnsafe(recordInfo.entityId) : null;

    if (values) {
      for (const [propId, val] of Object.entries(values)) {
        const existing = await this.entityRepo.findRecordValue(recordId, propId);
        const oldValue = existing?.value || null;
        const newValue = String(val);

        if (existing) {
          if (oldValue !== newValue) {
            await this.entityRepo.updateRecordValue(existing.id, newValue);
            // Audit log
            if (entity && recordInfo) {
              const prop = await this.entityRepo.findPropertyNameById(propId);
              await this.entityRepo.createAuditEntry({
                id: this._generateId() + this._generateId(),
                organizationId: entity.organizationId,
                entityId: recordInfo.entityId,
                recordId,
                action: 'update',
                field: prop?.name || propId,
                oldValue,
                newValue,
                userId,
                userName: userEmail,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } else {
          await this.entityRepo.createRecordValue({
            id: this._generateId(),
            recordId,
            propertyId: propId,
            value: val,
          });
        }
      }
    }

    return { message: 'Record updated' };
  }

  async updateRecordTags(recordId, tags, orgId) {
    const access = await this.entityRepo.findRecordWithOrgCheck(recordId, orgId);
    if (!access) throw new Error('Record not found or access denied');
    return this.entityRepo.updateRecordTags(recordId, tags);
  }

  async deleteRecord(recordId, orgId) {
    const access = await this.entityRepo.findRecordWithOrgCheck(recordId, orgId);
    if (!access) throw new Error('Record not found or access denied');
    return this.entityRepo.deleteRecord(recordId);
  }

  // ============================================================
  // AUDIT LOG
  // ============================================================

  async getAuditLog(entityId, orgId) {
    return this.entityRepo.findAuditLog(entityId, orgId);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  _generateId() {
    return Math.random().toString(36).substr(2, 9);
  }
}

module.exports = { EntityService };
