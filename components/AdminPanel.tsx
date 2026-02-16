import React, { useState, useEffect } from 'react';
import { Users, Buildings, GitBranch, Layout, Database, Shield, ShieldCheck, ArrowLeft, ArrowsClockwise, CaretDown, CaretUp, Briefcase, Target, Megaphone, CheckCircle, Clock, ChatCircle, Trash, MagnifyingGlass, X } from '@phosphor-icons/react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';

interface AdminStats {
    users: number;
    organizations: number;
    workflows: number;
    dashboards: number;
    entities: number;
}

interface AdminUser {
    id: string;
    name: string;
    email: string;
    profilePhoto?: string;
    companyRole?: string;
    isAdmin: boolean;
    createdAt: string;
    organizations: string;
    orgCount: number;
    workflowCount: number;
    dashboardCount: number;
    onboardingRole?: string;
    onboardingIndustry?: string;
    onboardingUseCase?: string;
    onboardingSource?: string;
    onboardingCompleted: boolean;
}

interface NodeFeedback {
    id: string;
    nodeType: string;
    nodeLabel: string;
    feedbackText: string;
    userId: string;
    userName: string;
    userEmail: string;
    organizationId: string;
    organizationName: string;
    workflowId?: string;
    workflowName?: string;
    createdAt: string;
}

interface AdminPanelProps {
    onNavigate?: (view: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [nodeFeedback, setNodeFeedback] = useState<NodeFeedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users');
    const [userSearchQuery, setUserSearchQuery] = useState<string>('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsRefreshing(true);
        try {
            const [statsRes, usersRes, feedbackRes] = await Promise.all([
                fetch(`${API_BASE}/admin/stats`, { credentials: 'include' }),
                fetch(`${API_BASE}/admin/users`, { credentials: 'include' }),
                fetch(`${API_BASE}/admin/node-feedback`, { credentials: 'include' })
            ]);

            if (statsRes.ok && usersRes.ok) {
                const statsData = await statsRes.json();
                const usersData = await usersRes.json();
                setStats(statsData);
                setUsers(usersData);
            }

            if (feedbackRes.ok) {
                const feedbackData = await feedbackRes.json();
                setNodeFeedback(feedbackData);
            }
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const deleteFeedback = async (feedbackId: string) => {
        if (!confirm('Are you sure you want to delete this feedback?')) return;
        
        try {
            const res = await fetch(`${API_BASE}/admin/node-feedback/${feedbackId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                setNodeFeedback(prev => prev.filter(f => f.id !== feedbackId));
            }
        } catch (error) {
            console.error('Error deleting feedback:', error);
        }
    };

    const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
        if (userId === user?.id) {
            alert('You cannot remove your own admin status');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/admin/users/${userId}/admin`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAdmin: !currentStatus }),
                credentials: 'include'
            });

            if (res.ok) {
                setUsers(prev => prev.map(u => 
                    u.id === userId ? { ...u, isAdmin: !currentStatus } : u
                ));
            }
        } catch (error) {
            console.error('Error updating admin status:', error);
        }
    };

