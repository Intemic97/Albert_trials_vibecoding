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
 * @param {Object} params - { userMessage, chatId, conversationHistory, instructions, allowedEntities, mentionedEntities }
 * @returns { answer, explanation, entitiesUsed, agentConversation }
 */
async function process(db, params) {
  const { userMessage, chatId, conversationHistory = [], instructions, allowedEntities, mentionedEntities } = params;
  const orgId = params.orgId;

  const agents = await agentService.list(db, orgId);
  const orchestrator = agents.find(a => a.role === 'orchestrator');
  const analyst = agents.find(a => a.role === 'analyst');
  const specialist = agents.find(a => a.role === 'specialist');
  const synthesisAgent = agents.find(a => a.role === 'synthesis');

  if (!orchestrator || !synthesisAgent) {
    throw new Error('Missing required agents (orchestrator, synthesis). Run seedDefaults.');
  }

  const effectiveEntities = mergeEntities(allowedEntities, mentionedEntities);
  const databaseContext = await buildDatabaseContext(db, orgId, effectiveEntities);

  const agentList = agents.map(a => a.role).filter((v, i, arr) => arr.indexOf(v) === i);
  const orchContext = {
    agentList,
    conversationHistory: [...conversationHistory, { role: 'user', content: userMessage }],
    userMessage
  };
  const orchPrompt = buildPrompt(orchestrator, orchContext);
  const orchResult = await callLLM(orchestrator, [
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

  if (analyst && agentsToInvoke.includes('analyst')) {
    const q = queries.analyst || userMessage;
    const ctx = { databaseContext };
    const folderIds = analyst.folderIds && analyst.folderIds.length ? analyst.folderIds : [];
    ctx.knowledgeContext = await buildKnowledgeContext(db, orgId, folderIds);
    const prompt = buildPrompt(analyst, ctx);
    const result = await callLLM(analyst, [
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

  if (specialist && agentsToInvoke.includes('specialist')) {
    let specialistQuery = queries.specialist || userMessage;
    if (agentResults.analyst) {
      specialistQuery += `\n\nData from analyst: ${JSON.stringify(agentResults.analyst)}`;
    }
    const ctx = { chatInstructions: instructions, agentResults: agentResults.analyst ? { analyst: agentResults.analyst } : {} };
    const folderIds = specialist.folderIds && specialist.folderIds.length ? specialist.folderIds : [];
    ctx.knowledgeContext = await buildKnowledgeContext(db, orgId, folderIds);
    const prompt = buildPrompt(specialist, ctx);
    const result = await callLLM(specialist, [
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

  const synCtx = { agentResults, userMessage };
  const synPrompt = buildPrompt(synthesisAgent, synCtx);
  const synResult = await callLLM(synthesisAgent, [
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

async function callLLM(agent, messages, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API Key not configured');
  const openai = new OpenAI({ apiKey });
  const model = agent.modelOverride || (agent.role === 'orchestrator' || agent.role === 'synthesis' ? 'gpt-4o' : 'gpt-4o-mini');
  const body = {
    model,
    messages,
    temperature: agent.temperature ?? 0.3,
    max_tokens: agent.maxTokens ?? 1500
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
