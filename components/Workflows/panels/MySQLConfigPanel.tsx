/**
 * MySQLConfigPanel
 * Extracted from Workflows.tsx lines 7825-7936
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Database, ChatText } from '@phosphor-icons/react';

interface MySQLConfigPanelProps {
  nodeId: string;
  node: any;
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;

}

export const MySQLConfigPanel: React.FC<MySQLConfigPanelProps> = ({ nodeId, node, onSave, onClose, openFeedbackPopup }) => {
  const [mysqlHost, setMysqlHost] = useState(node?.config?.mysqlHost || 'localhost');
  const [mysqlPort, setMysqlPort] = useState(node?.config?.mysqlPort || '3306');
  const [mysqlDatabase, setMysqlDatabase] = useState(node?.config?.mysqlDatabase || '');
  const [mysqlUsername, setMysqlUsername] = useState(node?.config?.mysqlUsername || '');
  const [mysqlPassword, setMysqlPassword] = useState(node?.config?.mysqlPassword || '');
  const [mysqlQuery, setMysqlQuery] = useState(node?.config?.mysqlQuery || 'SELECT * FROM ');

  const handleSave = () => {
    onSave(nodeId, { mysqlHost, mysqlPort, mysqlDatabase, mysqlUsername, mysqlPassword, mysqlQuery }, `MySQL: ${mysqlDatabase || 'query'}`);
    onClose();
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="MySQL"
        icon={Database}
        footer={
            <>
                <button
                    onClick={() => onClose()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!mysqlQuery.trim()}
                    className="flex items-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save
                </button>
            </>
        }
    >
        <div className="space-y-5">
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Host
                </label>
                    <input
                        type="text"
                        value={mysqlHost}
                        onChange={(e) => setMysqlHost(e.target.value)}
                        placeholder="localhost"
                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            Port
                        </label>
                        <input
                            type="text"
                            value={mysqlPort}
                            onChange={(e) => setMysqlPort(e.target.value)}
                            placeholder="3306"
                            className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                            Database
                        </label>
                        <input
                            type="text"
                            value={mysqlDatabase}
                            onChange={(e) => setMysqlDatabase(e.target.value)}
                            placeholder="mydb"
                            className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Username
                    </label>
                    <input
                        type="text"
                        value={mysqlUsername}
                        onChange={(e) => setMysqlUsername(e.target.value)}
                        placeholder="root"
                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Password
                    </label>
                    <input
                        type="password"
                        value={mysqlPassword}
                        onChange={(e) => setMysqlPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        SQL Query
                    </label>
                    <textarea
                        value={mysqlQuery}
                        onChange={(e) => setMysqlQuery(e.target.value)}
                        placeholder="SELECT * FROM users"
                        rows={3}
                        className="w-full px-3 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] font-mono placeholder:text-[var(--text-tertiary)]"
                    />
                </div>
            {/* Feedback Link */}
            <div className="pt-3 border-t border-[var(--border-light)]">
                <button
                    onClick={() => openFeedbackPopup('mysql', 'MySQL')}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 transition-colors"
                >
                    <ChatText size={12} />
                    What would you like this node to do?
                </button>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
