import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronRight, Building, Settings, Camera, X, Loader2 } from 'lucide-react';
import { API_BASE } from '../config';

interface ProfileMenuProps {
    onNavigate?: (view: string) => void;
}

// Reusable Avatar component
export const UserAvatar: React.FC<{ 
    name?: string; 
    profilePhoto?: string; 
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}> = ({ name, profilePhoto, size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-16 h-16 text-2xl',
        xl: 'w-24 h-24 text-3xl'
    };

    const initials = name
        ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';

    if (profilePhoto) {
        return (
            <img 
                src={profilePhoto.startsWith('http') ? profilePhoto : `${API_BASE}/files/${profilePhoto}`}
                alt={name || 'Profile'}
                className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
            />
        );
    }

    return (
        <div className={`${sizeClasses[size]} rounded-full bg-teal-600 text-white flex items-center justify-center font-bold ${className}`}>
            {initials}
        </div>
    );
};

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ onNavigate }) => {
    const { user, logout, organizations, switchOrganization, updateProfile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'main' | 'organizations'>('main');
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Reset view when closing
    useEffect(() => {
        if (!isOpen) setTimeout(() => setView('main'), 200);
    }, [isOpen]);

    // Initialize edit form when modal opens
    useEffect(() => {
        if (showProfileModal && user) {
            setEditName(user.name || '');
            setEditRole(user.companyRole || '');
        }
    }, [showProfileModal, user]);

    const openProfileModal = () => {
        setIsOpen(false);
        setShowProfileModal(true);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${API_BASE}/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                await updateProfile({ profilePhoto: data.filename });
            }
        } catch (error) {
            console.error('Photo upload error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            await updateProfile({ name: editName, companyRole: editRole });
            setShowProfileModal(false);
        } catch (error) {
            console.error('Save profile error:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const currentOrg = organizations.find(o => o.id === user?.orgId);

    return (
        <>
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="rounded-full shadow-md hover:ring-2 hover:ring-teal-500 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
                <UserAvatar name={user?.name} profilePhoto={user?.profilePhoto} size="md" />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">

                    {view === 'main' ? (
                        <>
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex flex-col items-center">
                                    <div className="mb-3 shadow-sm">
                                        <UserAvatar name={user?.name} profilePhoto={user?.profilePhoto} size="lg" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-lg">{user?.name || 'User'}</h3>
                                    {user?.companyRole && (
                                        <p className="text-xs text-teal-600 font-medium">{user.companyRole}</p>
                                    )}
                                    <p className="text-sm text-slate-500">{user?.email || 'user@example.com'}</p>
                                </div>
                            </div>

                            {/* Menu Items */}
                            <div className="px-2 py-2 space-y-1">
                                <button
                                    onClick={() => setView('organizations')}
                                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                                            <Building size={16} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium">Change organization</p>
                                            <p className="text-xs text-slate-400">{currentOrg?.name || 'Select Organization'}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-600" />
                                </button>

                                <button 
                                    onClick={openProfileModal}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors"
                                >
                                    <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                                        <User size={16} />
                                    </div>
                                    <span className="font-medium">My Profile</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        onNavigate?.('settings');
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors"
                                >
                                    <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                                        <Settings size={16} />
                                    </div>
                                    <span className="font-medium">Settings</span>
                                </button>
                            </div>

                            <div className="border-t border-slate-100 my-1 mx-2"></div>

                            <div className="px-2 pb-2">
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg group transition-colors"
                                >
                                    <div className="p-1.5 bg-red-50 rounded text-red-500 group-hover:bg-red-100 transition-colors">
                                        <LogOut size={16} />
                                    </div>
                                    <span className="font-medium">Log Out</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Organizations Submenu */}
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center">
                                <button
                                    onClick={() => setView('main')}
                                    className="p-1 -ml-1 mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <ChevronRight className="rotate-180" size={16} />
                                </button>
                                <h3 className="font-semibold text-slate-800">Organizations</h3>
                            </div>

                            <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                                {organizations.map(org => (
                                    <button
                                        key={org.id}
                                        onClick={() => switchOrganization(org.id)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-lg group transition-colors ${user?.orgId === org.id
                                            ? 'bg-teal-50 text-teal-700'
                                            : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${user?.orgId === org.id
                                                ? 'bg-teal-200 text-teal-800'
                                                : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                                                }`}>
                                                {org.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-medium">{org.name}</p>
                                                <p className="text-xs opacity-70 capitalize">{org.role}</p>
                                            </div>
                                        </div>
                                        {user?.orgId === org.id && (
                                            <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>

        {/* My Profile Modal */}
        {showProfileModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowProfileModal(false)}>
                <div className="bg-white rounded-xl shadow-2xl w-[450px] max-w-full mx-4" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800">My Profile</h2>
                        <button 
                            onClick={() => setShowProfileModal(false)}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Profile Photo */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="relative group">
                                <UserAvatar 
                                    name={user?.name} 
                                    profilePhoto={user?.profilePhoto} 
                                    size="xl" 
                                    className="shadow-lg"
                                />
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handlePhotoUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    {isUploading ? (
                                        <Loader2 size={24} className="text-white animate-spin" />
                                    ) : (
                                        <Camera size={24} className="text-white" />
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Click to change photo</p>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    placeholder="Your name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Company Role
                                </label>
                                <input
                                    type="text"
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    placeholder="e.g. Product Manager, Developer, Designer"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                                />
                                <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                        <button
                            onClick={() => setShowProfileModal(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <Loader2 size={16} className="animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
