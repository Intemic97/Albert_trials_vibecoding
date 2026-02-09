/**
 * Knowledge Repository
 * Data access layer for knowledge_folders, knowledge_documents.
 */

class KnowledgeRepository {
  constructor(db) {
    this.db = db;
  }

  // ============================================================
  // FOLDERS
  // ============================================================

  async findAllFolders(orgId) {
    return this.db.all('SELECT * FROM knowledge_folders WHERE organizationId = ? ORDER BY name ASC', [orgId]);
  }

  async findFolderById(id, orgId) {
    return this.db.get('SELECT * FROM knowledge_folders WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async createFolder({ id, organizationId, name, description, color, parentId, documentIds, entityIds, createdBy, createdAt, updatedAt }) {
    return this.db.run(
      'INSERT INTO knowledge_folders (id, organizationId, name, description, color, parentId, documentIds, entityIds, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, organizationId, name, description, color, parentId, documentIds || '[]', entityIds || '[]', createdBy, createdAt, updatedAt]
    );
  }

  async updateFolder(id, { name, description, color, parentId, updatedAt }) {
    return this.db.run(
      'UPDATE knowledge_folders SET name = ?, description = ?, color = ?, parentId = ?, updatedAt = ? WHERE id = ?',
      [name, description, color, parentId, updatedAt, id]
    );
  }

  async deleteFolder(id) {
    return this.db.run('DELETE FROM knowledge_folders WHERE id = ?', [id]);
  }

  async reparentChildren(oldParentId, newParentId) {
    return this.db.run('UPDATE knowledge_folders SET parentId = ? WHERE parentId = ?', [newParentId, oldParentId]);
  }

  async updateFolderField(id, field, value) {
    return this.db.run(`UPDATE knowledge_folders SET ${field} = ?, updatedAt = ? WHERE id = ?`, [value, new Date().toISOString(), id]);
  }

  // ============================================================
  // DOCUMENTS
  // ============================================================

  async findAllDocuments(orgId) {
    return this.db.all(
      'SELECT id, name, type, source, filePath, googleDriveId, googleDriveUrl, mimeType, fileSize, summary, tags, relatedEntityIds, uploadedBy, createdAt, updatedAt FROM knowledge_documents WHERE organizationId = ? ORDER BY updatedAt DESC',
      [orgId]
    );
  }

  async findDocumentById(id, orgId) {
    return this.db.get('SELECT * FROM knowledge_documents WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async createDocument(data) {
    return this.db.run(
      'INSERT INTO knowledge_documents (id, organizationId, name, type, source, filePath, mimeType, fileSize, extractedText, summary, tags, relatedEntityIds, uploadedBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.id, data.organizationId, data.name, data.type, data.source, data.filePath, data.mimeType, data.fileSize, data.extractedText, data.summary, data.tags, data.relatedEntityIds, data.uploadedBy, data.createdAt, data.updatedAt]
    );
  }

  async findDocumentFilePath(id, orgId) {
    return this.db.get('SELECT filePath, name FROM knowledge_documents WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async deleteDocument(id) {
    return this.db.run('DELETE FROM knowledge_documents WHERE id = ?', [id]);
  }

  async searchDocuments(orgId, query, limit = 20) {
    const pattern = `%${query}%`;
    return this.db.all(
      'SELECT id, name, summary, extractedText, type, createdAt FROM knowledge_documents WHERE organizationId = ? AND (extractedText LIKE ? OR name LIKE ? OR summary LIKE ?) ORDER BY updatedAt DESC LIMIT ?',
      [orgId, pattern, pattern, pattern, limit]
    );
  }

  async findDocumentRelatedEntities(id, orgId) {
    return this.db.get('SELECT relatedEntityIds FROM knowledge_documents WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async updateDocumentRelatedEntities(id, relatedEntityIds) {
    return this.db.run('UPDATE knowledge_documents SET relatedEntityIds = ?, updatedAt = ? WHERE id = ?', [relatedEntityIds, new Date().toISOString(), id]);
  }
}

module.exports = { KnowledgeRepository };
