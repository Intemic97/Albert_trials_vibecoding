/**
 * OPC UA Node Configuration Modal
 * Allows configuring OPC UA connection and node IDs
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { X } from '@phosphor-icons/react';
// AlertConfigSection removed - alerts are configured via dedicated Alert Agent node

interface OpcUaConfigModalProps {
  isOpen: boolean;
  connectionId?: string;
  nodeIds?: string[];
  pollingInterval?: number;
  availableConnections?: Array<{ id: string; name: string }>;
  alerts?: {
    enabled: boolean;
    cooldown?: number;
    thresholds?: Record<string, any>;
  };
  onSave: (config: {
    opcuaConnectionId: string;
    opcuaNodeIds: string[];
    opcuaPollingInterval: number;
    alerts?: {
      enabled: boolean;
      cooldown?: number;
      thresholds?: Record<string, any>;
    };
  }) => void;
  onClose: () => void;
}

export const OpcUaConfigModal: React.FC<OpcUaConfigModalProps> = ({
  isOpen,
  connectionId,
  nodeIds = [],
  pollingInterval = 5000,
  availableConnections = [],
  alerts,
  onSave,
  onClose,
}) => {
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '');
  const [nodeIdInput, setNodeIdInput] = useState('');
  const [nodeIdsList, setNodeIdsList] = useState<string[]>(nodeIds);
  const [pollInterval, setPollInterval] = useState(pollingInterval);
  const [alertConfig, setAlertConfig] = useState(alerts || { enabled: false });

  useEffect(() => {
    if (isOpen) {
      setSelectedConnectionId(connectionId || '');
      setNodeIdsList(nodeIds || []);
      setPollInterval(pollingInterval || 5000);
      setAlertConfig(alerts || { enabled: false });
    }
  }, [isOpen, connectionId, nodeIds, pollingInterval, alerts]);

  const handleAddNodeId = () => {
    if (nodeIdInput.trim() && !nodeIdsList.includes(nodeIdInput.trim())) {
      setNodeIdsList([...nodeIdsList, nodeIdInput.trim()]);
      setNodeIdInput('');
    }
  };

  const handleRemoveNodeId = (nodeId: string) => {
    setNodeIdsList(nodeIdsList.filter(id => id !== nodeId));
  };

  const handleSave = () => {
    if (selectedConnectionId && nodeIdsList.length > 0) {
      onSave({
        opcuaConnectionId: selectedConnectionId,
        opcuaNodeIds: nodeIdsList,
        opcuaPollingInterval: pollInterval,
        // alerts configured via dedicated Alert Agent node
      });
    }
  };

  if (!isOpen) return null;

  const isValid = selectedConnectionId && nodeIdsList.length > 0 && pollInterval > 0;

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure OPC UA Input"
      footer={
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            OPC UA Connection
          </label>
          <select
            value={selectedConnectionId}
            onChange={(e) => setSelectedConnectionId(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          >
            <option value="">Select a connection</option>
            {availableConnections.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name}
              </option>
            ))}
          </select>
          {availableConnections.length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
              No OPC UA connections available. Create one in Connections first.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Node IDs
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={nodeIdInput}
              onChange={(e) => setNodeIdInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddNodeId()}
              placeholder="ns=2;s=Temperature"
              className="flex-1 px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              onClick={handleAddNodeId}
              disabled={!nodeIdInput.trim()}
              className="px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {nodeIdsList.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
              {nodeIdsList.map((nodeId, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]"
                >
                  <code className="text-xs text-[var(--text-secondary)] font-mono flex-1 truncate">
                    {nodeId}
                  </code>
                  <button
                    onClick={() => handleRemoveNodeId(nodeId)}
                    className="ml-2 p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Polling Interval (ms)
          </label>
          <input
            type="number"
            value={pollInterval}
            onChange={(e) => setPollInterval(parseInt(e.target.value) || 0)}
            min="100"
            step="100"
            placeholder="5000"
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            How often to poll the OPC UA server (minimum 100ms)
          </p>
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> This node will connect to the OPC UA server
            and read the specified node IDs at the configured interval. Data will be output as time-series records.
          </p>
        </div>

      </div>
    </NodeConfigSidePanel>
  );
};
