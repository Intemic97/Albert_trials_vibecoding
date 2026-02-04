/**
 * Slack Node Configuration Modal
 * Allows configuring Slack webhook and message parameters
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Info, TestTube } from '@phosphor-icons/react';

interface SlackConfigModalProps {
    isOpen: boolean;
    config: {
        slackWebhookUrl?: string;
        slackChannel?: string;
        slackMessage?: string;
        slackUsername?: string;
        slackIconEmoji?: string;
    };
    onConfigChange: (key: string, value: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export const SlackConfigModal: React.FC<SlackConfigModalProps> = ({
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
        return url?.startsWith('https://hooks.slack.com/') || url?.startsWith('https://');
    };

    const handleTestMessage = async () => {
        if (!config.slackWebhookUrl) return;
        
        setIsTesting(true);
        setTestResult(null);
        
        try {
            const response = await fetch(config.slackWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: '🧪 Test message from Workflow Builder',
                    username: config.slackUsername || 'Workflow Bot',
                    icon_emoji: config.slackIconEmoji || ':robot_face:',
                    ...(config.slackChannel && { channel: config.slackChannel })
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
            title="Configure Slack Message"
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
                        disabled={!config.slackWebhookUrl || !config.slackMessage}
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
                        value={config.slackWebhookUrl || ''}
                        onChange={(e) => onConfigChange('slackWebhookUrl', e.target.value)}
                        placeholder="https://hooks.slack.com/services/T.../B.../..."
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono text-xs"
                    />
                    {config.slackWebhookUrl && !isValidWebhookUrl(config.slackWebhookUrl) && (
                        <p className="text-xs text-yellow-500 mt-1.5">
                            Webhook URL should start with https://hooks.slack.com/
                        </p>
                    )}
                </div>

                {/* Channel (optional) */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Channel <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
                    </label>
                    <input
                        type="text"
                        value={config.slackChannel || ''}
                        onChange={(e) => onConfigChange('slackChannel', e.target.value)}
                        placeholder="#general"
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Override the default channel. Leave empty to use webhook's default.
                    </p>
                </div>

                {/* Message */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Message <span className="text-red-400">*</span>
                    </label>
                    <textarea
                        value={config.slackMessage || ''}
                        onChange={(e) => onConfigChange('slackMessage', e.target.value)}
                        placeholder="Workflow completed! Results: {{result}}"
                        rows={4}
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Use {"{{fieldName}}"} to include data from previous nodes.
                    </p>
                </div>

                {/* Advanced Options */}
                <div className="space-y-4">
                    <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Advanced Options
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                                Bot Username
                            </label>
                            <input
                                type="text"
                                value={config.slackUsername || ''}
                                onChange={(e) => onConfigChange('slackUsername', e.target.value)}
                                placeholder="Workflow Bot"
                                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                                Icon Emoji
                            </label>
                            <input
                                type="text"
                                value={config.slackIconEmoji || ''}
                                onChange={(e) => onConfigChange('slackIconEmoji', e.target.value)}
                                placeholder=":robot_face:"
                                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                    </div>
                </div>

                {/* Test Button */}
                {config.slackWebhookUrl && (
                    <div className="pt-2">
                        <button
                            onClick={handleTestMessage}
                            disabled={isTesting || !isValidWebhookUrl(config.slackWebhookUrl)}
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
                            <li>Go to your Slack workspace settings</li>
                            <li>Navigate to Apps → Incoming Webhooks</li>
                            <li>Create a new webhook and select a channel</li>
                            <li>Copy the webhook URL</li>
                        </ol>
                    </div>
                </div>
            </div>
        </NodeConfigSidePanel>
    );
};

export default SlackConfigModal;
