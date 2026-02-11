/**
 * Agent Prompt Builder - Constructs system prompts for multi-agent copilot roles
 * Base prompts + editable agent config + injected context (DB, KB, conversation)
 */

const ROLE_BASES = {
  orchestrator: `You are the orchestrator of a multi-agent system. Your job is to:
1. Analyze the user's question and determine which specialist agents to invoke
2. Decide the order and dependencies (e.g. Analyst first, then Specialist with that data)
3. Output a JSON plan: { "agentsToInvoke": ["analyst", "specialist"], "queries": { "analyst": "...", "specialist": "..." } }

Available agent roles: analyst (queries entities/records), specialist (domain expertise, strategy, recommendations), synthesis (combines outputs).
- Use analyst when the question needs data lookup, counts, lists, entity relationships
- Use specialist when the question needs business strategy, best practices, recommendations
- Use both when you need data AND expert interpretation
- Use only specialist for conceptual questions without data`,

  analyst: `You are a data analyst agent. You have access to the user's database entities and records.
Your job: Answer data-focused questions precisely. Query entities, count records, find relationships.
Respond in valid JSON: { "answer": "conversational summary", "explanation": "how you analyzed", "entitiesUsed": ["Entity1"], "data": {} }
Be concise. Mention entity names when referencing data.`,

  specialist: `You are a domain specialist agent. You provide expertise, strategy, and recommendations.
Your job: Interpret business context, suggest best practices, recommend actions.
Use any context provided (data from other agents, knowledge base snippets) to inform your response.
Respond in valid JSON: { "answer": "your expert response", "explanation": "brief reasoning", "recommendations": [] }
Be practical and actionable.`,

  synthesis: `You are the synthesis agent. You combine outputs from other agents into one coherent response for the user.
Your job: Merge analyst data + specialist recommendations into a single, natural answer.
Do not repeat raw data - integrate it narratively. Be conversational and helpful.
Respond in valid JSON: { "answer": "final unified response", "entitiesUsed": [], "explanation": "brief" }`,

  memory: `You are the memory agent. You store and recall user preferences, patterns, and context from past conversations.
Your job: When asked to remember something, store it. When relevant, recall previous context.
Keep summaries concise. Respond in JSON: { "answer": "...", "stored": boolean, "recalled": [] }`
};

/**
 * Build database context (entities, properties, records) for analyst
 * Reuses logic from /api/database/ask
 */
async function buildDatabaseContext(db, orgId, entityIds = null) {
  let entitiesQuery = 'SELECT * FROM entities WHERE organizationId = ?';
  const entitiesParams = [orgId];
  if (entityIds && Array.isArray(entityIds) && entityIds.length > 0) {
    const placeholders = entityIds.map(() => '?').join(',');
    entitiesQuery += ` AND id IN (${placeholders})`;
    entitiesParams.push(...entityIds);
  }
  const entities = await db.all(entitiesQuery, entitiesParams);
  const databaseContext = {};

  for (const entity of entities) {
    const properties = await db.all('SELECT * FROM properties WHERE entityId = ?', [entity.id]);
    const records = await db.all('SELECT * FROM records WHERE entityId = ?', [entity.id]);
    const recordsWithValues = await Promise.all(records.map(async (record) => {
      const values = await db.all('SELECT * FROM record_values WHERE recordId = ?', [record.id]);
      const valuesMap = {};
      for (const v of values) {
        const prop = properties.find(p => p.id === v.propertyId);
        const key = prop ? prop.name : v.propertyId;
        if (prop && prop.type === 'relation' && prop.relatedEntityId && v.value) {
          try {
            const ids = JSON.parse(v.value);
            if (Array.isArray(ids) && ids.length > 0) {
              const relatedEntity = entities.find(e => e.id === prop.relatedEntityId);
              if (relatedEntity) {
                const relatedProps = await db.all('SELECT * FROM properties WHERE entityId = ?', [prop.relatedEntityId]);
                const names = [];
                for (const id of ids) {
                  const relatedValues = await db.all('SELECT * FROM record_values WHERE recordId = ?', [id]);
                  const nameProp = relatedProps.find(p => (p.name || '').toLowerCase() === 'name' || (p.name || '').toLowerCase() === 'title');
                  if (nameProp) {
                    const nameVal = relatedValues.find(rv => rv.propertyId === nameProp.id);
                    if (nameVal) names.push(nameVal.value);
                  }
                }
                valuesMap[key] = names.length > 0 ? names.join(', ') : v.value;
              } else {
                valuesMap[key] = v.value;
              }
            } else {
              valuesMap[key] = v.value;
            }
          } catch {
            valuesMap[key] = v.value;
          }
        } else {
          valuesMap[key] = v.value;
        }
      }
      return valuesMap;
    }));

    databaseContext[entity.name] = {
      description: entity.description,
      properties: properties.map(p => ({
        name: p.name,
        type: p.type,
        relatedTo: p.relatedEntityId ? entities.find(e => e.id === p.relatedEntityId)?.name : null
      })),
      recordCount: records.length,
      records: recordsWithValues.slice(0, 50)
    };
  }
  return databaseContext;
}

