import React, { useState, useEffect } from 'react';
import { 
    Users, Eye, Clock, User, Circle, ChatCircle, X, 
    PaperPlaneTilt, CaretDown, CaretRight, Database, GitBranch, 
    Layout, PencilSimple, Trash, Plus
} from '@phosphor-icons/react';
import { API_BASE } from '../config';

// ============================================================================
// TYPES
// ============================================================================

interface PresenceUser {
    id: string;
    name: string;
    profilePhoto?: string;
    color: string;
    location: string; // e.g., "Dashboard: Sales Overview", "Entity: Customers"
    lastActive: Date;
    isOnline: boolean;
}

interface ActivityEntry {
    id: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    action: 'create' | 'update' | 'delete' | 'view' | 'comment';
    targetType: 'entity' | 'dashboard' | 'workflow' | 'record';
    targetName: string;
    targetId: string;
    timestamp: Date;
    details?: string;
}

interface Comment {
    id: string;
    userId: string;
    userName: string;
    userPhoto?: string;
    content: string;
    timestamp: Date;
    targetType: 'entity' | 'dashboard' | 'workflow' | 'record';
    targetId: string;
}

// ============================================================================
// PRESENCE INDICATOR (Avatar Stack)
// ============================================================================

interface PresenceIndicatorProps {
    users: PresenceUser[];
    maxVisible?: number;
    size?: 'sm' | 'md' | 'lg';
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
    users,
    maxVisible = 4,
    size = 'md'
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const sizeClasses = {
        sm: 'w-6 h-6 text-[10px]',
        md: 'w-8 h-8 text-xs',
        lg: 'w-10 h-10 text-sm'
    };

    const visibleUsers = users.slice(0, maxVisible);
    const hiddenCount = users.length - maxVisible;

    if (users.length === 0) return null;

