import React from 'react';
import { Sparkles, LucideIcon } from 'lucide-react';

interface AIPromptSectionProps {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    generatingText?: string;
    icon?: LucideIcon;
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
    icon: Icon = Sparkles,
    buttonText = 'Generate'
}) => {
    return (
        <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Icon size={14} className="text-slate-600" />
                {label}
            </label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={(e) => e.key === 'Enter' && !isGenerating && onGenerate()}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400 bg-white"
                    disabled={isGenerating}
                />
                <button
                    onClick={onGenerate}
                    disabled={isGenerating || !value.trim()}
                    className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2 whitespace-nowrap"
                >
                    {isGenerating ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {generatingText}
                        </>
                    ) : (
                        <>
                            <Icon size={14} />
                            {buttonText}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
