import React, { useState, useRef, useEffect } from 'react';
import { PaperPlaneTilt, SpinnerGap, Info, Robot, User, Plus, Trash, ChatCircle, ArrowLeft, List, X, Sparkle, Database, Check, XCircle, CaretDoubleLeft, MagnifyingGlass, GearSix, Hash, ArrowCircleLeft, Folder, Star, Export, Tag, FileText } from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE } from '../config';
import { Entity, Property } from '../types';
import { useNotifications } from '../hooks/useNotifications';
import { ToastContainer } from './ui/Toast';

// Folder type for mentions
interface KnowledgeFolder {
    id: string;
    name: string;
    color?: string;
    entityIds: string[];
    documentIds: string[];
}

// Generate clean, concise chat title from user input
const generateChatTitle = (input: string): string => {
    let title = input.trim();
    
    // Remove folder contents: "#Folder (contains: @entity1, @entity2)" -> "#Folder"
    title = title.replace(/\s*\(contains:[^)]*\)/gi, '');
    
    // Remove "(empty folder)" text
    title = title.replace(/\s*\(empty folder\)/gi, '');
    
    // Extract first meaningful phrase (before punctuation or newline)
    const firstLine = title.split(/[.!?\n]/)[0].trim();
    
    // If starts with @ or #, keep the first mention and add context if short
    if (firstLine.startsWith('@') || firstLine.startsWith('#')) {
        const mentions = firstLine.match(/[@#][^\s@#,]+/g) || [];
        if (mentions.length > 0) {
            // Take first 2-3 mentions max
            const limitedMentions = mentions.slice(0, 3).join(' ');
            return limitedMentions.length > 40 ? limitedMentions.slice(0, 40) + '...' : limitedMentions;
        }
    }
    
    // For normal text, take first ~40 chars of meaningful content
    const cleanTitle = firstLine
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .slice(0, 45);
    
    // Don't cut words in half
    if (cleanTitle.length === 45 && firstLine.length > 45) {
        const lastSpace = cleanTitle.lastIndexOf(' ');
        if (lastSpace > 20) {
            return cleanTitle.slice(0, lastSpace) + '...';
        }
        return cleanTitle + '...';
    }
    
    return cleanTitle || 'New Chat';
};

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
    isFavorite?: boolean;
    tags?: string[];
}

// Predefined tag colors
const TAG_COLORS: Record<string, string> = {
    'work': '#3B82F6',
    'personal': '#8B5CF6',
    'research': '#10B981',
    'important': '#EF4444',
    'archive': '#6B7280',
    'project': '#F59E0B',
    'ideas': '#EC4899',
    'default': '#256A65'
};

