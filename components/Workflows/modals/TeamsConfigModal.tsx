/**
 * Microsoft Teams Node Configuration Modal
 * Allows configuring Teams webhook and message parameters
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Info, TestTube } from '@phosphor-icons/react';

interface TeamsConfigModalProps {
    isOpen: boolean;
    config: {
        teamsWebhookUrl?: string;
        teamsMessage?: string;
        teamsTitle?: string;
        teamsThemeColor?: string;
    };
    onConfigChange: (key: string, value: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export const TeamsConfigModal: React.FC<TeamsConfigModalProps> = ({
    isOpen,
    config,
    onConfigChange,
    onSave,
    onClose,
}) => {
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    if (!isOpen) return null;

    const isValidWebhookUrl = (url: string) => {
        return url?.includes('webhook.office.com') || url?.includes('outlook.office.com');
    };

    const handleTestMessage = async () => {
        if (!config.teamsWebhookUrl) return;
        
        setIsTesting(true);
        setTestResult(null);
        
        try {
            const response = await fetch(config.teamsWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    '@type': 'MessageCard',
                    '@context': 'http://schema.org/extensions',
                    themeColor: (config.teamsThemeColor || '0078D4').replace('#', ''),
                    summary: 'Test Message',
                    sections: [{
                        activityTitle: 'Test Message',
                        text: '🧪 Test message from Workflow Builder',
                        markdown: true
                    }]
                })
            });
            
            if (response.ok) {
                setTestResult({ success: true, message: 'Test message sent successfully!' });
            } else {
                setTestResult({ success: false, message: `Error: ${response.statusText}` });
            }
        } catch (error) {
            setTestResult({ success: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <NodeConfigSidePanel
            isOpen={isOpen}
            onClose={onClose}
            title="Configure Teams Message"
            footer={
                <div className="flex items-center gap-3 w-full">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!config.teamsWebhookUrl || !config.teamsMessage}
                        className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            }
        >
            <div className="space-y-5">
                {/* Webhook URL */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Webhook URL <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="url"
                        value={config.teamsWebhookUrl || ''}
                        onChange={(e) => onConfigChange('teamsWebhookUrl', e.target.value)}
                        placeholder="https://outlook.office.com/webhook/..."
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono text-xs"
                    />
                    {config.teamsWebhookUrl && !isValidWebhookUrl(config.teamsWebhookUrl) && (
                        <p className="text-xs text-yellow-500 mt-1.5">
                            Webhook URL should be from Office 365
                        </p>
                    )}
                </div>

                {/* Title */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Card Title
                    </label>
                    <input
                        type="text"
                        value={config.teamsTitle || ''}
                        onChange={(e) => onConfigChange('teamsTitle', e.target.value)}
                        placeholder="Workflow Notification"
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                    />
                </div>

                {/* Message */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Message <span className="text-red-400">*</span>
                    </label>
                    <textarea
                        value={config.teamsMessage || ''}
                        onChange={(e) => onConfigChange('teamsMessage', e.target.value)}
                        placeholder="Workflow completed! Results: {{result}}"
                        rows={4}
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Use {"{{fieldName}}"} to include data from previous nodes. Markdown supported.
                    </p>
                </div>

                {/* Theme Color */}
                <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                        Theme Color
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="color"
                            value={`#${config.teamsThemeColor || '0078D4'}`}
                            onChange={(e) => onConfigChange('teamsThemeColor', e.target.value.replace('#', ''))}
                            className="w-10 h-10 rounded border border-[var(--border-light)] cursor-pointer"
                        />
                        <input
                            type="text"
                            value={config.teamsThemeColor || '0078D4'}
                            onChange={(e) => onConfigChange('teamsThemeColor', e.target.value.replace('#', ''))}
                            placeholder="0078D4"
                            className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono"
                        />
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Color shown on the left edge of the card
                    </p>
                </div>

                {/* Test Button */}
                {config.teamsWebhookUrl && (
                    <div className="pt-2">
                        <button
                            onClick={handleTestMessage}
                            disabled={isTesting || !isValidWebhookUrl(config.teamsWebhookUrl)}
                            className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
                        >
                            <TestTube size={16} weight="light" />
                            {isTesting ? 'Sending...' : 'Send Test Message'}
                        </button>
                        
                        {testResult && (
                            <p className={`text-xs mt-2 ${testResult.success ? 'text-green-500' : 'text-red-400'}`}>
                                {testResult.message}
                            </p>
                        )}
                    </div>
                )}

                {/* Info Box */}
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg flex gap-3">
                    <Info size={16} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" weight="light" />
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        <p className="font-medium text-[var(--text-primary)] mb-1">How to get a Webhook URL:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Open your Teams channel</li>
                            <li>Click ••• → Connectors</li>
                            <li>Find "Incoming Webhook" and configure</li>
                            <li>Name it and copy the webhook URL</li>
                        </ol>
                    </div>
                </div>
            </div>
        </NodeConfigSidePanel>
    );
};

export default TeamsConfigModal;
