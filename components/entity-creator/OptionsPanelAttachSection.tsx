import React from 'react';
import { Download, SpinnerGap } from '@phosphor-icons/react';

export interface TemplateItem {
    id: string;
    name: string;
    icon: React.ComponentType<{ size?: number; weight?: string }>;
    iconBg: string;
}

interface OptionsPanelAttachSectionProps {
    onAttachClick: () => void;
    isImporting: boolean;
    csvMessage: { type: 'error' | 'success'; text: string } | null;
    datasetAttachedHint: string | null;
    templates: TemplateItem[];
    onApplyTemplate: (template: TemplateItem) => void;
}

export const OptionsPanelAttachSection: React.FC<OptionsPanelAttachSectionProps> = ({
    onAttachClick,
    isImporting,
    csvMessage,
    datasetAttachedHint,
    templates,
    onApplyTemplate,
}) => {
    return (
        <>
            <div className="space-y-1 mb-4">
                <button
                    onClick={onAttachClick}
                    disabled={isImporting}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left disabled:opacity-50 border border-[var(--border-light)]"
                >
                    {isImporting ? (
                        <SpinnerGap size={18} className="animate-spin text-[var(--text-tertiary)]" />
                    ) : (
                        <Download size={18} weight="light" className="text-[var(--text-tertiary)]" />
                    )}
                    Attach dataset
                </button>
                {csvMessage && (
                    <p
                        className={`text-[11px] px-1 ${
                            csvMessage.type === 'error' ? 'text-red-500' : 'text-[var(--text-secondary)]'
                        }`}
                    >
                        {csvMessage.text}
                    </p>
                )}
            </div>
            {datasetAttachedHint && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30">
                    <p className="text-xs text-[var(--text-primary)]">{datasetAttachedHint}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                        Describe above what you want and the AI will do it.
                    </p>
                </div>
            )}
            <div className="mb-5">
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
                    Templates
                </p>
                <div className="space-y-1">
                    {templates.map((template) => (
                        <button
                            key={template.id}
                            onClick={() => onApplyTemplate(template)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                        >
                            <span
                                className={`w-7 h-7 ${template.iconBg} rounded-md flex items-center justify-center`}
                            >
                                {React.createElement(template.icon, { size: 16, weight: 'light' })}
                            </span>
                            {template.name}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
};