    const deleteUser = async (userId: string, userEmail: string) => {
        if (userId === user?.id) {
            alert('You cannot delete your own account');
            return;
        }

        const confirmed = confirm(
            `⚠️ Are you sure you want to delete the user "${userEmail}"?\n\n` +
            `This will permanently delete:\n` +
            `• The user account\n` +
            `• All their workflows\n` +
            `• All their dashboards\n` +
            `• All their reports\n` +
            `• All their entities\n\n` +
            `This action cannot be undone!`
        );

        if (!confirmed) return;

        try {
            const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== userId));
                // Update stats
                if (stats) {
                    setStats({ ...stats, users: stats.users - 1 });
                }
                alert(`User ${userEmail} has been deleted successfully`);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('An error occurred while deleting the user');
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
                <div className="animate-spin text-teal-600">
                    <ArrowsClockwise size={32} weight="light" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-[var(--bg-primary)] overflow-hidden">
            {/* Header */}
            <header className="h-16 bg-[var(--bg-primary)] border-b border-[var(--border-light)] px-8 flex-shrink-0">
                <div className="max-w-7xl mx-auto flex items-center justify-between h-full">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onNavigate?.('entities')}
                            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                        >
                            <ArrowLeft size={18} weight="light" className="text-[var(--text-secondary)]" />
                        </button>
                        <div>
                            <h1 className="text-lg font-normal text-[var(--text-primary)]">Admin Panel</h1>
                            <p className="text-[11px] text-[var(--text-secondary)]">Platform administration</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchData}
                            disabled={isRefreshing}
                            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors disabled:opacity-50"
                        >
                            <ArrowsClockwise size={18} weight="light" className={`text-[var(--text-secondary)] ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <div />
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#84C4D1]/20 rounded-lg">
                                <Users size={20} weight="light" className="text-[var(--accent-primary)]" />
                            </div>
                            <div>
                                <p className="text-2xl font-normal text-slate-800">{stats?.users || 0}</p>
                                <p className="text-xs text-[var(--text-secondary)]">Users</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[var(--accent-primary)]/10 rounded-lg">
                                <Buildings size={20} weight="light" className="text-[var(--accent-primary)]" />
                            </div>
                            <div>
                                <p className="text-2xl font-normal text-slate-800">{stats?.organizations || 0}</p>
                                <p className="text-xs text-[var(--text-secondary)]">Organizations</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-100 rounded-lg">
                                <GitBranch size={20} weight="light" className="text-teal-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-normal text-slate-800">{stats?.workflows || 0}</p>
                                <p className="text-xs text-[var(--text-secondary)]">Workflows</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Layout size={20} weight="light" className="text-orange-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-normal text-slate-800">{stats?.dashboards || 0}</p>
                                <p className="text-xs text-[var(--text-secondary)]">Dashboards</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Database size={20} weight="light" className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-normal text-slate-800">{stats?.entities || 0}</p>
                                <p className="text-xs text-[var(--text-secondary)]">Entities</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                            activeTab === 'users'
                                ? 'bg-teal-600 text-white'
                                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <Users size={18} weight="light" />
                        Users ({users.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('feedback')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
                            activeTab === 'feedback'
                                ? 'bg-teal-600 text-white'
                                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <ChatCircle size={18} weight="light" />
                        Node Feedback ({nodeFeedback.length})
                    </button>
                </div>

                {/* Users Table */}
                {activeTab === 'users' && (
                <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--border-light)]">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-lg font-normal text-slate-800 flex items-center gap-2">
                                <Users size={20} weight="light" className="text-[var(--text-secondary)]" />
                                Registered Users
                            </h2>
                            {/* Search Input */}
                            <div className="relative">
                                <MagnifyingGlass size={16} weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                                <input
                                    type="text"
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    placeholder="Search by name or email..."
                                    className="pl-9 pr-8 py-2 w-64 border border-[var(--border-light)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                                {userSearchQuery && (
                                    <button
                                        onClick={() => setUserSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--bg-tertiary)] rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                                    >
                                        <X size={14} weight="light" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-[var(--bg-tertiary)]">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Organizations</th>
                                    <th className="px-6 py-3 text-center text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Workflows</th>
                                    <th className="px-6 py-3 text-center text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Dashboards</th>
                                    <th className="px-6 py-3 text-left text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Registered</th>
                                    <th className="px-6 py-3 text-center text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Admin</th>
                                    <th className="px-6 py-3 text-center text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {users
                                    .filter(u => {
                                        if (!userSearchQuery.trim()) return true;
                                        const query = userSearchQuery.toLowerCase();
                                        return (
                                            (u.name?.toLowerCase() || '').includes(query) ||
                                            (u.email?.toLowerCase() || '').includes(query)
                                        );
                                    })
                                    .map((u) => (
                                    <React.Fragment key={u.id}>
                                        <tr 
                                            className="hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                                            onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <button className="p-1 hover:bg-[var(--bg-selected)] rounded transition-colors">
                                                        {expandedUserId === u.id ? (
                                                            <CaretUp size={16} weight="light" className="text-[var(--text-tertiary)]" />
                                                        ) : (
                                                            <CaretDown size={16} weight="light" className="text-[var(--text-tertiary)]" />
                                                        )}
                                                    </button>
                                                    {u.profilePhoto ? (
                                                        <img 
                                                            src={u.profilePhoto.startsWith('http') ? u.profilePhoto : `${API_BASE}/files/${u.profilePhoto}`}
                                                            alt={u.name}
                                                            className="w-10 h-10 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-normal">
                                                            {u.name?.charAt(0).toUpperCase() || u.email.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-slate-800">{u.name || 'No name'}</p>
                                                            {u.onboardingCompleted ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-xs" title="Onboarding completed">
                                                                    <CheckCircle size={12} weight="light" />
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-xs" title="Onboarding pending">
                                                                    <Clock size={12} weight="light" />
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-[var(--text-secondary)]">{u.email}</p>
                                                        {u.companyRole && (
                                                            <p className="text-xs text-[var(--text-tertiary)]">{u.companyRole}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {u.organizations?.split(',').map((org, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded text-xs">
                                                            {org.trim()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded-full text-sm font-medium">
                                                    <GitBranch size={14} weight="light" />
                                                    {u.workflowCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium">
                                                    <Layout size={14} weight="light" />
                                                    {u.dashboardCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                                                {formatDate(u.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleAdminStatus(u.id, u.isAdmin);
                                                    }}
                                                    className={`p-2 rounded-lg transition-colors ${
                                                        u.isAdmin 
                                                            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                                                            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-selected)] hover:text-[var(--text-secondary)]'
                                                    }`}
                                                    title={u.isAdmin ? 'Remove admin' : 'Make admin'}
                                                >
                                                    {u.isAdmin ? <ShieldCheck size={18} weight="light" /> : <Shield size={18} weight="light" />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {u.id !== user?.id ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteUser(u.id, u.email);
                                                        }}
                                                        className="p-2 rounded-lg transition-colors bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-red-100 hover:text-red-600"
                                                        title="Delete user"
                                                    >
                                                        <Trash size={18} weight="light" />
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-[var(--text-tertiary)]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                        {/* Expanded onboarding details */}
                                        {expandedUserId === u.id && (
                                            <tr className="bg-[var(--bg-tertiary)]">
                                                <td colSpan={7} className="px-6 py-4">
                                                    <div className="ml-10">
                                                        <h4 className="text-sm font-normal text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                                            <Users size={16} weight="light" />
                                                            Onboarding Information
                                                        </h4>
                                                        {u.onboardingCompleted ? (
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-light)]">
                                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-1">
                                                                        <Briefcase size={12} weight="light" />
                                                                        Role
                                                                    </div>
                                                                    <p className="text-sm font-medium text-slate-800">{u.onboardingRole || '-'}</p>
                                                                </div>
                                                                <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-light)]">
                                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-1">
                                                                        <Buildings size={12} weight="light" />
                                                                        Industry
                                                                    </div>
                                                                    <p className="text-sm font-medium text-slate-800">{u.onboardingIndustry || '-'}</p>
                                                                </div>
                                                                <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-light)]">
                                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-1">
                                                                        <Target size={12} weight="light" />
                                                                        Use Case
                                                                    </div>
                                                                    <p className="text-sm font-medium text-slate-800">{u.onboardingUseCase || '-'}</p>
                                                                </div>
                                                                <div className="bg-[var(--bg-card)] rounded-lg p-3 border border-[var(--border-light)]">
                                                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mb-1">
                                                                        <Megaphone size={12} weight="light" />
                                                                        Source
                                                                    </div>
                                                                    <p className="text-sm font-medium text-slate-800">{u.onboardingSource || '-'}</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
                                                                <p className="flex items-center gap-2">
                                                                    <Clock size={16} weight="light" />
                                                                    This user hasn't completed the onboarding survey yet.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {users.length === 0 && (
                        <div className="px-6 py-12 text-center text-[var(--text-secondary)]">
                            No users found
                        </div>
                    )}
                    {users.length > 0 && userSearchQuery && users.filter(u => {
                        const query = userSearchQuery.toLowerCase();
                        return (u.name?.toLowerCase() || '').includes(query) || (u.email?.toLowerCase() || '').includes(query);
                    }).length === 0 && (
                        <div className="px-6 py-12 text-center text-[var(--text-secondary)]">
                            <MagnifyingGlass size={32} weight="light" className="mx-auto mb-3 opacity-30" />
                            <p>No users match "{userSearchQuery}"</p>
                            <button 
                                onClick={() => setUserSearchQuery('')}
                                className="mt-2 text-teal-600 hover:underline text-sm"
                            >
                                Clear search
                            </button>
                        </div>
                    )}
                </div>
                )}

                {/* Node Feedback Table */}
                {activeTab === 'feedback' && (
                <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--border-light)]">
                        <h2 className="text-lg font-normal text-slate-800 flex items-center gap-2">
                            <ChatCircle size={20} weight="light" className="text-teal-600" />
                            Node Feedback
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">User suggestions for workflow node improvements</p>
                    </div>
                    {nodeFeedback.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {nodeFeedback.map((feedback) => (
                                <div key={feedback.id} className="p-4 hover:bg-[var(--bg-tertiary)] transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                    feedback.nodeType === 'report_prompt' 
                                                        ? 'bg-purple-100 text-purple-700' 
                                                        : feedback.nodeType === 'dashboard_prompt'
                                                        ? 'bg-orange-100 text-orange-700'
                                                        : feedback.nodeType === 'workflow_assistant_prompt'
                                                        ? 'bg-slate-700 text-white'
                                                        : feedback.nodeType === 'connection'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-teal-100 text-teal-700'
                                                }`}>
                                                    {feedback.nodeType === 'report_prompt' ? '📊 Report Prompt'
                                                        : feedback.nodeType === 'dashboard_prompt' ? '📈 Dashboard Prompt'
                                                        : feedback.nodeType === 'workflow_assistant_prompt' ? '🤖 AI Assistant Prompt'
                                                        : feedback.nodeType === 'connection' ? `🔗 Connection: ${feedback.nodeLabel}`
                                                        : `🔧 ${feedback.nodeLabel || feedback.nodeType}`}
                                                </span>
                                                {feedback.workflowName && (
                                                    <span className="text-xs text-[var(--text-tertiary)]">
                                                        in workflow: {feedback.workflowName}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-800 whitespace-pre-wrap mb-2">
                                                {feedback.feedbackText}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                                                <span className="flex items-center gap-1">
                                                    <Users size={12} weight="light" />
                                                    {feedback.userName || feedback.userEmail || 'Unknown user'}
                                                </span>
                                                {feedback.organizationName && (
                                                    <span className="flex items-center gap-1">
                                                        <Buildings size={12} weight="light" />
                                                        {feedback.organizationName}
                                                    </span>
                                                )}
                                                <span>
                                                    {new Date(feedback.createdAt).toLocaleDateString('es-ES', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteFeedback(feedback.id)}
                                            className="p-2 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete feedback"
                                        >
                                            <Trash size={16} weight="light" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="px-6 py-12 text-center text-[var(--text-secondary)]">
                            <ChatCircle size={32} weight="light" className="mx-auto mb-3 opacity-30" />
                            <p>No feedback received yet</p>
                            <p className="text-xs mt-1">User feedback will appear here when submitted</p>
                        </div>
                    )}
                </div>
                )}
                </div>
            </main>
        </div>
    );
};
