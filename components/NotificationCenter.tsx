import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    Bell, BellRinging, X, Check, CheckCircle, WarningCircle, XCircle, Info,
    Trash, Eye, EyeSlash, GearSix, CaretRight, Clock, GitBranch, Database,
    ChartBar, Lightning, SpinnerGap
} from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { generateUUID } from '../utils/uuid';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType = 'success' | 'warning' | 'error' | 'info';
export type NotificationSource = 'workflow' | 'data' | 'system' | 'alert';

export interface Notification {
    id: string;
    type: NotificationType;
    source: NotificationSource;
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    actionUrl?: string;
    metadata?: Record<string, any>;
}

export interface AlertConfig {
    id: string;
    name: string;
    enabled: boolean;
    source: NotificationSource;
    condition: string;
    notifyEmail: boolean;
    notifyInApp: boolean;
    createdAt: Date;
}

// ============================================================================
// NOTIFICATION BELL BUTTON
// ============================================================================

interface NotificationBellProps {
    onClick: () => void;
    unreadCount: number;
}

export const NotificationBell = React.forwardRef<HTMLButtonElement, NotificationBellProps>(
    ({ onClick, unreadCount }, ref) => {
        const hasUnread = unreadCount > 0;
        
        const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            onClick();
        };
        
        return (
            <button
                ref={ref}
                onClick={handleClick}
                className="relative p-1.5 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                title="Notifications"
                data-notification-bell
            >
                <Bell size={16} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" weight="light" />
                {hasUnread && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#256A65] rounded-full" />
                )}
            </button>
        );
    }
);

