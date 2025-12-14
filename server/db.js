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
  `);

  return db;
}

module.exports = { openDb, initDb };
