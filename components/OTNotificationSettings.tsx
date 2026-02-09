/**
 * OT Notification Settings Component
 * Configure email notifications for OT alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Envelope,
    Bell,
    BellRinging,
    Gear,
    FloppyDisk,
    TestTube,
    SpinnerGap,
    CheckCircle,
    XCircle,
    Plus,
    X,
    Info
} from '@phosphor-icons/react';
import { API_BASE } from '../config';

interface NotificationSettings {
    smtpEnabled: boolean;
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPass: string;
    emailRecipients: string[];
    alertSeverities: ('error' | 'warning')[];
    emailEnabled: boolean;
    browserEnabled: boolean;
    cooldownMinutes: number;
}

interface OTNotificationSettingsProps {
    onClose?: () => void;
    isModal?: boolean;
}

export const OTNotificationSettings: React.FC<OTNotificationSettingsProps> = ({
    onClose,
    isModal = false
}) => {
    const [settings, setSettings] = useState<NotificationSettings>({
        smtpEnabled: false,
        smtpHost: '',
        smtpPort: '587',
        smtpUser: '',
        smtpPass: '',
        emailRecipients: [],
        alertSeverities: ['error'],
        emailEnabled: true,
        browserEnabled: true,
        cooldownMinutes: 5
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [newRecipient, setNewRecipient] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchSettings = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/ot-notification-settings`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setSettings({
                    ...settings,
                    ...data,
                    emailRecipients: data.emailRecipients || [],
                    alertSeverities: data.alertSeverities || ['error']
                });
            }
        } catch (error) {
            console.error('Error fetching notification settings:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        
        try {
            const res = await fetch(`${API_BASE}/ot-notification-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(settings)
            });
            
            if (res.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully' });
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestEmail = async () => {
        if (!testEmail) {
            setMessage({ type: 'error', text: 'Please enter a test email address' });
            return;
        }
        
        setIsTesting(true);
        setMessage(null);
        
        try {
            const res = await fetch(`${API_BASE}/ot-notification-settings/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ testEmail })
            });
            
            const data = await res.json();
            
            if (data.success) {
                setMessage({ type: 'success', text: 'Test email sent successfully' });
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to send test email' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to send test email' });
        } finally {
            setIsTesting(false);
        }
    };

    const addRecipient = () => {
        if (newRecipient && !settings.emailRecipients.includes(newRecipient)) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newRecipient)) {
                setMessage({ type: 'error', text: 'Please enter a valid email address' });
                return;
            }
            setSettings({
                ...settings,
                emailRecipients: [...settings.emailRecipients, newRecipient]
            });
            setNewRecipient('');
        }
    };

    const removeRecipient = (email: string) => {
        setSettings({
            ...settings,
            emailRecipients: settings.emailRecipients.filter(e => e !== email)
        });
    };

    const toggleSeverity = (severity: 'error' | 'warning') => {
        const current = settings.alertSeverities;
        if (current.includes(severity)) {
            if (current.length > 1) { // Keep at least one
                setSettings({
                    ...settings,
                    alertSeverities: current.filter(s => s !== severity)
                });
            }
        } else {
            setSettings({
                ...settings,
                alertSeverities: [...current, severity]
            });
        }
    };

    const content = (
        <div className="space-y-6">
            {/* Message */}
            {message && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                    message.type === 'success' 
                        ? 'bg-green-500/10 text-green-600 border border-green-500/20' 
                        : 'bg-red-500/10 text-red-600 border border-red-500/20'
                }`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    {message.text}
                </div>
            )}

            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="flex items-center gap-3">
                    <BellRinging size={24} className="text-[var(--accent-primary)]" />
                    <div>
                        <h4 className="font-medium text-[var(--text-primary)]">Email Notifications</h4>
                        <p className="text-xs text-[var(--text-tertiary)]">
                            Receive email alerts when OT thresholds are exceeded
                        </p>
                    </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={settings.smtpEnabled}
                        onChange={(e) => setSettings({ ...settings, smtpEnabled: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                </label>
            </div>

            {settings.smtpEnabled && (
                <>
                    {/* SMTP Settings */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <Gear size={16} />
                            SMTP Configuration
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    SMTP Host
                                </label>
                                <input
                                    type="text"
                                    value={settings.smtpHost}
                                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                                    placeholder="smtp.gmail.com"
                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    SMTP Port
                                </label>
                                <input
                                    type="text"
                                    value={settings.smtpPort}
                                    onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                                    placeholder="587"
                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    SMTP Username
                                </label>
                                <input
                                    type="email"
                                    value={settings.smtpUser}
                                    onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                                    placeholder="your-email@gmail.com"
                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    SMTP Password / App Password
                                </label>
                                <input
                                    type="password"
                                    value={settings.smtpPass}
                                    onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                                    placeholder="••••••••"
                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <p className="text-xs text-blue-600 flex items-start gap-2">
                                <Info size={14} className="flex-shrink-0 mt-0.5" />
                                For Gmail, use an App Password instead of your regular password. 
                                Go to Google Account → Security → 2-Step Verification → App passwords.
                            </p>
                        </div>
                    </div>

                    {/* Recipients */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <Envelope size={16} />
                            Email Recipients
                        </h4>
                        
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={newRecipient}
                                onChange={(e) => setNewRecipient(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addRecipient()}
                                placeholder="Add email address..."
                                className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                            />
                            <button
                                onClick={addRecipient}
                                className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                            >
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                        
                        {settings.emailRecipients.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {settings.emailRecipients.map((email) => (
                                    <div
                                        key={email}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-full text-sm text-[var(--text-primary)]"
                                    >
                                        <Envelope size={14} className="text-[var(--text-tertiary)]" />
                                        {email}
                                        <button
                                            onClick={() => removeRecipient(email)}
                                            className="p-0.5 hover:bg-red-500/20 rounded-full transition-colors"
                                        >
                                            <X size={12} className="text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-[var(--text-tertiary)] italic">
                                No recipients added yet
                            </p>
                        )}
                    </div>

                    {/* Alert Severities */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <Bell size={16} />
                            Alert Severities to Notify
                        </h4>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => toggleSeverity('error')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                    settings.alertSeverities.includes('error')
                                        ? 'bg-red-500/10 border-red-500/30 text-red-600'
                                        : 'bg-[var(--bg-tertiary)] border-[var(--border-light)] text-[var(--text-secondary)]'
                                }`}
                            >
                                <XCircle size={16} />
                                Errors
                                {settings.alertSeverities.includes('error') && <CheckCircle size={14} />}
                            </button>
                            <button
                                onClick={() => toggleSeverity('warning')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                    settings.alertSeverities.includes('warning')
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                                        : 'bg-[var(--bg-tertiary)] border-[var(--border-light)] text-[var(--text-secondary)]'
                                }`}
                            >
                                <Bell size={16} />
                                Warnings
                                {settings.alertSeverities.includes('warning') && <CheckCircle size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Cooldown */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                            Rate Limiting
                        </h4>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-[var(--text-secondary)]">
                                Don't send duplicate alerts within
                            </span>
                            <select
                                value={settings.cooldownMinutes}
                                onChange={(e) => setSettings({ ...settings, cooldownMinutes: parseInt(e.target.value) })}
                                className="px-3 py-1.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                            >
                                <option value={1}>1 minute</option>
                                <option value={5}>5 minutes</option>
                                <option value={15}>15 minutes</option>
                                <option value={30}>30 minutes</option>
                                <option value={60}>1 hour</option>
                            </select>
                        </div>
                    </div>

                    {/* Test Email */}
                    <div className="space-y-4 p-4 bg-[var(--bg-tertiary)] rounded-lg">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <TestTube size={16} />
                            Test Configuration
                        </h4>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                placeholder="Enter email to send test..."
                                className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                            />
                            <button
                                onClick={handleTestEmail}
                                disabled={isTesting}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isTesting ? (
                                    <SpinnerGap size={16} className="animate-spin" />
                                ) : (
                                    <Envelope size={16} />
                                )}
                                Send Test
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-light)]">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                )}
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {isSaving ? (
                        <SpinnerGap size={16} className="animate-spin" />
                    ) : (
                        <FloppyDisk size={16} />
                    )}
                    Save Settings
                </button>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <SpinnerGap size={24} className="text-[var(--text-tertiary)] animate-spin" />
            </div>
        );
    }

    if (isModal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
                <div 
                    className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6 border-b border-[var(--border-light)]">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                            <BellRinging size={24} className="text-[var(--accent-primary)]" />
                            OT Alert Notification Settings
                        </h3>
                    </div>
                    <div className="p-6">
                        {content}
                    </div>
                </div>
            </div>
        );
    }

    return content;
};
