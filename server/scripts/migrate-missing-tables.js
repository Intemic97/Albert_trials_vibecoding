/**
 * Migración: crea tablas que pueden faltar en BDs antiguas
 * (data_connections, standards, etc.) para evitar 500 en /api/data-connections.
 *
 * Uso: desde la raíz del proyecto
 *   node server/scripts/migrate-missing-tables.js
 *
 * Usa la misma base de datos que el servidor (por defecto ./database.sqlite).
 */

const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'database.sqlite');

async function run() {
  console.log('Opening database:', DB_PATH);
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  try {
    await db.exec('PRAGMA foreign_keys = ON;');

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
    console.log('  ✓ data_connections');

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
    console.log('  ✓ standards');

    await db.close();
    console.log('Migration finished. Missing tables have been created.');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

run();
