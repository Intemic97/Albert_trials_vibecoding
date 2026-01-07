import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, Sparkles, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { API_BASE } from '../config';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    data?: any; // For showing query results
    explanation?: string; // How the AI prepared the response
    entitiesUsed?: string[]; // Which entities were analyzed
}

interface DatabaseAssistantProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DatabaseAssistant: React.FC<DatabaseAssistantProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hi! I'm your Database Assistant. Ask me anything about your data - I can navigate through your entities, find records, and answer questions about relationships between your tables.",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && !isMinimized && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen, isMinimized]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const toggleExplanation = (messageId: string) => {
        setExpandedExplanations(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE}/database/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    question: userMessage.content,
                    conversationHistory: messages.slice(-6).map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                })
            });

            const data = await response.json();

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.answer || data.error || 'Sorry, I could not process your question.',
                timestamp: new Date(),
                data: data.queryResults,
                explanation: data.explanation,
                entitiesUsed: data.entitiesUsed
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error asking database:', error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your question. Please try again.',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            <div 
                className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 flex flex-col ${
                    isMinimized ? 'h-14 w-80' : 'h-[560px] w-[440px]'
                }`}
            >
                {/* Header */}
                <div 
                    className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-4 py-3 flex items-center justify-between cursor-pointer shrink-0"
                    onClick={() => setIsMinimized(!isMinimized)}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                            <Sparkles size={18} className="text-amber-300" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">Database Assistant</h3>
                            {!isMinimized && (
                                <p className="text-xs text-slate-300">Ask questions about your data</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                {!isMinimized && (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                                            message.role === 'user'
                                                ? 'bg-slate-800 text-white rounded-br-md'
                                                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm'
                                        }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                        
                                        {/* Show query results if any */}
                                        {message.data && Array.isArray(message.data) && message.data.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-slate-200">
                                                <p className="text-xs font-medium text-slate-500 mb-2">
                                                    Found {message.data.length} result{message.data.length > 1 ? 's' : ''}:
                                                </p>
                                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                                    {message.data.slice(0, 5).map((item: any, idx: number) => (
                                                        <div key={idx} className="bg-slate-50 rounded-lg p-2 text-xs">
                                                            {Object.entries(item).slice(0, 4).map(([key, value]) => (
                                                                <div key={key} className="flex gap-2">
                                                                    <span className="text-slate-400">{key}:</span>
                                                                    <span className="text-slate-700 truncate">
                                                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                    {message.data.length > 5 && (
                                                        <p className="text-xs text-slate-400 text-center">
                                                            + {message.data.length - 5} more results
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* How did I prepare this? - Only for assistant messages with explanation */}
                                        {message.role === 'assistant' && message.explanation && (
                                            <div className="mt-3 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => toggleExplanation(message.id)}
                                                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                                                >
                                                    <Info size={12} />
                                                    How did I prepare this?
                                                </button>

                                                {expandedExplanations.has(message.id) && (
                                                    <div className="mt-2 p-3 bg-teal-50 rounded-lg text-xs text-slate-700 leading-relaxed animate-in fade-in slide-in-from-top-1">
                                                        <p className="whitespace-pre-wrap">{message.explanation}</p>
                                                        {message.entitiesUsed && message.entitiesUsed.length > 0 && (
                                                            <div className="mt-2 pt-2 border-t border-teal-100">
                                                                <span className="text-slate-500">Entities analyzed: </span>
                                                                {message.entitiesUsed.map((entity, idx) => (
                                                                    <span key={entity}>
                                                                        <span className="text-teal-600 font-medium">@{entity}</span>
                                                                        {idx < message.entitiesUsed!.length - 1 && ', '}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        <p className={`text-[10px] mt-2 ${message.role === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Loader2 size={16} className="animate-spin text-slate-400" />
                                            <span className="text-sm text-slate-500">Analyzing your data...</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-slate-200 shrink-0">
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about your data..."
                                    className="flex-1 px-4 py-2.5 bg-slate-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:text-slate-400"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 text-center">
                                Try: "How many customers do we have?" or "Show products with price over 100"
                            </p>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

// Floating Ask Button Component
export const AskButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-full shadow-lg hover:shadow-xl hover:border-slate-300 transition-all group"
        >
            <Sparkles size={18} className="text-amber-500" />
            <span className="text-sm font-medium text-slate-700">Ask</span>
        </button>
    );
};