export const Copilots: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { notifications, removeNotification, error: showError, warning } = useNotifications(3000);
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
    const [availableFolders, setAvailableFolders] = useState<KnowledgeFolder[]>([]);
    const [isLoadingEntities, setIsLoadingEntities] = useState(false);
    const [chatSearchQuery, setChatSearchQuery] = useState('');
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editingInstructions, setEditingInstructions] = useState('');
    const [editingEntities, setEditingEntities] = useState<string[]>([]);
    
    // Favorites, Tags & Export state
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [filterTag, setFilterTag] = useState<string | null>(null);
    const [showTagMenu, setShowTagMenu] = useState<string | null>(null);
    const [newTagInput, setNewTagInput] = useState('');
    const [showExportModal, setShowExportModal] = useState(false);
    const [allTags, setAllTags] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const mentionContainerRef = useRef<HTMLDivElement>(null);
    const previousActiveChatRef = useRef<string | null>(null);
    
    // Mention state
    type MentionType = 'entity' | 'attribute' | 'folder';
    interface MentionState {
        isActive: boolean;
        type: MentionType;
        query: string;
        top: number;
        left: number;
        triggerIndex: number;
        entityContext?: Entity;
    }
    const [mention, setMention] = useState<MentionState>({
        isActive: false,
        type: 'entity',
        query: '',
        top: 0,
        left: 0,
        triggerIndex: -1
    });
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

    // Load chats from backend on mount (only once)
    useEffect(() => {
        let mounted = true;
        
        const initialize = async () => {
            await loadEntities();
            if (mounted) {
                await loadChats();
            }
        };
        
        initialize();
        
        return () => {
            mounted = false;
        };
    }, []); // Empty dependency array - only run on mount

    const loadEntities = async () => {
        try {
            setIsLoadingEntities(true);
            
            // Load entities
            const entitiesResponse = await fetch(`${API_BASE}/entities`, {
                credentials: 'include'
            });
            if (entitiesResponse.ok) {
                const entities = await entitiesResponse.json();
                setAvailableEntities(entities);
            }
            
            // Load folders
            const foldersResponse = await fetch(`${API_BASE}/knowledge/folders`, {
                credentials: 'include'
            });
            if (foldersResponse.ok) {
                const folders = await foldersResponse.json();
                setAvailableFolders(folders);
            }
        } catch (error) {
            console.error('Error loading entities/folders:', error);
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
    
    // Auto-save chats when they change (with debounce)
    useEffect(() => {
        if (chats.length === 0) return;

        const saveTimeout = setTimeout(() => {
            chats.forEach(chat => {
                if (chat.messages.length > 0 || chat.instructions || (chat.allowedEntities && chat.allowedEntities.length > 0)) {
                    saveChat(chat).catch(() => {});
                }
            });
        }, 1000);

        return () => clearTimeout(saveTimeout);
    }, [chats]);

    // Save previous chat when switching to a different chat
    useEffect(() => {
        if (previousActiveChatRef.current && previousActiveChatRef.current !== activeChat) {
            const previousChat = chats.find(c => c.id === previousActiveChatRef.current);
            if (previousChat && (previousChat.messages.length > 0 || previousChat.instructions || (previousChat.allowedEntities && previousChat.allowedEntities.length > 0))) {
                saveChat(previousChat).catch(() => {});
            }
        }
        previousActiveChatRef.current = activeChat;
    }, [activeChat, chats]);

    // Save all chats on unmount
    useEffect(() => {
        return () => {
            chats.forEach(chat => {
                if (chat.messages.length > 0 || chat.instructions || (chat.allowedEntities && chat.allowedEntities.length > 0)) {
                    const payload = {
                        id: chat.id,
                        title: chat.title || 'New Copilot',
                        messages: chat.messages.map(m => ({
                            id: m.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            role: m.role,
                            content: m.content || '',
                            timestamp: m.timestamp ? (m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp) : new Date().toISOString(),
                            data: m.data,
                            explanation: m.explanation,
                            entitiesUsed: m.entitiesUsed
                        })),
                        createdAt: chat.createdAt ? (chat.createdAt instanceof Date ? chat.createdAt.toISOString() : chat.createdAt) : new Date().toISOString(),
                        updatedAt: chat.updatedAt ? (chat.updatedAt instanceof Date ? chat.updatedAt.toISOString() : chat.updatedAt) : new Date().toISOString(),
                        instructions: chat.instructions || null,
                        allowedEntities: Array.isArray(chat.allowedEntities) && chat.allowedEntities.length > 0 ? chat.allowedEntities : null,
                        isFavorite: chat.isFavorite || false,
                        tags: Array.isArray(chat.tags) && chat.tags.length > 0 ? chat.tags : null
                    };
                    
                    // Try PUT first, if it fails (404), try POST
                    fetch(`${API_BASE}/copilot/chats/${chat.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(payload),
                        keepalive: true // Keep request alive even after page unload
                    }).catch(() => {
                        // If PUT fails, try POST (chat might not exist)
                        fetch(`${API_BASE}/copilot/chats`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(payload),
                            keepalive: true
                        }).catch(() => {});
                    });
                }
            });
        };
    }, [chats]);

    useEffect(() => {
        if (isEditingTitle) {
            setTimeout(() => titleInputRef.current?.focus(), 0);
        }
    }, [isEditingTitle]);

    const loadChats = async () => {
        try {
            const response = await fetch(`${API_BASE}/copilot/chats`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                
                const loadedChats = (data.chats || []).map((chat: any) => {
                    try {
                        // Server already parses messages and allowedEntities
                        return {
                            id: chat.id,
                            title: chat.title || 'New Copilot',
                            createdAt: chat.createdAt ? new Date(chat.createdAt) : new Date(),
                            updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : new Date(),
                            instructions: chat.instructions || undefined,
                            allowedEntities: Array.isArray(chat.allowedEntities) ? chat.allowedEntities : [],
                            isFavorite: chat.isFavorite || false,
                            tags: Array.isArray(chat.tags) ? chat.tags : [],
                            messages: Array.isArray(chat.messages) ? chat.messages.map((msg: any) => ({
                                id: msg.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                role: msg.role,
                                content: msg.content || '',
                                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                                data: msg.data,
                                explanation: msg.explanation,
                                entitiesUsed: msg.entitiesUsed
                            })) : []
                        };
                    } catch (parseError) {
                        console.error('[Copilots] Error parsing chat:', chat.id, parseError);
                        return null;
                    }
                }).filter((chat: any) => chat !== null);
                
                setChats(loadedChats);
            } else {
                setChats([]);
            }
        } catch (error) {
            setChats([]);
        }
    };

    const saveChat = async (chat: Chat) => {
        if (!chat || !chat.id) return;
        
        try {
            const payload = {
                title: chat.title || 'New Copilot',
                messages: chat.messages.map(m => ({
                    id: m.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    role: m.role,
                    content: m.content || '',
                    timestamp: m.timestamp ? (m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp) : new Date().toISOString(),
                    data: m.data,
                    explanation: m.explanation,
                    entitiesUsed: m.entitiesUsed
                })),
                createdAt: chat.createdAt ? (chat.createdAt instanceof Date ? chat.createdAt.toISOString() : chat.createdAt) : new Date().toISOString(),
                updatedAt: chat.updatedAt ? (chat.updatedAt instanceof Date ? chat.updatedAt.toISOString() : chat.updatedAt) : new Date().toISOString(),
                instructions: chat.instructions || null,
                allowedEntities: Array.isArray(chat.allowedEntities) && chat.allowedEntities.length > 0 ? chat.allowedEntities : null,
                isFavorite: chat.isFavorite || false,
                tags: Array.isArray(chat.tags) && chat.tags.length > 0 ? chat.tags : null
            };
            
            const response = await fetch(`${API_BASE}/copilot/chats/${chat.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to save chat: ${response.status}`);
            }
        } catch (error) {
            throw error;
        }
    };

    const handleCreateCopilot = () => {
        setCopilotName('');
        setCopilotInstructions('');
        setSelectedEntities([]);
        setShowCopilotModal(true);
    };

    const createNewChat = async (name?: string, instructions?: string, entities?: string[]): Promise<Chat> => {
        const defaultInstructions = instructions || "You are a helpful database assistant. Help users navigate through your entities, find records, and answer questions about relationships between tables.";
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

        setChats(prev => [newChat, ...prev]);
        setActiveChat(newChat.id);

        // Try to save to backend immediately
        try {
            const payload = {
                id: newChat.id,
                title: newChat.title,
                messages: newChat.messages.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp.toISOString()
                })),
                createdAt: newChat.createdAt.toISOString(),
                updatedAt: newChat.updatedAt.toISOString(),
                instructions: newChat.instructions || null,
                allowedEntities: newChat.allowedEntities && newChat.allowedEntities.length > 0 ? newChat.allowedEntities : null
            };
            await fetch(`${API_BASE}/copilot/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
        } catch (error) {
            // Chat is already in local state, so user can continue
        }
        
        return newChat;
    };

    const handleSaveCopilot = async () => {
        if (!copilotName.trim()) {
            warning('Missing name', 'Please enter a name for your copilot');
            return;
        }
        
        try {
            // Create the new chat and wait for it to complete
            const newChat = await createNewChat(copilotName.trim(), copilotInstructions.trim() || undefined, selectedEntities);
            
            // Ensure the chat is saved
            try {
                await saveChat(newChat);
            } catch (saveError) {
                // If save fails, try to create it again
                try {
                    const payload = {
                        id: newChat.id,
                        title: newChat.title,
                        messages: newChat.messages.map(m => ({
                            id: m.id,
                            role: m.role,
                            content: m.content,
                            timestamp: m.timestamp.toISOString()
                        })),
                        createdAt: newChat.createdAt.toISOString(),
                        updatedAt: newChat.updatedAt.toISOString(),
                        instructions: newChat.instructions || null,
                        allowedEntities: newChat.allowedEntities && newChat.allowedEntities.length > 0 ? newChat.allowedEntities : null
                    };
                    await fetch(`${API_BASE}/copilot/chats`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(payload)
                    });
                } catch (retryError) {
                    // Silent fail - chat is in local state
                }
            }
            
            // Reload chats to ensure sidebar is updated
            await loadChats();
            
            // Close modal and reset form
            setShowCopilotModal(false);
            setCopilotName('');
            setCopilotInstructions('');
            setSelectedEntities([]);
        } catch (error) {
            showError('Failed to create copilot', 'Please try again');
        }
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
            // Silent fail
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

    // Toggle favorite status
    const toggleFavorite = async (chatId: string) => {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        
        const updatedChat = { ...chat, isFavorite: !chat.isFavorite };
        setChats(prev => prev.map(c => c.id === chatId ? updatedChat : c));
        saveChat(updatedChat);
    };

    // Add tag to chat
    const addTagToChat = async (chatId: string, tag: string) => {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        
        const normalizedTag = tag.toLowerCase().trim();
        if (!normalizedTag) return;
        
        const currentTags = chat.tags || [];
        if (currentTags.includes(normalizedTag)) return;
        
        const updatedChat = { ...chat, tags: [...currentTags, normalizedTag] };
        setChats(prev => prev.map(c => c.id === chatId ? updatedChat : c));
        
        // Update allTags
        if (!allTags.includes(normalizedTag)) {
            setAllTags(prev => [...prev, normalizedTag]);
        }
        
        saveChat(updatedChat);
        setNewTagInput('');
    };

    // Remove tag from chat
    const removeTagFromChat = async (chatId: string, tag: string) => {
        const chat = chats.find(c => c.id === chatId);
        if (!chat || !chat.tags) return;
        
        const updatedChat = { ...chat, tags: chat.tags.filter(t => t !== tag) };
        setChats(prev => prev.map(c => c.id === chatId ? updatedChat : c));
        saveChat(updatedChat);
    };

    // Export conversation
    const exportConversation = (format: 'markdown' | 'txt' | 'json') => {
        const chat = currentChat;
        if (!chat) return;
        
        let content = '';
        let filename = `${chat.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`;
        let mimeType = 'text/plain';
        
        if (format === 'markdown') {
            content = `# ${chat.title}\n\n`;
            content += `*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`;
            chat.messages.forEach(msg => {
                const role = msg.role === 'user' ? '**You**' : '**Copilot**';
                content += `### ${role}\n\n${msg.content}\n\n---\n\n`;
            });
            filename += '.md';
            mimeType = 'text/markdown';
        } else if (format === 'txt') {
            content = `${chat.title}\n${'='.repeat(chat.title.length)}\n\n`;
            content += `Exported: ${new Date().toLocaleString()}\n\n`;
            chat.messages.forEach(msg => {
                const role = msg.role === 'user' ? 'You' : 'Copilot';
                content += `[${role}]\n${msg.content}\n\n`;
            });
            filename += '.txt';
        } else if (format === 'json') {
            content = JSON.stringify({
                title: chat.title,
                exportedAt: new Date().toISOString(),
                messages: chat.messages.map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp
                }))
            }, null, 2);
            filename += '.json';
            mimeType = 'application/json';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
    };

    // Update allTags when chats change
    useEffect(() => {
        const tags = new Set<string>();
        chats.forEach(chat => {
            chat.tags?.forEach(tag => tags.add(tag));
        });
        setAllTags(Array.from(tags));
    }, [chats]);

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
        let currentChat = chats.find(c => c.id === activeChat);
        if (!currentChat) {
            currentChat = await createNewChat();
        }
        if (!currentChat) return;

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
            // Auto-generate title from first user message (clean & concise)
            title: currentChat.messages.length === 1 ? generateChatTitle(input) : currentChat.title
        };

        // Use currentChat.id instead of activeChat to ensure we update the correct chat
        setChats(prev => prev.map(c => c.id === currentChat.id ? updatedChat : c));
        // Ensure activeChat is set to the current chat
        if (activeChat !== currentChat.id) {
            setActiveChat(currentChat.id);
        }
        setInput('');
        setIsLoading(true);
        
        // Save user message immediately
        saveChat(updatedChat).catch(err => console.error('[Copilots] Error saving user message:', err));

        try {
            // Extract all entity mentions from the message (including those inside folder citations)
            // Match @EntityName patterns - simplified regex to capture word characters
            const entityMentionRegex = /@(\w+)/g;
            const mentionedEntityNames: string[] = [];
            let match;
            while ((match = entityMentionRegex.exec(userMessage.content)) !== null) {
                const name = match[1].trim();
                // Only add unique entity names (case-insensitive comparison)
                if (name && !mentionedEntityNames.some(n => n.toLowerCase() === name.toLowerCase())) {
                    mentionedEntityNames.push(name);
                }
            }
            
            // Map mentioned entity names to their IDs
            const mentionedEntityIds = mentionedEntityNames
                .map(name => availableEntities.find(e => e.name.toLowerCase() === name.toLowerCase())?.id)
                .filter((id): id is string => !!id);
            
            // Also check if any folder was mentioned (via #) and include its entities
            const folderMentionRegex = /#(\w+)/g;
            while ((match = folderMentionRegex.exec(userMessage.content)) !== null) {
                const folderName = match[1].trim();
                const folder = availableFolders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
                if (folder && folder.entityIds) {
                    // Add all entity IDs from the folder that aren't already included
                    folder.entityIds.forEach(id => {
                        if (!mentionedEntityIds.includes(id)) {
                            mentionedEntityIds.push(id);
                        }
                    });
                }
            }
            
            console.log('[Copilots] Extracted entity mentions:', mentionedEntityNames, '-> IDs:', mentionedEntityIds);

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
                    allowedEntities: currentChat.allowedEntities,
                    mentionedEntities: mentionedEntityIds.length > 0 ? mentionedEntityIds : undefined
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

            setChats(prev => prev.map(c => c.id === currentChat.id ? finalChat : c));
            // Save assistant response immediately
            await saveChat(finalChat).catch(err => console.error('[Copilots] Error saving assistant message:', err));
        } catch (error) {
            console.error('[Copilots] Error asking database:', error);
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
            
            setChats(prev => prev.map(c => c.id === currentChat.id ? finalChat : c));
            // Save error message immediately
            await saveChat(finalChat).catch(err => console.error('[Copilots] Error saving error message:', err));
        } finally {
            setIsLoading(false);
        }
    };

    // Unified mention item type
    type MentionItem = (Entity & { _type: 'entity' }) | (KnowledgeFolder & { _type: 'folder' }) | (Property & { _type: 'property' });
    
    // Get mention suggestions
    const getMentionSuggestions = (): MentionItem[] => {
        if (!mention.isActive) return [];

        const query = mention.query.toLowerCase();

        if (mention.type === 'entity') {
            // Return only entities for @ mentions
            return availableEntities
                .filter(e => e.name.toLowerCase().includes(query))
                .map(e => ({ ...e, _type: 'entity' as const }));
        } else if (mention.type === 'folder') {
            // Return only folders for # mentions
            return availableFolders
                .filter(f => f.name.toLowerCase().includes(query))
                .map(f => ({ ...f, _type: 'folder' as const }));
        } else if (mention.type === 'attribute' && mention.entityContext) {
            return mention.entityContext.properties
                .filter(p => p.name.toLowerCase().includes(query))
                .map(p => ({ ...p, _type: 'property' as const }));
        }
        return [];
    };

    const mentionSuggestions = getMentionSuggestions();

    // Update mention position
    const updateMentionPosition = (cursorIndex: number, textareaElement: HTMLTextAreaElement, mirrorElement: HTMLDivElement) => {
        if (!textareaElement || !mirrorElement) return;

        const text = textareaElement.value;
        const textBefore = text.slice(0, cursorIndex);

        // Clear and set mirror content
        mirrorElement.textContent = textBefore;
        mirrorElement.style.fontSize = '15px';
        mirrorElement.style.padding = '16px 80px 16px 20px';
        mirrorElement.style.lineHeight = '1.5';
        mirrorElement.style.fontFamily = 'inherit';
        mirrorElement.style.whiteSpace = 'pre-wrap';

        const span = document.createElement('span');
        span.textContent = '.';
        mirrorElement.appendChild(span);

        const rect = span.getBoundingClientRect();
        const textareaRect = textareaElement.getBoundingClientRect();

        setMention(prev => ({
            ...prev,
            top: rect.top - textareaRect.top + 24,
            left: rect.left - textareaRect.left
        }));
    };

    // Handle input change with mention detection
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInput(val);

        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursor);
        const lastAt = textBeforeCursor.lastIndexOf('@');
        const lastHash = textBeforeCursor.lastIndexOf('#');

        // Check for # (folder mention) - takes precedence if more recent
        if (lastHash !== -1 && lastHash > lastAt) {
            const textSinceHash = textBeforeCursor.slice(lastHash + 1);
            if (textSinceHash.includes(' ')) {
                setMention(prev => ({ ...prev, isActive: false }));
                return;
            }

            if (mirrorRef.current) {
                updateMentionPosition(lastHash + 1, e.target, mirrorRef.current);
            }
            setMention({
                isActive: true,
                type: 'folder',
                query: textSinceHash,
                top: 0,
                left: 0,
                triggerIndex: lastHash + 1
            });
            setSelectedMentionIndex(0);
            return;
        }

        // Check for @ (entity mention)
        if (lastAt !== -1) {
            const textSinceAt = textBeforeCursor.slice(lastAt + 1);
            if (textSinceAt.includes(' ')) {
                setMention(prev => ({ ...prev, isActive: false }));
                return;
            }

            const dotIndex = textSinceAt.indexOf('.');

            if (dotIndex !== -1) {
                const entityName = textSinceAt.slice(0, dotIndex);
                const entity = availableEntities.find(e => e.name === entityName);

                if (entity) {
                    const attrQuery = textSinceAt.slice(dotIndex + 1);
                    if (mirrorRef.current) {
                        updateMentionPosition(cursor, e.target, mirrorRef.current);
                    }
                    setMention({
                        isActive: true,
                        type: 'attribute',
                        query: attrQuery,
                        top: 0,
                        left: 0,
                        triggerIndex: lastAt + 1 + dotIndex + 1,
                        entityContext: entity
                    });
                    setSelectedMentionIndex(0);
                    return;
                }
            }

            if (mirrorRef.current) {
                updateMentionPosition(lastAt + 1, e.target, mirrorRef.current);
            }
            setMention({
                isActive: true,
                type: 'entity',
                query: textSinceAt,
                top: 0,
                left: 0,
                triggerIndex: lastAt + 1
            });
            setSelectedMentionIndex(0);
        } else {
            setMention(prev => ({ ...prev, isActive: false }));
        }
    };

    // Select mention suggestion
    const selectMentionSuggestion = (item: MentionItem) => {
        if (!inputRef.current) return;

        const text = input;
        let insertText = '';
        let newCursorPos = 0;
        let triggerChar = '@';

        if (mention.type === 'entity') {
            // Handle entities with @
            insertText = item.name;
            triggerChar = '@';

            const start = text.lastIndexOf('@', inputRef.current.selectionStart);
            const end = inputRef.current.selectionStart;

            const newText = text.slice(0, start) + '@' + insertText + text.slice(end);
            setInput(newText);
            newCursorPos = start + 1 + insertText.length;
        } else if (mention.type === 'folder' && item._type === 'folder') {
            // Handle folders with # - expand to show contents
            const folder = item as KnowledgeFolder;
            
            // Get entity names inside this folder
            const folderEntities = availableEntities
                .filter(e => folder.entityIds.includes(e.id))
                .map(e => e.name);
            
            // Create expanded text showing folder and its contents
            if (folderEntities.length > 0) {
                insertText = `${folder.name} (contains: ${folderEntities.map(n => '@' + n).join(', ')})`;
            } else {
                insertText = `${folder.name} (empty folder)`;
            }
            triggerChar = '#';

            const start = text.lastIndexOf('#', inputRef.current.selectionStart);
            const end = inputRef.current.selectionStart;

            const newText = text.slice(0, start) + '#' + insertText + text.slice(end);
            setInput(newText);
            newCursorPos = start + 1 + insertText.length;
        } else if (item._type === 'property') {
            insertText = item.name;

            const start = text.lastIndexOf('.', inputRef.current.selectionStart);
            const end = inputRef.current.selectionStart;

            const newText = text.slice(0, start) + '.' + insertText + text.slice(end);
            setInput(newText);
            newCursorPos = start + 1 + insertText.length;
        }

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);

        setMention(prev => ({ ...prev, isActive: false }));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mention.isActive) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (mentionSuggestions.length > 0) {
                    selectMentionSuggestion(mentionSuggestions[selectedMentionIndex]);
                }
            } else if (e.key === 'Escape') {
                setMention(prev => ({ ...prev, isActive: false }));
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    useEffect(() => {
        setSelectedMentionIndex(0);
    }, [mention.query, mention.type]);

    const currentChat = chats.find(c => c.id === activeChat);
    const messages = currentChat?.messages || [];
    
    // Check if chat is empty (no active chat OR only has the initial assistant message)
    const isEmptyChat = !activeChat || (messages.length <= 1 && messages[0]?.role === 'assistant');
    
    const examplePrompts = [
        "¿Cuál es la tasa de defectos de esta semana?",
        "Muéstrame los lotes fuera de especificación",
        "Análisis de mermas por línea de producción",
        "¿Qué materias primas tienen más rechazos?",
        "Tendencia de calidad últimos 30 días"
    ];

    const chatQuery = new URLSearchParams(location.search).get('q')?.toLowerCase() || '';
    const chatIdParam = new URLSearchParams(location.search).get('chatId');
    
    // Filter and sort chats
    const filteredChats = chats
        .filter(chat => {
            // Search filter
            const searchMatch = !chatQuery && !chatSearchQuery || 
                chat.title.toLowerCase().includes((chatQuery || chatSearchQuery).toLowerCase());
            // Favorites filter
            const favMatch = !showFavoritesOnly || chat.isFavorite;
            // Tag filter
            const tagMatch = !filterTag || chat.tags?.includes(filterTag);
            return searchMatch && favMatch && tagMatch;
        })
        .sort((a, b) => {
            // Favorites first
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            // Then by date
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

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
        // Save title change immediately
        await saveChat(updatedChat).catch(err => console.error('[Copilots] Error saving title:', err));
    };

    const openEditModal = (chatId: string) => {
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return;
        setEditingChatId(chatId);
        setEditingInstructions(chat.instructions || '');
        setEditingEntities(chat.allowedEntities || []);
    };

    const handleSaveEdit = async () => {
        if (!editingChatId) return;
        const chat = chats.find(c => c.id === editingChatId);
        if (!chat) return;

        const updatedChat = {
            ...chat,
            instructions: editingInstructions.trim() || undefined,
            allowedEntities: editingEntities,
            updatedAt: new Date()
        };

        setChats(prev => prev.map(c => c.id === editingChatId ? updatedChat : c));
        setEditingChatId(null);
        setEditingInstructions('');
        setEditingEntities([]);
        // Save configuration changes immediately
        await saveChat(updatedChat).catch(err => console.error('[Copilots] Error saving configuration:', err));
    };

    const toggleEditingEntity = (entityId: string) => {
        setEditingEntities(prev => 
            prev.includes(entityId) 
                ? prev.filter(id => id !== entityId)
                : [...prev, entityId]
        );
    };

    return (
        <div className="h-screen flex flex-col bg-[var(--bg-primary)]">
            {/* Top Bar */}
            <div className="h-12 bg-[var(--bg-primary)] border-b border-[var(--border-light)] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/overview')}
                        className="flex items-center gap-2 px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors text-sm"
                    >
                        <ArrowLeft size={14} weight="light" />
                        <span className="font-medium">Back</span>
                    </button>
                    <div className="h-6 w-px bg-[var(--bg-selected)]"></div>
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
                                className="px-2 py-1 border border-[var(--border-light)] rounded-md text-sm bg-[var(--bg-card)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] selection:bg-[var(--bg-selected)] selection:text-[var(--text-primary)]"
                            />
                        ) : (
                            currentChat ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingTitle(currentChat.title || 'New Chat');
                                        setIsEditingTitle(true);
                                    }}
                                    className="text-sm font-normal text-[var(--text-primary)] hover:text-[var(--text-primary)] active:text-[var(--text-primary)] focus:outline-none transition-colors bg-transparent active:bg-transparent appearance-none"
                                >
                                    {currentChat.title || 'New Copilot'}
                                </button>
                            ) : (
                                <span className="text-sm font-normal text-[var(--text-primary)]">Copilots</span>
                            )
                        )}
                    </div>
                </div>
                {/* Action Buttons */}
                {currentChat && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/30 rounded-lg transition-colors"
                            title="Export conversation"
                        >
                            <Export size={14} />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button
                            onClick={() => toggleFavorite(currentChat.id)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                                currentChat.isFavorite 
                                    ? 'text-amber-500' 
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/30'
                            }`}
                            title={currentChat.isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Star size={14} weight={currentChat.isFavorite ? "fill" : "regular"} />
                        </button>
                        <button
                            onClick={() => openEditModal(currentChat.id)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/30 rounded-lg transition-colors"
                            title="Edit copilot configuration"
                        >
                            <GearSix size={14} />
                            <span className="hidden sm:inline">Configure</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar - Chat History */}
                <div
                    className={`bg-[var(--bg-card)] border-r border-[var(--border-light)] flex flex-col transition-all duration-300 ${
                        isSidebarOpen ? 'w-80' : 'w-0'
                    } overflow-hidden`}
                >
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-[var(--border-light)] shrink-0 bg-[var(--bg-card)]">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-light text-[var(--text-tertiary)] uppercase tracking-wider" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Your Copilots</h2>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                            >
                                <CaretDoubleLeft size={14} className="text-[var(--text-tertiary)]" weight="light" />
                            </button>
                        </div>
                        {/* Search Bar */}
                        <div className="relative mb-3">
                            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
                            <input
                                type="text"
                                value={chatSearchQuery}
                                onChange={(e) => setChatSearchQuery(e.target.value)}
                                placeholder="Search chats..."
                                className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                            />
                        </div>
                        <button
                            onClick={handleCreateCopilot}
                            className="w-full flex items-center justify-center px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                        >
                            <Sparkle size={14} className="mr-2" weight="light" />
                            New Copilot
                        </button>
                        
                        {/* Filter Pills */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <button
                                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                                    showFavoritesOnly 
                                        ? 'bg-amber-500/20 text-amber-500' 
                                        : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                                }`}
                            >
                                <Star size={12} weight={showFavoritesOnly ? "fill" : "regular"} />
                                Favorites
                            </button>
                            {allTags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                    {allTags.slice(0, 3).map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                                            className={`px-2 py-1 rounded-md text-xs transition-colors ${
                                                filterTag === tag 
                                                    ? 'text-white' 
                                                    : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
                                            }`}
                                            style={{ 
                                                backgroundColor: filterTag === tag ? (TAG_COLORS[tag] || TAG_COLORS.default) : undefined 
                                            }}
                                        >
                                            #{tag}
                                        </button>
                                    ))}
                                    {allTags.length > 3 && (
                                        <span className="text-xs text-[var(--text-tertiary)]">+{allTags.length - 3}</span>
                                    )}
                                </div>
                            )}
                            {(showFavoritesOnly || filterTag) && (
                                <button
                                    onClick={() => { setShowFavoritesOnly(false); setFilterTag(null); }}
                                    className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Chat List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {filteredChats.map(chat => (
                            <div
                                key={chat.id}
                                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                                    activeChat === chat.id
                                        ? 'bg-[var(--bg-card)] shadow-sm border border-[var(--border-light)]'
                                        : 'hover:bg-[var(--bg-card)]/70'
                                }`}
                                onClick={() => setActiveChat(chat.id)}
                            >
                                {/* Favorite Star */}
                                {chat.isFavorite && (
                                    <Star size={12} weight="fill" className="absolute top-1.5 left-1.5 text-amber-500" />
                                )}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                    activeChat === chat.id
                                        ? 'bg-[var(--bg-selected)] text-white'
                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] group-hover:bg-[var(--bg-selected)]'
                                }`}>
                                    <IntemicIcon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-normal truncate text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>{chat.title}</p>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-[var(--text-secondary)]">
                                                {chat.messages.length} {chat.messages.length === 1 ? 'msg' : 'msgs'}
                                            </span>
                                            {chat.tags && chat.tags.length > 0 && (
                                                <div className="flex items-center gap-1">
                                                    {chat.tags.slice(0, 2).map(tag => (
                                                        <span 
                                                            key={tag} 
                                                            className="px-1.5 py-0.5 rounded text-[10px] text-white"
                                                            style={{ backgroundColor: TAG_COLORS[tag] || TAG_COLORS.default }}
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {chat.tags.length > 2 && (
                                                        <span className="text-[10px] text-[var(--text-tertiary)]">+{chat.tags.length - 2}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {/* Hover action buttons - now inline with message count */}
                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(chat.id);
                                                }}
                                                className={`p-1 rounded transition-all ${chat.isFavorite ? 'text-amber-500' : 'hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]'}`}
                                                title={chat.isFavorite ? "Remove from favorites" : "Add to favorites"}
                                            >
                                                <Star size={12} weight={chat.isFavorite ? "fill" : "regular"} />
                                            </button>
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowTagMenu(showTagMenu === chat.id ? null : chat.id);
                                                    }}
                                                    className="p-1 hover:bg-[var(--bg-hover)] rounded transition-all"
                                                    title="Add tag"
                                                >
                                                    <Tag size={12} className="text-[var(--text-tertiary)]" />
                                                </button>
                                                {showTagMenu === chat.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setShowTagMenu(null)} />
                                                        <div className="absolute right-0 top-6 w-40 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-xl z-50 p-2">
                                                            <input
                                                                type="text"
                                                                value={newTagInput}
                                                                onChange={(e) => setNewTagInput(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        addTagToChat(chat.id, newTagInput);
                                                                    }
                                                                }}
                                                                placeholder="New tag..."
                                                                className="w-full px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mb-2"
                                                                autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            {allTags.filter(t => !chat.tags?.includes(t)).slice(0, 5).map(tag => (
                                                                <button
                                                                    key={tag}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        addTagToChat(chat.id, tag);
                                                                        setShowTagMenu(null);
                                                                    }}
                                                                    className="w-full text-left px-2 py-1 text-xs hover:bg-[var(--bg-tertiary)] rounded flex items-center gap-2"
                                                                >
                                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TAG_COLORS[tag] || TAG_COLORS.default }} />
                                                                    {tag}
                                                                </button>
                                                            ))}
                                                            {chat.tags && chat.tags.length > 0 && (
                                                                <>
                                                                    <div className="border-t border-[var(--border-light)] my-1" />
                                                                    <p className="text-[10px] text-[var(--text-tertiary)] px-2 mb-1">Remove:</p>
                                                                    {chat.tags.map(tag => (
                                                                        <button
                                                                            key={tag}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                removeTagFromChat(chat.id, tag);
                                                                            }}
                                                                            className="w-full text-left px-2 py-1 text-xs hover:bg-red-50 text-red-500 rounded flex items-center gap-2"
                                                                        >
                                                                            <X size={10} />
                                                                            {tag}
                                                                        </button>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditModal(chat.id);
                                                }}
                                                className="p-1 hover:bg-[var(--bg-hover)] rounded transition-all"
                                                title="Edit configuration"
                                            >
                                                <GearSix size={12} className="text-[var(--text-tertiary)]" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteChat(chat.id);
                                                }}
                                                className="p-1 hover:bg-red-50 rounded transition-all"
                                            >
                                                <Trash size={12} className="text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Toggle Sidebar Button (when closed) */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute left-4 top-20 p-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg hover:bg-[var(--bg-tertiary)] transition-colors z-10"
                    >
                        <List size={20} className="text-[var(--text-secondary)]" weight="light" />
                    </button>
                )}

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
                    {/* Messages Container */}
                    <div className="flex-1 overflow-y-auto">
                        {isEmptyChat ? (
                            /* Empty State - Centered */
                            <div className="h-full flex flex-col items-center justify-center px-6">
                                <div className="max-w-3xl w-full space-y-8">
                                    {/* Greeting */}
                                    <div className="text-center">
                                        <h2 className="text-lg font-medium text-[var(--text-secondary)] tracking-wider uppercase" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                                            Ask me anything about your data
                                        </h2>
                                    </div>
                                    
                                    {/* Centered Input */}
                                    <div className="relative">
                                        <form onSubmit={handleSubmit} className="relative">
                                            <div className="relative">
                                                <textarea
                                                    ref={inputRef}
                                                    value={input}
                                                    onChange={handleInputChange}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder="Ask about your data..."
                                                    rows={1}
                                                    className="w-full px-5 py-4 pr-16 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] resize-none transition-all"
                                                    style={{ 
                                                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                                                        lineHeight: '1.6',
                                                        letterSpacing: '0.01em'
                                                    }}
                                                    style={{ minHeight: '64px', maxHeight: '200px' }}
                                                    disabled={isLoading}
                                                />
                                                {/* Mention suggestions popover */}
                                                {mention.isActive && mentionSuggestions.length > 0 && (
                                                    <div
                                                        className="absolute z-50 w-64 bg-[var(--bg-card)] rounded-lg shadow-xl border border-[var(--border-light)] overflow-hidden"
                                                        style={{
                                                            top: mention.top,
                                                            left: mention.left
                                                        }}
                                                    >
                                                        <div className="bg-[var(--bg-tertiary)] px-3 py-2 border-b border-[var(--border-light)] text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">
                                                            {mention.type === 'entity' ? 'Entities' : mention.type === 'folder' ? 'Folders' : `Properties of ${mention.entityContext?.name}`}
                                                        </div>
                                                        <div className="max-h-48 overflow-y-auto">
                                                            {mentionSuggestions.map((item, index) => (
                                                                <button
                                                                    key={item.id}
                                                                    onClick={() => selectMentionSuggestion(item)}
                                                                    className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${
                                                                        index === selectedMentionIndex
                                                                            ? 'bg-teal-50 text-teal-700'
                                                                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                                                    }`}
                                                                >
                                                                    {item._type === 'folder' ? (
                                                                        <Folder size={14} style={{ color: (item as KnowledgeFolder).color || '#3b82f6' }} weight="fill" />
                                                                    ) : item._type === 'entity' ? (
                                                                        <Database size={14} className="text-teal-500" weight="light" />
                                                                    ) : (
                                                                        <Hash size={14} className="text-[var(--text-tertiary)]" weight="light" />
                                                                    )}
                                                                    <span className={item._type === 'folder' ? 'font-medium' : ''}>{item.name}</span>
                                                                    {item._type === 'folder' && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 ml-auto">
                                                                            {(item as KnowledgeFolder).entityIds.length} entities
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Mirror div for positioning */}
                                                <div
                                                    ref={mirrorRef}
                                                    className="absolute top-0 left-0 w-full pointer-events-none invisible whitespace-pre-wrap"
                                                    style={{ fontSize: '15px', padding: '16px 80px 16px 20px', lineHeight: '1.5' }}
                                                />
                                                {/* Send button */}
                                                <button
                                                    type="submit"
                                                    disabled={!input.trim() || isLoading}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    <PaperPlaneTilt size={16} weight="light" />
                                                </button>
                                            </div>
                                            <div className="flex items-center space-x-4 text-xs text-[var(--text-tertiary)] mt-2">
                                                <span className="flex items-center">
                                                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mr-1.5 font-sans text-[var(--text-secondary)]">@</kbd>
                                                    entities
                                                </span>
                                                <span className="flex items-center">
                                                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mr-1.5 font-sans text-[var(--text-secondary)]">#</kbd>
                                                    folders
                                                </span>
                                                <span className="flex items-center">
                                                    <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mr-1.5 font-sans text-[var(--text-secondary)]">.</kbd>
                                                    attributes
                                                </span>
                                            </div>
                                        </form>
                                    </div>

                                    {/* Example Prompts */}
                                    <div className="space-y-4">
                                        <p className="text-sm text-[var(--text-secondary)] text-center font-normal">Try asking:</p>
                                        <div className="flex flex-wrap gap-3 justify-center">
                                            {examplePrompts.slice(0, 5).map((prompt, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setInput(prompt)}
                                                    className="px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-card)] rounded-lg text-sm text-[var(--text-primary)] font-normal transition-all shadow-sm hover:shadow"
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
                                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-selected)] flex items-center justify-center shrink-0 mt-1">
                                                <IntemicIcon size={16} className="text-white" />
                                            </div>
                                        )}

                                        <div className={`flex-1 max-w-3xl ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                                            <div
                                                className={`rounded-2xl px-6 py-4 ${
                                                    message.role === 'user'
                                                        ? 'bg-slate-800 text-white inline-block'
                                                        : 'bg-[var(--bg-card)] border border-[var(--border-light)] shadow-sm'
                                                }`}
                                            >
                                                <p 
                                                    className="text-[15px] whitespace-pre-wrap leading-relaxed"
                                                    style={{ 
                                                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                                                        lineHeight: '1.6',
                                                        letterSpacing: '0.01em'
                                                    }}
                                                >
                                                    {message.content}
                                                </p>

                                                {/* Show query results if any */}
                                                {message.data && Array.isArray(message.data) && message.data.length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-[var(--border-light)]">
                                                        <p className="text-xs font-normal text-[var(--text-secondary)] mb-3 uppercase tracking-wide">
                                                            Found {message.data.length} result{message.data.length > 1 ? 's' : ''}
                                                        </p>
                                                        <div className="space-y-2 max-h-80 overflow-y-auto">
                                                            {message.data.slice(0, 10).map((item: any, idx: number) => (
                                                                <div key={idx} className="bg-[var(--bg-tertiary)] rounded-lg p-3 text-sm border border-[var(--border-light)]">
                                                                    {Object.entries(item).slice(0, 6).map(([key, value]) => (
                                                                        <div key={key} className="flex gap-3 py-0.5">
                                                                            <span className="text-[var(--text-secondary)] font-medium min-w-[120px]">{key}:</span>
                                                                            <span className="text-[var(--text-primary)] flex-1">
                                                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                            {message.data.length > 10 && (
                                                                <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
                                                                    + {message.data.length - 10} more results
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* How did I prepare this? */}
                                                {message.role === 'assistant' && message.explanation && (
                                                    <div className="mt-4 pt-4 border-t border-[var(--border-light)]">
                                                        <button
                                                            onClick={() => toggleExplanation(message.id)}
                                                            className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
                                                        >
                                                            <Info size={14} weight="light" />
                                                            How did I prepare this?
                                                        </button>

                                                        {expandedExplanations.has(message.id) && (
                                                            <div className="mt-3 p-4 bg-teal-50 rounded-xl text-sm text-[var(--text-primary)] leading-relaxed border border-teal-100">
                                                                <p className="whitespace-pre-wrap">{message.explanation}</p>
                                                                {message.entitiesUsed && message.entitiesUsed.length > 0 && (
                                                                    <div className="mt-3 pt-3 border-t border-teal-200">
                                                                        <span className="text-[var(--text-secondary)] font-medium">Entities analyzed: </span>
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

                                                <p className={`text-xs mt-3 ${message.role === 'user' ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-tertiary)]'}`}>
                                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>

                                        {message.role === 'user' && (
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-1">
                                                <User size={18} className="text-white" weight="light" />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex gap-4 justify-start">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shrink-0 mt-1">
                                            <Robot size={18} className="text-white" weight="light" />
                                        </div>
                                        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl px-6 py-4 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <SpinnerGap size={18} className="animate-spin text-teal-600" weight="light" />
                                                <span className="text-[15px] text-[var(--text-secondary)]">Analyzing your data...</span>
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
                        <div className="border-t border-[var(--border-light)] bg-[var(--bg-card)] shrink-0">
                        <div className="max-w-4xl mx-auto px-6 py-4">
                            <form onSubmit={handleSubmit} className="relative">
                                <div className="relative">
                                    <textarea
                                        ref={inputRef}
                                        value={input}
                                        onChange={handleInputChange}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask about your data... (Press Enter to send, Shift+Enter for new line)"
                                        rows={1}
                                        className="w-full px-5 py-4 pr-16 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-[var(--text-tertiary)] resize-none transition-all"
                                        style={{ minHeight: '56px', maxHeight: '200px' }}
                                        disabled={isLoading}
                                    />
                                    {/* Mention suggestions popover */}
                                    {mention.isActive && mentionSuggestions.length > 0 && (
                                        <div
                                            className="absolute z-50 w-64 bg-[var(--bg-card)] rounded-lg shadow-xl border border-[var(--border-light)] overflow-hidden"
                                            style={{
                                                top: mention.top,
                                                left: mention.left
                                            }}
                                        >
                                            <div className="bg-[var(--bg-tertiary)] px-3 py-2 border-b border-[var(--border-light)] text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">
                                                {mention.type === 'entity' ? 'Entities' : mention.type === 'folder' ? 'Folders' : `Properties of ${mention.entityContext?.name}`}
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {mentionSuggestions.map((item, index) => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => selectMentionSuggestion(item)}
                                                        className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-2 transition-colors ${
                                                            index === selectedMentionIndex
                                                                ? 'bg-teal-50 text-teal-700'
                                                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                                                        }`}
                                                    >
                                                        {item._type === 'folder' ? (
                                                            <Folder size={14} style={{ color: (item as KnowledgeFolder).color || '#3b82f6' }} weight="fill" />
                                                        ) : item._type === 'entity' ? (
                                                            <Database size={14} className="text-teal-500" weight="light" />
                                                        ) : (
                                                            <Hash size={14} className="text-[var(--text-tertiary)]" weight="light" />
                                                        )}
                                                        <span className={item._type === 'folder' ? 'font-medium' : ''}>{item.name}</span>
                                                        {item._type === 'folder' && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 ml-auto">
                                                                {(item as KnowledgeFolder).entityIds.length} entities
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Mirror div for positioning */}
                                    <div
                                        ref={mirrorRef}
                                        className="absolute top-0 left-0 w-full pointer-events-none invisible whitespace-pre-wrap"
                                        style={{ fontSize: '15px', padding: '16px 80px 16px 20px', lineHeight: '1.5' }}
                                    />
                                    {/* Send button */}
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <PaperPlaneTilt size={16} weight="light" />
                                    </button>
                                </div>
                                <div className="flex items-center space-x-4 text-xs text-[var(--text-tertiary)] mt-2">
                                    <span className="flex items-center">
                                        <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mr-1.5 font-sans text-[var(--text-secondary)]">@</kbd>
                                        entities
                                    </span>
                                    <span className="flex items-center">
                                        <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mr-1.5 font-sans text-[var(--text-secondary)]">#</kbd>
                                        folders
                                    </span>
                                    <span className="flex items-center">
                                        <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded mr-1.5 font-sans text-[var(--text-secondary)]">.</kbd>
                                        attributes
                                    </span>
                                </div>
                            </form>
                            <div className="mt-2 flex items-center justify-center gap-4 text-xs text-[var(--text-tertiary)]">
                                <span>Prueba: "¿Cuál es la tasa de defectos?"</span>
                                <span>•</span>
                                <span>"Muéstrame lotes fuera de especificación"</span>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {/* New Copilot Configuration Modal */}
            {showCopilotModal && (
                <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" 
                    onClick={() => setShowCopilotModal(false)}
                >
                    <div 
                        className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-selected)] flex items-center justify-center">
                                    <Sparkle size={18} className="text-white" weight="light" />
                                </div>
                                <div>
                                    <h3 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Create New Copilot</h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Configure your AI assistant with custom instructions and data access</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                    Copilot Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={copilotName}
                                    onChange={(e) => setCopilotName(e.target.value)}
                                    placeholder="e.g., Sales Assistant, Customer Support Bot"
                                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* Instructions */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                    Instructions
                                </label>
                                <textarea
                                    value={copilotInstructions}
                                    onChange={(e) => setCopilotInstructions(e.target.value)}
                                    placeholder="Define how your copilot should behave. For example: 'You are a sales assistant focused on customer data. Always provide concise answers and cite specific records when possible. Focus on revenue and customer metrics.'"
                                    rows={5}
                                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] resize-none transition-all"
                                />
                                <p className="text-xs text-[var(--text-secondary)] mt-2">
                                    Describe the copilot's role, tone, and focus areas. Mention which datasets it should prioritize.
                                </p>
                            </div>

                            {/* Entity Selection */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                    Available Datasets
                                </label>
                                <p className="text-xs text-[var(--text-secondary)] mb-3">
                                    Select which entities this copilot can access. Leave empty to allow access to all entities.
                                </p>
                                
                                {isLoadingEntities ? (
                                    <div className="flex items-center justify-center py-8">
                                        <SpinnerGap size={20} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                                    </div>
                                ) : availableEntities.length === 0 ? (
                                    <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-secondary)] text-center">
                                        No entities available. Create entities in Knowledge Base first.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto border border-[var(--border-light)] rounded-lg p-3 bg-[var(--bg-tertiary)]">
                                        {availableEntities.map((entity) => (
                                            <button
                                                key={entity.id}
                                                onClick={() => toggleEntitySelection(entity.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors duration-200 ease-in-out text-left ${
                                                    selectedEntities.includes(entity.id)
                                                        ? 'bg-[var(--bg-card)]/60 border-[var(--border-medium)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.02)]'
                                                        : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[var(--border-medium)] text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-200 ease-in-out ${
                                                    selectedEntities.includes(entity.id)
                                                        ? 'bg-[var(--bg-selected)] border-slate-900'
                                                        : 'border-[var(--border-medium)]'
                                                }`}>
                                                    {selectedEntities.includes(entity.id) && (
                                                        <Check size={12} className="text-white" weight="light" />
                                                    )}
                                                </div>
                                                <Database size={16} weight="light" className={`flex-shrink-0 transition-colors duration-200 ease-in-out ${
                                                    selectedEntities.includes(entity.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm truncate transition-colors duration-200 ease-in-out ${
                                                        selectedEntities.includes(entity.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
                                                    }`}>
                                                        {entity.name}
                                                    </p>
                                                    {entity.description && (
                                                        <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                                                            {entity.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
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
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-medium border border-[var(--border-light)]"
                                                >
                                                    {entity.name}
                                                    <button
                                                        onClick={() => toggleEntitySelection(entityId)}
                                                        className="hover:bg-[var(--bg-selected)] rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X size={12} weight="light" />
                                                    </button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] bg-[var(--bg-card)] flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowCopilotModal(false)}
                                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCopilot}
                                disabled={!copilotName.trim()}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkle size={14} weight="light" />
                                Create Copilot
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Chat Configuration Modal */}
            {editingChatId && (
                <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" 
                    onClick={() => {
                        setEditingChatId(null);
                        setEditingInstructions('');
                        setEditingEntities([]);
                    }}
                >
                    <div 
                        className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--bg-selected)] flex items-center justify-center">
                                    <GearSix size={18} className="text-white" weight="light" />
                                </div>
                                <div>
                                    <h3 className="text-base font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Edit Copilot Configuration</h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Update instructions, datasets, and settings</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Instructions */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                    Instructions
                                </label>
                                <textarea
                                    value={editingInstructions}
                                    onChange={(e) => setEditingInstructions(e.target.value)}
                                    placeholder="Define how your copilot should behave. For example: 'You are a sales assistant focused on customer data. Always provide concise answers and cite specific records when possible. Focus on revenue and customer metrics.'"
                                    rows={5}
                                    className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)] resize-none transition-all"
                                />
                                <p className="text-xs text-[var(--text-secondary)] mt-2">
                                    Describe the copilot's role, tone, and focus areas. Mention which datasets it should prioritize.
                                </p>
                            </div>

                            {/* Entity Selection */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-primary)] mb-2">
                                    Available Datasets
                                </label>
                                <p className="text-xs text-[var(--text-secondary)] mb-3">
                                    Select which entities this copilot can access. Leave empty to allow access to all entities.
                                </p>
                                
                                {isLoadingEntities ? (
                                    <div className="flex items-center justify-center py-8">
                                        <SpinnerGap size={20} className="animate-spin text-[var(--text-tertiary)]" weight="light" />
                                    </div>
                                ) : availableEntities.length === 0 ? (
                                    <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-secondary)] text-center">
                                        No entities available. Create entities in Knowledge Base first.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto border border-[var(--border-light)] rounded-lg p-3 bg-[var(--bg-tertiary)]">
                                        {availableEntities.map((entity) => (
                                            <button
                                                key={entity.id}
                                                onClick={() => toggleEditingEntity(entity.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors duration-200 ease-in-out text-left ${
                                                    editingEntities.includes(entity.id)
                                                        ? 'bg-[var(--bg-card)]/60 border-[var(--border-medium)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.02)]'
                                                        : 'bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[var(--border-medium)] text-[var(--text-primary)]'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-200 ease-in-out ${
                                                    editingEntities.includes(entity.id)
                                                        ? 'bg-[var(--bg-selected)] border-slate-900'
                                                        : 'border-[var(--border-medium)]'
                                                }`}>
                                                    {editingEntities.includes(entity.id) && (
                                                        <Check size={12} className="text-white" weight="light" />
                                                    )}
                                                </div>
                                                <Database size={16} weight="light" className={`flex-shrink-0 transition-colors duration-200 ease-in-out ${
                                                    editingEntities.includes(entity.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm truncate transition-colors duration-200 ease-in-out ${
                                                        editingEntities.includes(entity.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'
                                                    }`}>
                                                        {entity.name}
                                                    </p>
                                                    {entity.description && (
                                                        <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                                                            {entity.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
                                                    {entity.properties?.length || 0} fields
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {editingEntities.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {editingEntities.map(entityId => {
                                            const entity = availableEntities.find(e => e.id === entityId);
                                            return entity ? (
                                                <span
                                                    key={entityId}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-xs font-medium border border-[var(--border-light)]"
                                                >
                                                    {entity.name}
                                                    <button
                                                        onClick={() => toggleEditingEntity(entityId)}
                                                        className="hover:bg-[var(--bg-selected)] rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X size={12} weight="light" />
                                                    </button>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border-light)] bg-[var(--bg-card)] flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setEditingChatId(null);
                                    setEditingInstructions('');
                                    setEditingEntities([]);
                                }}
                                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors duration-200 ease-in-out"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-selected)] hover:bg-[#555555] text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
                            >
                                <Check size={14} weight="light" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Export Modal */}
            {showExportModal && currentChat && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowExportModal(false)}>
                    <div className="bg-[var(--bg-card)] rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                    <Export size={20} className="text-[var(--accent-primary)]" />
                                </div>
                                <div>
                                    <h2 className="text-base font-medium text-[var(--text-primary)]">Export Conversation</h2>
                                    <p className="text-xs text-[var(--text-tertiary)]">{currentChat.messages.length} messages</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            >
                                <X size={18} className="text-[var(--text-tertiary)]" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            <button
                                onClick={() => exportConversation('markdown')}
                                className="w-full flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] hover:text-white rounded-xl transition-colors text-left group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center">
                                    <FileText size={18} className="text-purple-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">Markdown</p>
                                    <p className="text-xs text-[var(--text-tertiary)] group-hover:text-white/70">Formatted for docs & notes</p>
                                </div>
                            </button>
                            <button
                                onClick={() => exportConversation('txt')}
                                className="w-full flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] hover:text-white rounded-xl transition-colors text-left group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center">
                                    <FileText size={18} className="text-blue-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">Plain Text</p>
                                    <p className="text-xs text-[var(--text-tertiary)] group-hover:text-white/70">Simple readable format</p>
                                </div>
                            </button>
                            <button
                                onClick={() => exportConversation('json')}
                                className="w-full flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] hover:text-white rounded-xl transition-colors text-left group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center">
                                    <Database size={18} className="text-emerald-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">JSON</p>
                                    <p className="text-xs text-[var(--text-tertiary)] group-hover:text-white/70">Structured data export</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Toast Notifications */}
            <ToastContainer notifications={notifications} onDismiss={removeNotification} position="bottom-right" />
        </div>
    );
};