// ============================================================================
// NOTIFICATION CENTER PANEL
// ============================================================================

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
    triggerRef?: React.RefObject<HTMLButtonElement>;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, triggerRef }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'settings'>('all');
    const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
    const panelRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // Calculate position based on trigger button
    useEffect(() => {
        if (isOpen && triggerRef?.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                left: Math.max(16, rect.left - 280 + rect.width) // Align right edge with button, min 16px from left
            });
        }
    }, [isOpen, triggerRef]);

    // Fetch notifications on mount
    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
            fetchAlertConfigs();
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Ignore clicks on the bell button itself (toggle handles that)
            if (target.closest('[data-notification-bell]')) {
                return;
            }
            if (panelRef.current && !panelRef.current.contains(target)) {
                onClose();
            }
        };
        
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/notifications`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setNotifications(Array.isArray(data) ? data.map((n: any) => ({
                    ...n,
                    timestamp: new Date(n.timestamp)
                })) : []);
            } else {
                // Mock data for demo
                setNotifications(getMockNotifications());
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            setNotifications(getMockNotifications());
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAlertConfigs = async () => {
        try {
            const res = await fetch(`${API_BASE}/alert-configs`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setAlertConfigs(Array.isArray(data) ? data : []);
            } else {
                setAlertConfigs(getMockAlertConfigs());
            }
        } catch (error) {
            setAlertConfigs(getMockAlertConfigs());
        }
    };

    const markAsRead = async (id: string) => {
        setNotifications(prev => 
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        
        try {
            await fetch(`${API_BASE}/notifications/${id}/read`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        
        try {
            await fetch(`${API_BASE}/notifications/read-all`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const deleteNotification = async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        
        try {
            await fetch(`${API_BASE}/notifications/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const clearAll = async () => {
        if (!confirm('Clear all notifications?')) return;
        setNotifications([]);
        
        try {
            await fetch(`${API_BASE}/notifications`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    const toggleAlertConfig = (id: string) => {
        setAlertConfigs(prev =>
            prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
        );
    };

    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(n => !n.read)
        : notifications;

    const unreadCount = notifications.filter(n => !n.read).length;

    if (!isOpen) return null;

    return createPortal(
        <div 
            ref={panelRef}
            className="fixed w-80 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-2xl overflow-hidden z-[99999]"
            style={{ top: position.top, left: position.left }}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--border-light)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bell size={16} className="text-[#256A65]" weight="light" />
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Notifications</h3>
                    {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-[#256A65] text-white text-[10px] font-bold rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="p-1.5 text-xs text-[#256A65] hover:bg-[#256A65]/10 rounded-lg transition-colors"
                        >
                            Mark all read
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                    >
                        <X size={14} weight="light" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border-light)]">
                {(['all', 'unread', 'settings'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                            activeTab === tab
                                ? 'text-[#256A65] border-b-2 border-[#256A65] -mb-px'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        {tab === 'all' ? 'All' : tab === 'unread' ? `Unread (${unreadCount})` : 'Settings'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto">
                {activeTab === 'settings' ? (
                    <div className="p-4 space-y-3">
                        <h4 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                            Alert Configurations
                        </h4>
                        {alertConfigs.length === 0 ? (
                            <p className="text-xs text-[var(--text-tertiary)] text-center py-4">
                                No alerts configured
                            </p>
                        ) : (
                            alertConfigs.map(config => (
                                <div
                                    key={config.id}
                                    className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${
                                            config.source === 'workflow' ? 'bg-[#84C4D1]/20 text-[#256A65]' :
                                            config.source === 'data' ? 'bg-amber-100 text-amber-600' :
                                            'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                                        }`}>
                                            {config.source === 'workflow' ? <GitBranch size={14} weight="light" /> :
                                             config.source === 'data' ? <Database size={14} weight="light" /> :
                                             <Lightning size={14} weight="light" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-[var(--text-primary)]">{config.name}</p>
                                            <p className="text-[10px] text-[var(--text-tertiary)]">{config.condition}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleAlertConfig(config.id)}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${
                                            config.enabled ? 'bg-[#256A65]' : 'bg-[var(--border-medium)]'
                                        }`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                            config.enabled ? 'translate-x-5' : 'translate-x-0.5'
                                        }`} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                ) : isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <SpinnerGap size={24} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Bell size={32} className="text-[var(--text-tertiary)] mb-2" weight="light" />
                        <p className="text-sm text-[var(--text-secondary)]">
                            {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--border-light)]">
                        {filteredNotifications.map(notification => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onMarkAsRead={() => markAsRead(notification.id)}
                                onDelete={() => deleteNotification(notification.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            {activeTab !== 'settings' && notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-[var(--border-light)] flex justify-between">
                    <button
                        onClick={clearAll}
                        className="text-xs text-red-500 hover:text-red-600 transition-colors"
                    >
                        Clear all
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        <GearSix size={12} weight="light" />
                        Configure alerts
                    </button>
                </div>
            )}
        </div>,
        document.body
    );
};

// ============================================================================
// NOTIFICATION ITEM
// ============================================================================

interface NotificationItemProps {
    notification: Notification;
    onMarkAsRead: () => void;
    onDelete: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    onMarkAsRead,
    onDelete
}) => {
    const getIcon = () => {
        switch (notification.type) {
            case 'success': return <CheckCircle size={16} className="text-emerald-500" weight="fill" />;
            case 'warning': return <WarningCircle size={16} className="text-amber-500" weight="fill" />;
            case 'error': return <XCircle size={16} className="text-red-500" weight="fill" />;
            default: return <Info size={16} className="text-[#256A65]" weight="fill" />;
        }
    };

    const getSourceIcon = () => {
        switch (notification.source) {
            case 'workflow': return <GitBranch size={10} weight="light" />;
            case 'data': return <Database size={10} weight="light" />;
            case 'alert': return <Lightning size={10} weight="light" />;
            default: return <Info size={10} weight="light" />;
        }
    };

    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <div
            className={`relative p-4 hover:bg-[var(--bg-tertiary)] transition-colors group ${
                !notification.read ? 'bg-[#256A65]/5' : ''
            }`}
        >
            {/* Unread indicator */}
            {!notification.read && (
                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#256A65] rounded-full" />
            )}
            
            <div className="flex gap-3">
                <div className="shrink-0 mt-0.5">{getIcon()}</div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${notification.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)] font-medium'}`}>
                            {notification.title}
                        </p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.read && (
                                <button
                                    onClick={onMarkAsRead}
                                    className="p-1 text-[var(--text-tertiary)] hover:text-[#256A65] hover:bg-[#256A65]/10 rounded transition-colors"
                                    title="Mark as read"
                                >
                                    <Check size={12} weight="bold" />
                                </button>
                            )}
                            <button
                                onClick={onDelete}
                                className="p-1 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                            >
                                <Trash size={12} weight="light" />
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                        {notification.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
                            {getSourceIcon()}
                            {notification.source}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">•</span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                            {timeAgo(notification.timestamp)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MOCK DATA
// ============================================================================

const getMockNotifications = (): Notification[] => [
    {
        id: '1',
        type: 'success',
        source: 'workflow',
        title: 'Workflow completed',
        message: 'Data Import Pipeline finished successfully. 1,234 records processed.',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        read: false
    },
    {
        id: '2',
        type: 'warning',
        source: 'data',
        title: 'Low storage warning',
        message: 'Storage usage is at 85%. Consider cleaning up old data.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        read: false
    },
    {
        id: '3',
        type: 'error',
        source: 'workflow',
        title: 'Workflow failed',
        message: 'API Sync workflow failed at step 3: Connection timeout.',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        read: true
    },
    {
        id: '4',
        type: 'info',
        source: 'system',
        title: 'New feature available',
        message: 'Try the new Dashboard widgets with real-time data preview.',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        read: true
    }
];

const getMockAlertConfigs = (): AlertConfig[] => [
    {
        id: '1',
        name: 'Workflow Failures',
        enabled: true,
        source: 'workflow',
        condition: 'When any workflow fails',
        notifyEmail: true,
        notifyInApp: true,
        createdAt: new Date()
    },
    {
        id: '2',
        name: 'Data Changes',
        enabled: false,
        source: 'data',
        condition: 'When records are modified',
        notifyEmail: false,
        notifyInApp: true,
        createdAt: new Date()
    }
];

// ============================================================================
// HOOK
// ============================================================================

export const useNotificationCenter = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // Fetch initial unread count
        fetchUnreadCount();
        
        // Poll for updates every 30 seconds
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchUnreadCount = async () => {
        try {
            const res = await fetch(`${API_BASE}/notifications/unread-count`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.count || 0);
            } else {
                // Mock count
                setUnreadCount(2);
            }
        } catch (error) {
            setUnreadCount(2);
        }
    };

    return {
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(prev => !prev),
        unreadCount,
        refreshCount: fetchUnreadCount
    };
};

export default NotificationCenter;
