/**
 * NodeConfigPanels - Paneles de configuración para todos los tipos de nodos
 * 
 * Renderiza el panel de configuración correcto según el tipo de nodo.
 * Usa el nodeConfigStore para estado y el workflowStore para guardar.
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Code,
  GitBranch,
  Lightning,
  Table,
  FileText,
  Globe,
  EnvelopeSimple,
  Robot,
  ChartLine,
  FloppyDisk as Save,
  X,
  Plus,
  Trash,
  CaretDown,
  Clock,
} from '@phosphor-icons/react';
import { useWorkflowStore, useNodeConfigStore } from '../../stores';
import {
  NodeConfigSidePanel,
  ConfigField,
  ConfigInput,
  ConfigTextarea,
  ConfigSelect,
  ConfigButton,
} from '../NodeConfigSidePanel';
import { LLMConfigModal, PythonConfigModal, ConditionConfigModal, SaveRecordsConfigModal, SpecializedAgentConfigModal } from './modals';

// ============================================================================
// TYPES
// ============================================================================

interface NodeConfigPanelsProps {
  entities?: any[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const NodeConfigPanels: React.FC<NodeConfigPanelsProps> = ({
  entities = [],
}) => {
  // Stores
  const nodes = useWorkflowStore(state => state.nodes);
  const updateNode = useWorkflowStore(state => state.updateNode);
  
  const configuringNodeId = useNodeConfigStore(state => state.configuringNodeId);
  const configuringNodeType = useNodeConfigStore(state => state.configuringNodeType);
  const closeConfig = useNodeConfigStore(state => state.closeConfig);
  
  // Find the node being configured
  const node = nodes.find(n => n.id === configuringNodeId);
  
  if (!configuringNodeId || !node) return null;
  
  // Render the appropriate config panel based on node type
  switch (configuringNodeType) {
    case 'fetchData':
      return (
        <FetchDataConfig
          node={node}
          entities={entities}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'condition':
      return (
        <ConditionConfigModalAdapter
          node={node}
          nodes={nodes}
          connections={connections}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'llm':
      return (
        <LLMConfigModalAdapter
          node={node}
          entities={entities}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'specializedAgent':
      return (
        <SpecializedAgentConfigModal
          isOpen={true}
          config={node.config || {}}
          entities={entities.map((e: any) => ({ id: e.id, name: e.name, type: e.type || 'entity' }))}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'python':
      return (
        <PythonConfigModalAdapter
          node={node}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'http':
      return (
        <HttpConfig
          node={node}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'saveRecords':
      return (
        <SaveRecordsConfigModalAdapter
          node={node}
          entities={entities}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );

    case 'sendEmail':
    case 'email':
      return (
        <EmailConfig
          node={node}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'join':
      return (
        <JoinConfig
          node={node}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'trigger':
      if (node?.label === 'Schedule' || node?.label?.startsWith('Schedule:')) {
        return (
          <ScheduleConfig
            node={node}
            onSave={(config) => {
              updateNode(node.id, { config, label: config.label });
              closeConfig();
            }}
            onClose={closeConfig}
          />
        );
      }
      return (
        <GenericConfig
          node={node}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    default:
      return (
        <GenericConfig
          node={node}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
  }
};

// ============================================================================
// MODAL ADAPTERS (reuse modals with node/onSave/onClose interface)
// ============================================================================

const LLMConfigModalAdapter: React.FC<{ node: any; entities: any[]; onSave: (c: any) => void; onClose: () => void }> = ({ node, entities, onSave, onClose }) => {
  const c = node.config || {};
  const [llmPrompt, setLlmPrompt] = useState(c.llmPrompt || c.prompt || '');
  const [llmContextEntities, setLlmContextEntities] = useState<string[]>(c.llmContextEntities || []);
  const [llmIncludeInput, setLlmIncludeInput] = useState(c.llmIncludeInput !== false);
  return (
    <LLMConfigModal
      isOpen={true}
      llmPrompt={llmPrompt}
      llmContextEntities={llmContextEntities}
      llmIncludeInput={llmIncludeInput}
      entities={entities.map((e: any) => ({ id: e.id, name: e.name, type: e.type || 'entity' }))}
      onLLMPromptChange={setLlmPrompt}
      onLLMContextEntitiesChange={setLlmContextEntities}
      onLLMIncludeInputChange={setLlmIncludeInput}
      onSave={() => onSave({ llmPrompt, llmContextEntities, llmIncludeInput })}
      onClose={onClose}
    />
  );
};

const PythonConfigModalAdapter: React.FC<{ node: any; onSave: (c: any) => void; onClose: () => void }> = ({ node, onSave, onClose }) => {
  const c = node.config || {};
  const [pythonCode, setPythonCode] = useState(c.pythonCode || c.code || '');
  const [pythonAiPrompt, setPythonAiPrompt] = useState(c.pythonAiPrompt || '');
  return (
    <PythonConfigModal
      isOpen={true}
      pythonCode={pythonCode}
      pythonAiPrompt={pythonAiPrompt}
      onPythonCodeChange={setPythonCode}
      onPythonAiPromptChange={setPythonAiPrompt}
      onSave={() => onSave({ pythonCode, code: pythonCode })}
      onClose={onClose}
    />
  );
};

const ConditionConfigModalAdapter: React.FC<{ node: any; nodes: any[]; connections: any[]; onSave: (c: any) => void; onClose: () => void }> = ({
  node, nodes, connections, onSave, onClose,
}) => {
  const c = node.config || {};
  const [conditionField, setConditionField] = useState(c.conditionField || c.field || '');
  const [conditionOperator, setConditionOperator] = useState(c.conditionOperator || c.operator || 'equals');
  const [conditionValue, setConditionValue] = useState(c.conditionValue || c.value || '');
  const [processingMode, setProcessingMode] = useState<'batch' | 'perRow'>(c.processingMode || 'batch');
  const [additionalConditions, setAdditionalConditions] = useState(c.additionalConditions || []);
  const [logicalOperator, setLogicalOperator] = useState<'AND' | 'OR'>(c.logicalOperator || 'AND');
  return (
    <ConditionConfigModal
      isOpen={true}
      nodeId={node.id}
      nodes={nodes}
      connections={connections}
      conditionField={conditionField}
      conditionOperator={conditionOperator}
      conditionValue={conditionValue}
      processingMode={processingMode}
      additionalConditions={additionalConditions}
      logicalOperator={logicalOperator}
      onConditionFieldChange={setConditionField}
      onConditionOperatorChange={setConditionOperator}
      onConditionValueChange={setConditionValue}
      onProcessingModeChange={setProcessingMode}
      onAdditionalConditionsChange={setAdditionalConditions}
      onLogicalOperatorChange={setLogicalOperator}
      onSave={() => {
        // Map snake_case operators to executor's camelCase (not_equals->notEquals, etc.)
        const opMap: Record<string, string> = {
          not_equals: 'notEquals', greater_than: 'greaterThan', less_than: 'lessThan',
          greater_or_equal: 'greaterOrEqual', less_or_equal: 'lessOrEqual',
          is_empty: 'isEmpty', is_not_empty: 'isNotEmpty', not_contains: 'notContains',
          starts_with: 'startsWith', ends_with: 'endsWith',
        };
        onSave({
          conditionField,
          conditionOperator: opMap[conditionOperator] || conditionOperator,
          conditionValue,
          processingMode,
          additionalConditions,
          logicalOperator,
        });
      }}
      onClose={onClose}
    />
  );
};

const SaveRecordsConfigModalAdapter: React.FC<{ node: any; entities: any[]; onSave: (c: any) => void; onClose: () => void }> = ({ node, entities, onSave, onClose }) => {
  const c = node.config || {};
  return (
    <SaveRecordsConfigModal
      isOpen={true}
      entityId={c.entityId}
      saveMode={c.saveMode || 'insert'}
      availableEntities={entities.map((e: any) => ({ id: e.id, name: e.name }))}
      onSave={(config) => onSave(config)}
      onClose={onClose}
    />
  );
};

// ============================================================================
// FETCH DATA CONFIG
// ============================================================================

interface FetchDataConfigProps {
  node: any;
  entities: any[];
  onSave: (config: any) => void;
  onClose: () => void;
}

const FetchDataConfig: React.FC<FetchDataConfigProps> = ({
  node,
  entities,
  onSave,
  onClose,
}) => {
  const [selectedEntityId, setSelectedEntityId] = useState(node.config?.entityId || '');
  const [limit, setLimit] = useState(node.config?.limit || '100');
  const [filters, setFilters] = useState(node.config?.filters || []);
  
  const selectedEntity = entities.find(e => e.id === selectedEntityId);
  
  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Configure Data Source"
      icon={Database}
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton
            variant="primary"
            onClick={() => onSave({
              entityId: selectedEntityId,
              entityName: selectedEntity?.name,
              limit: parseInt(limit),
              filters,
            })}
            disabled={!selectedEntityId}
          >
            <Save size={14} />
            Save Configuration
          </ConfigButton>
        </div>
      }
    >
      <ConfigField label="Data Entity" required>
        <ConfigSelect
          value={selectedEntityId}
          onChange={setSelectedEntityId}
          placeholder="Select an entity..."
          options={entities.map(e => ({ value: e.id, label: e.name }))}
        />
      </ConfigField>
      
      {selectedEntity && (
        <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] mb-2">
            Available fields:
          </p>
          <div className="flex flex-wrap gap-1">
            {selectedEntity.properties?.map((prop: any) => (
              <span
                key={prop.name}
                className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded text-[10px] text-[var(--text-tertiary)]"
              >
                {prop.name}
              </span>
            ))}
          </div>
        </div>
      )}
      
      <ConfigField label="Row Limit" description="Maximum number of rows to fetch">
        <ConfigInput
          type="number"
          value={limit}
          onChange={setLimit}
          placeholder="100"
        />
      </ConfigField>
    </NodeConfigSidePanel>
  );
};

// ============================================================================
// CONDITION CONFIG
// ============================================================================

interface ConditionConfigProps {
  node: any;
  onSave: (config: any) => void;
  onClose: () => void;
}

const ConditionConfig: React.FC<ConditionConfigProps> = ({
  node,
  onSave,
  onClose,
}) => {
  const [field, setField] = useState(node.config?.field || '');
  const [operator, setOperator] = useState(node.config?.operator || 'equals');
  const [value, setValue] = useState(node.config?.value || '');
  
  const operators = [
    { value: 'equals', label: 'Equals (==)' },
    { value: 'notEquals', label: 'Not Equals (!=)' },
    { value: 'greaterThan', label: 'Greater Than (>)' },
    { value: 'lessThan', label: 'Less Than (<)' },
    { value: 'contains', label: 'Contains' },
    { value: 'startsWith', label: 'Starts With' },
    { value: 'endsWith', label: 'Ends With' },
    { value: 'isEmpty', label: 'Is Empty' },
    { value: 'isNotEmpty', label: 'Is Not Empty' },
  ];
  
  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Configure Condition"
      icon={GitBranch}
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton
            variant="primary"
            onClick={() => onSave({ field, operator, value })}
            disabled={!field}
          >
            <Save size={14} />
            Save Condition
          </ConfigButton>
        </div>
      }
    >
      <ConfigField label="Field to Check" required>
        <ConfigInput
          value={field}
          onChange={setField}
          placeholder="e.g., status, amount, category"
        />
      </ConfigField>
      
      <ConfigField label="Operator" required>
        <ConfigSelect
          value={operator}
          onChange={setOperator}
          options={operators}
        />
      </ConfigField>
      
      {!['isEmpty', 'isNotEmpty'].includes(operator) && (
        <ConfigField label="Value" description="The value to compare against">
          <ConfigInput
            value={value}
            onChange={setValue}
            placeholder="Enter comparison value..."
          />
        </ConfigField>
      )}
      
      <div className="mt-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
        <p className="text-xs text-[var(--text-secondary)] mb-1">Preview:</p>
        <code className="text-xs text-[var(--accent-primary)] font-mono">
          {field || 'field'} {operators.find(o => o.value === operator)?.label.split(' ')[0].toLowerCase()} {value || '...'}
        </code>
      </div>
    </NodeConfigSidePanel>
  );
};

// ============================================================================
// LLM CONFIG
// ============================================================================

interface LLMConfigProps {
  node: any;
  onSave: (config: any) => void;
  onClose: () => void;
}

const LLMConfig: React.FC<LLMConfigProps> = ({
  node,
  onSave,
  onClose,
}) => {
  const [model, setModel] = useState(node.config?.model || 'gpt-4o-mini');
  const [systemPrompt, setSystemPrompt] = useState(node.config?.systemPrompt || '');
  const [userPrompt, setUserPrompt] = useState(node.config?.userPrompt || '');
  const [temperature, setTemperature] = useState(node.config?.temperature || '0.7');
  
  const models = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
    { value: 'gpt-4o', label: 'GPT-4o (Balanced)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (Powerful)' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  ];
  
  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Configure LLM"
      icon={Robot}
      width="xl"
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton
            variant="primary"
            onClick={() => onSave({
              model,
              systemPrompt,
              userPrompt,
              temperature: parseFloat(temperature),
            })}
            disabled={!userPrompt}
          >
            <Save size={14} />
            Save Configuration
          </ConfigButton>
        </div>
      }
    >
      <ConfigField label="Model" required>
        <ConfigSelect
          value={model}
          onChange={setModel}
          options={models}
        />
      </ConfigField>
      
      <ConfigField 
        label="System Prompt" 
        description="Instructions for how the AI should behave"
      >
        <ConfigTextarea
          value={systemPrompt}
          onChange={setSystemPrompt}
          placeholder="You are a helpful assistant that..."
          rows={4}
        />
      </ConfigField>
      
      <ConfigField 
        label="User Prompt" 
        required
        description="Use {{field_name}} to reference input data"
      >
        <ConfigTextarea
          value={userPrompt}
          onChange={setUserPrompt}
          placeholder="Analyze the following data: {{data}}"
          rows={6}
        />
      </ConfigField>
      
      <ConfigField 
        label="Temperature" 
        description="0 = deterministic, 1 = creative"
      >
        <ConfigInput
          type="number"
          value={temperature}
          onChange={setTemperature}
          placeholder="0.7"
        />
      </ConfigField>
    </NodeConfigSidePanel>
  );
};

// ============================================================================
// SCHEDULE CONFIG
// ============================================================================

interface ScheduleConfigProps {
  node: any;
  onSave: (config: any) => void;
  onClose: () => void;
}

const ScheduleConfig: React.FC<ScheduleConfigProps> = ({
  node,
  onSave,
  onClose,
}) => {
  const [intervalValue, setIntervalValue] = useState(node.config?.scheduleIntervalValue || node.config?.scheduleInterval?.replace(/\D/g, '') || '5');
  const [intervalUnit, setIntervalUnit] = useState<'minutes' | 'hours' | 'days'>(node.config?.scheduleIntervalUnit || (
    node.config?.scheduleInterval?.endsWith('h') ? 'hours' : node.config?.scheduleInterval?.endsWith('d') ? 'days' : 'minutes'
  ));
  const [enabled, setEnabled] = useState(node.config?.scheduleEnabled !== false);

  const handleSave = () => {
    const unitChar = intervalUnit.charAt(0);
    const scheduleInterval = `${intervalValue}${unitChar}`;
    const label = `Schedule: Every ${intervalValue} ${intervalUnit}`;
    onSave({
      scheduleInterval,
      scheduleIntervalValue: intervalValue,
      scheduleIntervalUnit: intervalUnit,
      scheduleEnabled: enabled,
      scheduleType: 'interval',
      label,
    });
  };

  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Configure Schedule"
      icon={Clock}
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton variant="primary" onClick={handleSave}>
            <Save size={14} />
            Save Schedule
          </ConfigButton>
        </div>
      }
    >
      <ConfigField label="Run workflow every" description="The workflow will run automatically at this interval.">
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            max="999"
            value={intervalValue}
            onChange={(e) => setIntervalValue(e.target.value)}
            className="w-20 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          />
          <ConfigSelect
            value={intervalUnit}
            onChange={(v) => setIntervalUnit(v as 'minutes' | 'hours' | 'days')}
            options={[
              { value: 'minutes', label: 'Minutes' },
              { value: 'hours', label: 'Hours' },
              { value: 'days', label: 'Days' },
            ]}
          />
        </div>
      </ConfigField>
      <ConfigField label="Enabled" description="Turn off to pause scheduled runs.">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-[var(--border-light)]"
          />
          <span className="text-sm text-[var(--text-primary)]">Schedule is active</span>
        </label>
      </ConfigField>
    </NodeConfigSidePanel>
  );
};

// ============================================================================
// PYTHON CONFIG
// ============================================================================

const PYTHON_DEFAULT_CODE = `def process(data):
    # Modify data here
    return data`;

interface PythonConfigProps {
  node: any;
  onSave: (config: any) => void;
  onClose: () => void;
}

const PythonConfig: React.FC<PythonConfigProps> = ({
  node,
  onSave,
  onClose,
}) => {
  const [code, setCode] = useState(node.config?.code || node.config?.pythonCode || PYTHON_DEFAULT_CODE);
  
  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Configure Python Code"
      icon={Code}
      width="600px"
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton
            variant="primary"
            onClick={() => onSave({ code, pythonCode: code })}
          >
            <Save size={14} />
            Save Code
          </ConfigButton>
        </div>
      }
    >
      <ConfigField 
        label="Python Code" 
        description="Write your transformation code. Define def process(data): ... and return the result."
      >
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={20}
          className="w-full px-3 py-2.5 text-sm font-mono text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
          style={{ tabSize: 4 }}
          placeholder={PYTHON_DEFAULT_CODE}
          spellCheck={false}
        />
      </ConfigField>
      
      <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-xs">
        <p className="font-medium text-[var(--text-secondary)] mb-2">Available variables:</p>
        <ul className="space-y-1 text-[var(--text-tertiary)]">
          <li><code className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--accent-primary)] font-mono">data</code> - Input data from previous node</li>
          <li><code className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--accent-primary)] font-mono">pd</code> - Pandas library</li>
          <li><code className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--accent-primary)] font-mono">np</code> - NumPy library</li>
        </ul>
      </div>
    </NodeConfigSidePanel>
  );
};

// ============================================================================
// HTTP CONFIG
// ============================================================================

interface HttpConfigProps {
  node: any;
  onSave: (config: any) => void;
  onClose: () => void;
}

const HttpConfig: React.FC<HttpConfigProps> = ({
  node,
  onSave,
  onClose,
}) => {
  const c = node.config || {};
  const [method, setMethod] = useState(c.httpMethod || c.method || 'GET');
  const [url, setUrl] = useState(c.httpUrl || c.url || '');
  const [headers, setHeaders] = useState(typeof c.headers === 'string' ? c.headers : JSON.stringify(c.headers || {}, null, 2));
  const [body, setBody] = useState(c.body || '');
  
  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Configure HTTP Request"
      icon={Globe}
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton
            variant="primary"
            onClick={() => {
              try {
                onSave({
                  httpUrl: url,
                  httpMethod: method,
                  headers: JSON.parse(headers || '{}'),
                  body,
                });
              } catch {
                onSave({ httpUrl: url, httpMethod: method });
              }
            }}
            disabled={!url}
          >
            <Save size={14} />
            Save Configuration
          </ConfigButton>
        </div>
      }
    >
      <div className="flex gap-2 mb-4">
        <div className="w-28">
          <ConfigField label="Method">
            <ConfigSelect
              value={method}
              onChange={setMethod}
              options={[
                { value: 'GET', label: 'GET' },
                { value: 'POST', label: 'POST' },
                { value: 'PUT', label: 'PUT' },
                { value: 'DELETE', label: 'DELETE' },
                { value: 'PATCH', label: 'PATCH' },
              ]}
            />
          </ConfigField>
        </div>
        <div className="flex-1">
          <ConfigField label="URL" required>
            <ConfigInput
              value={url}
              onChange={setUrl}
              placeholder="https://api.example.com/endpoint"
            />
          </ConfigField>
        </div>
      </div>
      
      <ConfigField label="Headers" description="JSON format">
        <ConfigTextarea
          value={headers}
          onChange={setHeaders}
          placeholder='{"Authorization": "Bearer ...", "Content-Type": "application/json"}'
          rows={3}
        />
      </ConfigField>
      
      {['POST', 'PUT', 'PATCH'].includes(method) && (
        <ConfigField label="Body" description="Request body (JSON)">
          <ConfigTextarea
            value={body}
            onChange={setBody}
            placeholder='{"key": "value"}'
            rows={5}
          />
        </ConfigField>
      )}
    </NodeConfigSidePanel>
  );
};

// ============================================================================
// EMAIL CONFIG
// ============================================================================

interface EmailConfigProps {
  node: any;
  onSave: (config: any) => void;
  onClose: () => void;
}

const EmailConfig: React.FC<EmailConfigProps> = ({
  node,
  onSave,
  onClose,
}) => {
  const c = node.config || {};
  const [to, setTo] = useState(c.emailTo || c.to || '');
  const [subject, setSubject] = useState(c.emailSubject || c.subject || '');
  const [body, setBody] = useState(c.emailBody || c.body || '');
  
  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Configure Email"
      icon={EnvelopeSimple}
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton
            variant="primary"
            onClick={() => onSave({ emailTo: to, emailSubject: subject, emailBody: body })}
            disabled={!to || !subject}
          >
            <Save size={14} />
            Save Configuration
          </ConfigButton>
        </div>
      }
    >
      <ConfigField label="To" required description="Separate multiple emails with commas">
        <ConfigInput
          value={to}
          onChange={setTo}
          placeholder="email@example.com, another@example.com"
        />
      </ConfigField>
      
      <ConfigField label="Subject" required>
        <ConfigInput
          value={subject}
          onChange={setSubject}
          placeholder="Workflow Notification: {{status}}"
        />
      </ConfigField>
      
      <ConfigField 
        label="Body" 
        description="Use {{field}} to include data from input"
      >
        <ConfigTextarea
          value={body}
          onChange={setBody}
          placeholder="Hello,

The workflow has completed with the following results:
{{summary}}

Best regards"
          rows={8}
        />
      </ConfigField>
    </NodeConfigSidePanel>
  );
};

// ============================================================================
// JOIN CONFIG
// ============================================================================

interface JoinConfigProps {
  node: any;
  onSave: (config: any) => void;
  onClose: () => void;
}

const JoinConfig: React.FC<JoinConfigProps> = ({
  node,
  onSave,
  onClose,
}) => {
  const [joinType, setJoinType] = useState(node.config?.joinType || 'inner');
  const [leftKey, setLeftKey] = useState(node.config?.leftKey || '');
  const [rightKey, setRightKey] = useState(node.config?.rightKey || '');
  
  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title="Configure Join"
      icon={Table}
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton
            variant="primary"
            onClick={() => onSave({ joinType, leftKey, rightKey })}
            disabled={!leftKey || !rightKey}
          >
            <Save size={14} />
            Save Configuration
          </ConfigButton>
        </div>
      }
    >
      <ConfigField label="Join Type">
        <ConfigSelect
          value={joinType}
          onChange={setJoinType}
          options={[
            { value: 'inner', label: 'Inner Join' },
            { value: 'left', label: 'Left Join' },
            { value: 'right', label: 'Right Join' },
            { value: 'outer', label: 'Full Outer Join' },
          ]}
        />
      </ConfigField>
      
      <ConfigField label="Left Key (Input A)" required>
        <ConfigInput
          value={leftKey}
          onChange={setLeftKey}
          placeholder="e.g., id, customer_id"
        />
      </ConfigField>
      
      <ConfigField label="Right Key (Input B)" required>
        <ConfigInput
          value={rightKey}
          onChange={setRightKey}
          placeholder="e.g., id, order_customer_id"
        />
      </ConfigField>
      
      <div className="mt-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
        <p className="text-xs text-[var(--text-secondary)]">
          <strong>{joinType.charAt(0).toUpperCase() + joinType.slice(1)} Join:</strong>{' '}
          {joinType === 'inner' && 'Returns only matching rows from both inputs'}
          {joinType === 'left' && 'Returns all rows from Input A, matching rows from Input B'}
          {joinType === 'right' && 'Returns all rows from Input B, matching rows from Input A'}
          {joinType === 'outer' && 'Returns all rows from both inputs'}
        </p>
      </div>
    </NodeConfigSidePanel>
  );
};

// ============================================================================
// GENERIC CONFIG (Fallback)
// ============================================================================

interface GenericConfigProps {
  node: any;
  onSave: (config: any) => void;
  onClose: () => void;
}

const GenericConfig: React.FC<GenericConfigProps> = ({
  node,
  onSave,
  onClose,
}) => {
  const [label, setLabel] = useState(node.label || '');
  const [description, setDescription] = useState(node.config?.description || '');
  
  return (
    <NodeConfigSidePanel
      isOpen={true}
      onClose={onClose}
      title={`Configure ${node.type}`}
      footer={
        <div className="flex gap-2">
          <ConfigButton variant="secondary" onClick={onClose}>
            Cancel
          </ConfigButton>
          <ConfigButton
            variant="primary"
            onClick={() => onSave({ label, description })}
          >
            <Save size={14} />
            Save
          </ConfigButton>
        </div>
      }
    >
      <ConfigField label="Node Label">
        <ConfigInput
          value={label}
          onChange={setLabel}
          placeholder="Enter node label..."
        />
      </ConfigField>
      
      <ConfigField label="Description">
        <ConfigTextarea
          value={description}
          onChange={setDescription}
          placeholder="Optional description..."
          rows={3}
        />
      </ConfigField>
      
      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <p className="text-xs text-amber-600">
          Configuration for <strong>{node.type}</strong> nodes is coming soon.
        </p>
      </div>
    </NodeConfigSidePanel>
  );
};

export default NodeConfigPanels;
