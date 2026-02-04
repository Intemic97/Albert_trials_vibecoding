/**
 * Google Sheets Node Configuration Modal
 * Allows configuring Google Sheets read/write operations
 */

import React from 'react';
import { NodeConfigSidePanel } from '../../NodeConfigSidePanel';
import { Info, Table, ArrowsDownUp } from '@phosphor-icons/react';

interface GoogleSheetsConfigModalProps {
    isOpen: boolean;
    config: {
        googleApiKey?: string;
        spreadsheetId?: string;
        sheetRange?: string;
        operation?: string;
    };
    onConfigChange: (key: string, value: string) => void;
    onSave: () => void;
    onClose: () => void;
}

export const GoogleSheetsConfigModal: React.FC<GoogleSheetsConfigModalProps> = ({
    isOpen,
    config,
    onConfigChange,
    onSave,
    onClose,
}) => {
    if (!isOpen) return null;

    const extractSpreadsheetId = (input: string) => {
        // Try to extract ID from full URL
        const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
            return match[1];
        }
        // Return as-is if it looks like just an ID
        return input;
    };

    const handleSpreadsheetInput = (value: string) => {
        const id = extractSpreadsheetId(value);
        onConfigChange('spreadsheetId', id);
    };

    return (
        <NodeConfigSidePanel
            isOpen={isOpen}
            onClose={onClose}
            title="Configure Google Sheets"
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
                        disabled={!config.spreadsheetId}
                        className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </div>
            }
        >
            <div className="space-y-5">
                {/* Operation */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Operation
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { value: 'read', label: 'Read', icon: '📖' },
                            { value: 'write', label: 'Write', icon: '✏️' },
                            { value: 'append', label: 'Append', icon: '➕' },
                        ].map((op) => (
                            <button
                                key={op.value}
                                onClick={() => onConfigChange('operation', op.value)}
                                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                                    config.operation === op.value || (!config.operation && op.value === 'read')
                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                        : 'border-[var(--border-light)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--border-medium)]'
                                }`}
                            >
                                <span className="text-lg">{op.icon}</span>
                                <span className="text-xs font-medium">{op.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* API Key */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        API Key <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
                    </label>
                    <input
                        type="password"
                        value={config.googleApiKey || ''}
                        onChange={(e) => onConfigChange('googleApiKey', e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono text-xs"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        For public sheets, or use GOOGLE_API_KEY env variable
                    </p>
                </div>

                {/* Spreadsheet ID / URL */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Spreadsheet URL or ID <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={config.spreadsheetId || ''}
                        onChange={(e) => handleSpreadsheetInput(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/... or just the ID"
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                    />
                    {config.spreadsheetId && (
                        <p className="text-xs text-green-500 mt-1">
                            ID: {config.spreadsheetId}
                        </p>
                    )}
                </div>

                {/* Sheet Range */}
                <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                        Range
                    </label>
                    <input
                        type="text"
                        value={config.sheetRange || ''}
                        onChange={(e) => onConfigChange('sheetRange', e.target.value)}
                        placeholder="Sheet1!A1:Z1000"
                        className="w-full px-3 py-2.5 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)] font-mono"
                    />
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        Format: SheetName!A1:Z100. Default: Sheet1!A1:Z1000
                    </p>
                </div>

                {/* Operation Info */}
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg flex gap-3">
                    <ArrowsDownUp size={16} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" weight="light" />
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        <p className="font-medium text-[var(--text-primary)] mb-1">Data Format:</p>
                        <ul className="space-y-1">
                            <li><strong>Read:</strong> First row = headers, returns array of objects</li>
                            <li><strong>Write:</strong> Overwrites range with input data</li>
                            <li><strong>Append:</strong> Adds rows after existing data</li>
                        </ul>
                    </div>
                </div>

                {/* Info Box */}
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg flex gap-3">
                    <Info size={16} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" weight="light" />
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        <p className="font-medium text-[var(--text-primary)] mb-1">Setup:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Make your spreadsheet public (Share → Anyone with link)</li>
                            <li>Or create an API key in Google Cloud Console</li>
                            <li>Enable Google Sheets API for your project</li>
                        </ol>
                    </div>
                </div>
            </div>
        </NodeConfigSidePanel>
    );
};

export default GoogleSheetsConfigModal;
