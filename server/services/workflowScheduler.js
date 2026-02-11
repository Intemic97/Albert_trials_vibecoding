/**
 * Workflow Scheduler - Runs workflows on a schedule (every X minutes/hours/days)
 *
 * Polls workflow_schedules table every minute and triggers execution for due workflows.
 * Supports interval-based scheduling (e.g. every 5 minutes, every 1 hour).
 */

const { openDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Parse interval string like "5m", "1h", "1d" to milliseconds
function parseIntervalMs(intervalStr) {
  if (!intervalStr || typeof intervalStr !== 'string') return null;
  const match = intervalStr.match(/^(\d+)(m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (value <= 0) return null;
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

let schedulerIntervalId = null;
let executeWorkflowFn = null;

/**
 * Execute a workflow (injected to avoid circular deps)
 */
function setExecuteWorkflow(fn) {
  executeWorkflowFn = fn;
}

/**
 * Sync workflow schedules from workflow data when workflow is saved
 * Call this from PUT /api/workflows/:id
 */
async function syncWorkflowSchedule(db, workflowId, organizationId, data) {
  const nodes = data?.nodes || [];
  const scheduleTrigger = nodes.find(
    (n) =>
      n.type === 'trigger' &&
      (n.label === 'Schedule' || (n.label && n.label.startsWith('Schedule:')) || n.config?.scheduleInterval)
  );

  if (!scheduleTrigger?.config) {
    await db.run('DELETE FROM workflow_schedules WHERE workflowId = ?', [workflowId]);
    return;
  }

  const config = scheduleTrigger.config;
  if (!config.scheduleEnabled) {
    await db.run('DELETE FROM workflow_schedules WHERE workflowId = ?', [workflowId]);
    return;
  }

  let intervalMs = null;
  if (config.scheduleType === 'interval' && config.scheduleInterval) {
    intervalMs = parseIntervalMs(config.scheduleInterval);
  } else if (config.scheduleType === 'interval' && config.scheduleIntervalValue && config.scheduleIntervalUnit) {
    const v = parseInt(config.scheduleIntervalValue, 10) || 5;
    const u = (config.scheduleIntervalUnit || 'm').charAt(0).toLowerCase();
    intervalMs = parseIntervalMs(`${v}${u}`);
  }

  if (!intervalMs || intervalMs < 60000) return; // Minimum 1 minute

  const now = new Date().toISOString();
  const existing = await db.get('SELECT id FROM workflow_schedules WHERE workflowId = ?', [workflowId]);
  if (existing) {
    await db.run(
      'UPDATE workflow_schedules SET intervalMs = ?, lastRunAt = COALESCE(lastRunAt, ?), updatedAt = ? WHERE workflowId = ?',
      [intervalMs, now, now, workflowId]
    );
  } else {
    await db.run(
      'INSERT INTO workflow_schedules (id, workflowId, organizationId, intervalMs, lastRunAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), workflowId, organizationId, intervalMs, null, now, now]
    );
  }
}

/**
 * Process due schedules and trigger workflow execution
 */
async function processSchedules() {
  if (!executeWorkflowFn) return;

  let db;
  try {
    db = await openDb();
    const schedules = await db.all(
      'SELECT * FROM workflow_schedules WHERE enabled = 1 AND intervalMs > 0'
    );
    const now = Date.now();

    for (const s of schedules) {
      const lastRun = s.lastRunAt ? new Date(s.lastRunAt).getTime() : 0;
      const nextRun = lastRun + s.intervalMs;
      if (now >= nextRun) {
        try {
          console.log(`[WorkflowScheduler] Triggering workflow ${s.workflowId} (interval: ${s.intervalMs}ms)`);
          await executeWorkflowFn(s.workflowId, {}, s.organizationId);
          await db.run(
            'UPDATE workflow_schedules SET lastRunAt = ? WHERE workflowId = ?',
            [new Date().toISOString(), s.workflowId]
          );
        } catch (err) {
          console.error(`[WorkflowScheduler] Error executing workflow ${s.workflowId}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[WorkflowScheduler] Error processing schedules:', err);
  }
}

/**
 * Start the scheduler (runs every 60 seconds)
 */
function start(executeFn) {
  if (schedulerIntervalId) return;
  setExecuteWorkflow(executeFn);
  processSchedules(); // Run immediately once
  schedulerIntervalId = setInterval(processSchedules, 60000); // Every minute
  console.log('[WorkflowScheduler] Started (polling every 60s)');
}

/**
 * Stop the scheduler
 */
function stop() {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
    console.log('[WorkflowScheduler] Stopped');
  }
}

module.exports = {
  start,
  stop,
  syncWorkflowSchedule,
  parseIntervalMs
};
