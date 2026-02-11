/**
 * Agent Service - CRUD for copilot agents (refactored: agents are top-level containers)
 * Each agent represents a workspace/team (ej. "Agente Repsol", "Agente Finanzas")
 * with its own configured roles (orchestrator, analyst, specialist, synthesis prompts)
 */

const crypto = require('crypto');

function generateId() {
  return `agent_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

async function list(db, orgId) {
  const agents = await db.all(
    'SELECT * FROM copilot_agents WHERE organizationId = ? ORDER BY sortOrder ASC, name ASC',
    [orgId]
  );
  const parsed = agents.map(parseAgent);
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
    icon: row.icon || '🤖'
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
    `INSERT INTO copilot_agents (id, organizationId, name, description, icon, instructions, allowedEntities, folderIds, orchestratorPrompt, analystPrompt, specialistPrompt, synthesisPrompt, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId,
      payload.name || 'Nuevo Agente',
      payload.description || null,
      payload.icon || '🤖',
      payload.instructions || null,
      payload.allowedEntities ? JSON.stringify(payload.allowedEntities) : null,
      payload.folderIds ? JSON.stringify(payload.folderIds) : null,
      payload.orchestratorPrompt || null,
      payload.analystPrompt || null,
      payload.specialistPrompt || null,
      payload.synthesisPrompt || null,
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
  const now = new Date().toISOString();
  const updates = [];
  const params = [];
  const fields = ['name', 'description', 'icon', 'instructions', 'allowedEntities', 'folderIds', 'orchestratorPrompt', 'analystPrompt', 'specialistPrompt', 'synthesisPrompt', 'sortOrder'];
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
  // Delete all chats belonging to this agent
  await db.run('DELETE FROM copilot_chats WHERE agentId = ?', [id]);
  await db.run('DELETE FROM copilot_agents WHERE id = ? AND organizationId = ?', [id, orgId]);
  return true;
}

async function seedDefaults(db, orgId) {
  const now = new Date().toISOString();
  const defaultAgent = {
    id: `agent_default_${orgId.slice(0, 12).replace(/[-]/g, '')}`,
    name: 'Asistente General',
    description: 'Tu copiloto para consultas generales sobre entidades y datos',
    icon: '💬',
    instructions: 'Ayuda al usuario a navegar sus entidades, encontrar records y responder preguntas sobre sus datos.'
  };
  const existing = await db.get('SELECT id FROM copilot_agents WHERE id = ?', [defaultAgent.id]);
  if (!existing) {
    await create(db, orgId, defaultAgent);
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
