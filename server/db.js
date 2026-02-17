const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function openDb() {
  return open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });
}

async function initDb() {
  const db = await openDb();

  // Enable WAL mode for better concurrent access (prevents SQLITE_BUSY)
  await db.exec('PRAGMA journal_mode = WAL;');
  await db.exec('PRAGMA busy_timeout = 5000;');

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON;');

  // DROP tables to ensure fresh schema (User approved data deletion)
  // DROP tables removed to ensure data persistence
  // await db.exec(`
  //   DROP TABLE IF EXISTS record_values;
  //   DROP TABLE IF EXISTS records;
  //   DROP TABLE IF EXISTS properties;
  //   DROP TABLE IF EXISTS entities;
  //   DROP TABLE IF EXISTS workflows;
  //   DROP TABLE IF EXISTS user_organizations;
  //   DROP TABLE IF EXISTS organizations;
  //   DROP TABLE IF EXISTS users;
  // `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      profilePhoto TEXT,
      companyRole TEXT,
      locale TEXT DEFAULT 'en',
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS user_organizations (
      userId TEXT,
      organizationId TEXT,
      role TEXT DEFAULT 'member',
      PRIMARY KEY (userId, organizationId),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      organizationId TEXT,
      name TEXT,
      description TEXT,
      author TEXT,
      lastEdited TEXT,
      entityType TEXT DEFAULT 'generic',
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      entityId TEXT,
      name TEXT,
      type TEXT,
      defaultValue TEXT,
      relatedEntityId TEXT,
      unit TEXT,
      FOREIGN KEY(entityId) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      entityId TEXT,
      createdAt TEXT,
      FOREIGN KEY(entityId) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS record_values (
      id TEXT PRIMARY KEY,
      recordId TEXT,
      propertyId TEXT,
      value TEXT,
      FOREIGN KEY(recordId) REFERENCES records(id) ON DELETE CASCADE,
      FOREIGN KEY(propertyId) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      organizationId TEXT,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      tags TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      organizationId TEXT,
      name TEXT NOT NULL,
      description TEXT,
      isPublic INTEGER DEFAULT 0,
      shareToken TEXT UNIQUE,
      createdBy TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS widgets (
      id TEXT PRIMARY KEY,
      dashboardId TEXT,
      title TEXT NOT NULL,
      description TEXT,
      config TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      createdAt TEXT,
      FOREIGN KEY(dashboardId) REFERENCES dashboards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS simulations (
      id TEXT PRIMARY KEY,
      organizationId TEXT,
      name TEXT NOT NULL,
      description TEXT,
      baseDatasetId TEXT,
      baseDatasetName TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      simulationId TEXT,
      name TEXT NOT NULL,
      description TEXT,
      variables TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(simulationId) REFERENCES simulations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS list_items (
      id TEXT PRIMARY KEY,
      scenarioId TEXT,
      label TEXT NOT NULL,
      value TEXT,
      type TEXT NOT NULL,
      formula TEXT,
      metadata TEXT,
      createdAt TEXT,
      FOREIGN KEY(scenarioId) REFERENCES scenarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pending_approvals (
      id TEXT PRIMARY KEY,
      organizationId TEXT,
      workflowId TEXT,
      nodeId TEXT,
      nodeLabel TEXT,
      assignedUserId TEXT,
      assignedUserName TEXT,
      status TEXT DEFAULT 'pending',
      inputDataPreview TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(workflowId) REFERENCES workflows(id) ON DELETE CASCADE,
      FOREIGN KEY(assignedUserId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS node_feedback (
      id TEXT PRIMARY KEY,
      nodeType TEXT NOT NULL,
      nodeLabel TEXT,
      feedbackText TEXT NOT NULL,
      userId TEXT,
      userName TEXT,
      userEmail TEXT,
      organizationId TEXT,
      workflowId TEXT,
      workflowName TEXT,
      createdAt TEXT,
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pending_invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      organizationId TEXT NOT NULL,
      invitedBy TEXT,
      invitedByName TEXT,
      token TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(invitedBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS workflow_executions (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      organizationId TEXT,
      status TEXT DEFAULT 'pending',
      triggerType TEXT DEFAULT 'manual',
      inputs TEXT,
      currentNodeId TEXT,
      nodeResults TEXT,
      finalOutput TEXT,
      error TEXT,
      createdAt TEXT,
      startedAt TEXT,
      completedAt TEXT,
      FOREIGN KEY(workflowId) REFERENCES workflows(id) ON DELETE CASCADE,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS execution_logs (
      id TEXT PRIMARY KEY,
      executionId TEXT NOT NULL,
      nodeId TEXT,
      nodeType TEXT,
      nodeLabel TEXT,
      status TEXT,
      inputData TEXT,
      outputData TEXT,
      error TEXT,
      duration INTEGER,
      timestamp TEXT,
      FOREIGN KEY(executionId) REFERENCES workflow_executions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS report_templates (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'FileText',
      createdBy TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(createdBy) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS template_sections (
      id TEXT PRIMARY KEY,
      templateId TEXT NOT NULL,
      parentId TEXT,
      title TEXT NOT NULL,
      content TEXT,
      generationRules TEXT,
      sortOrder INTEGER DEFAULT 0,
      FOREIGN KEY(templateId) REFERENCES report_templates(id) ON DELETE CASCADE,
      FOREIGN KEY(parentId) REFERENCES template_sections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      templateId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      createdBy TEXT NOT NULL,
      reviewerId TEXT,
      deadline TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(templateId) REFERENCES report_templates(id),
      FOREIGN KEY(createdBy) REFERENCES users(id),
      FOREIGN KEY(reviewerId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS report_sections (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      templateSectionId TEXT NOT NULL,
      content TEXT,
      userPrompt TEXT,
      status TEXT DEFAULT 'empty',
      generatedAt TEXT,
      FOREIGN KEY(reportId) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY(templateSectionId) REFERENCES template_sections(id)
    );

    CREATE TABLE IF NOT EXISTS report_contexts (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSize INTEGER,
      extractedText TEXT,
      uploadedAt TEXT,
      FOREIGN KEY(reportId) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS report_comments (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      sectionId TEXT NOT NULL,
      userId TEXT NOT NULL,
      userName TEXT,
      selectedText TEXT,
      startOffset INTEGER,
      endOffset INTEGER,
      commentText TEXT NOT NULL,
      suggestionText TEXT,
      status TEXT DEFAULT 'open',
      createdAt TEXT,
      updatedAt TEXT,
      resolvedAt TEXT,
      resolvedBy TEXT,
      FOREIGN KEY(reportId) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
  `);

  // Create AI assistant files table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_assistant_files (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileSize INTEGER,
      extractedText TEXT,
      uploadedAt TEXT,
      FOREIGN KEY(reportId) REFERENCES reports(id) ON DELETE CASCADE
    );
  `);

  // Create Knowledge Base documents table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      organizationId TEXT,
      name TEXT NOT NULL,
      type TEXT,
      source TEXT,
      filePath TEXT,
      googleDriveId TEXT,
      googleDriveUrl TEXT,
      mimeType TEXT,
      fileSize INTEGER,
      extractedText TEXT,
      summary TEXT,
      metadata TEXT,
      tags TEXT,
      relatedEntityIds TEXT,
      uploadedBy TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(uploadedBy) REFERENCES users(id)
    );
  `);

  // Create Knowledge Base document chunks table (for semantic search)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_document_chunks (
      id TEXT PRIMARY KEY,
      documentId TEXT,
      chunkIndex INTEGER,
      content TEXT,
      embedding TEXT,
      FOREIGN KEY(documentId) REFERENCES knowledge_documents(id) ON DELETE CASCADE
    );
  `);

  // Create knowledge folders table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_folders (
      id TEXT PRIMARY KEY,
      organizationId TEXT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      parentId TEXT,
      documentIds TEXT DEFAULT '[]',
      entityIds TEXT DEFAULT '[]',
      createdBy TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(parentId) REFERENCES knowledge_folders(id) ON DELETE SET NULL
    );
  `);

  // Create dashboard-workflow connections table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS dashboard_workflow_connections (
      id TEXT PRIMARY KEY,
      dashboardId TEXT,
      widgetId TEXT,
      workflowId TEXT,
      nodeId TEXT,
      executionId TEXT,
      outputPath TEXT,
      refreshMode TEXT DEFAULT 'manual',
      refreshInterval INTEGER,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(dashboardId) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY(widgetId) REFERENCES widgets(id) ON DELETE CASCADE,
      FOREIGN KEY(workflowId) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `);

  // Create notifications table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      orgId TEXT,
      userId TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      metadata TEXT,
      createdAt TEXT,
      FOREIGN KEY(orgId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create notification reads table (tracks which users have read which notifications)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      id TEXT PRIMARY KEY,
      notificationId TEXT NOT NULL,
      userId TEXT NOT NULL,
      readAt TEXT,
      UNIQUE(notificationId, userId),
      FOREIGN KEY(notificationId) REFERENCES notifications(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create alert configurations table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS alert_configs (
      id TEXT PRIMARY KEY,
      orgId TEXT NOT NULL,
      userId TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      condition TEXT,
      threshold TEXT,
      entityId TEXT,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT,
      FOREIGN KEY(orgId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migration: Add profilePhoto and companyRole columns to users table if they don't exist
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN profilePhoto TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN companyRole TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN locale TEXT DEFAULT 'en'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add createdBy and createdByName columns to workflows table
  try {
    await db.exec(`ALTER TABLE workflows ADD COLUMN createdBy TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE workflows ADD COLUMN createdByName TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add lastEditedBy and lastEditedByName columns to workflows table
  try {
    await db.exec(`ALTER TABLE workflows ADD COLUMN lastEditedBy TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE workflows ADD COLUMN lastEditedByName TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add tags column to workflows table
  try {
    await db.exec(`ALTER TABLE workflows ADD COLUMN tags TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add isAdmin column to users table for platform-wide admin access
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN isAdmin INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add onboarding columns to users table
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN onboardingRole TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN onboardingIndustry TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN onboardingUseCase TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN onboardingSource TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN onboardingCompleted INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add email verification columns
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN verificationToken TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add password reset columns
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN resetPasswordToken TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN resetPasswordExpires TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add Stripe subscription columns to organizations table
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN subscriptionPlan TEXT DEFAULT 'free'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN stripeCustomerId TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN stripeSubscriptionId TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN subscriptionStatus TEXT DEFAULT 'active'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN subscriptionCurrentPeriodEnd TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add company info columns to organizations table
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN industry TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN employees TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN website TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN linkedinUrl TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN headquarters TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN foundingYear TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN overview TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add inputs column to workflow_executions table
  try {
    await db.exec(`ALTER TABLE workflow_executions ADD COLUMN inputs TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Create workflow_schedules table for periodic workflow execution
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workflow_schedules (
      id TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL UNIQUE,
      organizationId TEXT NOT NULL,
      intervalMs INTEGER NOT NULL,
      lastRunAt TEXT,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(workflowId) REFERENCES workflows(id) ON DELETE CASCADE,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add triggerType column to workflow_executions table if missing
  try {
    await db.exec(`ALTER TABLE workflow_executions ADD COLUMN triggerType TEXT DEFAULT 'manual'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Recreate workflow_executions table to remove userId column if it exists
  try {
    // Check if userId column exists
    const tableInfo = await db.all(`PRAGMA table_info(workflow_executions)`);
    const hasUserId = tableInfo.some(col => col.name === 'userId');
    
    if (hasUserId) {
      console.log('[Migration] Dropping and recreating workflow_executions table...');
      
      // Simply drop and recreate the table (data loss acceptable in development)
      await db.exec(`DROP TABLE IF EXISTS workflow_executions;`);
      
      await db.exec(`
        CREATE TABLE workflow_executions (
          id TEXT PRIMARY KEY,
          workflowId TEXT NOT NULL,
          organizationId TEXT,
          status TEXT DEFAULT 'pending',
          triggerType TEXT DEFAULT 'manual',
          inputs TEXT,
          currentNodeId TEXT,
          nodeResults TEXT,
          finalOutput TEXT,
          error TEXT,
          createdAt TEXT,
          startedAt TEXT,
          completedAt TEXT,
          FOREIGN KEY(workflowId) REFERENCES workflows(id) ON DELETE CASCADE,
          FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
        );
      `);
      
      console.log('[Migration] workflow_executions table recreated successfully');
    }
  } catch (e) {
    console.error('[Migration] Error recreating workflow_executions:', e.message);
    // If migration fails, continue anyway
  }

  // Migration: Add Slack integration columns to organizations table
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN slackBotToken TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN slackTeamId TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN slackTeamName TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN slackConnectedAt TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN logo TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add entityType column to entities table
  try {
    await db.exec(`ALTER TABLE entities ADD COLUMN entityType TEXT DEFAULT 'generic'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add unit column to properties table
  try {
    await db.exec(`ALTER TABLE properties ADD COLUMN unit TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add tags column to records table
  try {
    await db.exec(`ALTER TABLE records ADD COLUMN tags TEXT DEFAULT '[]'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add formula column to properties table (for calculated fields)
  try {
    await db.exec(`ALTER TABLE properties ADD COLUMN formula TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Audit trail table for record changes
  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      entityId TEXT NOT NULL,
      recordId TEXT,
      action TEXT NOT NULL,
      field TEXT,
      oldValue TEXT,
      newValue TEXT,
      userId TEXT,
      userName TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(entityId) REFERENCES entities(id) ON DELETE CASCADE
    );
  `);

  // Create copilot_chats table for storing chat history
  await db.exec(`
    CREATE TABLE IF NOT EXISTS copilot_chats (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      organizationId TEXT NOT NULL,
      title TEXT NOT NULL,
      messages TEXT NOT NULL,
      instructions TEXT,
      allowedEntities TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    );
  `);

  // Add new columns if they don't exist
  try {
    await db.exec(`ALTER TABLE copilot_chats ADD COLUMN instructions TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.exec(`ALTER TABLE copilot_chats ADD COLUMN allowedEntities TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.exec(`ALTER TABLE copilot_chats ADD COLUMN isFavorite INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.exec(`ALTER TABLE copilot_chats ADD COLUMN tags TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.exec(`ALTER TABLE copilot_chats ADD COLUMN agentIds TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.exec(`ALTER TABLE copilot_chats ADD COLUMN agentId TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE copilot_chats ADD COLUMN useChatMemory INTEGER DEFAULT 1`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migrate old copilot_agents schema to new (if old columns exist)
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN description TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN icon TEXT DEFAULT '🤖'`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN orchestratorPrompt TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN analystPrompt TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN specialistPrompt TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN synthesisPrompt TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN instructions TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN allowedEntities TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN folderIds TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN sortOrder INTEGER DEFAULT 0`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN createdAt TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE copilot_agents ADD COLUMN updatedAt TEXT`);
  } catch (e) {}

  // Multi-agent: copilot_agents table (refactored: agents are now top-level containers)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS copilot_agents (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT '🤖',
      instructions TEXT,
      allowedEntities TEXT,
      folderIds TEXT,
      orchestratorPrompt TEXT,
      analystPrompt TEXT,
      specialistPrompt TEXT,
      synthesisPrompt TEXT,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      role TEXT DEFAULT 'agent',
      createdBy TEXT,
      createdByName TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // Ensure all columns exist (fixes DBs created with older schema)
  const agentColumns = await db.all('PRAGMA table_info(copilot_agents)');
  const has = (name) => agentColumns.some((c) => c.name === name);
  const addCol = async (sql) => { try { await db.exec(sql); } catch (e) { /* already exists or invalid */ } };
  if (!has('instructions')) await addCol('ALTER TABLE copilot_agents ADD COLUMN instructions TEXT');
  if (!has('allowedEntities')) await addCol('ALTER TABLE copilot_agents ADD COLUMN allowedEntities TEXT');
  if (!has('folderIds')) await addCol('ALTER TABLE copilot_agents ADD COLUMN folderIds TEXT');
  if (!has('sortOrder')) await addCol('ALTER TABLE copilot_agents ADD COLUMN sortOrder INTEGER DEFAULT 0');
  if (!has('createdAt')) await addCol('ALTER TABLE copilot_agents ADD COLUMN createdAt TEXT');
  if (!has('updatedAt')) await addCol('ALTER TABLE copilot_agents ADD COLUMN updatedAt TEXT');
  if (!has('role')) {
    try { await db.exec(`ALTER TABLE copilot_agents ADD COLUMN role TEXT DEFAULT 'agent'`); } catch (e) {}
  }
  if (!has('createdBy')) await addCol('ALTER TABLE copilot_agents ADD COLUMN createdBy TEXT');
  if (!has('createdByName')) await addCol('ALTER TABLE copilot_agents ADD COLUMN createdByName TEXT');
  if (!has('allowedWorkflowIds')) await addCol('ALTER TABLE copilot_agents ADD COLUMN allowedWorkflowIds TEXT');
  if (!has('toolsEnabled')) await addCol('ALTER TABLE copilot_agents ADD COLUMN toolsEnabled TEXT');
  if (!has('memoryEnabled')) await addCol('ALTER TABLE copilot_agents ADD COLUMN memoryEnabled INTEGER DEFAULT 1');

  // Agent memory: persistent memory per agent across all chats/executions
  await db.exec(`
    CREATE TABLE IF NOT EXISTS agent_memory (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      organizationId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT DEFAULT 'chat',
      metadata TEXT,
      createdAt TEXT,
      FOREIGN KEY(agentId) REFERENCES copilot_agents(id) ON DELETE CASCADE
    )
  `);
  try {
    await db.exec('CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agentId, createdAt)');
  } catch (e) {}

  // Multi-agent: agent_conversations (inter-agent messages per turn)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS agent_conversations (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      turnIndex INTEGER NOT NULL,
      messageId TEXT,
      fromAgent TEXT NOT NULL,
      toAgent TEXT NOT NULL,
      type TEXT,
      content TEXT,
      metadata TEXT,
      createdAt TEXT,
      FOREIGN KEY(chatId) REFERENCES copilot_chats(id) ON DELETE CASCADE
    )
  `);

  try {
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_conversations_chat ON agent_conversations(chatId, turnIndex)`);
  } catch (e) {
    // Index might already exist
  }

  // Migration: Add grid layout columns to widgets table
  try {
    await db.exec(`ALTER TABLE widgets ADD COLUMN gridX INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE widgets ADD COLUMN gridY INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE widgets ADD COLUMN gridWidth INTEGER DEFAULT 1`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE widgets ADD COLUMN gridHeight INTEGER DEFAULT 1`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE widgets ADD COLUMN dataSource TEXT DEFAULT 'entity'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE widgets ADD COLUMN workflowConnectionId TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Migration: Add new columns to simulations table for the new data model
  try {
    await db.exec(`ALTER TABLE simulations ADD COLUMN sourceEntities TEXT DEFAULT '[]'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE simulations ADD COLUMN variables TEXT DEFAULT '[]'`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    await db.exec(`ALTER TABLE simulations ADD COLUMN scenariosData TEXT DEFAULT '[]'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Create audit_logs table for activity tracking
  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      userId TEXT,
      userName TEXT,
      userEmail TEXT,
      action TEXT NOT NULL,
      resourceType TEXT NOT NULL,
      resourceId TEXT,
      resourceName TEXT,
      details TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Create index for faster queries
  try {
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organizationId)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(userId)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(createdAt)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
  } catch (e) {
    // Indexes might already exist
  }

  // Create ai_audit_logs table for AI-specific audit trail (compliance)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_audit_logs (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      userId TEXT,
      userEmail TEXT,
      chatId TEXT,
      agentId TEXT,
      agentRole TEXT NOT NULL,
      model TEXT NOT NULL,
      tokensInput INTEGER DEFAULT 0,
      tokensOutput INTEGER DEFAULT 0,
      tokensTotal INTEGER DEFAULT 0,
      durationMs INTEGER,
      promptLength INTEGER,
      responseLength INTEGER,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);
  try {
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_audit_org ON ai_audit_logs(organizationId)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON ai_audit_logs(createdAt)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_audit_chat ON ai_audit_logs(chatId)`);
  } catch (e) { /* indexes exist */ }

  // Migration: aiAuditMode for organizations (modo auditoría)
  try {
    await db.exec(`ALTER TABLE organizations ADD COLUMN aiAuditMode INTEGER DEFAULT 0`);
  } catch (e) { /* column exists */ }

  // Create ot_alerts table for OT/Industrial alerts
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ot_alerts (
      id TEXT PRIMARY KEY,
      organizationId TEXT,
      nodeId TEXT,
      nodeType TEXT,
      fieldName TEXT,
      value REAL,
      threshold TEXT,
      severity TEXT,
      message TEXT,
      metadata TEXT,
      createdAt TEXT,
      acknowledgedAt TEXT,
      acknowledgedBy TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for ot_alerts
  try {
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_ot_alerts_org ON ot_alerts(organizationId)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_ot_alerts_created ON ot_alerts(createdAt)`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_ot_alerts_severity ON ot_alerts(severity)`);
  } catch (e) {
    // Indexes might already exist
  }

  // data_connections table (used by dataConnections routes and OT)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS data_connections (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      description TEXT,
      config TEXT,
      status TEXT DEFAULT 'inactive',
      lastTestedAt TEXT,
      lastError TEXT,
      createdBy TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // standards table (used by dataConnections/standards routes)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS standards (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      category TEXT,
      description TEXT,
      version TEXT,
      status TEXT DEFAULT 'active',
      effectiveDate TEXT,
      expiryDate TEXT,
      content TEXT,
      tags TEXT,
      relatedEntityIds TEXT DEFAULT '[]',
      createdBy TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // Migration: workflowStatus for report_sections (per-section Draft/Review/Ready to Send)
  try {
    await db.exec(`ALTER TABLE report_sections ADD COLUMN workflowStatus TEXT DEFAULT 'draft'`);
  } catch (e) { /* column exists */ }

  return db;
}

module.exports = { openDb, initDb };
