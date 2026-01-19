import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Info, Bot, User, Plus, Trash2, MessageSquare, ArrowLeft, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    data?: any;
    explanation?: string;
    entitiesUsed?: string[];
}

interface Chat {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
}

export const Copilots: React.FC = () => {
    const navigate = useNavigate();
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load chats from backend on mount
    useEffect(() => {
        loadChats();
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeChat, chats]);

    // Focus input when chat changes
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [activeChat]);

    const loadChats = async () => {
        try {
            const response = await fetch(`${API_BASE}/copilot/chats`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                const loadedChats = data.chats.map((chat: any) => ({
                    ...chat,
                    createdAt: new Date(chat.createdAt),
                    updatedAt: new Date(chat.updatedAt),
                    messages: chat.messages.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }))
                }));
                
                // If no chats exist, create one
                if (loadedChats.length === 0) {
                    console.log('No chats found, creating default chat');
                    await createNewChat();
                } else {
                    setChats(loadedChats);
                    // Set active chat to most recent if none selected
                    if (!activeChat) {
                        setActiveChat(loadedChats[0].id);
                    }
                }
            } else {
                console.error('Failed to load chats, creating default chat');
                await createNewChat();
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            // Initialize with a default chat if loading fails
            await createNewChat();
        }
    };

    const saveChat = async (chat: Chat) => {
        try {
            await fetch(`${API_BASE}/copilot/chats/${chat.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(chat)
            });
        } catch (error) {
            console.error('Error saving chat:', error);
        }
    };

    const createNewChat = async () => {
        const newChat: Chat = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [{
                id: '1',
                role: 'assistant',
                content: "Good afternoon! I'm your Database Copilot. I can help you navigate through your entities, find records, and answer questions about relationships between your tables. What would you like to know?",
                timestamp: new Date()
            }],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Always update local state immediately so the input becomes enabled
        setChats(prev => [newChat, ...prev]);
        setActiveChat(newChat.id);

        // Try to save to backend
        try {
            await fetch(`${API_BASE}/copilot/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newChat)
            });
        } catch (error) {
            console.error('Error saving chat to backend:', error);
            // Chat is already in local state, so user can continue
        }
    };

    const deleteChat = async (chatId: string) => {
        try {
            await fetch(`${API_BASE}/copilot/chats/${chatId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Error deleting chat:', error);
        }

        setChats(prev => prev.filter(c => c.id !== chatId));
        
        // If deleted chat was active, switch to another
        if (activeChat === chatId) {
            const remainingChats = chats.filter(c => c.id !== chatId);
            if (remainingChats.length > 0) {
                setActiveChat(remainingChats[0].id);
            } else {
                createNewChat();
            }
        }
    };

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

        // If no active chat, create one first
        if (!activeChat) {
            await createNewChat();
            // Wait a bit for the chat to be created
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const currentChat = chats.find(c => c.id === activeChat);
        if (!currentChat) {
            console.error('No chat available to send message');
            return;
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        // Update chat with user message
        const updatedChat = {
            ...currentChat,
            messages: [...currentChat.messages, userMessage],
            updatedAt: new Date(),
            // Auto-generate title from first user message
            title: currentChat.messages.length === 1 ? input.trim().slice(0, 50) : currentChat.title
        };

        setChats(prev => prev.map(c => c.id === activeChat ? updatedChat : c));
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE}/database/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    question: userMessage.content,
                    conversationHistory: currentChat.messages.slice(-6).map(m => ({
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

            const finalChat = {
                ...updatedChat,
                messages: [...updatedChat.messages, assistantMessage],
                updatedAt: new Date()
            };

            setChats(prev => prev.map(c => c.id === activeChat ? finalChat : c));
            saveChat(finalChat);
        } catch (error) {
            console.error('Error asking database:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your question. Please try again.',
                timestamp: new Date()
            };
            
            const finalChat = {
                ...updatedChat,
                messages: [...updatedChat.messages, errorMessage],
                updatedAt: new Date()
            };
            
            setChats(prev => prev.map(c => c.id === activeChat ? finalChat : c));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const currentChat = chats.find(c => c.id === activeChat);
    const messages = currentChat?.messages || [];
    
    // Check if chat is empty (only has the initial assistant message)
    const isEmptyChat = messages.length <= 1 && messages[0]?.role === 'assistant';
    
    const examplePrompts = [
        "How many customers do we have?",
        "Show me products with price over 100",
        "List all recent production orders",
        "What are my top selling products?",
        "Show me customer demographics"
    ];

    return (
        <div className="h-screen flex flex-col bg-white">
            {/* Top Bar */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/overview')}
                        className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-semibold text-slate-900">
                            {currentChat?.title || 'New Chat'}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Chat History */}
                <div
                    className={`bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-300 ${
                        isSidebarOpen ? 'w-80' : 'w-0'
                    } overflow-hidden`}
                >
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-slate-200 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Chats</h2>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                                <X size={16} className="text-slate-500" />
                            </button>
                        </div>
                        <button
                            onClick={createNewChat}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors font-medium"
                        >
                            <Plus size={18} />
                            New Chat
                        </button>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                                    activeChat === chat.id
                                        ? 'bg-white shadow-sm border border-slate-200'
                                        : 'hover:bg-white/50'
                                }`}
                                onClick={() => setActiveChat(chat.id)}
                            >
                                <MessageSquare size={16} className={`shrink-0 ${activeChat === chat.id ? 'text-teal-600' : 'text-slate-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate text-slate-700">{chat.title}</p>
                                    <p className="text-xs text-slate-400">
                                        {chat.messages.length} messages
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteChat(chat.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded-lg transition-all"
                                >
                                    <Trash2 size={14} className="text-red-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Toggle Sidebar Button (when closed) */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute left-4 top-20 p-2 bg-white border border-slate-200 rounded-lg shadow-lg hover:bg-slate-50 transition-colors z-10"
                    >
                        <Menu size={20} className="text-slate-600" />
                    </button>
                )}

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col bg-slate-50">
                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto">
                        {isEmptyChat ? (
                            /* Empty State - Centered */
                            <div className="h-full flex flex-col items-center justify-center px-6">
                                <div className="max-w-3xl w-full space-y-8">
                                    {/* Greeting */}
                                    <div className="text-center space-y-2">
                                        <h2 className="text-3xl font-bold text-slate-900">
                                            Good afternoon, how can I help you today?
                                        </h2>
                                        <p className="text-slate-500">
                                            I'm your Database Copilot. Ask me anything about your data.
                                        </p>
                                    </div>

                                    {/* Centered Input */}
                                    <div className="relative">
                                        <form onSubmit={handleSubmit}>
                                            <textarea
                                                ref={inputRef}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Ask about your data..."
                                                rows={1}
                                                className="w-full px-6 py-4 pr-16 bg-white border-2 border-slate-200 rounded-2xl text-[15px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-400 resize-none shadow-lg transition-all"
                                                style={{ minHeight: '60px', maxHeight: '200px' }}
                                                disabled={isLoading}
                                            />
                                            <button
                                                type="submit"
                                                disabled={!input.trim() || isLoading}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-xl hover:from-teal-700 hover:to-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg disabled:shadow-none"
                                            >
                                                <Send size={20} />
                                            </button>
                                        </form>
                                    </div>

                                    {/* Example Prompts */}
                                    <div className="space-y-3">
                                        <p className="text-sm text-slate-500 text-center">Try asking:</p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {examplePrompts.slice(0, 5).map((prompt, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setInput(prompt)}
                                                    className="px-4 py-2 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50 rounded-full text-sm text-slate-700 transition-all shadow-sm hover:shadow"
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Normal Chat View */
                            <div className="max-w-4xl mx-auto px-6 py-8">
                                <div className="space-y-6">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {message.role === 'assistant' && (
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shrink-0 mt-1">
                                                <Bot size={18} className="text-white" />
                                            </div>
                                        )}

                                        <div className={`flex-1 max-w-3xl ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                                            <div
                                                className={`rounded-2xl px-6 py-4 ${
                                                    message.role === 'user'
                                                        ? 'bg-slate-800 text-white inline-block'
                                                        : 'bg-white border border-slate-200 shadow-sm'
                                                }`}
                                            >
                                                <p className="text-[15px] whitespace-pre-wrap leading-relaxed">{message.content}</p>

                                                {/* Show query results if any */}
                                                {message.data && Array.isArray(message.data) && message.data.length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-slate-200">
                                                        <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">
                                                            Found {message.data.length} result{message.data.length > 1 ? 's' : ''}
                                                        </p>
                                                        <div className="space-y-2 max-h-80 overflow-y-auto">
                                                            {message.data.slice(0, 10).map((item: any, idx: number) => (
                                                                <div key={idx} className="bg-slate-50 rounded-lg p-3 text-sm border border-slate-100">
                                                                    {Object.entries(item).slice(0, 6).map(([key, value]) => (
                                                                        <div key={key} className="flex gap-3 py-0.5">
                                                                            <span className="text-slate-500 font-medium min-w-[120px]">{key}:</span>
                                                                            <span className="text-slate-700 flex-1">
                                                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                            {message.data.length > 10 && (
                                                                <p className="text-sm text-slate-400 text-center py-2">
                                                                    + {message.data.length - 10} more results
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* How did I prepare this? */}
                                                {message.role === 'assistant' && message.explanation && (
                                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                                        <button
                                                            onClick={() => toggleExplanation(message.id)}
                                                            className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
                                                        >
                                                            <Info size={14} />
                                                            How did I prepare this?
                                                        </button>

                                                        {expandedExplanations.has(message.id) && (
                                                            <div className="mt-3 p-4 bg-teal-50 rounded-xl text-sm text-slate-700 leading-relaxed border border-teal-100">
                                                                <p className="whitespace-pre-wrap">{message.explanation}</p>
                                                                {message.entitiesUsed && message.entitiesUsed.length > 0 && (
                                                                    <div className="mt-3 pt-3 border-t border-teal-200">
                                                                        <span className="text-slate-600 font-medium">Entities analyzed: </span>
                                                                        {message.entitiesUsed.map((entity, idx) => (
                                                                            <span key={entity}>
                                                                                <span className="text-teal-700 font-semibold">@{entity}</span>
                                                                                {idx < message.entitiesUsed!.length - 1 && ', '}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <p className={`text-xs mt-3 ${message.role === 'user' ? 'text-slate-400' : 'text-slate-400'}`}>
                                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>

                                        {message.role === 'user' && (
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-1">
                                                <User size={18} className="text-white" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex gap-4 justify-start">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shrink-0 mt-1">
                                            <Bot size={18} className="text-white" />
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <Loader2 size={18} className="animate-spin text-teal-600" />
                                                <span className="text-[15px] text-slate-600">Analyzing your data...</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                    <div ref={messagesEndRef} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area - Fixed at bottom (only for non-empty chat) */}
                    {!isEmptyChat && (
                        <div className="border-t border-slate-200 bg-white shrink-0">
                        <div className="max-w-4xl mx-auto px-6 py-4">
                            <form onSubmit={handleSubmit} className="relative">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask about your data... (Press Enter to send, Shift+Enter for new line)"
                                    rows={1}
                                    className="w-full px-5 py-4 pr-14 bg-slate-50 border border-slate-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-400 resize-none transition-all"
                                    style={{ minHeight: '56px', maxHeight: '200px' }}
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="absolute right-3 bottom-3 p-3 bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-xl hover:from-teal-700 hover:to-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg disabled:shadow-none"
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                            <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-400">
                                <span>Try: "How many customers do we have?"</span>
                                <span>•</span>
                                <span>"Show products with price over 100"</span>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};
