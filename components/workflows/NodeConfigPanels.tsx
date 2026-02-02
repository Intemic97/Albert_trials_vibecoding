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
        <ConditionConfig
          node={node}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'llm':
      return (
        <LLMConfig
          node={node}
          onSave={(config) => {
            updateNode(node.id, { config });
            closeConfig();
          }}
          onClose={closeConfig}
        />
      );
    
    case 'python':
      return (
        <PythonConfig
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
        <code className="text-xs text-[#256A65] font-mono">
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
// PYTHON CONFIG
// ============================================================================

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
  const [code, setCode] = useState(node.config?.code || `# Input data is available as 'data' variable
# Return your result at the end

result = data
return result`);
  
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
            onClick={() => onSave({ code })}
          >
            <Save size={14} />
            Save Code
          </ConfigButton>
        </div>
      }
    >
      <ConfigField 
        label="Python Code" 
        description="Write your transformation code. Input data is available as 'data' variable."
      >
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={20}
          className="w-full px-3 py-2 text-xs font-mono text-[var(--text-primary)] bg-[#1e1e2e] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#256A65] resize-none"
          style={{ tabSize: 4 }}
        />
      </ConfigField>
      
      <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-xs">
        <p className="font-medium text-[var(--text-secondary)] mb-2">Available variables:</p>
        <ul className="space-y-1 text-[var(--text-tertiary)]">
          <li><code className="text-[#256A65]">data</code> - Input data from previous node</li>
          <li><code className="text-[#256A65]">pd</code> - Pandas library</li>
          <li><code className="text-[#256A65]">np</code> - NumPy library</li>
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
  const [method, setMethod] = useState(node.config?.method || 'GET');
  const [url, setUrl] = useState(node.config?.url || '');
  const [headers, setHeaders] = useState(node.config?.headers || '{}');
  const [body, setBody] = useState(node.config?.body || '');
  
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
            onClick={() => onSave({
              method,
              url,
              headers: JSON.parse(headers || '{}'),
              body,
            })}
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
  const [to, setTo] = useState(node.config?.to || '');
  const [subject, setSubject] = useState(node.config?.subject || '');
  const [body, setBody] = useState(node.config?.body || '');
  
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
            onClick={() => onSave({ to, subject, body })}
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
