import React, { useState, useRef, useEffect } from 'react';
import { Entity, Property } from '../types';
import { Database, Hash, ArrowCircleLeft, PaperPlaneTilt } from '@phosphor-icons/react';

interface PromptInputProps {
    entities: Entity[];
    companyInfo?: any;
    onGenerate: (prompt: string, mentionedEntityIds: string[]) => void;
    isGenerating: boolean;
    placeholder?: string;
    buttonLabel?: string;
    className?: string;
    initialValue?: string;
    onChange?: (value: string, mentionedIds: string[]) => void;
    hideButton?: boolean;
    inputData?: any[]; // Data from previous node for @ mention
}

type MentionType = 'entity' | 'attribute';

interface MentionState {
    isActive: boolean;
    type: MentionType;
    query: string;
    top: number;
    left: number;
    triggerIndex: number;
    entityContext?: Entity; // For attribute mentions
}

export const PromptInput: React.FC<PromptInputProps> = ({
    entities,
    companyInfo,
    onGenerate,
    isGenerating,
    placeholder = "Ask a question...",
    buttonLabel = "Generate",
    className = "",
    initialValue = "",
    onChange,
    hideButton = false,
    inputData
}) => {
    const [prompt, setPrompt] = useState(initialValue);
    const [mention, setMention] = useState<MentionState>({
        isActive: false,
        type: 'entity',
        query: '',
        top: 0,
        left: 0,
        triggerIndex: -1
    });

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Filter suggestions based on query
    const getSuggestions = () => {
        if (!mention.isActive) return [];

        const query = mention.query.toLowerCase();

        if (mention.type === 'entity') {
            const entitySuggestions = entities.filter(e =>
                e.name.toLowerCase().includes(query)
            );

            // Add company info fields as pseudo-entities
            const companyFields: Entity[] = companyInfo ? [
                { id: 'company_name', name: 'Company Name', properties: [], description: 'Company Name', lastEdited: '', author: 'System' },
                { id: 'company_industry', name: 'Industry', properties: [], description: 'Company Industry', lastEdited: '', author: 'System' },
                { id: 'company_employees', name: 'Employees', properties: [], description: 'Number of Employees', lastEdited: '', author: 'System' },
                { id: 'company_website', name: 'Website', properties: [], description: 'Company Website', lastEdited: '', author: 'System' },
                { id: 'company_linkedin', name: 'LinkedIn', properties: [], description: 'LinkedIn Profile', lastEdited: '', author: 'System' },
                { id: 'company_headquarters', name: 'Headquarters', properties: [], description: 'Headquarters Location', lastEdited: '', author: 'System' },
                { id: 'company_founding_year', name: 'Founding Year', properties: [], description: 'Year Founded', lastEdited: '', author: 'System' },
                { id: 'company_overview', name: 'Company Overview', properties: [], description: 'Company Overview', lastEdited: '', author: 'System' }
            ] : [];

            const companySuggestions = companyFields.filter(f =>
                f.name.toLowerCase().includes(query)
            );

            // Add Input Data option if inputData is available
            const inputDataOption: Entity[] = (inputData && inputData.length > 0 && 'input data'.includes(query)) ? [
                { id: '__input_data__', name: 'Input Data', properties: [], description: 'Data from previous node', lastEdited: '', author: 'System' }
            ] : [];

            return [...inputDataOption, ...entitySuggestions, ...companySuggestions];
        } else if (mention.type === 'attribute' && mention.entityContext) {
            return mention.entityContext.properties.filter(p =>
                p.name.toLowerCase().includes(query)
            );
        }
        return [];
    };

    const suggestions = getSuggestions();

    useEffect(() => {
        setSelectedIndex(0);
    }, [mention.query, mention.type]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setPrompt(val);

        if (onChange) {
            const mentionedIds = entities
                .filter(ent => val.includes(`@${ent.name}`))
                .map(ent => ent.id);
            onChange(val, mentionedIds);
        }

        const cursor = e.target.selectionStart;

        // Check for triggers
        // 1. Entity Trigger: @
        // 2. Attribute Trigger: . (only if preceded by an entity name)

        // Look backwards from cursor
        const textBeforeCursor = val.slice(0, cursor);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            // Check if there's a space between @ and cursor (cancel mention)
            const textSinceAt = textBeforeCursor.slice(lastAt + 1);
            if (textSinceAt.includes(' ')) {
                setMention(prev => ({ ...prev, isActive: false }));
                return;
            }

            // Check for dot to switch to attribute mode
            const dotIndex = textSinceAt.indexOf('.');

            if (dotIndex !== -1) {
                // Potential attribute mention
                // Extract entity name: @EntityName.
                const entityName = textSinceAt.slice(0, dotIndex);
                const entity = entities.find(e => e.name === entityName);

                if (entity) {
                    const attrQuery = textSinceAt.slice(dotIndex + 1);
                    updateMentionPosition(cursor);
                    setMention({
                        isActive: true,
                        type: 'attribute',
                        query: attrQuery,
                        top: 0, // Updated by updateMentionPosition
                        left: 0,
                        triggerIndex: lastAt + 1 + dotIndex + 1, // Start of attribute query
                        entityContext: entity
                    });
                    return;
                }
            }

            // Entity mode
            updateMentionPosition(lastAt + 1);
            setMention({
                isActive: true,
                type: 'entity',
                query: textSinceAt,
                top: 0,
                left: 0,
                triggerIndex: lastAt + 1
            });
        } else {
            setMention(prev => ({ ...prev, isActive: false }));
        }
    };

    const updateMentionPosition = (cursorIndex: number) => {
        if (!textareaRef.current || !mirrorRef.current) return;

        const text = textareaRef.current.value;
        const textBefore = text.slice(0, cursorIndex);

        // Update mirror content
        mirrorRef.current.textContent = textBefore;

        // Create a span to measure position
        const span = document.createElement('span');
        span.textContent = '.';
        mirrorRef.current.appendChild(span);

        const rect = span.getBoundingClientRect();
        const textareaRect = textareaRef.current.getBoundingClientRect();

        setMention(prev => ({
            ...prev,
            top: rect.top - textareaRect.top + 24, // Offset
            left: rect.left - textareaRect.left
        }));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (mention.isActive) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (suggestions.length > 0) {
                    selectSuggestion(suggestions[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                setMention(prev => ({ ...prev, isActive: false }));
            }
        } else if (e.key === 'Enter' && !e.shiftKey && !hideButton) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const selectSuggestion = (item: Entity | Property) => {
        if (!textareaRef.current) return;

        const text = prompt;
        let insertText = '';
        let newCursorPos = 0;

        if (mention.type === 'entity') {
            const entity = item as Entity;
            insertText = entity.name;

            const start = text.lastIndexOf('@', textareaRef.current.selectionStart);
            const end = textareaRef.current.selectionStart;

            const newText = text.slice(0, start) + '@' + insertText + text.slice(end);
            setPrompt(newText);
            newCursorPos = start + 1 + insertText.length;

            if (onChange) {
                const mentionedIds = entities
                    .filter(ent => newText.includes(`@${ent.name}`))
                    .map(ent => ent.id);
                onChange(newText, mentionedIds);
            }

        } else {
            const prop = item as Property;
            insertText = prop.name;

            const start = text.lastIndexOf('.', textareaRef.current.selectionStart);
            const end = textareaRef.current.selectionStart;

            const newText = text.slice(0, start) + '.' + insertText + text.slice(end);
            setPrompt(newText);
            newCursorPos = start + 1 + insertText.length;

            if (onChange) {
                const mentionedIds = entities
                    .filter(ent => newText.includes(`@${ent.name}`))
                    .map(ent => ent.id);
                onChange(newText, mentionedIds);
            }
        }

        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);

        setMention(prev => ({ ...prev, isActive: false }));
    };

    const handleSubmit = () => {
        if (!prompt.trim() || isGenerating) return;

        // Extract mentioned entity IDs from the prompt
        const mentionedIds = entities
            .filter(e => prompt.includes(`@${e.name}`))
            .map(e => e.id);

        onGenerate(prompt, mentionedIds);
    };

    // Expose a method to set prompt externally (e.g. from templates)
    useEffect(() => {
        // This is a bit of a hack to allow parent to set prompt if needed, 
        // but for now we'll just rely on the parent passing a key to reset or similar if needed.
        // Or we could lift state up, but that might be too much refactoring.
    }, []);

    return (
        <div className={`relative group focus-within:ring-2 focus-within:ring-teal-500/20 transition-all ${className}`}>
            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full h-32 p-4 pr-14 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] transition-colors text-[var(--text-primary)] leading-relaxed placeholder:text-[var(--text-tertiary)]"
                />
                
                {/* Inline Send Button (like Copilots) */}
                <button
                    onClick={handleSubmit}
                    disabled={isGenerating || !prompt.trim()}
                    className="absolute right-3 bottom-3 w-10 h-10 flex items-center justify-center bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Send (Enter)"
                >
                    {isGenerating ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <PaperPlaneTilt size={16} weight="light" />
                    )}
                </button>

                {/* Suggestion Popover */}
                {mention.isActive && suggestions.length > 0 && (
                    <div
                        className="absolute z-50 w-64 bg-[var(--bg-card)] rounded-lg shadow-xl border border-[var(--border-light)] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                        style={{
                            top: mention.top,
                            left: mention.left
                        }}
                    >
                        <div className="bg-slate-50 px-3 py-2 border-b border-[var(--border-light)] text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">
                            {mention.type === 'entity' ? (inputData && inputData.length > 0 ? 'Data Sources' : 'Entities') : `Properties of ${mention.entityContext?.name}`}
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {suggestions.map((item, index) => (
                                <button
                                    key={item.id}
                                    onClick={() => selectSuggestion(item)}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${index === selectedIndex
                                        ? 'bg-teal-50 text-teal-700'
                                        : 'text-[var(--text-primary)] hover:bg-slate-50'
                                        }`}
                                >
                                    {mention.type === 'entity' ? (
                                        item.id === '__input_data__' ? (
                                            <ArrowCircleLeft size={14} weight="light" className="text-teal-500" />
                                        ) : (
                                            <Database size={14} weight="light" className="text-[var(--text-tertiary)]" />
                                        )
                                    ) : (
                                        <Hash size={14} weight="light" className="text-[var(--text-tertiary)]" />
                                    )}
                                    <span>{item.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Mirror div for positioning */}
                <div
                    ref={mirrorRef}
                    className="absolute top-0 left-0 w-full h-full p-4 pointer-events-none invisible whitespace-pre-wrap font-sans text-base leading-relaxed"
                />
            </div>

            {!hideButton && (
                <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center space-x-4 text-xs text-[var(--text-tertiary)]">
                        <span className="flex items-center">
                            <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mr-1.5 font-sans">@</kbd>
                            to mention entities
                        </span>
                        <span className="flex items-center">
                            <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mr-1.5 font-sans">.</kbd>
                            for attributes
                        </span>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">{buttonLabel}</span>
                </div>
            )}
        </div>
    );
};
