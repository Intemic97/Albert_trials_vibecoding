import React, { useState, useEffect } from 'react';
import { Users, Building2, GitBranch, LayoutDashboard, Database, Shield, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { ProfileMenu } from './ProfileMenu';

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
}

interface AdminPanelProps {
    onNavigate?: (view: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsRefreshing(true);
        try {
            const [statsRes, usersRes] = await Promise.all([
                fetch(`${API_BASE}/admin/stats`, { credentials: 'include' }),
                fetch(`${API_BASE}/admin/users`, { credentials: 'include' })
            ]);

            if (statsRes.ok && usersRes.ok) {
                const statsData = await statsRes.json();
                const usersData = await usersRes.json();
                setStats(statsData);
                setUsers(usersData);
            }
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
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
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin text-teal-600">
                    <RefreshCw size={32} />
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onNavigate?.('entities')}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft size={20} className="text-slate-600" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
                                <Shield size={24} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800">Admin Panel</h1>
                                <p className="text-sm text-slate-500">Platform administration</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchData}
                            disabled={isRefreshing}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={20} className={`text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <ProfileMenu onNavigate={onNavigate} />
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Users size={20} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats?.users || 0}</p>
                                <p className="text-xs text-slate-500">Users</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Building2 size={20} className="text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats?.organizations || 0}</p>
                                <p className="text-xs text-slate-500">Organizations</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-100 rounded-lg">
                                <GitBranch size={20} className="text-teal-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats?.workflows || 0}</p>
                                <p className="text-xs text-slate-500">Workflows</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <LayoutDashboard size={20} className="text-orange-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats?.dashboards || 0}</p>
                                <p className="text-xs text-slate-500">Dashboards</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Database size={20} className="text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-800">{stats?.entities || 0}</p>
                                <p className="text-xs text-slate-500">Entities</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Users size={20} className="text-slate-600" />
                            Registered Users
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Organizations</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Workflows</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Dashboards</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Registered</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Admin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {u.profilePhoto ? (
                                                    <img 
                                                        src={u.profilePhoto.startsWith('http') ? u.profilePhoto : `${API_BASE}/files/${u.profilePhoto}`}
                                                        alt={u.name}
                                                        className="w-10 h-10 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-semibold">
                                                        {u.name?.charAt(0).toUpperCase() || u.email.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-slate-800">{u.name || 'No name'}</p>
                                                    <p className="text-sm text-slate-500">{u.email}</p>
                                                    {u.companyRole && (
                                                        <p className="text-xs text-slate-400">{u.companyRole}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {u.organizations?.split(',').map((org, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                                                        {org.trim()}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded-full text-sm font-medium">
                                                <GitBranch size={14} />
                                                {u.workflowCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium">
                                                <LayoutDashboard size={14} />
                                                {u.dashboardCount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {formatDate(u.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleAdminStatus(u.id, u.isAdmin)}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    u.isAdmin 
                                                        ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                                                }`}
                                                title={u.isAdmin ? 'Remove admin' : 'Make admin'}
                                            >
                                                {u.isAdmin ? <ShieldCheck size={18} /> : <Shield size={18} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {users.length === 0 && (
                        <div className="px-6 py-12 text-center text-slate-500">
                            No users found
                        </div>
                    )}
                </div>
                </div>
            </main>
        </div>
    );
};
