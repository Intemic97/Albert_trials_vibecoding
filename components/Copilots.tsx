import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Info, Bot, User, Plus, Trash2, MessageSquare, ArrowLeft, Menu, X, Sparkles, Database, Check, XCircle, ChevronsLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE } from '../config';
import { Entity } from '../types';

// Intemic Logo Icon Component
const IntemicIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            {/* Left curvilinear shape - chevron/parenthesis opening left */}
            <path
                d="M 4 4 Q 2 8 2 12 Q 2 16 4 20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
            />
            {/* Right curvilinear shape - chevron/parenthesis opening right */}
            <path
                d="M 20 4 Q 22 8 22 12 Q 22 16 20 20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
            />
            {/* Center circle */}
            <circle
                cx="12"
                cy="12"
                r="2"
                fill="currentColor"
            />
        </svg>
    );
};

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
    instructions?: string;
    allowedEntities?: string[];
}

export const Copilots: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChat, setActiveChat] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitle, setEditingTitle] = useState('');
    const [showCopilotModal, setShowCopilotModal] = useState(false);
    const [copilotName, setCopilotName] = useState('');
    const [copilotInstructions, setCopilotInstructions] = useState('');
    const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
    const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
    const [isLoadingEntities, setIsLoadingEntities] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    // Load chats from backend on mount
    useEffect(() => {
        loadChats();
        loadEntities();
    }, []);

    const loadEntities = async () => {
        try {
            setIsLoadingEntities(true);
            const response = await fetch(`${API_BASE}/entities`, {
                credentials: 'include'
            });
            if (response.ok) {
                const entities = await response.json();
                setAvailableEntities(entities);
            }
        } catch (error) {
            console.error('Error loading entities:', error);
        } finally {
            setIsLoadingEntities(false);
        }
    };

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

    useEffect(() => {
        if (isEditingTitle) {
            setTimeout(() => titleInputRef.current?.focus(), 0);
        }
    }, [isEditingTitle]);

    const loadChats = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/copilot/chats`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                const loadedChats = (data.chats || []).map((chat: any) => ({
                    ...chat,
                    createdAt: chat.createdAt ? new Date(chat.createdAt) : new Date(),
                    updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : new Date(),
                    instructions: chat.instructions || undefined,
                    allowedEntities: chat.allowedEntities || [],
                    messages: (chat.messages || []).map((msg: any) => ({
                        ...msg,
                        id: msg.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
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
                body: JSON.stringify({
                    title: chat.title,
                    messages: chat.messages,
                    updatedAt: chat.updatedAt.toISOString(),
                    instructions: chat.instructions,
                    allowedEntities: chat.allowedEntities
                })
            });
        } catch (error) {
            console.error('Error saving chat:', error);
        }
    };

    const handleCreateCopilot = () => {
        setCopilotName('');
        setCopilotInstructions('');
        setSelectedEntities([]);
        setShowCopilotModal(true);
    };

    const createNewChat = async (name?: string, instructions?: string, entities?: string[]) => {
        const defaultInstructions = instructions || "You are a helpful database assistant. Help users navigate through their entities, find records, and answer questions about relationships between tables.";
        const welcomeMessage = instructions 
            ? `Hello! I'm ${name || 'your Copilot'}. ${instructions}\n\nWhat would you like to know?`
            : "Good afternoon! I'm your Database Copilot. I can help you navigate through your entities, find records, and answer questions about relationships between your tables. What would you like to know?";

        const newChat: Chat = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: name || 'New Copilot',
            messages: [{
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                role: 'assistant',
                content: welcomeMessage,
                timestamp: new Date()
            }],
            createdAt: new Date(),
            updatedAt: new Date(),
            instructions: defaultInstructions,
            allowedEntities: entities || []
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

    const handleSaveCopilot = () => {
        if (!copilotName.trim()) {
            alert('Please enter a name for your copilot');
            return;
        }
        createNewChat(copilotName.trim(), copilotInstructions.trim() || undefined, selectedEntities);
        setShowCopilotModal(false);
        setCopilotName('');
        setCopilotInstructions('');
        setSelectedEntities([]);
    };

    const toggleEntitySelection = (entityId: string) => {
        setSelectedEntities(prev => 
            prev.includes(entityId) 
                ? prev.filter(id => id !== entityId)
                : [...prev, entityId]
        );
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
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
                    })),
                    chatId: currentChat.id,
                    instructions: currentChat.instructions,
                    allowedEntities: currentChat.allowedEntities
                })
            });

            const data = await response.json();

            const assistantMessage: Message = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        "List all recent orders",
        "What are my top selling products?",
        "Show me customer demographics"
    ];

    const chatQuery = new URLSearchParams(location.search).get('q')?.toLowerCase() || '';
    const chatIdParam = new URLSearchParams(location.search).get('chatId');
    const filteredChats = chatQuery
        ? chats.filter(chat => chat.title.toLowerCase().includes(chatQuery))
        : chats;

    useEffect(() => {
        if (chatIdParam && chats.some(chat => chat.id === chatIdParam)) {
            setActiveChat(chatIdParam);
        }
    }, [chatIdParam, chats]);

    const saveChatTitle = async () => {
        if (!currentChat) return;
        const nextTitle = editingTitle.trim();
        if (!nextTitle) {
            setIsEditingTitle(false);
            return;
        }
        const updatedChat = { ...currentChat, title: nextTitle, updatedAt: new Date() };
        setChats(prev => prev.map(c => c.id === currentChat.id ? updatedChat : c));
        setIsEditingTitle(false);
        await saveChat(updatedChat);
    };

    return (
        <div className="h-screen flex flex-col bg-white">
            {/* Top Bar */}
            <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/overview')}
                        className="flex items-center gap-2 px-2 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors text-sm"
                    >
                        <ArrowLeft size={14} />
                        <span className="font-medium">Back</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        {isEditingTitle ? (
                            <input
                                ref={titleInputRef}
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={saveChatTitle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        saveChatTitle();
                                    }
                                    if (e.key === 'Escape') {
                                        setIsEditingTitle(false);
                                    }
                                }}
                                className="px-2 py-1 border border-slate-200 rounded-md text-sm bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-300 selection:bg-slate-200 selection:text-slate-800"
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!currentChat) return;
                                    setEditingTitle(currentChat.title || 'New Chat');
                                    setIsEditingTitle(true);
                                }}
                                className="text-sm font-normal text-slate-800 hover:text-slate-700 active:text-slate-700 focus:outline-none transition-colors bg-transparent active:bg-transparent appearance-none"
                            >
                                {currentChat?.title || 'Database Copilot'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Chat History */}
                <div
                    className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${
                        isSidebarOpen ? 'w-80' : 'w-0'
                    } overflow-hidden`}
                >
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-slate-200 shrink-0 bg-white">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-light text-slate-400 uppercase tracking-wider" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Your Copilots</h2>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ChevronsLeft size={14} className="text-slate-400" />
                            </button>
                        </div>
                        <button
                            onClick={handleCreateCopilot}
                            className="w-full flex items-center justify-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md"
                        >
                            <Sparkles size={14} className="mr-2" />
                            New Copilot
                        </button>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {filteredChats.map(chat => (
                            <div
                                key={chat.id}
                                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                                    activeChat === chat.id
                                        ? 'bg-white shadow-sm border border-slate-200'
                                        : 'hover:bg-white/70'
                                }`}
                                onClick={() => setActiveChat(chat.id)}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                    activeChat === chat.id
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                                }`}>
                                    <IntemicIcon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-normal truncate text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>{chat.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {chat.messages.length} {chat.messages.length === 1 ? 'message' : 'messages'}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteChat(chat.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded transition-all"
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
                                    <div className="text-center space-y-3">
                                        <h2 className="text-2xl font-normal text-slate-900 leading-tight" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
                                            Ask me anything about your data.
                                        </h2>
                                        <p className="text-sm text-slate-600 font-normal">
                                            Try a quick prompt below or write your own question.
                                        </p>
                                    </div>

                                    {/* Centered Input */}
                                    <div className="relative">
                                        <form onSubmit={handleSubmit} className="relative">
                                            <textarea
                                                ref={inputRef}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Ask about your data..."
                                                rows={1}
                                                className="w-full px-5 py-4 pr-16 bg-white border border-slate-200 rounded-xl text-[15px] focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 placeholder:text-slate-400 resize-none transition-all"
                                                style={{ minHeight: '64px', maxHeight: '200px' }}
                                                disabled={isLoading}
                                            />
                                            <button
                                                type="submit"
                                                disabled={!input.trim() || isLoading}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Send size={16} />
                                            </button>
                                            <div className="flex items-center space-x-4 text-xs text-slate-400 mt-2">
                                                <span className="flex items-center">
                                                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded mr-1.5 font-sans">@</kbd>
                                                    to mention entities
                                                </span>
                                                <span className="flex items-center">
                                                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded mr-1.5 font-sans">.</kbd>
                                                    for attributes
                                                </span>
                                            </div>
                                        </form>
                                    </div>

                                    {/* Example Prompts */}
                                    <div className="space-y-4">
                                        <p className="text-sm text-slate-600 text-center font-normal">Try asking:</p>
                                        <div className="flex flex-wrap gap-3 justify-center">
                                            {examplePrompts.slice(0, 5).map((prompt, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setInput(prompt)}
                                                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-white rounded-lg text-sm text-slate-700 font-normal transition-all shadow-sm hover:shadow"
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
                                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 mt-1">
                                                <IntemicIcon size={16} className="text-white" />
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
                                                        <p className="text-xs font-normal text-slate-600 mb-3 uppercase tracking-wide">
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
                                                                                <span className="text-teal-700 font-normal">@{entity}</span>
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
                                    className="w-full px-5 py-4 pr-16 bg-slate-50 border border-slate-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-400 resize-none transition-all"
                                    style={{ minHeight: '56px', maxHeight: '200px' }}
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Send size={16} />
                                </button>
                                <div className="flex items-center space-x-4 text-xs text-slate-400 mt-2">
                                    <span className="flex items-center">
                                        <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded mr-1.5 font-sans">@</kbd>
                                        to mention entities
                                    </span>
                                    <span className="flex items-center">
                                        <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded mr-1.5 font-sans">.</kbd>
                                        for attributes
                                    </span>
                                </div>
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

            {/* New Copilot Configuration Modal */}
            {showCopilotModal && (
                <div 
                    className="fixed inset-0 bg-[#256A65]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
                    onClick={() => setShowCopilotModal(false)}
                >
                    <div 
                        className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-[#256A65]/5 to-transparent">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-lg bg-[#256A65] flex items-center justify-center">
                                    <Sparkles size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-normal text-slate-900" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Create New Copilot</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Configure your AI assistant with custom instructions and data access</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Copilot Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={copilotName}
                                    onChange={(e) => setCopilotName(e.target.value)}
                                    placeholder="e.g., Sales Assistant, Customer Support Bot"
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#256A65] focus:border-transparent placeholder:text-slate-400"
                                    autoFocus
                                />
                            </div>

                            {/* Instructions */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Instructions
                                </label>
                                <textarea
                                    value={copilotInstructions}
                                    onChange={(e) => setCopilotInstructions(e.target.value)}
                                    placeholder="Define how your copilot should behave. For example: 'You are a sales assistant focused on customer data. Always provide concise answers and cite specific records when possible. Focus on revenue and customer metrics.'"
                                    rows={5}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#256A65] focus:border-transparent placeholder:text-slate-400 resize-none"
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    Describe the copilot's role, tone, and focus areas. Mention which datasets it should prioritize.
                                </p>
                            </div>

                            {/* Entity Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Available Datasets
                                </label>
                                <p className="text-xs text-slate-500 mb-3">
                                    Select which entities this copilot can access. Leave empty to allow access to all entities.
                                </p>
                                
                                {isLoadingEntities ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 size={20} className="animate-spin text-slate-400" />
                                    </div>
                                ) : availableEntities.length === 0 ? (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 text-center">
                                        No entities available. Create entities in Knowledge Base first.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                                        {availableEntities.map((entity) => (
                                            <button
                                                key={entity.id}
                                                onClick={() => toggleEntitySelection(entity.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                                                    selectedEntities.includes(entity.id)
                                                        ? 'bg-[#256A65]/10 border-[#256A65] text-slate-900'
                                                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                                    selectedEntities.includes(entity.id)
                                                        ? 'bg-[#256A65] border-[#256A65]'
                                                        : 'border-slate-300'
                                                }`}>
                                                    {selectedEntities.includes(entity.id) && (
                                                        <Check size={12} className="text-white" />
                                                    )}
                                                </div>
                                                <Database size={16} className={`flex-shrink-0 ${
                                                    selectedEntities.includes(entity.id) ? 'text-[#256A65]' : 'text-slate-400'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${
                                                        selectedEntities.includes(entity.id) ? 'text-slate-900' : 'text-slate-700'
                                                    }`}>
                                                        {entity.name}
                                                    </p>
                                                    {entity.description && (
                                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                                            {entity.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-400 flex-shrink-0">
                                                    {entity.properties?.length || 0} fields
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {selectedEntities.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedEntities.map(entityId => {
                                            const entity = availableEntities.find(e => e.id === entityId);
                                            return entity ? (
                                                <span
                                                    key={entityId}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#256A65]/10 text-[#256A65] rounded-lg text-xs font-medium"
                                                >
                                                    {entity.name}
                                                    <button
                                                        onClick={() => toggleEntitySelection(entityId)}
                                                        className="hover:bg-[#256A65]/20 rounded-full p-0.5"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowCopilotModal(false)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCopilot}
                                disabled={!copilotName.trim()}
                                className="flex items-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles size={14} className="mr-2" />
                                Create Copilot
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
