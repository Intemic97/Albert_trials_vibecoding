import React from 'react';
import { Sparkle, Icon, SpinnerGap } from '@phosphor-icons/react';

interface AIPromptSectionProps {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    generatingText?: string;
    icon?: Icon;
    buttonText?: string;
}

export const AIPromptSection: React.FC<AIPromptSectionProps> = ({
    label,
    placeholder,
    value,
    onChange,
    onGenerate,
    isGenerating,
    generatingText = 'Generating...',
    icon: IconComponent = Sparkle,
    buttonText = 'Generate'
}) => {
    return (
        <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <IconComponent size={14} weight="fill" className="text-[var(--text-secondary)]" />
                {label}
            </label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={(e) => e.key === 'Enter' && !isGenerating && onGenerate()}
                    className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                    disabled={isGenerating}
                />
                <button
                    onClick={onGenerate}
                    disabled={isGenerating || !value.trim()}
                    className="flex items-center px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2 whitespace-nowrap"
                >
                    {isGenerating ? (
                        <>
                            <SpinnerGap size={14} weight="bold" className="animate-spin" />
                            {generatingText}
                        </>
                    ) : (
                        <>
                            <IconComponent size={14} weight="fill" />
                            {buttonText}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
