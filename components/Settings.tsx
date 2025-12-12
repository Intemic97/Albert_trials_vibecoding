import React, { useState, useEffect } from 'react';
import { User, Mail, Plus, X, Search, Building } from 'lucide-react';
import { ProfileMenu } from './ProfileMenu';

interface SettingsProps {
    onViewChange?: (view: string) => void;
}

interface OrgUser {
    id: string;
    name: string;
    email: string;
    role: string;
}

export const Settings: React.FC<SettingsProps> = ({ onViewChange }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'team' | 'billing'>('team');
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [isInviting, setIsInviting] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        if (activeTab === 'team') {
            fetchUsers();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/organization/users', {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3001/api/organization/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: inviteEmail }),
                credentials: 'include'
            });

            const data = await res.json();

            if (res.ok) {
                setFeedback({ type: 'success', message: data.message });
                setIsInviting(false);
                setInviteEmail('');
                if (data.added) {
                    fetchUsers();
                }
            } else {
                setFeedback({ type: 'error', message: data.error || 'Failed to send invite' });
            }
        } catch (error) {
            setFeedback({ type: 'error', message: 'An error occurred' });
        }

        setTimeout(() => setFeedback(null), 3000);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <User className="text-teal-600" size={24} />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
                        <p className="text-xs text-slate-500">Manage organization and preferences</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <ProfileMenu onNavigate={onViewChange} />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

                    <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl w-fit mb-8">
                        {['General', 'Team', 'Billing'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase() as any)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab.toLowerCase()
                                    ? 'bg-white text-teal-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'team' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800">Team Members</h2>
                                    <p className="text-slate-500 text-sm">Manage who has access to this organization.</p>
                                </div>
                                <button
                                    onClick={() => setIsInviting(true)}
                                    className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium shadow-md transition-colors"
                                >
                                    <Plus size={16} className="mr-2" />
                                    Invite Member
                                </button>
                            </div>

                            {feedback && (
                                <div className={`p-4 rounded-lg text-sm font-medium ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {feedback.message}
                                </div>
                            )}

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map((user) => (
                                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm">
                                                            {user.name.charAt(0)}
                                                        </div>
                                                        <span className="font-medium text-slate-700">{user.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${user.role === 'admin'
                                                        ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {user.email}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button className="text-slate-400 hover:text-red-600 transition-colors">
                                                        <span className="sr-only">Remove</span>
                                                        <X size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'team' && (
                        <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed">
                            <div className="text-slate-400 mb-2">
                                <Building size={48} className="mx-auto opacity-20" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-800">Coming Soon</h3>
                            <p className="text-slate-500">This settings section is under development.</p>
                        </div>
                    )}
                </div>

                {/* Invite Modal */}
                {isInviting && (
                    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="font-semibold text-slate-800">Invite Team Member</h3>
                                <button onClick={() => setIsInviting(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleInvite} className="p-6">
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                                            placeholder="colleague@company.com"
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Invitation will be sent via email. If they have an account, they'll be added immediately.
                                    </p>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsInviting(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium shadow-md transition-colors"
                                    >
                                        Send Invitation
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
