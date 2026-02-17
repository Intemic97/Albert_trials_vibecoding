/**
 * HumanApprovalConfigPanel
 * Config panel for Human-in-the-Loop nodes.
 * Allows assigning a user and choosing notification channel (platform / email).
 */

import React, { useState, useEffect } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { HandPalm, User, UserCheck, ChatText, Bell, EnvelopeSimple, Check } from '@phosphor-icons/react';
import { API_BASE } from '../../../config';
import { useAuth } from '../../../context/AuthContext';
import { UserAvatar } from '../../ProfileMenu';

type NotificationChannel = 'platform' | 'email' | 'both';

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
  const [organizationUsers, setOrganizationUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Derive current config from node
  const currentNode = nodes.find(n => n.id === nodeId);
  const currentConfig = currentNode?.config || {};

  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentConfig.assignedUserId || null);
  const [selectedUserName, setSelectedUserName] = useState<string>(currentConfig.assignedUserName || '');
  const [selectedUserPhoto, setSelectedUserPhoto] = useState<string | undefined>(currentConfig.assignedUserPhoto);
  const [notificationChannel, setNotificationChannel] = useState<NotificationChannel>(currentConfig.notificationChannel || 'platform');

  useEffect(() => {
    const loadUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch(`${API_BASE}/organization/users`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setOrganizationUsers(Array.isArray(data) ? data : []);
        }
      } catch (err) { console.error('Failed to load users:', err); }
      finally { setIsLoadingUsers(false); }
    };
    loadUsers();
  }, []);

  const handleUserSelect = (userId: string, userName: string, profilePhoto?: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setSelectedUserPhoto(profilePhoto);
  };

  const handleSave = () => {
    if (!selectedUserId) return;
    onSave(nodeId, {
      assignedUserId: selectedUserId,
      assignedUserName: selectedUserName,
      assignedUserPhoto: selectedUserPhoto,
      notificationChannel,
    });
    onClose();
  };

  const channelOptions: { value: NotificationChannel; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: 'platform',
      label: 'Platform',
      description: 'In-app notification',
      icon: <Bell size={16} weight="bold" />,
    },
    {
      value: 'email',
      label: 'Email',
      description: 'Send email to user',
      icon: <EnvelopeSimple size={16} weight="bold" />,
    },
    {
      value: 'both',
      label: 'Both',
      description: 'Platform + Email',
      icon: (
        <div className="flex items-center -space-x-1">
          <Bell size={13} weight="bold" />
          <EnvelopeSimple size={13} weight="bold" />
        </div>
      ),
    },
  ];

  return (
    <NodeConfigSidePanel
        isOpen={!!nodeId}
        onClose={() => onClose()}
        title="Human in the Loop"
        description="Assign a user and configure how they'll be notified"
        icon={UserCheck}
        width="w-[450px]"
        footer={
          <div className="flex items-center gap-2 w-full justify-end">
            <button
                onClick={() => onClose()}
                className="flex items-center px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
                Cancel
            </button>
            <button
                onClick={handleSave}
                disabled={!selectedUserId}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedUserId
                    ? 'bg-teal-600 text-white hover:bg-teal-700'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                }`}
            >
                <Check size={14} weight="bold" />
                Save
            </button>
          </div>
        }
    >
        <div className="space-y-5">
            {/* ─── User list ─── */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                    Assign to
                </label>
                {isLoadingUsers ? (
                    <div className="flex items-center justify-center py-8 text-[var(--text-tertiary)]">
                        <div className="w-5 h-5 border-2 border-[var(--border-medium)] border-t-teal-500 rounded-full animate-spin mr-2" />
                        Loading users...
                    </div>
                ) : organizationUsers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[var(--text-tertiary)]">
                        No users found in your organization.
                    </div>
                ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {organizationUsers.map((u) => {
                            const isSelected = selectedUserId === u.id;
                            return (
                                <button
                                    key={u.id}
                                    onClick={() => handleUserSelect(u.id, u.name || u.email, u.profilePhoto)}
                                    className={`w-full p-3 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                                        isSelected
                                            ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/20'
                                            : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]/50'
                                    }`}
                                >
                                    <UserAvatar name={u.name || u.email} profilePhoto={u.profilePhoto} size="sm" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-[var(--text-primary)] truncate">
                                            {u.name || 'Unnamed User'}
                                        </div>
                                        <div className="text-xs text-[var(--text-secondary)] truncate">
                                            {u.email}
                                        </div>
                                    </div>
                                    {isSelected && (
                                      <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                                        <Check size={12} weight="bold" className="text-white" />
                                      </div>
                                    )}
                                    {!isSelected && (
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                          u.role === 'admin'
                                              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                                              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                      }`}>
                                          {u.role}
                                      </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── Divider ─── */}
            <div className="border-t border-[var(--border-light)]" />

            {/* ─── Notification channel ─── */}
            <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Notify via
                </label>
                <p className="text-[10px] text-[var(--text-tertiary)] mb-3">
                    Choose how the assigned user will be notified when this step requires their approval.
                </p>
                <div className="grid grid-cols-3 gap-2">
                    {channelOptions.map((opt) => {
                        const isActive = notificationChannel === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setNotificationChannel(opt.value)}
                                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${
                                    isActive
                                        ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                                        : 'border-[var(--border-light)] hover:border-[var(--border-medium)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    isActive ? 'bg-teal-100 dark:bg-teal-800/50' : 'bg-[var(--bg-tertiary)]'
                                }`}>
                                    {opt.icon}
                                </div>
                                <span className="text-xs font-medium">{opt.label}</span>
                                <span className="text-[10px] text-[var(--text-tertiary)] leading-tight">{opt.description}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    </NodeConfigSidePanel>
  );
};
