/**
 * Agent Service - CRUD for copilot agents
 */

const crypto = require('crypto');

function generateId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

const SYSTEM_AGENT_ROLES = ['orchestrator', 'analyst', 'specialist', 'synthesis'];

async function list(db, orgId) {
  const custom = await db.all(
    'SELECT * FROM copilot_agents WHERE organizationId = ? AND (isSystem = 0 OR isSystem IS NULL) ORDER BY sortOrder ASC, name ASC',
    [orgId]
  );
  const system = await db.all(
    'SELECT * FROM copilot_agents WHERE organizationId = ? AND isSystem = 1 ORDER BY sortOrder ASC',
    [orgId]
  );
  const parsed = [...system, ...custom].map(parseAgent);
  if (parsed.length === 0) {
    await seedDefaults(db, orgId);
    return list(db, orgId);
  }
  return parsed;
}

function parseAgent(row) {
  return {
    ...row,
    allowedEntities: row.allowedEntities ? safeParse(row.allowedEntities, []) : [],
    folderIds: row.folderIds ? safeParse(row.folderIds, []) : [],
    isSystem: !!row.isSystem,
    temperature: row.temperature != null ? row.temperature : 0.3,
    maxTokens: row.maxTokens != null ? row.maxTokens : 1500
  };
}

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback;
  }
}

async function get(db, id, orgId) {
  const row = await db.get(
    'SELECT * FROM copilot_agents WHERE id = ? AND organizationId = ?',
    [id, orgId]
  );
  return row ? parseAgent(row) : null;
}

async function create(db, orgId, payload) {
  const id = payload.id || generateId();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO copilot_agents (id, organizationId, name, role, systemPrompt, modelOverride, temperature, maxTokens, allowedEntities, folderIds, isSystem, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId,
      payload.name || 'Unnamed Agent',
      payload.role || 'specialist',
      payload.systemPrompt || null,
      payload.modelOverride || null,
      payload.temperature ?? 0.3,
      payload.maxTokens ?? 1500,
      payload.allowedEntities ? JSON.stringify(payload.allowedEntities) : null,
      payload.folderIds ? JSON.stringify(payload.folderIds) : null,
      0,
      payload.sortOrder ?? 0,
      now,
      now
    ]
  );
  return get(db, id, orgId);
}

async function update(db, id, orgId, payload) {
  const existing = await get(db, id, orgId);
  if (!existing) return null;
  if (existing.isSystem) {
    throw new Error('System agents cannot be modified');
  }
  const now = new Date().toISOString();
  const updates = [];
  const params = [];
  const fields = ['name', 'role', 'systemPrompt', 'modelOverride', 'temperature', 'maxTokens', 'allowedEntities', 'folderIds', 'sortOrder'];
  for (const f of fields) {
    if (payload[f] !== undefined) {
      if (f === 'allowedEntities' || f === 'folderIds') {
        updates.push(`${f} = ?`);
        params.push(Array.isArray(payload[f]) ? JSON.stringify(payload[f]) : payload[f]);
      } else {
        updates.push(`${f} = ?`);
        params.push(payload[f]);
      }
    }
  }
  if (updates.length === 0) return existing;
  updates.push('updatedAt = ?');
  params.push(now, id, orgId);
  await db.run(
    `UPDATE copilot_agents SET ${updates.join(', ')} WHERE id = ? AND organizationId = ?`,
    params
  );
  return get(db, id, orgId);
}

async function remove(db, id, orgId) {
  const existing = await get(db, id, orgId);
  if (!existing) return false;
  if (existing.isSystem) {
    throw new Error('System agents cannot be deleted');
  }
  await db.run('DELETE FROM copilot_agents WHERE id = ? AND organizationId = ?', [id, orgId]);
  return true;
}

async function seedDefaults(db, orgId) {
  const now = new Date().toISOString();
  const roles = [
    { role: 'orchestrator', name: 'Orquestador', isSystem: 1 },
    { role: 'analyst', name: 'Analista de Datos', isSystem: 0 },
    { role: 'specialist', name: 'Especialista de Dominio', isSystem: 0 },
    { role: 'synthesis', name: 'Síntesis', isSystem: 1 }
  ];
  for (let i = 0; i < roles.length; i++) {
    const id = `system_${roles[i].role}_${orgId.slice(0, 12).replace(/[-]/g, '')}`;
    const existing = await db.get('SELECT id FROM copilot_agents WHERE id = ?', [id]);
    if (!existing) {
      await db.run(
        `INSERT INTO copilot_agents (id, organizationId, name, role, systemPrompt, modelOverride, temperature, maxTokens, isSystem, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, NULL, NULL, 0.3, 1500, ?, ?, ?, ?)`,
        [id, orgId, roles[i].name, roles[i].role, roles[i].isSystem, i, now, now]
      );
    }
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  seedDefaults
};
