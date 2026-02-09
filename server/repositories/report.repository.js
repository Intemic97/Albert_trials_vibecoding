/**
 * Report Repository
 * Data access layer for report_templates, template_sections, reports,
 * report_sections, report_contexts, report_comments, ai_assistant_files.
 */

class ReportRepository {
  constructor(db) {
    this.db = db;
  }

  // ============================================================
  // REPORT TEMPLATES
  // ============================================================

  async findAllTemplates(orgId) {
    const templates = await this.db.all(
      'SELECT id, name, description, icon, createdBy, createdAt, updatedAt FROM report_templates WHERE organizationId = ? ORDER BY updatedAt DESC',
      [orgId]
    );
    for (const t of templates) {
      t.sections = await this.findTemplateSections(t.id);
    }
    return templates;
  }

  async findTemplateById(id, orgId) {
    const template = await this.db.get('SELECT * FROM report_templates WHERE id = ? AND organizationId = ?', [id, orgId]);
    if (template) {
      template.sections = await this.findTemplateSections(id);
    }
    return template;
  }

  async findTemplateSections(templateId) {
    return this.db.all(
      'SELECT id, parentId, title, content, generationRules, sortOrder FROM template_sections WHERE templateId = ? ORDER BY sortOrder ASC',
      [templateId]
    );
  }

  async createTemplate({ id, organizationId, name, description, icon, createdBy, createdAt, updatedAt }) {
    return this.db.run(
      'INSERT INTO report_templates (id, organizationId, name, description, icon, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, organizationId, name, description, icon, createdBy, createdAt, updatedAt]
    );
  }

  async updateTemplate(id, { name, description, icon, updatedAt }) {
    return this.db.run(
      'UPDATE report_templates SET name = ?, description = ?, icon = ?, updatedAt = ? WHERE id = ?',
      [name, description, icon, updatedAt, id]
    );
  }

  async deleteTemplate(id) {
    return this.db.run('DELETE FROM report_templates WHERE id = ?', [id]);
  }

  async createTemplateSection({ id, templateId, parentId, title, content, generationRules, sortOrder }) {
    return this.db.run(
      'INSERT INTO template_sections (id, templateId, parentId, title, content, generationRules, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, templateId, parentId, title, content, generationRules, sortOrder]
    );
  }

  async deleteTemplateSections(templateId) {
    return this.db.run('DELETE FROM template_sections WHERE templateId = ?', [templateId]);
  }

  // ============================================================
  // REPORTS
  // ============================================================

  async findAllReports(orgId) {
    return this.db.all(
      `SELECT r.*, u.name as createdByName, u.email as createdByEmail,
        rev.name as reviewerName, rev.email as reviewerEmail, t.name as templateName
       FROM reports r
       LEFT JOIN users u ON r.createdBy = u.id
       LEFT JOIN users rev ON r.reviewerId = rev.id
       LEFT JOIN report_templates t ON r.templateId = t.id
       WHERE r.organizationId = ? ORDER BY r.updatedAt DESC`,
      [orgId]
    );
  }

  async findReportById(id, orgId) {
    return this.db.get(
      `SELECT r.*, u.name as createdByName, u.email as createdByEmail,
        rev.name as reviewerName, rev.email as reviewerEmail, t.name as templateName
       FROM reports r
       LEFT JOIN users u ON r.createdBy = u.id
       LEFT JOIN users rev ON r.reviewerId = rev.id
       LEFT JOIN report_templates t ON r.templateId = t.id
       WHERE r.id = ? AND r.organizationId = ?`,
      [id, orgId]
    );
  }

  async findReportIdByOrg(id, orgId) {
    return this.db.get('SELECT id FROM reports WHERE id = ? AND organizationId = ?', [id, orgId]);
  }

  async createReport({ id, organizationId, templateId, name, description, createdBy, reviewerId, deadline, createdAt, updatedAt }) {
    return this.db.run(
      "INSERT INTO reports (id, organizationId, templateId, name, description, status, createdBy, reviewerId, deadline, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)",
      [id, organizationId, templateId, name, description, createdBy, reviewerId, deadline, createdAt, updatedAt]
    );
  }

