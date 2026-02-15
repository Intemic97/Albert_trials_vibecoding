/**
 * HumanApprovalConfigPanel
 * Extracted from Workflows.tsx lines 9942-10008
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { HandPalm, User, UserCheck, ChatText } from '@phosphor-icons/react';
import { API_BASE } from '../../../config';
import { useAuth } from '../../../context/AuthContext';
import { UserAvatar } from '../../ProfileMenu';

interface HumanApprovalConfigPanelProps {
  nodeId: string;
  node: any;
  nodes: any[];
  onSave: (nodeId: string, config: Record<string, any>, label?: string) => void;
  onClose: () => void;
  openFeedbackPopup?: (type: string, name: string) => void;
}

export const HumanApprovalConfigPanel: React.FC<HumanApprovalConfigPanelProps> = ({
  nodeId, node, nodes, onSave, onClose, openFeedbackPopup
}) => {
  const { user } = useAuth();
  const token = user?.token;
  const organizationId = user?.orgId;
  const [organizationUsers, setOrganizationUsers] = useState<any[]>([]);
  const [selectedApproverUserId, setSelectedApproverUserId] = useState(node?.config?.approverUserId || '');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch(`${API_BASE}/organizations/${organizationId}/members`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setOrganizationUsers(data.members || []);
        }
      } catch (err) { console.error('Failed to load users:', err); }
      finally { setIsLoadingUsers(false); }
    };
    loadUsers();
  }, [organizationId, token]);

  const handleSave = () => {
    const approver = organizationUsers.find(u => u.userId === selectedApproverUserId);
    onSave(nodeId, {
      approverUserId: selectedApproverUserId,
      approverName: approver ? (approver.name || approver.email) : 'Unknown',
    });
  };

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Human in the Loop"
        description="Assign a user to approve this step"
        icon={UserCheck}
        width="w-[450px]"
        footer={
            <button
                onClick={() => onClose()}
                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
                Close
            </button>
        }
    >
            <div className="space-y-5">
                <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                        Assign to
                    </label>
                    {organizationUsers.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)]">
                        <div className="w-5 h-5 border-2 border-[var(--border-medium)] border-t-teal-500 rounded-full animate-spin mr-2" />
                        Loading users...
                    </div>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {organizationUsers.map((user) => {
                            const currentNode = nodes.find(n => n.id === nodeId);
                            const isSelected = currentNode?.config?.assignedUserId === user.id;
                            return (
                                <button
                                    key={user.id}
                                    onClick={() => handleSave(user.id, user.name || user.email, user.profilePhoto)}
                                    className={`w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                                        isSelected
                                            ? 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]'
                                            : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]/50'
                                    }`}
                                >
                                    <UserAvatar name={user.name || user.email} profilePhoto={user.profilePhoto} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-[var(--text-primary)] truncate">
                                            {user.name || 'Unnamed User'}
                                        </div>
                                        <div className="text-xs text-[var(--text-secondary)] truncate">
                                            {user.email}
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        user.role === 'admin'
                                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                    }`}>
                                        {user.role}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
                </div>
            </div>
    </NodeConfigSidePanel>

  );
};