    return (
        <div className="relative">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center -space-x-2"
            >
                {visibleUsers.map((user, idx) => (
                    <div
                        key={user.id}
                        className={`${sizeClasses[size]} rounded-full border-2 border-[var(--bg-card)] flex items-center justify-center font-medium ${
                            user.isOnline ? 'ring-2 ring-emerald-400 ring-offset-1' : ''
                        }`}
                        style={{ 
                            backgroundColor: user.color,
                            zIndex: visibleUsers.length - idx
                        }}
                        title={`${user.name}${user.location ? ` - ${user.location}` : ''}`}
                    >
                        {user.profilePhoto ? (
                            <img 
                                src={user.profilePhoto} 
                                alt={user.name}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <span className="text-white">
                                {user.name.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                ))}
                
                {hiddenCount > 0 && (
                    <div 
                        className={`${sizeClasses[size]} rounded-full border-2 border-[var(--bg-card)] bg-[var(--bg-tertiary)] flex items-center justify-center font-medium text-[var(--text-secondary)]`}
                    >
                        +{hiddenCount}
                    </div>
                )}
            </button>

            {/* Expanded dropdown */}
            {isExpanded && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />
                    <div className="absolute top-full mt-2 right-0 w-64 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-[var(--border-light)] flex items-center gap-2">
                            <Users size={14} className="text-[var(--accent-primary)]" weight="light" />
                            <span className="text-xs font-medium text-[var(--text-primary)]">
                                {users.length} {users.length === 1 ? 'person' : 'people'} online
                            </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            {users.map(user => (
                                <div key={user.id} className="px-3 py-2 hover:bg-[var(--bg-tertiary)] flex items-center gap-3">
                                    <div className="relative">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                                            style={{ backgroundColor: user.color }}
                                        >
                                            {user.profilePhoto ? (
                                                <img 
                                                    src={user.profilePhoto} 
                                                    alt={user.name}
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                user.name.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-card)] ${
                                            user.isOnline ? 'bg-emerald-400' : 'bg-gray-400'
                                        }`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                                            {user.name}
                                        </p>
                                        {user.location && (
                                            <p className="text-[10px] text-[var(--text-tertiary)] truncate flex items-center gap-1">
                                                <Eye size={10} weight="light" />
                                                {user.location}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ============================================================================
// ACTIVITY FEED
// ============================================================================

interface ActivityFeedProps {
    targetType?: 'entity' | 'dashboard' | 'workflow' | 'record';
    targetId?: string;
    limit?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
    targetType,
    targetId,
    limit = 20
}) => {
    const [activities, setActivities] = useState<ActivityEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        fetchActivities();
    }, [targetType, targetId]);

    const fetchActivities = async () => {
        setIsLoading(true);
        try {
            let url = `${API_BASE}/activities?limit=${limit}`;
            if (targetType && targetId) {
                url += `&targetType=${targetType}&targetId=${targetId}`;
            }
            
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setActivities(Array.isArray(data) ? data.map((a: any) => ({
                    ...a,
                    timestamp: new Date(a.timestamp)
                })) : []);
            } else {
                // Mock data
                setActivities(getMockActivities());
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
            setActivities(getMockActivities());
        } finally {
            setIsLoading(false);
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'create': return <Plus size={12} className="text-emerald-500" weight="bold" />;
            case 'update': return <PencilSimple size={12} className="text-[var(--accent-primary)]" weight="light" />;
            case 'delete': return <Trash size={12} className="text-red-500" weight="light" />;
            case 'comment': return <ChatCircle size={12} className="text-[#84C4D1]" weight="light" />;
            default: return <Eye size={12} className="text-[var(--text-tertiary)]" weight="light" />;
        }
    };

    const getTargetIcon = (type: string) => {
        switch (type) {
            case 'entity': return <Database size={10} weight="light" />;
            case 'dashboard': return <Layout size={10} weight="light" />;
            case 'workflow': return <GitBranch size={10} weight="light" />;
            default: return <Circle size={10} weight="light" />;
        }
    };

    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    };

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[var(--accent-primary)]" weight="light" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">Recent Activity</span>
                </div>
                {isExpanded ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
            </button>

            {/* Content */}
            {isExpanded && (
                <div className="border-t border-[var(--border-light)]">
                    {isLoading ? (
                        <div className="px-4 py-6 text-center">
                            <div className="animate-spin w-5 h-5 border-2 border-[var(--border-medium)] border-t-[var(--accent-primary)] rounded-full mx-auto" />
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-[var(--text-tertiary)]">
                            No recent activity
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border-light)] max-h-[300px] overflow-y-auto">
                            {activities.map(activity => (
                                <div key={activity.id} className="px-4 py-3 hover:bg-[var(--bg-tertiary)] transition-colors">
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-medium text-[var(--text-secondary)] shrink-0 mt-0.5">
                                            {activity.userPhoto ? (
                                                <img 
                                                    src={activity.userPhoto} 
                                                    alt={activity.userName}
                                                    className="w-full h-full rounded-full object-cover"
                                                />
                                            ) : (
                                                activity.userName.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-medium text-[var(--text-primary)]">
                                                    {activity.userName}
                                                </span>
                                                {getActionIcon(activity.action)}
                                                <span className="text-xs text-[var(--text-secondary)]">
                                                    {activity.action === 'create' ? 'created' : 
                                                     activity.action === 'update' ? 'updated' :
                                                     activity.action === 'delete' ? 'deleted' :
                                                     activity.action === 'comment' ? 'commented on' : 'viewed'}
                                                </span>
                                                <span className="text-xs text-[var(--text-primary)] font-medium flex items-center gap-1">
                                                    {getTargetIcon(activity.targetType)}
                                                    {activity.targetName}
                                                </span>
                                            </div>
                                            {activity.details && (
                                                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 line-clamp-1">
                                                    {activity.details}
                                                </p>
                                            )}
                                            <span className="text-[10px] text-[var(--text-tertiary)] mt-1 block">
                                                {timeAgo(activity.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// COMMENTS SECTION
// ============================================================================

interface CommentsSectionProps {
    targetType: 'entity' | 'dashboard' | 'workflow' | 'record';
    targetId: string;
    currentUserId?: string;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
    targetType,
    targetId,
    currentUserId
}) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchComments();
    }, [targetType, targetId]);

    const fetchComments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/comments?targetType=${targetType}&targetId=${targetId}`,
                { credentials: 'include' }
            );
            if (res.ok) {
                const data = await res.json();
                setComments(Array.isArray(data) ? data.map((c: any) => ({
                    ...c,
                    timestamp: new Date(c.timestamp)
                })) : []);
            } else {
                setComments([]);
            }
        } catch (error) {
            console.error('Error fetching comments:', error);
            setComments([]);
        } finally {
            setIsLoading(false);
        }
    };

    const submitComment = async () => {
        if (!newComment.trim()) return;
        
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    targetType,
                    targetId,
                    content: newComment.trim()
                })
            });
            
            if (res.ok) {
                setNewComment('');
                fetchComments();
            }
        } catch (error) {
            console.error('Error submitting comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteComment = async (commentId: string) => {
        try {
            await fetch(`${API_BASE}/comments/${commentId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    const timeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--border-light)] flex items-center gap-2">
                <ChatCircle size={14} className="text-[var(--accent-primary)]" weight="light" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                    Comments ({comments.length})
                </span>
            </div>

            {/* Comments List */}
            <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--border-light)]">
                {isLoading ? (
                    <div className="px-4 py-6 text-center">
                        <div className="animate-spin w-5 h-5 border-2 border-[var(--border-medium)] border-t-[var(--accent-primary)] rounded-full mx-auto" />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[var(--text-tertiary)]">
                        No comments yet. Be the first to comment!
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="px-4 py-3 group">
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
                                    {comment.userPhoto ? (
                                        <img 
                                            src={comment.userPhoto} 
                                            alt={comment.userName}
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    ) : (
                                        comment.userName.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-[var(--text-primary)]">
                                                {comment.userName}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-tertiary)]">
                                                {timeAgo(comment.timestamp)}
                                            </span>
                                        </div>
                                        {currentUserId === comment.userId && (
                                            <button
                                                onClick={() => deleteComment(comment.id)}
                                                className="p-1 text-[var(--text-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash size={12} weight="light" />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                                        {comment.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Comment Input */}
            <div className="px-4 py-3 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]/30">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
                        placeholder="Write a comment..."
                        className="flex-1 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:text-[var(--text-tertiary)]"
                        disabled={isSubmitting}
                    />
                    <button
                        onClick={submitComment}
                        disabled={!newComment.trim() || isSubmitting}
                        className="p-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] disabled:bg-[var(--bg-tertiary)] text-white disabled:text-[var(--text-tertiary)] rounded-lg transition-colors"
                    >
                        <PaperPlaneTilt size={14} weight="light" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MOCK DATA
// ============================================================================

const getMockActivities = (): ActivityEntry[] => [
    {
        id: '1',
        userId: 'u1',
        userName: 'Ana García',
        action: 'update',
        targetType: 'entity',
        targetName: 'Customers',
        targetId: 'e1',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        details: 'Added 15 new records'
    },
    {
        id: '2',
        userId: 'u2',
        userName: 'Carlos López',
        action: 'create',
        targetType: 'dashboard',
        targetName: 'Sales Overview',
        targetId: 'd1',
        timestamp: new Date(Date.now() - 30 * 60 * 1000)
    },
    {
        id: '3',
        userId: 'u1',
        userName: 'Ana García',
        action: 'comment',
        targetType: 'workflow',
        targetName: 'Data Pipeline',
        targetId: 'w1',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        details: 'Should we add error handling here?'
    },
    {
        id: '4',
        userId: 'u3',
        userName: 'María Rodríguez',
        action: 'delete',
        targetType: 'record',
        targetName: 'Old Invoice #1234',
        targetId: 'r1',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
    }
];

export default { PresenceIndicator, ActivityFeed, CommentsSection };
