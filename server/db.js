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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      author TEXT,
      lastEdited TEXT
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
  `);

  return db;
}

module.exports = { openDb, initDb };
