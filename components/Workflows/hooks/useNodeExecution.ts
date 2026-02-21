/**
 * useNodeExecution hook
 * Extracted from Workflows.tsx — contains all node execution logic:
 *   executeNode, executeJoinInput, handleRunNode, runWorkflow
 */

import { useCallback, useRef } from 'react';
import { API_BASE } from '../../../config';
import type { WorkflowNode, Connection } from '../types';

// ---- Dependency interface ----
export interface NodeExecutionDeps {
  /** Current nodes snapshot (from React state) */
  nodes: WorkflowNode[];
  /** Current connections snapshot */
  connections: Connection[];
  /** Entity definitions */
  entities: any[];
  /** React setState for nodes */
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  /** React setState for connections */
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  /** Update a node and broadcast via WebSocket */
  updateNodeAndBroadcast: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  /** Show toast notification */
  showToast: (message: string, type: 'success' | 'error') => void;
  /** Is the workflow currently running? */
  isRunning: boolean;
  /** Set running flag */
  setIsRunning: (v: boolean) => void;
  /** Current workflow ID */
  currentWorkflowId: string | null;
  /** Current workflow name */
  workflowName: string;
  /** Save workflow before execution */
  saveWorkflow: () => Promise<void>;
  /** Set waiting approval node id (for human-in-the-loop) */
  setWaitingApprovalNodeId: (id: string | null) => void;
  /** Set pending approval data (for human-in-the-loop) */
  setPendingApprovalData: (data: { inputData: any; resolve: () => void } | null) => void;
  /** The version number currently active on the canvas (null = Draft) */
  activeVersionNumber?: number | null;
}

// ---- Return type ----
export interface NodeExecutionReturn {
  executeNode: (nodeId: string, inputData?: any, recursive?: boolean) => Promise<void>;
  executeJoinInput: (nodeId: string, inputData: any, inputPort: 'A' | 'B') => Promise<void>;
  handleRunNode: (nodeId: string) => Promise<void>;
  runWorkflow: () => Promise<void>;
}

/**
 * Custom hook that encapsulates all node execution logic.
 * It reads dependencies from the latest values via a ref to avoid stale closures.
 */
