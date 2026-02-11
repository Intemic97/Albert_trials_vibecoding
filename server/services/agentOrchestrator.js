/**
 * Agent Orchestrator - Multi-agent copilot coordination
 * process() -> decideAgents -> invokeAgent(s) -> synthesize -> persist
 */

const OpenAI = require('openai');
const { buildPrompt, buildDatabaseContext, buildKnowledgeContext } = require('./agentPromptBuilder');
const agentService = require('./agentService');

const crypto = require('crypto');
function generateId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Main entry: process user message through multi-agent pipeline
 * @param {Object} db - database instance
 * @param {Object} params - { agentId, userMessage, chatId, conversationHistory, instructions, allowedEntities, mentionedEntities }
 * @returns { answer, explanation, entitiesUsed, agentConversation }
 */
async function process(db, params) {
  const { agentId, userMessage, chatId, conversationHistory = [], instructions, allowedEntities, mentionedEntities } = params;
  const orgId = params.orgId;

  if (!agentId) {
    throw new Error('agentId is required');
  }

  const agent = await agentService.get(db, agentId, orgId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  // Agent has orchestratorPrompt, analystPrompt, specialistPrompt, synthesisPrompt
  // If not configured, use defaults from ROLE_BASES

  const effectiveEntities = mergeEntities(agent.allowedEntities || allowedEntities, mentionedEntities);
  const databaseContext = await buildDatabaseContext(db, orgId, effectiveEntities);

  // Build orchestrator prompt using agent's config
  const orchAgentConfig = {
    role: 'orchestrator',
    systemPrompt: agent.orchestratorPrompt,
    temperature: 0.3,
    maxTokens: 1500
  };
  const orchContext = {
    agentList: ['analyst', 'specialist', 'synthesis'],
    conversationHistory: [...conversationHistory, { role: 'user', content: userMessage }],
    userMessage
  };
  const orchPrompt = buildPrompt(orchAgentConfig, orchContext);
  const orchResult = await callLLM(orchAgentConfig, [
    { role: 'system', content: orchPrompt },
    ...conversationHistory.slice(-4).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: userMessage }
  ], { responseFormat: true });

  let plan;
  try {
    plan = JSON.parse(orchResult);
  } catch (_) {
    plan = { agentsToInvoke: ['analyst', 'specialist'], queries: { analyst: userMessage, specialist: userMessage } };
  }
  const agentsToInvoke = plan.agentsToInvoke || ['analyst'];
  const queries = plan.queries || { analyst: userMessage, specialist: userMessage };

  const agentConversation = [];
  const agentResults = {};

  if (agentsToInvoke.includes('analyst')) {
    const q = queries.analyst || userMessage;
    const analystConfig = {
      role: 'analyst',
      systemPrompt: agent.analystPrompt,
      temperature: 0.3,
      maxTokens: 1500
    };
    const ctx = { databaseContext };
    const folderIds = agent.folderIds && agent.folderIds.length ? agent.folderIds : [];
    ctx.knowledgeContext = await buildKnowledgeContext(db, orgId, folderIds);
    const prompt = buildPrompt(analystConfig, ctx);
    const result = await callLLM(analystConfig, [
      { role: 'system', content: prompt },
      { role: 'user', content: q }
    ], { responseFormat: true });
    agentConversation.push({ fromAgent: 'orchestrator', toAgent: 'analyst', type: 'query', content: q });
    let parsed = result;
    try {
      parsed = JSON.parse(result);
    } catch (_) {}
    agentResults.analyst = parsed;
    agentConversation.push({ fromAgent: 'analyst', toAgent: 'orchestrator', type: 'response', content: typeof parsed === 'string' ? parsed : JSON.stringify(parsed) });
  }

  if (agentsToInvoke.includes('specialist')) {
    let specialistQuery = queries.specialist || userMessage;
    if (agentResults.analyst) {
      specialistQuery += `\n\nData from analyst: ${JSON.stringify(agentResults.analyst)}`;
    }
    const specialistConfig = {
      role: 'specialist',
      systemPrompt: agent.specialistPrompt,
      temperature: 0.3,
      maxTokens: 1500
    };
    const ctx = { chatInstructions: agent.instructions || instructions, agentResults: agentResults.analyst ? { analyst: agentResults.analyst } : {} };
    const folderIds = agent.folderIds && agent.folderIds.length ? agent.folderIds : [];
    ctx.knowledgeContext = await buildKnowledgeContext(db, orgId, folderIds);
    const prompt = buildPrompt(specialistConfig, ctx);
    const result = await callLLM(specialistConfig, [
      { role: 'system', content: prompt },
      { role: 'user', content: specialistQuery }
    ], { responseFormat: true });
    agentConversation.push({ fromAgent: 'orchestrator', toAgent: 'specialist', type: 'query', content: queries.specialist || userMessage });
    let parsed = result;
    try {
      parsed = JSON.parse(result);
    } catch (_) {}
    agentResults.specialist = parsed;
    agentConversation.push({ fromAgent: 'specialist', toAgent: 'orchestrator', type: 'response', content: typeof parsed === 'string' ? parsed : JSON.stringify(parsed) });
  }

  const synthesisConfig = {
    role: 'synthesis',
    systemPrompt: agent.synthesisPrompt,
    temperature: 0.3,
    maxTokens: 1500
  };
  const synCtx = { agentResults, userMessage };
  const synPrompt = buildPrompt(synthesisConfig, synCtx);
  const synResult = await callLLM(synthesisConfig, [
    { role: 'system', content: synPrompt },
    { role: 'user', content: `User asked: ${userMessage}\n\nCombine the agent outputs above into one coherent response.` }
  ], { responseFormat: true });

  let finalParsed;
  try {
    finalParsed = JSON.parse(synResult);
  } catch (_) {
    finalParsed = { answer: synResult, explanation: '', entitiesUsed: [] };
  }

  const turnIndex = 0;
  if (chatId) {
    await persistAgentConversation(db, chatId, turnIndex, agentConversation);
  }

  return {
    answer: finalParsed.answer || synResult,
    explanation: finalParsed.explanation || 'Response synthesized from multiple agents.',
    entitiesUsed: finalParsed.entitiesUsed || (agentResults.analyst && agentResults.analyst.entitiesUsed) || [],
    agentConversation
  };
}

function mergeEntities(allowed, mentioned) {
  if (mentioned && Array.isArray(mentioned) && mentioned.length > 0) {
    if (allowed && Array.isArray(allowed) && allowed.length > 0) {
      return [...new Set([...allowed, ...mentioned])];
    }
    return mentioned;
  }
  return allowed;
}

async function callLLM(agentConfig, messages, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API Key not configured');
  const openai = new OpenAI({ apiKey });
  const model = agentConfig.role === 'orchestrator' || agentConfig.role === 'synthesis' ? 'gpt-4o' : 'gpt-4o-mini';
  const body = {
    model,
    messages,
    temperature: agentConfig.temperature ?? 0.3,
    max_tokens: agentConfig.maxTokens ?? 1500
  };
  if (opts.responseFormat) {
    body.response_format = { type: 'json_object' };
  }
  const completion = await openai.chat.completions.create(body);
  return completion.choices[0]?.message?.content || '';
}

async function persistAgentConversation(db, chatId, turnIndex, messages) {
  for (const m of messages) {
    await db.run(
      `INSERT INTO agent_conversations (id, chatId, turnIndex, fromAgent, toAgent, type, content, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), chatId, turnIndex, m.fromAgent, m.toAgent, m.type || 'message', m.content, new Date().toISOString()]
    );
  }
}

module.exports = { process };
