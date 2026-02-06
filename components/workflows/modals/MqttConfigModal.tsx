/**
 * MQTT Node Configuration Modal
 * Allows configuring MQTT subscription topics
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { X } from '@phosphor-icons/react';
// AlertConfigSection removed - alerts are configured via dedicated Alert Agent node

interface MqttConfigModalProps {
  isOpen: boolean;
  connectionId?: string;
  topics?: string[];
  qos?: number;
  availableConnections?: Array<{ id: string; name: string }>;
  alerts?: {
    enabled: boolean;
    cooldown?: number;
    thresholds?: Record<string, any>;
  };
  onSave: (config: {
    mqttConnectionId: string;
    mqttTopics: string[];
    mqttQos: number;
    alerts?: {
      enabled: boolean;
      cooldown?: number;
      thresholds?: Record<string, any>;
    };
  }) => void;
  onClose: () => void;
}

export const MqttConfigModal: React.FC<MqttConfigModalProps> = ({
  isOpen,
  connectionId,
  topics = [],
  qos = 0,
  availableConnections = [],
  alerts,
  onSave,
  onClose,
}) => {
  const [selectedConnectionId, setSelectedConnectionId] = useState(connectionId || '');
  const [topicInput, setTopicInput] = useState('');
  const [topicsList, setTopicsList] = useState<string[]>(topics);
  const [qosLevel, setQosLevel] = useState(qos);
  const [alertConfig, setAlertConfig] = useState(alerts || { enabled: false });
  const [sparkplugEnabled, setSparkplugEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedConnectionId(connectionId || '');
      setTopicsList(topics || []);
      setQosLevel(qos || 0);
      setAlertConfig(alerts || { enabled: false });
    }
  }, [isOpen, connectionId, topics, qos, alerts]);

  const handleAddTopic = () => {
    if (topicInput.trim() && !topicsList.includes(topicInput.trim())) {
      setTopicsList([...topicsList, topicInput.trim()]);
      setTopicInput('');
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setTopicsList(topicsList.filter(t => t !== topic));
  };

  const handleSave = () => {
    if (selectedConnectionId && topicsList.length > 0) {
      onSave({
        mqttConnectionId: selectedConnectionId,
        mqttTopics: topicsList,
        mqttQos: qosLevel,
        mqttSparkplugB: sparkplugEnabled,
      });
    }
  };

  if (!isOpen) return null;

  const isValid = selectedConnectionId && topicsList.length > 0 && qosLevel >= 0 && qosLevel <= 2;

  return (
    <NodeConfigSidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Configure MQTT Subscriber"
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
            MQTT Connection
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
              No MQTT connections available. Create one in Connections first.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
            Topics to Subscribe
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTopic()}
              placeholder="sensors/temperature/#"
              className="flex-1 px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            <button
              onClick={handleAddTopic}
              disabled={!topicInput.trim()}
              className="px-4 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {topicsList.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
              {topicsList.map((topic, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]"
                >
                  <code className="text-xs text-[var(--text-secondary)] font-mono flex-1 truncate">
                    {topic}
                  </code>
                  <button
                    onClick={() => handleRemoveTopic(topic)}
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
            QoS Level
          </label>
          <select
            value={qosLevel}
            onChange={(e) => setQosLevel(parseInt(e.target.value))}
            className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]"
          >
            <option value={0}>QoS 0 - At most once (fire and forget)</option>
            <option value={1}>QoS 1 - At least once (acknowledged)</option>
            <option value={2}>QoS 2 - Exactly once (guaranteed)</option>
          </select>
          <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
            Quality of Service level for message delivery guarantee
          </p>
        </div>

        {/* Sparkplug B Toggle */}
        <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-light)]">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Sparkplug B Protocol</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Decode IIoT Sparkplug B payloads (protobuf)</p>
          </div>
          <button
            onClick={() => setSparkplugEnabled(!sparkplugEnabled)}
            className="relative inline-flex items-center focus:outline-none"
          >
            <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${sparkplugEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-medium)]'}`}>
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${sparkplugEnabled ? 'translate-x-5' : ''}`} />
            </div>
          </button>
        </div>

        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-medium text-[var(--text-primary)]">Note:</span> This node will subscribe to the specified MQTT topics
            and output messages as they arrive. {sparkplugEnabled ? 'Sparkplug B payloads will be automatically decoded.' : 'Use wildcards (# for multi-level, + for single-level) for flexible subscriptions.'}
          </p>
        </div>

      </div>
    </NodeConfigSidePanel>
  );
};