export function useNodeExecution(deps: NodeExecutionDeps): NodeExecutionReturn {
  // Keep a ref to always have the latest deps inside async functions
  const depsRef = useRef(deps);
  depsRef.current = deps;

  // ---- executeNode ----
  const executeNode = useCallback(async (nodeId: string, inputData: any = null, recursive: boolean = true) => {
    const {
      nodes, connections, entities,
      setNodes, updateNodeAndBroadcast,
      setWaitingApprovalNodeId, setPendingApprovalData,
      currentWorkflowId, workflowName,
    } = depsRef.current;

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Set to running and broadcast
    updateNodeAndBroadcast(nodeId, { status: 'running' as const, inputData });

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Set result based on type
    let result = '';
    let nodeData: any = null;
    let conditionResult: boolean | undefined = undefined;

    if (node.type === 'fetchData') {
      if (!node.config?.entityId) {
        result = 'Error: No entity configured';
        updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result });
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/entities/${node.config.entityId}/records`, { credentials: 'include' });
        const records = await res.json();

        const entity = entities.find((e: any) => e.id === node.config?.entityId);
        console.log('[fetchData] records from API:', records.length, 'first record:', JSON.stringify(records[0]));
        console.log('[fetchData] entity found:', !!entity, 'entity props:', entity?.properties?.length);
        console.log('[fetchData] inputData:', inputData);
        const fetchedRecords = records.map((record: any) => {
          const flattened: any = { id: record.id, createdAt: record.createdAt };
          if (record.values) {
            Object.entries(record.values).forEach(([propId, value]) => {
              if (entity) {
                const prop = entity.properties.find((p: any) => p.id === propId);
                flattened[prop ? prop.name : propId] = value;
              } else {
                flattened[propId] = value;
              }
            });
          }
          return flattened;
        });

        // Merge: add input data columns to each fetched record (like addField does)
        if (inputData && typeof inputData === 'object' && !Array.isArray(inputData) && Object.keys(inputData).length > 0) {
          // Input is key-value map (e.g. from manualInput) — spread into every fetched record
          nodeData = fetchedRecords.map((record: any) => ({ ...inputData, ...record }));
        } else if (Array.isArray(inputData) && inputData.length > 0) {
          // Input is array — merge 1-to-1 if same length, else spread first row into all
          if (inputData.length === fetchedRecords.length) {
            nodeData = fetchedRecords.map((record: any, i: number) => ({ ...inputData[i], ...record }));
          } else {
            const inputFlat = inputData.length === 1 ? inputData[0] : {};
            nodeData = fetchedRecords.map((record: any) => ({ ...inputFlat, ...record }));
          }
        } else {
          nodeData = fetchedRecords;
        }
        result = `Fetched ${records.length} records from ${node.config.entityName}`;
      } catch (error) {
        result = 'Error fetching data';
        updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result });
        return;
      }
    } else {
      switch (node.type) {
        case 'trigger':
          result = 'Triggered!';
          break;

        case 'action':
          if (node.config?.columnRenames && node.config.columnRenames.length > 0 && inputData && Array.isArray(inputData)) {
            const renames = node.config.columnRenames as { oldName: string; newName: string }[];
            nodeData = inputData.map((row: any) => {
              const newRow: any = {};
              for (const key of Object.keys(row)) {
                const rename = renames.find(r => r.oldName === key);
                newRow[rename ? rename.newName : key] = row[key];
              }
              return newRow;
            });
            result = `Renamed ${renames.length} column(s): ${renames.map(r => `${r.oldName} → ${r.newName}`).join(', ')}`;
          } else {
            nodeData = inputData;
            result = 'No column renames configured';
          }
          break;

        case 'condition': {
          if (node.config?.conditionField && node.config?.conditionOperator) {
            const dataToEval = inputData;
            const processingMode = node.config.processingMode || 'batch';
            const additionalConds = node.config.additionalConditions || [];
            const logicalOp = node.config.logicalOperator || 'AND';

            if (dataToEval && Array.isArray(dataToEval) && dataToEval.length > 0) {
              const evaluateSingleCondition = (record: any, field: string, operator: string, value: string): boolean => {
                const fieldValue = record[field];
                switch (operator) {
                  case 'isText': return typeof fieldValue === 'string';
                  case 'isNumber': return !isNaN(Number(fieldValue));
                  case 'equals': return String(fieldValue) === value;
                  case 'not_equals':
                  case 'notEquals': return String(fieldValue) !== value;
                  case 'contains': return String(fieldValue).toLowerCase().includes((value || '').toLowerCase());
                  case 'not_contains': return !String(fieldValue).toLowerCase().includes((value || '').toLowerCase());
                  case 'greater_than':
                  case 'greaterThan': return Number(fieldValue) > Number(value);
                  case 'less_than':
                  case 'lessThan': return Number(fieldValue) < Number(value);
                  case 'greater_or_equal': return Number(fieldValue) >= Number(value);
                  case 'less_or_equal': return Number(fieldValue) <= Number(value);
                  case 'starts_with': return String(fieldValue).toLowerCase().startsWith((value || '').toLowerCase());
                  case 'ends_with': return String(fieldValue).toLowerCase().endsWith((value || '').toLowerCase());
                  case 'is_empty': return fieldValue === null || fieldValue === undefined || fieldValue === '';
                  case 'is_not_empty': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
                  default: return false;
                }
              };

              const evaluateRecord = (record: any): boolean => {
                const primaryResult = evaluateSingleCondition(
                  record,
                  node.config!.conditionField!,
                  node.config!.conditionOperator!,
                  node.config!.conditionValue || ''
                );
                if (!additionalConds || additionalConds.length === 0) return primaryResult;

                const allResults = [primaryResult];
                for (const cond of additionalConds) {
                  if (cond.field) {
                    allResults.push(evaluateSingleCondition(record, cond.field, cond.operator, cond.value));
                  }
                }
                return logicalOp === 'AND' ? allResults.every(r => r) : allResults.some(r => r);
              };

              if (processingMode === 'perRow') {
                const trueRecords = dataToEval.filter((record: any) => evaluateRecord(record));
                const falseRecords = dataToEval.filter((record: any) => !evaluateRecord(record));
                nodeData = { trueRecords, falseRecords };
                conditionResult = trueRecords.length > 0;
                const condCount = 1 + additionalConds.length;
                result = `${condCount} condition${condCount > 1 ? 's' : ''} (${logicalOp}): ${trueRecords.length} TRUE, ${falseRecords.length} FALSE`;
              } else {
                const condResult = evaluateRecord(dataToEval[0]);
                nodeData = dataToEval;
                conditionResult = condResult;
                const condCount = 1 + additionalConds.length;
                result = `${condCount} condition${condCount > 1 ? 's' : ''} (${logicalOp}) → ${condResult ? '✓ All to TRUE' : '✗ All to FALSE'}`;
              }
            } else {
              result = 'No data to evaluate';
            }
          } else {
            result = 'Error: Condition not configured';
            updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result });
            return;
          }
          break;
        }

        case 'addField':
          if ((node.config?.addFieldName || node.config?.conditionField) && inputData && Array.isArray(inputData)) {
            const fieldName = node.config.addFieldName || node.config.conditionField;
            const fieldValue = node.config.addFieldValue ?? node.config.conditionValue ?? '';
            nodeData = inputData.map((record: any) => ({ ...record, [fieldName]: fieldValue }));
            result = `Added field "${fieldName}" = "${fieldValue}" to ${nodeData.length} records`;
          } else if (!inputData || (Array.isArray(inputData) && inputData.length === 0)) {
            result = 'No input data received';
          } else {
            result = 'Not configured — set field name in node config';
          }
          break;

        case 'saveRecords':
          if (node.config?.entityId && inputData && Array.isArray(inputData)) {
            try {
              let savedCount = 0;
              let failedCount = 0;
              for (const record of inputData) {
                const { id, ...recordWithoutId } = record;
                const response = await fetch(`${API_BASE}/entities/${node.config.entityId}/records`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(recordWithoutId),
                  credentials: 'include'
                });
                if (response.ok) savedCount++;
                else {
                  failedCount++;
                  console.error(`Failed to save record:`, record, await response.text());
                }
              }
              nodeData = inputData;
              result = failedCount > 0
                ? `Saved ${savedCount}, Failed ${failedCount} to ${node.config.entityName}`
                : `Saved ${savedCount} records to ${node.config.entityName}`;
            } catch (error: any) {
              console.error('Save records error:', error);
              result = `Error: ${error.message || 'Failed to save'}`;
            }
          } else {
            result = 'Not configured or no data';
          }
          break;

        case 'python':
          if (node.config?.pythonCode) {
            try {
              const response = await fetch(`${API_BASE}/python/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code: node.config.pythonCode,
                  inputData: Array.isArray(inputData) ? inputData : (inputData ? [inputData] : [])
                }),
                credentials: 'include'
              });

              if (response.ok) {
                const data = await response.json();
                if (data.success === false) {
                  const error: any = new Error(data.error || 'Python execution failed');
                  error.traceback = data.traceback;
                  throw error;
                }
                if (data.result && typeof data.result === 'object' && data.result.error) {
                  throw new Error(data.result.error);
                }
                if (data.result === null || data.result === undefined) {
                  console.warn('[Python] Execution returned null/undefined result');
                  nodeData = [];
                  result = 'Warning: Python returned no data (null). Make sure your process() function returns a value.';
                  updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result, outputData: [] });
                  return;
                } else if (Array.isArray(data.result) && data.result.length === 0) {
                  nodeData = [];
                  result = 'Python executed - returned empty array';
                } else {
                  nodeData = data.result;
                  const recordCount = Array.isArray(data.result) ? data.result.length : 1;
                  result = `Python executed successfully (${recordCount} ${recordCount === 1 ? 'record' : 'records'})`;
                }
              } else {
                const errorData = await response.json();
                const error: any = new Error(errorData.error || 'Python execution failed');
                error.traceback = errorData.traceback;
                throw error;
              }
            } catch (error: any) {
              console.error('Python execution error:', error);
              const errorMessage = error.message || 'Failed to execute';
              const traceback = error.traceback || '';
              result = `Error: ${errorMessage}${traceback ? '\n' + traceback : ''}`;
              updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result, outputData: [{ error: errorMessage }] });
              return;
            }
          } else {
            result = 'Code not configured';
          }
          break;

        case 'franmit':
          try {
            // Block execution if API secret is not configured
            const franmitSecret = node.config?.franmitApiSecretId || '';
            if (!franmitSecret.trim()) {
              result = 'Error: API secret not configured. Open the node config and enter the secret.';
              updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result, outputData: [{ error: 'API secret not configured' }] });
              return;
            }

            const sanitizeFranmitOutput = (obj: any, depth = 0): any => {
              if (depth > 50) return obj;
              if (obj === null || obj === undefined) return 0;
              if (typeof obj === 'number') {
                if (isNaN(obj) || !isFinite(obj)) return 0;
                return obj;
              }
              if (Array.isArray(obj)) return obj.map(item => sanitizeFranmitOutput(item, depth + 1));
              if (typeof obj === 'object') {
                const sanitized: any = {};
                for (const key of Object.keys(obj)) sanitized[key] = sanitizeFranmitOutput(obj[key], depth + 1);
                return sanitized;
              }
              return obj;
            };

            // Apply column mapping: rename input columns to FranMIT expected parameter names
            const colMapping: Record<string, string> = node.config?.franmitColumnMapping || {};
            const applyFranmitMapping = (row: Record<string, any>): Record<string, any> => {
              if (!row || typeof row !== 'object') return row;
              const mapped: Record<string, any> = {};
              // Build reverse map: inputColumn -> franmitParam
              const reverseMap: Record<string, string> = {};
              for (const [franmitParam, inputCol] of Object.entries(colMapping)) {
                if (inputCol && typeof inputCol === 'string') {
                  reverseMap[inputCol] = franmitParam;
                }
              }
              for (const [key, value] of Object.entries(row)) {
                const targetKey = reverseMap[key] || key;
                mapped[targetKey] = value;
              }
              return mapped;
            };

            const hasMappingConfig = Object.keys(colMapping).length > 0;
            let mappedInputData = inputData;
            if (hasMappingConfig) {
              if (Array.isArray(inputData)) {
                mappedInputData = inputData.map(applyFranmitMapping);
              } else if (typeof inputData === 'object' && inputData !== null) {
                mappedInputData = applyFranmitMapping(inputData);
              }
            }

            const reactorConfiguration: any = {};
            reactorConfiguration.V_reb = parseFloat(node.config?.franmitReactorVolume || '') || 53;
            reactorConfiguration.scale_cat = parseFloat(node.config?.franmitCatalystScaleFactor || '') || 1;

            const isBatch = Array.isArray(mappedInputData) && mappedInputData.length > 0;
            const requestBody = isBatch
              ? { mode: 'batch', recetas: mappedInputData, reactorConfiguration, apiSecret: franmitSecret }
              : { mode: 'single', receta: (typeof mappedInputData === 'object' && !Array.isArray(mappedInputData)) ? mappedInputData : {}, reactorConfiguration, apiSecret: franmitSecret };

            const response = await fetch(`${API_BASE}/franmit/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              credentials: 'include'
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success === false) {
                const error: any = new Error(data.error || 'FranMIT execution failed');
                error.traceback = data.traceback;
                throw error;
              }
              const results = sanitizeFranmitOutput(data.results || []);
              nodeData = Array.isArray(results) ? results : [results];
              result = `FranMIT reactor model executed: ${nodeData.length} row(s)`;
            } else {
              const errorData = await response.json();
              const error: any = new Error(errorData.error || 'FranMIT execution failed');
              error.traceback = errorData.traceback;
              throw error;
            }
          } catch (error: any) {
            console.error('FranMIT execution error:', error);
            const errorMessage = error.message || 'Failed to execute';
            const traceback = error.traceback || '';
            result = `Error: ${errorMessage}${traceback ? '\n' + traceback : ''}`;
            updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result, outputData: [{ error: errorMessage }] });
            return;
          }
          break;

        case 'conveyor':
          try {
            const speed = parseFloat(node.config?.conveyorSpeed || '0');
            const length = parseFloat(node.config?.conveyorLength || '0');
            const width = parseFloat(node.config?.conveyorWidth || '0') || 0.8;
            const inclination = parseFloat(node.config?.conveyorInclination || '0');
            const loadCapacity = parseFloat(node.config?.conveyorLoadCapacity || '0') || 50;
            const motorPower = parseFloat(node.config?.conveyorMotorPower || '0') || 0;
            const frictionCoeff = parseFloat(node.config?.conveyorFrictionCoeff || '0') || 0.025;
            const beltType = node.config?.conveyorBeltType || 'flat';

            if (!speed || !length) throw new Error('Speed and Length are required parameters');

            const g = 9.81;
            const inclinationRad = (inclination * Math.PI) / 180;
            const transportTime = length / speed;
            const throughput = loadCapacity * speed * 3.6;
            const horizontalComponent = frictionCoeff * loadCapacity * length * g * Math.cos(inclinationRad);
            const verticalComponent = loadCapacity * length * g * Math.sin(inclinationRad);
            const beltTension = horizontalComponent + verticalComponent;
            const requiredPower = (beltTension * speed) / 1000;
            const efficiency = motorPower > 0 ? Math.min((requiredPower / motorPower) * 100, 100) : 0;

            const conveyorOutput = {
              belt_speed_m_s: speed, belt_length_m: length, belt_width_m: width, belt_type: beltType,
              inclination_deg: inclination, load_capacity_kg_m: loadCapacity, friction_coefficient: frictionCoeff,
              transport_time_s: Math.round(transportTime * 100) / 100,
              throughput_t_h: Math.round(throughput * 100) / 100,
              belt_tension_N: Math.round(beltTension * 100) / 100,
              required_power_kW: Math.round(requiredPower * 100) / 100,
              motor_power_kW: motorPower || 'N/A',
              motor_efficiency_pct: motorPower > 0 ? Math.round(efficiency * 100) / 100 : 'N/A',
            };

            if (Array.isArray(inputData) && inputData.length > 0) {
              nodeData = inputData.map((row: any) => ({ ...row, ...conveyorOutput }));
            } else {
              nodeData = [conveyorOutput];
            }
            result = `Conveyor model calculated: transport ${transportTime.toFixed(1)}s, throughput ${throughput.toFixed(1)} t/h, power ${requiredPower.toFixed(2)} kW`;
          } catch (error: any) {
            console.error('Conveyor execution error:', error);
            result = `Error: ${error.message || 'Conveyor calculation failed'}`;
            updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result, outputData: [{ error: error.message }] });
            return;
          }
          break;

        case 'llm':
          if (node.config?.llmPrompt) {
            const llmProcessingMode = node.config.processingMode || 'batch';
            try {
              const outputType = node.config.outputType || 'text';
              const enumOptions = node.config.enumOptions || [];

              if (llmProcessingMode === 'perRow' && inputData && Array.isArray(inputData) && inputData.length > 0) {
                const results: any[] = [];
                for (let i = 0; i < inputData.length; i++) {
                  const record = inputData[i];
                  let personalizedPrompt = node.config.llmPrompt;
                  Object.keys(record).forEach(key => {
                    personalizedPrompt = personalizedPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(record[key]));
                  });
                  const response = await fetch(`${API_BASE}/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      prompt: personalizedPrompt,
                      mentionedEntityIds: node.config.llmContextEntities || [],
                      additionalContext: node.config.llmIncludeInput ? [record] : undefined,
                      outputType,
                      enumOptions
                    }),
                    credentials: 'include'
                  });
                  if (response.ok) {
                    const data = await response.json();
                    results.push({ ...record, ai_result: data.response });
                  } else {
                    results.push({ ...record, ai_result: 'Error generating', ai_error: true });
                  }
                }
                nodeData = results;
                result = `Generated for ${results.length} records`;
              } else {
                const response = await fetch(`${API_BASE}/generate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    prompt: node.config.llmPrompt,
                    mentionedEntityIds: node.config.llmContextEntities || [],
                    additionalContext: node.config.llmIncludeInput ? inputData : undefined,
                    outputType,
                    enumOptions
                  }),
                  credentials: 'include'
                });
                if (response.ok) {
                  const data = await response.json();
                  nodeData = [{ result: data.response }];
                  result = 'Generated text successfully';
                } else {
                  const errorData = await response.json();
                  throw new Error(errorData.error || 'Failed to generate text');
                }
              }
            } catch (error: any) {
              console.error('LLM generation error:', error);
              result = `Error: ${error.message || 'Failed to generate'}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'Prompt not configured';
          }
          break;

        case 'manualInput':
          if (node.config?.manualInputVarName || node.config?.inputVarName) {
            const varName = node.config.manualInputVarName || node.config.inputVarName;
            const varValue = node.config.manualInputVarValue ?? node.config.inputVarValue ?? '';
            const parsedValue = !isNaN(Number(varValue)) && varValue.trim() !== '' ? Number(varValue) : varValue;
            nodeData = [{ [varName]: parsedValue }];
            result = `Set ${varName} = ${parsedValue}`;
          } else {
            result = 'Not configured — set variable name in node config';
          }
          break;

        case 'http':
          if (node.config?.httpUrl) {
            try {
              const response = await fetch(`${API_BASE}/proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: node.config.httpUrl, method: 'GET' }),
                credentials: 'include'
              });
              if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) nodeData = data;
                else if (typeof data === 'object') nodeData = [data];
                else nodeData = [{ result: data }];
                result = `Fetched from ${node.config.httpUrl}`;
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Request failed');
              }
            } catch (error: any) {
              console.error('HTTP request error:', error);
              result = `Error: ${error.message || 'Failed to fetch'}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'URL not configured';
          }
          break;

        case 'mysql':
          if (node.config?.mysqlQuery) {
            try {
              const response = await fetch(`${API_BASE}/mysql/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  host: node.config.mysqlHost || 'localhost',
                  port: node.config.mysqlPort || '3306',
                  database: node.config.mysqlDatabase,
                  username: node.config.mysqlUsername,
                  password: node.config.mysqlPassword,
                  query: node.config.mysqlQuery
                }),
                credentials: 'include'
              });
              if (response.ok) {
                const data = await response.json();
                nodeData = data.results || [];
                result = `Fetched ${nodeData.length} rows from MySQL`;
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'MySQL query failed');
              }
            } catch (error: any) {
              console.error('MySQL query error:', error);
              result = `Error: ${error.message || 'Failed to query MySQL'}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'Query not configured';
          }
          break;

        case 'sapFetch':
          if (node.config?.sapEntity && node.config?.sapBaseApiUrl) {
            try {
              result = `SAP S/4HANA configured: ${node.config.sapEntity}`;
              nodeData = [{
                _note: 'SAP S/4HANA integration pending backend implementation',
                connection: node.config.sapConnectionName,
                entity: node.config.sapEntity,
                servicePath: node.config.sapServicePath
              }];
            } catch (error: any) {
              console.error('SAP fetch error:', error);
              result = `Error: ${error.message || 'Failed to fetch from SAP'}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'SAP connection not configured';
          }
          break;

        case 'limsFetch':
          if (node.config?.limsServerUrl && node.config?.limsApiKey) {
            try {
              const response = await fetch(`${API_BASE}/lims/fetch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  serverUrl: node.config.limsServerUrl,
                  apiKey: node.config.limsApiKey,
                  endpoint: node.config.limsEndpoint || 'materials',
                  query: node.config.limsQuery || ''
                }),
                credentials: 'include'
              });
              if (response.ok) {
                const data = await response.json();
                nodeData = Array.isArray(data) ? data : [data];
                result = `Fetched ${nodeData.length} records from LIMS`;
              } else {
                const errorData = await response.json();
                result = `Error: ${errorData.error || 'Failed to fetch from LIMS'}`;
                nodeData = [{ error: errorData.error || 'Failed to fetch from LIMS' }];
              }
            } catch (error: any) {
              result = `Error: ${error.message}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'LIMS not configured';
          }
          break;

        case 'statisticalAnalysis':
          if (node.config?.statisticalMethod) {
            try {
              const params = node.config.statisticalParams ? JSON.parse(node.config.statisticalParams) : {};
              const response = await fetch(`${API_BASE}/statistical/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  method: node.config.statisticalMethod,
                  inputData: inputData,
                  params: params,
                  goldenBatchId: node.config.goldenBatchId || null
                }),
                credentials: 'include'
              });
              if (response.ok) {
                const data = await response.json();
                nodeData = data.results || [data];
                result = `Analysis completed: ${node.config.statisticalMethod}`;
              } else {
                const errorData = await response.json();
                result = `Error: ${errorData.error || 'Statistical analysis failed'}`;
                nodeData = [{ error: errorData.error || 'Statistical analysis failed' }];
              }
            } catch (error: any) {
              result = `Error: ${error.message}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'Statistical analysis not configured';
          }
          break;

        case 'alertAgent':
          if (node.config?.alertConditions) {
            try {
              const conditions = JSON.parse(node.config.alertConditions);
              let alertTriggered = false;
              let alertMessage = '';

              if (inputData) {
                const data = Array.isArray(inputData) ? inputData : [inputData];
                for (const condition of conditions) {
                  const field = condition.field;
                  const operator = condition.operator;
                  const value = condition.value;
                  for (const record of data) {
                    const fieldValue = record[field];
                    let matches = false;
                    switch (operator) {
                      case '>': matches = Number(fieldValue) > Number(value); break;
                      case '<': matches = Number(fieldValue) < Number(value); break;
                      case '>=': matches = Number(fieldValue) >= Number(value); break;
                      case '<=': matches = Number(fieldValue) <= Number(value); break;
                      case '==': matches = String(fieldValue) === String(value); break;
                      case '!=': matches = String(fieldValue) !== String(value); break;
                    }
                    if (matches) { alertTriggered = true; alertMessage = condition.message || `Alert: ${field} ${operator} ${value}`; break; }
                  }
                  if (alertTriggered) break;
                }
              }

              if (alertTriggered) {
                const actions = node.config.alertActions || ['email'];
                const recipients = node.config.alertRecipients?.split(',').map((r: string) => r.trim()) || [];
                for (const action of actions) {
                  if (action === 'email' && recipients.length > 0) {
                    await fetch(`${API_BASE}/send-email`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        to: recipients.filter((r: string) => r.includes('@')).join(','),
                        subject: `[${node.config.alertSeverity?.toUpperCase()}] ${alertMessage}`,
                        body: alertMessage
                      }),
                      credentials: 'include'
                    });
                  } else if (action === 'sms' && recipients.length > 0) {
                    await fetch(`${API_BASE}/send-sms`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        to: recipients.filter((r: string) => !r.includes('@')).join(','),
                        body: alertMessage
                      }),
                      credentials: 'include'
                    });
                  }
                }
                result = `Alert triggered: ${alertMessage}`;
                nodeData = [{ alert: true, message: alertMessage, severity: node.config.alertSeverity }];
              } else {
                result = 'No alerts triggered';
                nodeData = [{ alert: false }];
              }
            } catch (error: any) {
              result = `Error: ${error.message}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'Alert agent not configured';
          }
          break;

        case 'pdfReport':
          if (node.config?.pdfTemplate) {
            try {
              const reportData = node.config.pdfReportData ? JSON.parse(node.config.pdfReportData) : inputData;
              const response = await fetch(`${API_BASE}/pdf/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template: node.config.pdfTemplate, data: reportData, outputPath: node.config.pdfOutputPath || '' }),
                credentials: 'include'
              });
              if (response.ok) {
                const data = await response.json();
                nodeData = [{ pdfPath: data.path, pdfUrl: data.url }];
                result = `PDF report generated: ${data.path || data.url}`;
              } else {
                const errorData = await response.json();
                result = `Error: ${errorData.error || 'PDF generation failed'}`;
                nodeData = [{ error: errorData.error || 'PDF generation failed' }];
              }
            } catch (error: any) {
              result = `Error: ${error.message}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'PDF report not configured';
          }
          break;

        case 'sendEmail':
          if (node.config?.emailTo) {
            try {
              const replaceVariables = (text: string, data: any) => {
                if (!text || !data) return text;
                let r = text;
                const record = Array.isArray(data) ? data[0] : data;
                if (record && typeof record === 'object') {
                  Object.keys(record).forEach(key => { r = r.replace(new RegExp(`\\{${key}\\}`, 'g'), String(record[key] ?? '')); });
                }
                return r;
              };
              const emailData: Record<string, any> = {
                to: replaceVariables(node.config.emailTo, inputData),
                subject: replaceVariables(node.config.emailSubject || '', inputData),
                body: replaceVariables(node.config.emailBody || '', inputData),
              };
              // Only include SMTP override if user explicitly configured it
              if (node.config.emailSmtpUser && node.config.emailSmtpPass) {
                emailData.smtpHost = node.config.emailSmtpHost || 'smtp.gmail.com';
                emailData.smtpPort = node.config.emailSmtpPort || '587';
                emailData.smtpUser = node.config.emailSmtpUser;
                emailData.smtpPass = node.config.emailSmtpPass;
              }
              const response = await fetch(`${API_BASE}/email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailData),
                credentials: 'include'
              });
              if (response.ok) {
                const respData = await response.json();
                nodeData = inputData || [{ emailSent: true, to: emailData.to }];
                result = `Email sent to ${emailData.to}` + (respData.provider ? ` via ${respData.provider}` : '');
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send email');
              }
            } catch (error: any) {
              console.error('Email send error:', error);
              result = `Error: ${error.message || 'Failed to send email'}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'Recipient not configured';
          }
          break;

        case 'sendSMS':
          if (node.config?.smsTo) {
            try {
              const replaceVariables = (text: string, data: any) => {
                if (!text || !data) return text;
                let r = text;
                const record = Array.isArray(data) ? data[0] : data;
                if (record && typeof record === 'object') {
                  Object.keys(record).forEach(key => { r = r.replace(new RegExp(`\\{${key}\\}`, 'g'), String(record[key] ?? '')); });
                }
                return r;
              };
              const smsData = {
                to: replaceVariables(node.config.smsTo, inputData),
                body: replaceVariables(node.config.smsBody || '', inputData),
                accountSid: node.config.twilioAccountSid,
                authToken: node.config.twilioAuthToken,
                fromNumber: node.config.twilioFromNumber
              };
              const response = await fetch(`${API_BASE}/sms/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(smsData),
                credentials: 'include'
              });
              if (response.ok) {
                nodeData = inputData || [{ smsSent: true, to: smsData.to }];
                result = `SMS sent to ${smsData.to}`;
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send SMS');
              }
            } catch (error: any) {
              console.error('SMS send error:', error);
              result = `Error: ${error.message || 'Failed to send SMS'}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'Phone number not configured';
          }
          break;

        case 'sendWhatsApp':
          if (node.config?.whatsappTo) {
            try {
              const replaceVariablesWA = (text: string, data: any) => {
                if (!text || !data) return text;
                let r = text;
                const record = Array.isArray(data) ? data[0] : data;
                if (record && typeof record === 'object') {
                  Object.keys(record).forEach(key => { r = r.replace(new RegExp(`\\{${key}\\}`, 'g'), String(record[key] ?? '')); });
                }
                return r;
              };
              const waData = {
                to: replaceVariablesWA(node.config.whatsappTo, inputData),
                body: replaceVariablesWA(node.config.whatsappBody || '', inputData),
                accountSid: node.config.whatsappTwilioAccountSid,
                authToken: node.config.whatsappTwilioAuthToken,
                fromNumber: node.config.whatsappTwilioFromNumber
              };
              const response = await fetch(`${API_BASE}/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(waData),
                credentials: 'include'
              });
              if (response.ok) {
                nodeData = inputData || [{ whatsappSent: true, to: waData.to }];
                result = `WhatsApp sent to ${waData.to}`;
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send WhatsApp');
              }
            } catch (error: any) {
              console.error('WhatsApp send error:', error);
              result = `Error: ${error.message || 'Failed to send WhatsApp'}`;
              nodeData = [{ error: error.message }];
            }
          } else {
            result = 'WhatsApp number not configured';
          }
          break;

        case 'dataVisualization':
          if (node.config?.generatedWidget) {
            nodeData = inputData;
            result = `Chart: ${node.config.generatedWidget.title || 'Data Visualization'}`;
          } else {
            result = 'No visualization configured. Double-click to set up.';
          }
          break;

        case 'esios': {
          const indicatorId = node.config?.esiosArchiveId || '1001';
          const esiosDate = node.config?.esiosDate || new Date().toISOString().split('T')[0];
          const startDate = `${esiosDate}T00:00`;
          const endDate = `${esiosDate}T23:59`;
          const url = `https://api.esios.ree.es/indicators/${indicatorId}?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
          try {
            const response = await fetch(`${API_BASE}/proxy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url, method: 'GET',
                headers: { 'Accept': 'application/json; application/vnd.esios-api-v1+json', 'x-api-key': 'd668c991cd9fbd6873796a76b80bca256bf0f26db8d4c1de702546642fecda64' }
              }),
              credentials: 'include'
            });
            if (response.ok) {
              const data = await response.json();
              nodeData = [data];
              result = `Fetched ESIOS Indicator ${indicatorId} for ${esiosDate}`;
            } else {
              const errorData = await response.json();
              throw new Error(errorData.error || `ESIOS Request failed: ${response.status}`);
            }
          } catch (error: any) {
            console.error('ESIOS request error:', error);
            result = `Error: ${error.message || 'Failed to fetch'}`;
            nodeData = [{ error: error.message }];
          }
          break;
        }

        case 'climatiq':
          if (node.config?.climatiqFactor !== undefined) {
            const factor = node.config.climatiqFactor;
            const unit = node.config.climatiqUnit || 'kg CO2e';
            const description = node.config.climatiqDescription || 'Emission factor';
            nodeData = [{ factor, unit, description, query: node.config.climatiqQuery }];
            result = `Using ${description}: ${factor} ${unit}`;
          } else {
            result = 'Not configured - please select an emission factor';
            nodeData = [{ error: 'No emission factor selected' }];
          }
          break;

        case 'weather': {
          const latitude = node.config?.latitude || 40.4168;
          const longitude = node.config?.longitude || -3.7038;
          const date = node.config?.date || new Date().toISOString().split('T')[0];
          const forecastDays = node.config?.forecastDays || 7;
          const endDate = new Date(new Date(date).getTime() + (forecastDays - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code&timezone=auto&start_date=${date}&end_date=${endDate}`;
          try {
            const response = await fetch(`${API_BASE}/proxy`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url, method: 'GET',
                headers: {}
              }),
              credentials: 'include'
            });
            if (response.ok) {
              const data = await response.json();
              // Transform data: each day becomes a separate row with timestamp
              const dailyRecords = data.daily.time.map((dateStr: string, index: number) => {
                const timestamp = new Date(`${dateStr}T12:00:00`).toISOString();
                return {
                  timestamp: timestamp,
                  date: dateStr,
                  latitude: data.latitude,
                  longitude: data.longitude,
                  timezone: data.timezone,
                  temperature_max: data.daily.temperature_2m_max[index],
                  temperature_min: data.daily.temperature_2m_min[index],
                  precipitation: data.daily.precipitation_sum[index],
                  wind_speed_max: data.daily.wind_speed_10m_max[index],
                  weather_code: data.daily.weather_code ? data.daily.weather_code[index] : null
                };
              });
              nodeData = dailyRecords;
              result = `Fetched weather data for ${date} (${forecastDays} days, ${dailyRecords.length} records)`;
            } else {
              const errorData = await response.json();
              throw new Error(errorData.error || `Weather API request failed: ${response.status}`);
            }
          } catch (error: any) {
            console.error('Weather request error:', error);
            result = `Error: ${error.message || 'Failed to fetch weather data'}`;
            nodeData = [{ error: error.message }];
          }
          break;
        }

        case 'excelInput':
          if (node.config?.useGCS && node.config?.gcsPath) {
            nodeData = node.config.previewData || [];
            const totalRows = node.config.rowCount || nodeData.length;
            result = `Loaded ${totalRows} rows from ${node.config.fileName || 'cloud'} (cloud storage)`;
          } else if (node.config?.parsedData && Array.isArray(node.config.parsedData)) {
            nodeData = node.config.parsedData;
            result = `Loaded ${nodeData.length} rows from ${node.config.fileName || 'file'}`;
          } else {
            result = 'No file loaded - click to upload Excel/CSV file';
            nodeData = [];
          }
          break;

        case 'pdfInput':
          if (node.config?.pdfText) {
            nodeData = [{ text: node.config.pdfText, pages: node.config.pages, fileName: node.config.fileName, metadata: node.config.metadata }];
            result = `Loaded PDF: ${node.config.fileName} (${node.config.pages} pages)`;
          } else {
            result = 'No PDF loaded - click to upload PDF file';
            nodeData = [];
          }
          break;

        case 'join':
          if (inputData && inputData.A && inputData.B) {
            const dataA = Array.isArray(inputData.A) ? inputData.A : [inputData.A];
            const dataB = Array.isArray(inputData.B) ? inputData.B : [inputData.B];
            const strategy = node.config?.joinStrategy || 'concat';

            if (strategy === 'concat') {
              nodeData = [...dataA, ...dataB];
              result = `Concatenated ${dataA.length} + ${dataB.length} = ${nodeData.length} records`;
            } else if (strategy === 'mergeByKey' && node.config?.joinKey) {
              const key = node.config.joinKey;
              const joinTypeConfig = node.config?.joinType || 'inner';
              const merged: any[] = [];
              const fieldsInA = dataA.length > 0 ? Object.keys(dataA[0]) : [];
              const fieldsInB = dataB.length > 0 ? Object.keys(dataB[0]) : [];
              const allOutputFields = new Set<string>(fieldsInA);
              for (const field of fieldsInB) {
                if (field === key) continue;
                if (fieldsInA.includes(field)) allOutputFields.add(`B_${field}`);
                else allOutputFields.add(field);
              }

              for (const recordA of dataA) {
                const keyValue = recordA[key];
                const matchingB = dataB.find((b: any) => b[key] === keyValue);
                if (matchingB) {
                  const mergedRecord: any = { ...recordA };
                  for (const [fieldName, fieldValue] of Object.entries(matchingB)) {
                    if (fieldName === key) continue;
                    else if (fieldsInA.includes(fieldName)) mergedRecord[`B_${fieldName}`] = fieldValue;
                    else mergedRecord[fieldName] = fieldValue;
                  }
                  merged.push(mergedRecord);
                } else if (joinTypeConfig === 'outer') {
                  merged.push(recordA);
                }
              }

              if (joinTypeConfig === 'outer') {
                for (const recordB of dataB) {
                  const keyValue = recordB[key];
                  const existsInA = dataA.some((a: any) => a[key] === keyValue);
                  if (!existsInA) {
                    const prefixedRecord: any = {};
                    for (const [fieldName, fieldValue] of Object.entries(recordB)) {
                      if (fieldsInA.includes(fieldName) && fieldName !== key) prefixedRecord[`B_${fieldName}`] = fieldValue;
                      else prefixedRecord[fieldName] = fieldValue;
                    }
                    merged.push(prefixedRecord);
                  }
                }
              }

              const normalizedMerged = merged.map(record => {
                const normalized: any = {};
                for (const field of allOutputFields) normalized[field] = record[field] !== undefined ? record[field] : '';
                return normalized;
              });

              nodeData = normalizedMerged;
              const joinTypeName = joinTypeConfig === 'inner' ? 'Inner' : 'Outer';
              result = `${joinTypeName} Join by "${key}": ${nodeData.length} records`;
            } else {
              nodeData = [...dataA, ...dataB];
              result = `Concatenated (no key configured): ${nodeData.length} records`;
            }
          } else {
            result = 'Waiting for both inputs...';
          }
          break;

        case 'splitColumns':
          if (inputData && Array.isArray(inputData) && inputData.length > 0) {
            const columnsA = node.config?.columnsOutputA || [];
            const columnsB = node.config?.columnsOutputB || [];
            if (columnsA.length === 0 && columnsB.length === 0) {
              const allKeys = Object.keys(inputData[0] || {});
              nodeData = { outputA: inputData, outputB: inputData.map(() => ({})) };
              result = `Not configured - all ${allKeys.length} columns to Output A`;
            } else {
              const outputA = inputData.map((record: any) => {
                const filtered: any = {};
                columnsA.forEach((col: string) => { if (col in record) filtered[col] = record[col]; });
                return filtered;
              });
              const outputB = inputData.map((record: any) => {
                const filtered: any = {};
                columnsB.forEach((col: string) => { if (col in record) filtered[col] = record[col]; });
                return filtered;
              });
              nodeData = { outputA, outputB };
              result = `Split: ${columnsA.length} cols → A, ${columnsB.length} cols → B (${inputData.length} rows)`;
            }
          } else {
            result = 'No input data to split';
            nodeData = { outputA: [], outputB: [] };
          }
          break;

        case 'output':
          if (inputData && Array.isArray(inputData) && inputData.length > 0) {
            nodeData = inputData;
            result = `Received ${inputData.length} record(s)`;
          } else if (inputData) {
            nodeData = [inputData];
            result = 'Received data';
          } else {
            result = 'No input data';
          }
          break;

        case 'humanApproval':
          if (!node.config?.assignedUserId) {
            result = 'Error: No user assigned';
            updateNodeAndBroadcast(nodeId, { status: 'error' as const, executionResult: result });
            return;
          }
          updateNodeAndBroadcast(nodeId, { status: 'waiting' as const, inputData });
          setWaitingApprovalNodeId(nodeId);

          // --- Send notification to the assigned user ---
          {
            const channel = node.config.notificationChannel || 'platform';
            const shouldPlatform = channel === 'platform' || channel === 'both';
            const shouldEmail = channel === 'email' || channel === 'both';
            const nodeLabel = node.config.customName || node.label || 'Human Approval';
            const wfName = workflowName || 'Untitled Workflow';

            if (shouldPlatform) {
              try {
                await fetch(`${API_BASE}/notifications`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    userId: node.config.assignedUserId,
                    type: 'approval_required',
                    title: 'Approval required',
                    message: `"${nodeLabel}" step in workflow "${wfName}" is waiting for your approval.`,
                    link: currentWorkflowId ? `/workflow/${currentWorkflowId}` : undefined,
                    metadata: { workflowId: currentWorkflowId, nodeId, workflowName: wfName },
                  }),
                });
              } catch (e) {
                console.warn('Failed to send platform notification:', e);
              }
            }

            if (shouldEmail) {
              try {
                await fetch(`${API_BASE}/workflow/notify-approval-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    assignedUserId: node.config.assignedUserId,
                    assignedUserName: node.config.assignedUserName,
                    nodeLabel,
                    workflowId: currentWorkflowId,
                    workflowName: wfName,
                  }),
                });
              } catch (e) {
                console.warn('Failed to send email notification:', e);
              }
            }
          }

          await new Promise<void>((resolve) => {
            setPendingApprovalData({ inputData, resolve });
          });
          nodeData = inputData;
          result = `Approved by ${node.config.assignedUserName}`;
          break;
      }
    }

    // Set to completed and broadcast
    updateNodeAndBroadcast(nodeId, {
      status: 'completed' as const,
      executionResult: result,
      data: nodeData,
      outputData: nodeData,
      conditionResult: conditionResult !== undefined ? conditionResult : undefined
    });

    if (recursive) {
      // Re-read connections from latest deps (they may have changed)
      const latestConnections = depsRef.current.connections;
      const latestNodes = depsRef.current.nodes;
      const nextConnections = latestConnections.filter(conn => conn.fromNodeId === nodeId);

      if (node.type === 'condition' && node.config?.processingMode === 'perRow' && nodeData?.trueRecords !== undefined) {
        for (const conn of nextConnections) {
          const targetNode = latestNodes.find(n => n.id === conn.toNodeId);
          const dataToSend = conn.outputType === 'false' ? nodeData.falseRecords : nodeData.trueRecords;
          if (targetNode?.type === 'join') {
            await executeJoinInput(conn.toNodeId, dataToSend, conn.inputPort || 'A');
          } else {
            await executeNode(conn.toNodeId, dataToSend);
          }
        }
      } else if (node.type === 'splitColumns' && nodeData?.outputA !== undefined) {
        for (const conn of nextConnections) {
          const targetNode = latestNodes.find(n => n.id === conn.toNodeId);
          const dataToSend = conn.outputType === 'B' ? nodeData.outputB : nodeData.outputA;
          if (targetNode?.type === 'join') {
            await executeJoinInput(conn.toNodeId, dataToSend, conn.inputPort || 'A');
          } else {
            await executeNode(conn.toNodeId, dataToSend);
          }
        }
      } else {
        const toExecute = node.type === 'condition' && conditionResult !== undefined
          ? nextConnections.filter(c => conditionResult ? (!c.outputType || c.outputType === 'true') : c.outputType === 'false')
          : nextConnections;

        for (const conn of toExecute) {
          const targetNode = latestNodes.find(n => n.id === conn.toNodeId);
          if (targetNode?.type === 'join') {
            await executeJoinInput(conn.toNodeId, nodeData, conn.inputPort || 'A');
          } else {
            await executeNode(conn.toNodeId, nodeData);
          }
        }
      }
    }
  }, []); // Dependencies managed through depsRef

  // ---- executeJoinInput ----
  const executeJoinInput = useCallback(async (nodeId: string, inputData: any, inputPort: 'A' | 'B') => {
    const { nodes, setNodes, updateNodeAndBroadcast } = depsRef.current;
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'join') return;

    const updates = inputPort === 'A' ? { inputDataA: inputData } : { inputDataB: inputData };
    updateNodeAndBroadcast(nodeId, updates);

    await new Promise(resolve => setTimeout(resolve, 100));

    const updatedNodes = await new Promise<WorkflowNode[]>(resolve => {
      setNodes(prev => { resolve(prev); return prev; });
    });

    const updatedNode = updatedNodes.find(n => n.id === nodeId);
    if (updatedNode?.inputDataA && updatedNode?.inputDataB) {
      await executeNode(nodeId, { A: updatedNode.inputDataA, B: updatedNode.inputDataB });
    } else {
      setNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, status: 'waiting' as const, executionResult: `Waiting for input ${inputPort === 'A' ? 'B' : 'A'}...` } : n
      ));
    }
  }, [executeNode]);

  // ---- runWorkflow ----
  const runWorkflow = useCallback(async () => {
    const { isRunning, setIsRunning, saveWorkflow, setNodes, nodes, connections, currentWorkflowId, showToast } = depsRef.current;
    if (isRunning) return;
    setIsRunning(true);

    try {
      await saveWorkflow();

      setNodes(prev => prev.map(n => ({
        ...n,
        status: 'idle' as const,
        executionResult: undefined,
        inputDataA: undefined,
        inputDataB: undefined
      })));

      const activeVersion = depsRef.current.activeVersionNumber ?? undefined;
      fetch(`${API_BASE}/workflow/${currentWorkflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inputs: {}, versionNumber: activeVersion })
      }).catch(err => console.error('Background execution error:', err));

      const triggerNodes = nodes.filter(node =>
        !connections.some(conn => conn.toNodeId === node.id)
      );

      if (triggerNodes.length === 0) {
        showToast('No trigger nodes found! Add a node without incoming connections.', 'error');
        setIsRunning(false);
        return;
      }

      for (const trigger of triggerNodes) {
        await executeNode(trigger.id);
      }

      setTimeout(() => {
        setNodes(currentNodes => {
          const hasErrors = currentNodes.some(n => n.status === 'error');
          const hasCompleted = currentNodes.some(n => n.status === 'completed');
          if (hasErrors) showToast('There are configuration errors in some nodes, check the execution history for details', 'error');
          else if (hasCompleted) showToast('Workflow executed successfully!', 'success');
          return currentNodes;
        });
      }, 500);

    } catch (error) {
      console.error('Error executing workflow:', error);
      showToast(`Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsRunning(false);
    }
  }, [executeNode]);

  // ---- handleRunNode ----
  const handleRunNode = useCallback(async (nodeId: string) => {
    const { isRunning, nodes, connections, setNodes } = depsRef.current;
    if (isRunning) return;

    const node = nodes.find(n => n.id === nodeId);

    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, status: undefined, executionResult: undefined } : n
    ));
    await new Promise(resolve => setTimeout(resolve, 50));

    // Special handling for join nodes
    if (node?.type === 'join') {
      if (node.inputDataA && node.inputDataB) {
        await executeNode(nodeId, { A: node.inputDataA, B: node.inputDataB }, false);
      } else {
        const incomingConnections = connections.filter(c => c.toNodeId === nodeId);
        let dataA = node.inputDataA;
        let dataB = node.inputDataB;

        for (const conn of incomingConnections) {
          const parentNode = nodes.find(n => n.id === conn.fromNodeId);
          if (parentNode?.outputData) {
            let parentData;
            if (parentNode.type === 'splitColumns') {
              parentData = conn.outputType === 'B' ? parentNode.outputData.outputB : parentNode.outputData.outputA;
            } else {
              parentData = parentNode.outputData;
            }
            if (conn.inputPort === 'A') dataA = parentData;
            else if (conn.inputPort === 'B') dataB = parentData;
          }
        }

        setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, inputDataA: dataA, inputDataB: dataB } : n
        ));

        if (dataA && dataB) {
          await executeNode(nodeId, { A: dataA, B: dataB }, false);
        } else {
          alert(`Join node needs both inputs. Missing: ${!dataA ? 'A' : ''} ${!dataB ? 'B' : ''}`);
        }
      }
      return;
    }

    // Find input data from parent nodes
    const incomingConnections = connections.filter(c => c.toNodeId === nodeId);
    let inputData = null;
    if (incomingConnections.length > 0) {
      for (const conn of incomingConnections) {
        const parentNode = nodes.find(n => n.id === conn.fromNodeId);
        if (parentNode && parentNode.outputData) {
          if (parentNode.type === 'splitColumns') {
            inputData = conn.outputType === 'B' ? parentNode.outputData.outputB : parentNode.outputData.outputA;
          } else {
            inputData = parentNode.outputData;
          }
          break;
        }
      }
    }

    await executeNode(nodeId, inputData, false);
  }, [executeNode]);

  return { executeNode, executeJoinInput, handleRunNode, runWorkflow };
}

