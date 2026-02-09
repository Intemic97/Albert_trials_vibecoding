/**
 * Record Service
 * Business logic for records with audit logging.
 * Delegates to EntityService for core CRUD.
 * 
 * Record states (via tags):
 *   draft -> pending -> verified -> audited
 *                    -> flagged
 *                    -> estimated
 */

const RECORD_TAGS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  VERIFIED: 'verified',
  AUDITED: 'audited',
  FLAGGED: 'flagged',
  ESTIMATED: 'estimated',
};

const VALID_TAG_TRANSITIONS = {
  draft: ['pending', 'flagged'],
  pending: ['verified', 'estimated', 'flagged', 'draft'],
  verified: ['audited', 'flagged', 'pending'],
  estimated: ['verified', 'flagged', 'pending'],
  audited: ['flagged'], // Can only be flagged after audit
  flagged: ['draft', 'pending'], // Reset to draft or pending
};

class RecordService {
  constructor(repos) {
    this.entityRepo = repos.entity;
  }

  /**
   * Calculate data completeness for an entity's records.
   */
  async getDataCompleteness(entityId, orgId) {
    const entity = await this.entityRepo.findById(entityId, orgId);
    if (!entity) throw new Error('Entity not found');

    const properties = await this.entityRepo.findPropertiesByEntityId(entityId);
    const records = await this.entityRepo.findRecordsByEntityId(entityId);

    if (records.length === 0 || properties.length === 0) {
      return { percentage: 0, filled: 0, total: 0 };
    }

    const totalCells = records.length * properties.length;
    let filledCells = 0;

    for (const record of records) {
      for (const prop of properties) {
        const val = record.values?.[prop.id];
        if (val !== undefined && val !== null && val !== '') {
          filledCells++;
        }
      }
    }

    return {
      percentage: Math.round((filledCells / totalCells) * 100),
      filled: filledCells,
      total: totalCells,
      recordCount: records.length,
      propertyCount: properties.length,
    };
  }

  /**
   * Export records to CSV format.
   */
  async exportToCSV(entityId, orgId) {
    const entity = await this.entityRepo.findById(entityId, orgId);
    if (!entity) throw new Error('Entity not found');

    const properties = await this.entityRepo.findPropertiesByEntityId(entityId);
    const records = await this.entityRepo.findRecordsByEntityId(entityId);

    const headers = properties.map(p => p.unit ? `${p.name} (${p.unit})` : p.name);
    const rows = records.map(r =>
      properties.map(p => {
        const v = r.values?.[p.id];
        if (v === undefined || v === null) return '';
        const str = String(v);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      })
    );

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

module.exports = { RecordService, RECORD_TAGS, VALID_TAG_TRANSITIONS };
