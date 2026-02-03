/**
 * Modbus Node Configuration Modal
 * Allows configuring Modbus connection and register addresses
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { X } from '@phosphor-icons/react';
import { AlertConfigSection } from './AlertConfigSection';

interface ModbusConfigModalProps {
  isOpen: boolean;
  connectionId?: string;
  addresses?: string[];
  functionCode?: number;
  availableConnections?: Array<{ id: string; name: string }>;
  alerts?: {
    enabled: boolean;
    cooldown?: number;
    thresholds?: Record<string, any>;
  };
  onSave: (config: {
    modbusConnectionId: string;
    modbusAddresses: string[];
    modbusFunctionCode: number;
    alerts?: {
      enabled: boolean;
      cooldown?: number;
      thresholds?: Record<string, any>;
    };
  }) => void;
  onClose: () => void;
}

export const ModbusConfigModal: React.FC<ModbusConfigModalProps> = ({
  isOpen,
  connectionId,
  addresses = [],
  functionCode = 3,
  availableConnections = [],
  alerts,
  onSave,
  onClose,
}) => {
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '');
  const [addressInput, setAddressInput] = useState('');
  const [addressesList, setAddressesList] = useState<string[]>(addresses);
  const [funcCode, setFuncCode] = useState(functionCode);
  const [alertConfig, setAlertConfig] = useState(alerts || { enabled: false });

  useEffect(() => {
    if (isOpen) {
      setSelectedConnectionId(connectionId || '');
      setAddressesList(addresses || []);
      setFuncCode(functionCode || 3);
      setAlertConfig(alerts || { enabled: false });
    }
  }, [isOpen, connectionId, addresses, functionCode, alerts]);

  const handleAddAddress = () => {
    if (addressInput.trim() && !addressesList.includes(addressInput.trim())) {
      setAddressesList([...addressesList, addressInput.trim()]);
      setAddressInput('');
    }
  };

  const handleRemoveAddress = (address: string) => {
    setAddressesList(addressesList.filter(addr => addr !== address));
  };

  const handleSave = () => {
    if (selectedConnectionId && addressesList.length > 0) {
      onSave({
        modbusConnectionId: selectedConnectionId,
        modbusAddresses: addressesList,
        modbusFunctionCode: funcCode,
        alerts: alertConfig.enabled ? alertConfig : undefined,
      });
    }
  };

  if (!isOpen) return null;

  const isValid = selectedConnectionId && addressesList.length > 0 && funcCode >= 1 && funcCode <= 6;

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure Modbus Input"
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
            Modbus Connection
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
              No Modbus connections available. Create one in Connections first.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Function Code
          </label>
          <select
            value={funcCode}
            onChange={(e) => setFuncCode(parseInt(e.target.value))}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          >
            <option value={1}>1 - Read Coils</option>
            <option value={2}>2 - Read Discrete Inputs</option>
            <option value={3}>3 - Read Holding Registers</option>
            <option value={4}>4 - Read Input Registers</option>
            <option value={5}>5 - Write Single Coil</option>
            <option value={6}>6 - Write Single Register</option>
          </select>
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            Modbus function code determines the type of data to read
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Register Addresses
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddAddress()}
              placeholder="40001"
              className="flex-1 px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              onClick={handleAddAddress}
              disabled={!addressInput.trim()}
              className="px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {addressesList.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
              {addressesList.map((address, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]"
                >
                  <code className="text-xs text-[var(--text-secondary)] font-mono flex-1 truncate">
                    {address}
                  </code>
                  <button
                    onClick={() => handleRemoveAddress(address)}
                    className="ml-2 p-1 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> This node will connect to the Modbus device
            and read the specified register addresses using the selected function code. Data will be output as time-series records.
          </p>
        </div>
      </div>
    </NodeConfigSidePanel>
  );
};
