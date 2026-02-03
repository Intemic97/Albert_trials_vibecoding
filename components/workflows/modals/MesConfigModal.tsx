/**
 * MES Node Configuration Modal
 * Allows configuring MES connection and endpoint
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';

interface MesConfigModalProps {
  isOpen: boolean;
  connectionId?: string;
  endpoint?: string;
  query?: string;
  availableConnections?: Array<{ id: string; name: string }>;
  onSave: (config: {
    mesConnectionId: string;
    mesEndpoint: string;
    mesQuery?: string;
  }) => void;
  onClose: () => void;
}

export const MesConfigModal: React.FC<MesConfigModalProps> = ({
  isOpen,
  connectionId,
  endpoint = '',
  query = '',
  availableConnections = [],
  onSave,
  onClose,
}) => {
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '');
  const [endpointValue, setEndpointValue] = useState(endpoint);
  const [queryValue, setQueryValue] = useState(query);

  useEffect(() => {
    if (isOpen) {
      setSelectedConnectionId(connectionId || '');
      setEndpointValue(endpoint || '');
      setQueryValue(query || '');
    }
  }, [isOpen, connectionId, endpoint, query]);

  const handleSave = () => {
    if (selectedConnectionId && endpointValue.trim()) {
      onSave({
        mesConnectionId: selectedConnectionId,
        mesEndpoint: endpointValue.trim(),
        mesQuery: queryValue.trim() || undefined,
      });
    }
  };

  if (!isOpen) return null;

  const isValid = selectedConnectionId && endpointValue.trim();

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure MES Data"
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
            MES Connection
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
              No MES connections available. Create one in Connections first.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            API Endpoint
          </label>
          <input
            type="text"
            value={endpointValue}
            onChange={(e) => setEndpointValue(e.target.value)}
            placeholder="/api/production/orders"
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            MES API endpoint to fetch production data from
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Query Parameters (Optional)
          </label>
          <input
            type="text"
            value={queryValue}
            onChange={(e) => setQueryValue(e.target.value)}
            placeholder="status=active&date=today"
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
          />
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            Optional query parameters or filters for the API request
          </p>
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> This node will connect to the MES system
            and fetch production data from the specified endpoint. The data will be output as records for further processing.
          </p>
        </div>
      </div>
    </NodeConfigSidePanel>
  );
};