  async updateReport(id, { name, description, reviewerId, deadline, updatedAt }) {
    return this.db.run(
      'UPDATE reports SET name = ?, description = ?, reviewerId = ?, deadline = ?, updatedAt = ? WHERE id = ?',
      [name, description, reviewerId, deadline, updatedAt, id]
    );
  }

  async updateReportStatus(id, status, updatedAt) {
    return this.db.run('UPDATE reports SET status = ?, updatedAt = ? WHERE id = ?', [status, updatedAt, id]);
  }

  async updateReportTimestamp(id) {
    return this.db.run('UPDATE reports SET updatedAt = ? WHERE id = ?', [new Date().toISOString(), id]);
  }

  async deleteReport(id) {
    return this.db.run('DELETE FROM reports WHERE id = ?', [id]);
  }

  async deleteReportsByCreator(userId) {
    return this.db.run('DELETE FROM reports WHERE createdBy = ?', [userId]);
  }

  // ============================================================
  // REPORT SECTIONS
  // ============================================================

  async findReportSections(reportId) {
    return this.db.all('SELECT * FROM report_sections WHERE reportId = ?', [reportId]);
  }

  async findReportSectionById(sectionId) {
    return this.db.get('SELECT * FROM report_sections WHERE id = ?', [sectionId]);
  }

  async createReportSection({ id, reportId, templateSectionId, status = 'empty' }) {
    return this.db.run(
      "INSERT INTO report_sections (id, reportId, templateSectionId, status) VALUES (?, ?, ?, ?)",
      [id, reportId, templateSectionId, status]
    );
  }

  async updateReportSection(id, { content, userPrompt, status, generatedAt }) {
    return this.db.run(
      'UPDATE report_sections SET content = ?, userPrompt = ?, status = ?, generatedAt = ? WHERE id = ?',
      [content, userPrompt, status, generatedAt, id]
    );
  }

  // ============================================================
  // REPORT CONTEXTS
  // ============================================================

  async findContextsByReport(reportId) {
    return this.db.all(
      'SELECT id, fileName, fileSize, uploadedAt FROM report_contexts WHERE reportId = ? ORDER BY uploadedAt DESC',
      [reportId]
    );
  }

  async createContext({ id, reportId, fileName, filePath, fileSize, extractedText, uploadedAt }) {
    return this.db.run(
      'INSERT INTO report_contexts (id, reportId, fileName, filePath, fileSize, extractedText, uploadedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, reportId, fileName, filePath, fileSize, extractedText, uploadedAt]
    );
  }

  async findContextById(contextId, reportId, orgId) {
    return this.db.get(
      'SELECT rc.* FROM report_contexts rc JOIN reports r ON rc.reportId = r.id WHERE rc.id = ? AND r.id = ? AND r.organizationId = ?',
      [contextId, reportId, orgId]
    );
  }

  async deleteContext(contextId) {
    return this.db.run('DELETE FROM report_contexts WHERE id = ?', [contextId]);
  }

  async findContextTexts(reportId) {
    return this.db.all('SELECT extractedText FROM report_contexts WHERE reportId = ?', [reportId]);
  }

  // ============================================================
  // REPORT COMMENTS
  // ============================================================

  async findCommentsByReport(reportId) {
    return this.db.all(
      `SELECT c.*, u.name as userName, u.email as userEmail, resolver.name as resolvedByName
       FROM report_comments c
       LEFT JOIN users u ON c.userId = u.id
       LEFT JOIN users resolver ON c.resolvedBy = resolver.id
       WHERE c.reportId = ? ORDER BY c.createdAt DESC`,
      [reportId]
    );
  }

  async createComment(data) {
    return this.db.run(
      "INSERT INTO report_comments (id, reportId, sectionId, userId, userName, selectedText, startOffset, endOffset, commentText, suggestionText, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)",
      [data.id, data.reportId, data.sectionId, data.userId, data.userName, data.selectedText, data.startOffset, data.endOffset, data.commentText, data.suggestionText, data.createdAt, data.updatedAt]
    );
  }

  async findCommentById(commentId) {
    return this.db.get('SELECT * FROM report_comments WHERE id = ?', [commentId]);
  }

  async deleteComment(commentId) {
    return this.db.run('DELETE FROM report_comments WHERE id = ?', [commentId]);
  }
}

module.exports = { ReportRepository };
