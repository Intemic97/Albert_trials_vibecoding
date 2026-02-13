/**
 * Agent Service - CRUD for copilot agents (refactored: agents are top-level containers)
 * Each agent represents a workspace/team (ej. "Asistente Producción", "Agente Finanzas")
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
    icon: row.icon || 'Robot',
    memoryEnabled: row.memoryEnabled === undefined || row.memoryEnabled === 1 || row.memoryEnabled === true,
    toolsEnabled: row.toolsEnabled ? safeParse(row.toolsEnabled, []) : [],
    allowedWorkflowIds: row.allowedWorkflowIds ? safeParse(row.allowedWorkflowIds, []) : []
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
  const roleVal = 'agent';
  const baseCols = 'id, organizationId, name, description, icon, instructions, allowedEntities, folderIds, orchestratorPrompt, analystPrompt, specialistPrompt, synthesisPrompt, sortOrder, createdAt, updatedAt, createdBy, createdByName';
  const baseValues = [
    id, orgId, payload.name || 'Nuevo Agente', payload.description ?? null, payload.icon || '🤖',
    payload.instructions ?? null, payload.allowedEntities ? JSON.stringify(payload.allowedEntities) : null,
    payload.folderIds ? JSON.stringify(payload.folderIds) : null, payload.orchestratorPrompt ?? null,
    payload.analystPrompt ?? null, payload.specialistPrompt ?? null, payload.synthesisPrompt ?? null,
    payload.sortOrder ?? 0, now, now, payload.createdBy ?? null, payload.createdByName ?? null
  ];
  try {
    await db.run(
      `INSERT INTO copilot_agents (${baseCols}, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...baseValues, roleVal]
    );
  } catch (err) {
    if (err.message && err.message.includes('no such column')) {
      // Fallback: try without createdBy/createdByName/role
      const fallbackCols = 'id, organizationId, name, description, icon, instructions, allowedEntities, folderIds, orchestratorPrompt, analystPrompt, specialistPrompt, synthesisPrompt, sortOrder, createdAt, updatedAt';
      const fallbackValues = baseValues.slice(0, 15);
      await db.run(`INSERT INTO copilot_agents (${fallbackCols}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, fallbackValues);
    } else {
      throw err;
    }
  }
  return get(db, id, orgId);
}

async function update(db, id, orgId, payload) {
  const existing = await get(db, id, orgId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updates = [];
  const params = [];
  const fields = ['name', 'description', 'icon', 'instructions', 'allowedEntities', 'folderIds', 'orchestratorPrompt', 'analystPrompt', 'specialistPrompt', 'synthesisPrompt', 'sortOrder', 'allowedWorkflowIds', 'toolsEnabled', 'memoryEnabled'];
  for (const f of fields) {
    if (payload[f] !== undefined) {
      if (f === 'allowedEntities' || f === 'folderIds' || f === 'allowedWorkflowIds' || f === 'toolsEnabled') {
        updates.push(`${f} = ?`);
        params.push(Array.isArray(payload[f]) ? JSON.stringify(payload[f]) : payload[f]);
      } else if (f === 'memoryEnabled') {
        updates.push(`${f} = ?`);
        params.push(payload[f] === true || payload[f] === 1 ? 1 : 0);
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
    icon: 'Robot',
    instructions: 'Ayuda al usuario a navegar sus entidades, encontrar records y responder preguntas sobre sus datos.'
  };
  const existing = await db.get('SELECT id FROM copilot_agents WHERE id = ?', [defaultAgent.id]);
  if (!existing) {
    await create(db, orgId, defaultAgent);
  }
}

// ==================== AGENT MEMORY ====================

/**
 * Add a memory entry for an agent
 * @param {string} source - 'chat' | 'workflow' | 'system'
 */
async function addMemory(db, agentId, orgId, role, content, source = 'chat', metadata = null) {
  const id = `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  await db.run(
    `INSERT INTO agent_memory (id, agentId, organizationId, role, content, source, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, agentId, orgId, role, content, source, metadata ? JSON.stringify(metadata) : null, new Date().toISOString()]
  );
  return id;
}

/**
 * Get recent memory for an agent (across all chats/executions)
 * @param {number} limit - max messages to return (default 20)
 */
async function getMemory(db, agentId, limit = 20) {
  const rows = await db.all(
    'SELECT role, content, source, metadata, createdAt FROM agent_memory WHERE agentId = ? ORDER BY createdAt DESC LIMIT ?',
    [agentId, limit]
  );
  return rows.reverse().map(r => ({
    role: r.role,
    content: r.content,
    source: r.source,
    metadata: r.metadata ? safeParse(r.metadata, null) : null,
    createdAt: r.createdAt
  }));
}

/**
 * Clear all memory for an agent
 */
async function clearMemory(db, agentId) {
  await db.run('DELETE FROM agent_memory WHERE agentId = ?', [agentId]);
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  seedDefaults,
  addMemory,
  getMemory,
  clearMemory
};
