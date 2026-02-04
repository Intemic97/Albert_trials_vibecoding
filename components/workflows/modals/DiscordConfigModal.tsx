/**
 * Discord Node Configuration Modal
 * Allows configuring Discord webhook and message parameters
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Info, TestTube } from '@phosphor-icons/react';

interface DiscordConfigModalProps {
    isOpen: boolean;
    config: {
        discordWebhookUrl?: string;
        discordMessage?: string;
        discordUsername?: string;
        discordAvatarUrl?: string;
        discordEmbedTitle?: string;
        discordEmbedColor?: string;
    };
    onConfigChange: (key: string, value: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export const DiscordConfigModal: React.FC<DiscordConfigModalProps> = ({
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
        return url?.startsWith('https://discord.com/api/webhooks/') || url?.startsWith('https://discordapp.com/api/webhooks/');
    };

    const handleTestMessage = async () => {
        if (!config.discordWebhookUrl) return;
        
        setIsTesting(true);
        setTestResult(null);
        
        try {
            const response = await fetch(config.discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: '🧪 Test message from Workflow Builder',
                    username: config.discordUsername || 'Workflow Bot',
                    ...(config.discordAvatarUrl && { avatar_url: config.discordAvatarUrl })
                })
            });
            
            if (response.ok || response.status === 204) {
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
            title="Configure Discord Message"
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
                        disabled={!config.discordWebhookUrl || (!config.discordMessage && !config.discordEmbedTitle)}
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
                        value={config.discordWebhookUrl || ''}
                        onChange={(e) => onConfigChange('discordWebhookUrl', e.target.value)}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono text-xs"
                    />
                    {config.discordWebhookUrl && !isValidWebhookUrl(config.discordWebhookUrl) && (
                        <p className="text-xs text-yellow-500 mt-1.5">
                            Webhook URL should start with https://discord.com/api/webhooks/
                        </p>
                    )}
                </div>

                {/* Message */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Message
                    </label>
                    <textarea
                        value={config.discordMessage || ''}
                        onChange={(e) => onConfigChange('discordMessage', e.target.value)}
                        placeholder="Workflow completed! Results: {{result}}"
                        rows={3}
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Use {"{{fieldName}}"} to include data from previous nodes.
                    </p>
                </div>

                {/* Embed Options */}
                <div className="space-y-4">
                    <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Embed Options
                    </p>
                    
                    <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                            Embed Title
                        </label>
                        <input
                            type="text"
                            value={config.discordEmbedTitle || ''}
                            onChange={(e) => onConfigChange('discordEmbedTitle', e.target.value)}
                            placeholder="Workflow Result"
                            className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                            Embed Color
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={`#${config.discordEmbedColor || '5865F2'}`}
                                onChange={(e) => onConfigChange('discordEmbedColor', e.target.value.replace('#', ''))}
                                className="w-10 h-10 rounded border border-[var(--border-light)] cursor-pointer"
                            />
                            <input
                                type="text"
                                value={config.discordEmbedColor || '5865F2'}
                                onChange={(e) => onConfigChange('discordEmbedColor', e.target.value.replace('#', ''))}
                                placeholder="5865F2"
                                className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Advanced Options */}
                <div className="space-y-4">
                    <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                        Bot Appearance
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                                Bot Username
                            </label>
                            <input
                                type="text"
                                value={config.discordUsername || ''}
                                onChange={(e) => onConfigChange('discordUsername', e.target.value)}
                                placeholder="Workflow Bot"
                                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                                Avatar URL
                            </label>
                            <input
                                type="url"
                                value={config.discordAvatarUrl || ''}
                                onChange={(e) => onConfigChange('discordAvatarUrl', e.target.value)}
                                placeholder="https://..."
                                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                    </div>
                </div>

                {/* Test Button */}
                {config.discordWebhookUrl && (
                    <div className="pt-2">
                        <button
                            onClick={handleTestMessage}
                            disabled={isTesting || !isValidWebhookUrl(config.discordWebhookUrl)}
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
                            <li>Open your Discord server settings</li>
                            <li>Go to Integrations → Webhooks</li>
                            <li>Create a new webhook and select a channel</li>
                            <li>Copy the webhook URL</li>
                        </ol>
                    </div>
                </div>
            </div>
        </NodeConfigSidePanel>
    );
};

export default DiscordConfigModal;
