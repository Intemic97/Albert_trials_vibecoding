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
 * @param {Object} params - { agentId, userMessage, chatId, conversationHistory, instructions, allowedEntities, mentionedEntities, userId, userEmail }
 * @returns { answer, explanation, entitiesUsed, agentConversation }
 */
async function process(db, params) {
  const { agentId, userMessage, chatId, conversationHistory = [], instructions, allowedEntities, mentionedEntities, useChatMemory, userId, userEmail } = params;
  const orgId = params.orgId;
  const locale = params.locale === 'en' ? 'en' : 'es';
  const languageInstruction = locale === 'en'
    ? 'Always answer in English unless the user explicitly asks for another language.'
    : 'Responde siempre en español salvo que el usuario pida explícitamente otro idioma.';

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

  // Load agent's persistent memory (only if agent has memory enabled and chat uses it)
  const shouldUseMemory = (agent.memoryEnabled !== false) && (useChatMemory !== false);
  let agentMemory = [];
  if (shouldUseMemory) {
    try {
      agentMemory = await agentService.getMemory(db, agentId, 20);
    } catch (_) {}
  }

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
  const orchPrompt = `${buildPrompt(orchAgentConfig, orchContext)}\n\n${languageInstruction}`;
  const memoryMessages = agentMemory.map(m => ({ role: m.role, content: m.content }));
  const orchRes = await callLLM(orchAgentConfig, [
    { role: 'system', content: orchPrompt },
    ...memoryMessages.slice(-6),
    ...conversationHistory.slice(-4).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: userMessage }
  ], { responseFormat: true });
  const orchResult = orchRes.content;
  await logAIUsage(db, { organizationId: orgId, userId, userEmail, chatId, agentId, agentRole: 'orchestrator', model: 'gpt-4o', tokensInput: orchRes.usage?.prompt_tokens, tokensOutput: orchRes.usage?.completion_tokens, tokensTotal: orchRes.usage?.total_tokens, durationMs: orchRes.durationMs, promptLength: orchPrompt?.length, responseLength: orchResult?.length });

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
    const prompt = `${buildPrompt(analystConfig, ctx)}\n\n${languageInstruction}`;
    const analystRes = await callLLM(analystConfig, [
      { role: 'system', content: prompt },
      { role: 'user', content: q }
    ], { responseFormat: true });
    const result = analystRes.content;
    await logAIUsage(db, { organizationId: orgId, userId, userEmail, chatId, agentId, agentRole: 'analyst', model: 'gpt-4o-mini', tokensInput: analystRes.usage?.prompt_tokens, tokensOutput: analystRes.usage?.completion_tokens, tokensTotal: analystRes.usage?.total_tokens, durationMs: analystRes.durationMs });
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
    const prompt = `${buildPrompt(specialistConfig, ctx)}\n\n${languageInstruction}`;
    const specRes = await callLLM(specialistConfig, [
      { role: 'system', content: prompt },
      { role: 'user', content: specialistQuery }
    ], { responseFormat: true });
    const result = specRes.content;
    await logAIUsage(db, { organizationId: orgId, userId, userEmail, chatId, agentId, agentRole: 'specialist', model: 'gpt-4o-mini', tokensInput: specRes.usage?.prompt_tokens, tokensOutput: specRes.usage?.completion_tokens, tokensTotal: specRes.usage?.total_tokens, durationMs: specRes.durationMs });
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
  const synPrompt = `${buildPrompt(synthesisConfig, synCtx)}\n\n${languageInstruction}`;
  const synRes = await callLLM(synthesisConfig, [
    { role: 'system', content: synPrompt },
    { role: 'user', content: `User asked: ${userMessage}\n\nCombine the agent outputs above into one coherent response.` }
  ], { responseFormat: true });
  const synResult = synRes.content;
  await logAIUsage(db, { organizationId: orgId, userId, userEmail, chatId, agentId, agentRole: 'synthesis', model: 'gpt-4o', tokensInput: synRes.usage?.prompt_tokens, tokensOutput: synRes.usage?.completion_tokens, tokensTotal: synRes.usage?.total_tokens, durationMs: synRes.durationMs });

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

  // Persist this interaction to agent's memory (only if agent has memory enabled)
  if (agent.memoryEnabled !== false) {
    try {
      await agentService.addMemory(db, agentId, orgId, 'user', userMessage, 'chat', { chatId });
      await agentService.addMemory(db, agentId, orgId, 'assistant', finalParsed.answer || synResult, 'chat', { chatId });
    } catch (_) {}
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
  const start = Date.now();
  const completion = await openai.chat.completions.create(body);
  const durationMs = Date.now() - start;
  const content = completion.choices[0]?.message?.content || '';
  const usage = completion.usage || {};
  return { content, usage: { prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0, total_tokens: usage.total_tokens || 0 }, durationMs };
}

async function logAIUsage(db, opts) {
  const id = generateId();
  const { organizationId, userId, userEmail, chatId, agentId, agentRole, model, tokensInput, tokensOutput, tokensTotal, durationMs, promptLength, responseLength } = opts;
  try {
    await db.run(
      `INSERT INTO ai_audit_logs (id, organizationId, userId, userEmail, chatId, agentId, agentRole, model, tokensInput, tokensOutput, tokensTotal, durationMs, promptLength, responseLength, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, organizationId, userId || null, userEmail || null, chatId || null, agentId || null, agentRole || 'unknown', model || 'unknown',
        tokensInput || 0, tokensOutput || 0, tokensTotal || 0, durationMs || null, promptLength || null, responseLength || null, new Date().toISOString()]
    );
  } catch (err) {
    console.error('[agentOrchestrator] AI audit log error:', err.message);
  }
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
