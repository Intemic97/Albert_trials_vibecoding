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
      FOREIGN KEY(organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS properties (
      id TEXT PRIMARY KEY,
      entityId TEXT,
      name TEXT,
      type TEXT,
      defaultValue TEXT,
      relatedEntityId TEXT,
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

  return db;
}

module.exports = { openDb, initDb };