/**
 * Build knowledge context from folders (documents extractedText)
 */
async function buildKnowledgeContext(db, orgId, folderIds = []) {
  if (!folderIds || folderIds.length === 0) return '';
  const folders = await db.all(
    'SELECT * FROM knowledge_folders WHERE id IN (' + folderIds.map(() => '?').join(',') + ') AND organizationId = ?',
    [...folderIds, orgId]
  );
  const docIds = new Set();
  for (const f of folders) {
    try {
      const ids = f.documentIds ? JSON.parse(f.documentIds) : [];
      ids.forEach(id => docIds.add(id));
    } catch (_) {}
  }
  if (docIds.size === 0) return '';
  const docs = await db.all(
    'SELECT id, name, extractedText FROM knowledge_documents WHERE id IN (' + [...docIds].map(() => '?').join(',') + ') AND organizationId = ?',
    [...docIds, orgId]
  );
  return docs
    .filter(d => d.extractedText && d.extractedText.length > 0)
    .map(d => `[Document: ${d.name}]\n${d.extractedText.slice(0, 4000)}`)
    .join('\n\n---\n\n');
}

/**
 * Build full system prompt for an agent
 * @param {Object} agent - { role, systemPrompt, ... }
 * @param {Object} context - { databaseContext?, knowledgeContext?, conversationHistory?, agentResults?, chatInstructions?, userMessage }
 */
function buildPrompt(agent, context = {}) {
  const base = ROLE_BASES[agent.role] || ROLE_BASES.analyst;
  const editable = (agent.systemPrompt || '').trim();
  let injected = '';

  if (agent.role === 'analyst' && context.databaseContext) {
    injected += `\nDATABASE SCHEMA AND DATA:\n${JSON.stringify(context.databaseContext, null, 2)}\n`;
  }
  if ((agent.role === 'specialist' || agent.role === 'analyst') && context.knowledgeContext) {
    injected += `\nKNOWLEDGE BASE:\n${context.knowledgeContext}\n`;
  }
  if (agent.role === 'specialist' && context.chatInstructions) {
    injected += `\nCUSTOM INSTRUCTIONS:\n${context.chatInstructions}\n`;
  }
  if (agent.role === 'orchestrator' && context.agentList) {
    injected += `\nAvailable agents: ${context.agentList.join(', ')}\n`;
  }
  if (agent.role === 'synthesis' && context.agentResults) {
    injected += `\nAGENT OUTPUTS TO COMBINE:\n${JSON.stringify(context.agentResults, null, 2)}\n`;
  }
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    injected += `\nRECENT CONVERSATION:\n${context.conversationHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}\n`;
  }

  return `${base}\n\n${editable ? editable + '\n\n---\n' : ''}${injected}`;
}

module.exports = {
  ROLE_BASES,
  buildDatabaseContext,
  buildKnowledgeContext,
  buildPrompt
};
