/**
 * Telegram Node Configuration Modal
 * Allows configuring Telegram bot and message parameters
 */

import React, { useState } from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Info, TestTube, Robot } from '@phosphor-icons/react';

interface TelegramConfigModalProps {
    isOpen: boolean;
    config: {
        telegramBotToken?: string;
        telegramChatId?: string;
        telegramMessage?: string;
        telegramParseMode?: string;
    };
    onConfigChange: (key: string, value: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export const TelegramConfigModal: React.FC<TelegramConfigModalProps> = ({
    isOpen,
    config,
    onConfigChange,
    onSave,
    onClose,
}) => {
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    if (!isOpen) return null;

    const handleTestMessage = async () => {
        if (!config.telegramBotToken || !config.telegramChatId) return;
        
        setIsTesting(true);
        setTestResult(null);
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: config.telegramChatId,
                    text: '🧪 Test message from Workflow Builder',
                    parse_mode: config.telegramParseMode || 'HTML'
                })
            });
            
            const result = await response.json();
            
            if (result.ok) {
                setTestResult({ success: true, message: 'Test message sent successfully!' });
            } else {
                setTestResult({ success: false, message: `Error: ${result.description}` });
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
            title="Configure Telegram Message"
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
                        disabled={!config.telegramBotToken || !config.telegramChatId || !config.telegramMessage}
                        className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            }
        >
            <div className="space-y-5">
                {/* Bot Token */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Bot Token <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="password"
                        value={config.telegramBotToken || ''}
                        onChange={(e) => onConfigChange('telegramBotToken', e.target.value)}
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono text-xs"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Get this from @BotFather on Telegram
                    </p>
                </div>

                {/* Chat ID */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Chat ID <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={config.telegramChatId || ''}
                        onChange={(e) => onConfigChange('telegramChatId', e.target.value)}
                        placeholder="-1001234567890 or @channelname"
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        User ID, group ID (starts with -), or @username
                    </p>
                </div>

                {/* Message */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Message <span className="text-red-400">*</span>
                    </label>
                    <textarea
                        value={config.telegramMessage || ''}
                        onChange={(e) => onConfigChange('telegramMessage', e.target.value)}
                        placeholder="<b>Workflow completed!</b>\nResults: {{result}}"
                        rows={4}
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] resize-none font-mono text-xs"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Use {"{{fieldName}}"} for placeholders. HTML tags: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;, &lt;a&gt;
                    </p>
                </div>

                {/* Parse Mode */}
                <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                        Parse Mode
                    </label>
                    <select
                        value={config.telegramParseMode || 'HTML'}
                        onChange={(e) => onConfigChange('telegramParseMode', e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    >
                        <option value="HTML">HTML</option>
                        <option value="Markdown">Markdown</option>
                        <option value="MarkdownV2">MarkdownV2</option>
                    </select>
                </div>

                {/* Test Button */}
                {config.telegramBotToken && config.telegramChatId && (
                    <div className="pt-2">
                        <button
                            onClick={handleTestMessage}
                            disabled={isTesting}
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
                    <Robot size={16} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" weight="light" />
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        <p className="font-medium text-[var(--text-primary)] mb-1">How to get a Bot Token:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Open Telegram and search for @BotFather</li>
                            <li>Send /newbot and follow the instructions</li>
                            <li>Copy the bot token provided</li>
                            <li>Add the bot to your chat/group</li>
                        </ol>
                    </div>
                </div>
            </div>
        </NodeConfigSidePanel>
    );
};

export default TelegramConfigModal;
