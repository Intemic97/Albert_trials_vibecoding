import React, { useState, useEffect } from 'react';
import { Entity } from '../types';
import { Database, Sparkles, X, Info, Plus, Share2, LayoutDashboard, ChevronDown, Copy, Check, Trash2, Link, ExternalLink } from 'lucide-react';
import { PromptInput } from './PromptInput';
import { DynamicChart, WidgetConfig } from './DynamicChart';
import { ProfileMenu } from './ProfileMenu';
import { API_BASE } from '../config';

// Generate UUID that works in non-HTTPS contexts
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for HTTP contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface DashboardData {
    id: string;
    name: string;
    description?: string;
    isPublic?: number;
    shareToken?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface SavedWidget extends WidgetConfig {
    id: string;
    position?: number;
}

interface DashboardProps {
    entities: Entity[];
    onNavigate?: (entityId: string) => void;
    onViewChange?: (view: string) => void;
}

interface WidgetCardProps {
    widget: WidgetConfig;
    onSave?: (widget: WidgetConfig) => void;
    onRemove: () => void;
    isSaved?: boolean;
    onNavigate?: (entityId: string) => void;
    entities?: Entity[];
}

const WidgetCard: React.FC<WidgetCardProps> = ({ widget, onSave, onRemove, isSaved, onNavigate, entities }) => {
    const [showExplanation, setShowExplanation] = useState(false);

    const renderExplanation = (text: string) => {
        if (!text) return null;

        const parts = text.split(/(@[a-zA-Z0-9_]+)/g);

        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                const entityName = part.substring(1);
                const entity = entities?.find(e => e.name === entityName);

                if (entity && onNavigate) {
                    return (
                        <span
                            key={index}
                            onClick={() => onNavigate(entity.id)}
                            className="text-teal-600 font-medium cursor-pointer hover:underline"
                            title={`View ${entityName} details`}
                        >
                            {part}
                        </span>
                    );
                }
            }
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative group">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {!isSaved && onSave && (
                    <button
                        onClick={() => onSave(widget)}
                        className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                        title="Save to Dashboard"
                    >
                        <Plus size={16} />
                    </button>
                )}
                <button
                    onClick={onRemove}
                    className={`p-1 text-slate-400 rounded transition-colors hover:text-red-500 hover:bg-red-50`}
                    title={isSaved ? "Delete Widget" : "Remove"}
                >
                    <X size={16} />
                </button>
            </div>

            <h3 className="text-lg font-semibold text-slate-800 mb-1">{widget.title}</h3>
            <p className="text-xs text-slate-500 mb-4">{widget.description}</p>

            <DynamicChart config={widget} />

            {widget.explanation && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <button
                        onClick={() => setShowExplanation(!showExplanation)}
                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                        <Info size={12} />
                        How did I prepare this?
                    </button>

                    {showExplanation && (
                        <div className="mt-2 p-3 bg-teal-50 rounded-lg text-xs text-slate-700 leading-relaxed animate-in fade-in slide-in-from-top-1 whitespace-pre-wrap">
                            {renderExplanation(widget.explanation)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ entities, onNavigate, onViewChange }) => {
    // Dashboard state
    const [dashboards, setDashboards] = useState<DashboardData[]>([]);
    const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
    const [showDashboardDropdown, setShowDashboardDropdown] = useState(false);
    
    // Modal states
    const [showShareModal, setShowShareModal] = useState(false);
    
    // Inline editing states
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editingTitle, setEditingTitle] = useState('');
    const [editingDescription, setEditingDescription] = useState('');
    
    // Widget state
    const [generatedWidgets, setGeneratedWidgets] = useState<WidgetConfig[]>([]);
    const [savedWidgets, setSavedWidgets] = useState<SavedWidget[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Share state
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);

    const selectedDashboard = dashboards.find(d => d.id === selectedDashboardId);

    // Fetch dashboards on mount
    useEffect(() => {
        fetchDashboards();
    }, []);

    // Fetch widgets when dashboard changes
    useEffect(() => {
        if (selectedDashboardId) {
            fetchWidgets(selectedDashboardId);
        } else {
            setSavedWidgets([]);
        }
    }, [selectedDashboardId]);

    const fetchDashboards = async () => {
        try {
            const res = await fetch(`${API_BASE}/dashboards`, { credentials: 'include' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setDashboards(data);
                // Auto-select first dashboard if available
                if (data.length > 0 && !selectedDashboardId) {
                    setSelectedDashboardId(data[0].id);
                }
            }
        } catch (error) {
            console.error('Error fetching dashboards:', error);
        }
    };

    const fetchWidgets = async (dashboardId: string) => {
        try {
            const res = await fetch(`${API_BASE}/dashboards/${dashboardId}/widgets`, { credentials: 'include' });
            const data = await res.json();
            if (Array.isArray(data)) {
                setSavedWidgets(data.map((w: any) => ({
                    ...w.config,
                    id: w.id,
                    position: w.position
                })));
            } else {
                setSavedWidgets([]);
            }
        } catch (error) {
            console.error('Error fetching widgets:', error);
            setSavedWidgets([]);
        }
    };

    const handleCreateDashboard = async () => {
        try {
            const id = generateUUID();
            const defaultName = `Dashboard ${dashboards.length + 1}`;
            const res = await fetch(`${API_BASE}/dashboards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    name: defaultName,
                    description: ''
                }),
                credentials: 'include'
            });

            if (res.ok) {
                const newDashboard = await res.json();
                setDashboards(prev => [newDashboard, ...prev]);
                setSelectedDashboardId(newDashboard.id);
                // Start editing the title immediately
                setEditingTitle(defaultName);
                setIsEditingTitle(true);
            }
        } catch (error) {
            console.error('Error creating dashboard:', error);
            alert('Failed to create dashboard.');
        }
    };

    const handleSaveTitle = async () => {
        if (!selectedDashboardId || !editingTitle.trim()) {
            setIsEditingTitle(false);
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editingTitle.trim(),
                    description: selectedDashboard?.description || ''
                }),
                credentials: 'include'
            });

            if (res.ok) {
                setDashboards(prev => prev.map(d => 
                    d.id === selectedDashboardId 
                        ? { ...d, name: editingTitle.trim() }
                        : d
                ));
            }
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
        setIsEditingTitle(false);
    };

    const handleSaveDescription = async () => {
        if (!selectedDashboardId) {
            setIsEditingDescription(false);
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: selectedDashboard?.name || '',
                    description: editingDescription.trim()
                }),
                credentials: 'include'
            });

            if (res.ok) {
                setDashboards(prev => prev.map(d => 
                    d.id === selectedDashboardId 
                        ? { ...d, description: editingDescription.trim() }
                        : d
                ));
            }
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
        setIsEditingDescription(false);
    };

    const handleDeleteDashboard = async () => {
        if (!selectedDashboardId) return;
        if (!confirm('Are you sure you want to delete this dashboard and all its widgets?')) return;
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                const remaining = dashboards.filter(d => d.id !== selectedDashboardId);
                setDashboards(remaining);
                setSelectedDashboardId(remaining.length > 0 ? remaining[0].id : null);
            }
        } catch (error) {
            console.error('Error deleting dashboard:', error);
            alert('Failed to delete dashboard.');
        }
    };

    const handleShareDashboard = async () => {
        if (!selectedDashboardId) return;
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}/share`, {
                method: 'POST',
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                const fullUrl = `${window.location.origin}/shared/${data.shareToken}`;
                setShareUrl(fullUrl);
                setShowShareModal(true);
                
                // Update local state
                setDashboards(prev => prev.map(d => 
                    d.id === selectedDashboardId 
                        ? { ...d, isPublic: 1, shareToken: data.shareToken }
                        : d
                ));
            }
        } catch (error) {
            console.error('Error sharing dashboard:', error);
            alert('Failed to share dashboard.');
        }
    };

    const handleUnshareDashboard = async () => {
        if (!selectedDashboardId) return;
        
        try {
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}/unshare`, {
                method: 'POST',
                credentials: 'include'
            });

            if (res.ok) {
                setDashboards(prev => prev.map(d => 
                    d.id === selectedDashboardId 
                        ? { ...d, isPublic: 0, shareToken: undefined }
                        : d
                ));
                setShowShareModal(false);
                setShareUrl('');
            }
        } catch (error) {
            console.error('Error unsharing dashboard:', error);
        }
    };

    const copyShareUrl = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleGenerateWidget = async (prompt: string, mentionedEntityIds: string[]) => {
        setIsGenerating(true);
        try {
            const res = await fetch(`${API_BASE}/generate-widget`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    mentionedEntityIds
                }),
                credentials: 'include'
            });

            const widgetConfig = await res.json();
            if (widgetConfig.error) {
                throw new Error(widgetConfig.error);
            }

            setGeneratedWidgets(prev => [widgetConfig, ...prev]);
        } catch (error) {
            console.error('Error generating widget:', error);
            alert('Failed to generate widget. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveWidget = async (widget: WidgetConfig) => {
        if (!selectedDashboardId) {
            alert('Please select or create a dashboard first.');
            return;
        }
        
        try {
            const id = generateUUID();
            const res = await fetch(`${API_BASE}/dashboards/${selectedDashboardId}/widgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    title: widget.title,
                    description: widget.description,
                    config: widget
                }),
                credentials: 'include'
            });

            if (res.ok) {
                const savedWidget = await res.json();
                setSavedWidgets(prev => [...prev, { ...widget, id: savedWidget.id, position: savedWidget.position }]);
                setGeneratedWidgets(prev => prev.filter(w => w !== widget));
            }
        } catch (error) {
            console.error('Error saving widget:', error);
            alert('Failed to save widget.');
        }
    };

    const removeWidget = async (widgetId: string, isGenerated: boolean = false, index?: number) => {
        if (isGenerated && index !== undefined) {
            setGeneratedWidgets(prev => prev.filter((_, i) => i !== index));
        } else {
            try {
                await fetch(`${API_BASE}/widgets/${widgetId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                setSavedWidgets(prev => prev.filter(w => w.id !== widgetId));
            } catch (error) {
                console.error('Error deleting widget:', error);
            }
        }
    };

    const openShareModalIfShared = () => {
        if (selectedDashboard?.shareToken) {
            const fullUrl = `${window.location.origin}/shared/${selectedDashboard.shareToken}`;
            setShareUrl(fullUrl);
            setShowShareModal(true);
        } else {
            handleShareDashboard();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-20 shrink-0">
                <div className="flex items-center gap-4">
                    <LayoutDashboard className="text-teal-600" size={24} />
                    
                    {/* Dashboard Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowDashboardDropdown(!showDashboardDropdown)}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                            <span className="font-semibold text-slate-800">
                                {selectedDashboard?.name || 'Select Dashboard'}
                            </span>
                            <ChevronDown size={16} className="text-slate-500" />
                        </button>
                        
                        {showDashboardDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-30 py-1">
                                {dashboards.map(dashboard => (
                                    <button
                                        key={dashboard.id}
                                        onClick={() => {
                                            setSelectedDashboardId(dashboard.id);
                                            setShowDashboardDropdown(false);
                                        }}
                                        className={`w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between ${
                                            dashboard.id === selectedDashboardId ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
                                        }`}
                                    >
                                        <span className="truncate">{dashboard.name}</span>
                                        {dashboard.isPublic === 1 && (
                                            <Link size={12} className="text-teal-500 shrink-0 ml-2" />
                                        )}
                                    </button>
                                ))}
                                {dashboards.length === 0 && (
                                    <div className="px-4 py-2 text-sm text-slate-500">No dashboards yet</div>
                                )}
                                <div className="border-t border-slate-100 mt-1 pt-1">
                                    <button
                                        onClick={() => {
                                            handleCreateDashboard();
                                            setShowDashboardDropdown(false);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-teal-600 flex items-center gap-2"
                                    >
                                        <Plus size={16} />
                                        New Dashboard
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Dashboard Actions */}
                    {selectedDashboard && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={openShareModalIfShared}
                                className={`p-2 rounded-lg transition-colors ${
                                    selectedDashboard.isPublic 
                                        ? 'text-teal-600 hover:bg-teal-50' 
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                                title={selectedDashboard.isPublic ? "Manage Share Link" : "Share Dashboard"}
                            >
                                <Share2 size={18} />
                            </button>
                            <button
                                onClick={handleDeleteDashboard}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Dashboard"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    <ProfileMenu onNavigate={onViewChange} />
                </div>
            </header>

            {/* Click outside to close dropdown */}
            {showDashboardDropdown && (
                <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowDashboardDropdown(false)}
                />
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8">

                    {/* No Dashboard Selected State */}
                    {!selectedDashboard && dashboards.length === 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                            <LayoutDashboard className="mx-auto text-slate-300 mb-4" size={48} />
                            <h3 className="text-lg font-semibold text-slate-600 mb-2">Create your first dashboard</h3>
                            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                                Dashboards let you organize and share your visualizations with your team.
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                            >
                                <Plus size={18} />
                                Create Dashboard
                            </button>
                        </div>
                    )}

                    {/* Dashboard Content */}
                    {selectedDashboard && (
                        <>
                            {/* Editable Title */}
                            <div className="mb-2">
                                {isEditingTitle ? (
                                    <input
                                        type="text"
                                        value={editingTitle}
                                        onChange={e => setEditingTitle(e.target.value)}
                                        onBlur={handleSaveTitle}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                                        className="text-2xl font-bold text-slate-800 bg-transparent border-b-2 border-teal-500 focus:outline-none w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <h2 
                                        onClick={() => {
                                            setEditingTitle(selectedDashboard.name);
                                            setIsEditingTitle(true);
                                        }}
                                        className="text-2xl font-bold text-slate-800 cursor-pointer hover:text-teal-600 transition-colors"
                                        title="Click to edit"
                                    >
                                        {selectedDashboard.name}
                                    </h2>
                                )}
                            </div>

                            {/* Editable Description */}
                            <div className="mb-6">
                                {isEditingDescription ? (
                                    <input
                                        type="text"
                                        value={editingDescription}
                                        onChange={e => setEditingDescription(e.target.value)}
                                        onBlur={handleSaveDescription}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveDescription()}
                                        placeholder="Add a description..."
                                        className="text-sm text-slate-500 bg-transparent border-b border-slate-300 focus:border-teal-500 focus:outline-none w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <p 
                                        onClick={() => {
                                            setEditingDescription(selectedDashboard.description || '');
                                            setIsEditingDescription(true);
                                        }}
                                        className="text-sm text-slate-500 cursor-pointer hover:text-slate-700 transition-colors"
                                        title="Click to edit"
                                    >
                                        {selectedDashboard.description || 'Click to add description...'}
                                    </p>
                                )}
                            </div>

                            {/* Saved Widgets Section */}
                            {savedWidgets.length > 0 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {savedWidgets.map((widget) => (
                                            <WidgetCard
                                                key={widget.id}
                                                widget={widget}
                                                onRemove={() => removeWidget(widget.id)}
                                                isSaved={true}
                                                onNavigate={onNavigate}
                                                entities={entities}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* AI Widget Generator */}
                            <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl shadow-lg p-4">
                                <div className="bg-white rounded-lg p-3">
                                    <PromptInput
                                        entities={entities}
                                        onGenerate={handleGenerateWidget}
                                        isGenerating={isGenerating}
                                        placeholder="Describe a chart... e.g. 'Bar chart of @Customers by total orders'"
                                        buttonLabel="Generate"
                                        className="text-slate-800"
                                    />
                                </div>
                            </div>

                            {/* Generated Widgets Section */}
                            {generatedWidgets.length > 0 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                        <Sparkles size={18} className="text-teal-500" />
                                        New Widgets
                                        <span className="text-xs font-normal text-slate-500">(click + to save to dashboard)</span>
                                    </h3>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {generatedWidgets.map((widget, index) => (
                                            <WidgetCard
                                                key={index}
                                                widget={widget}
                                                onSave={handleSaveWidget}
                                                onRemove={() => removeWidget('', true, index)}
                                                onNavigate={onNavigate}
                                                entities={entities}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Empty State when no widgets */}
                            {savedWidgets.length === 0 && generatedWidgets.length === 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                                    <Database className="mx-auto text-slate-300 mb-4" size={48} />
                                    <h3 className="text-lg font-semibold text-slate-600 mb-2">No widgets yet</h3>
                                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                                        Use the prompt below to create custom charts and visualizations from your data.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div>


            {/* Share Dashboard Modal */}
            {showShareModal && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl p-6 w-[450px]" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Share2 size={20} className="text-teal-600" />
                            Share Dashboard
                        </h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Anyone with this link can view your dashboard without logging in.
                        </p>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={shareUrl}
                                readOnly
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-600"
                            />
                            <button
                                onClick={copyShareUrl}
                                className={`px-3 py-2 rounded-lg flex items-center gap-1 text-sm font-medium transition-colors ${
                                    copied 
                                        ? 'bg-green-100 text-green-700' 
                                        : 'bg-teal-600 text-white hover:bg-teal-700'
                                }`}
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        </div>
                        <div className="flex gap-2 mb-4">
                            <a
                                href={shareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                            >
                                <ExternalLink size={14} />
                                Open in new tab
                            </a>
                        </div>
                        <div className="flex gap-2 justify-between border-t border-slate-100 pt-4">
                            <button
                                onClick={handleUnshareDashboard}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
                            >
                                Stop Sharing
                            </button>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
