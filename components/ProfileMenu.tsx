import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronRight, Building, Settings, Camera, X, Loader2, Shield, Plus } from 'lucide-react';
import { API_BASE } from '../config';

interface ProfileMenuProps {
    onNavigate?: (view: string) => void;
    triggerContent?: React.ReactNode;
    triggerClassName?: string;
    menuPlacement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
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
        <div className={`${sizeClasses[size]} rounded-full bg-[#256A65] text-white flex items-center justify-center font-normal ${className}`}>
            {initials}
        </div>
    );
};

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ onNavigate, triggerContent, triggerClassName = '', menuPlacement = 'bottom-right' }) => {
    const { user, logout, organizations, switchOrganization, updateProfile, refreshOrganizations } = useAuth();
    // console.log('[ProfileMenu] user.isAdmin:', user?.isAdmin);
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'main' | 'organizations'>('main');
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [isCreatingOrg, setIsCreatingOrg] = useState(false);
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

    const handleCreateOrganization = async () => {
        if (!newOrgName.trim()) return;
        
        setIsCreatingOrg(true);
        try {
            const res = await fetch(`${API_BASE}/organizations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newOrgName }),
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                await refreshOrganizations();
                await switchOrganization(data.organization.id);
                setShowCreateOrgModal(false);
                setNewOrgName('');
                setIsOpen(false);
            }
        } catch (error) {
            console.error('Create organization error:', error);
        } finally {
            setIsCreatingOrg(false);
        }
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const targetNode = event.target as Node;
            const clickedTrigger = triggerRef.current?.contains(targetNode);
            const clickedMenu = menuRef.current?.contains(targetNode);
            if (!clickedTrigger && !clickedMenu) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const currentOrg = organizations.find(o => o.id === user?.orgId);
    const triggerRef = useRef<HTMLButtonElement>(null);
    
    // Calculate position for fixed positioning
    const [menuPosition, setMenuPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const menuWidth = 288; // w-72 = 18rem = 288px
            const menuHeight = 400; // approximate height
            
            // Calculate space available
            const spaceOnRight = windowWidth - rect.right;
            const spaceOnLeft = rect.left;
            
            let position: { top: number; left?: number; right?: number };
            let top: number;
            
            // Check if trigger is on the left side (likely sidebar)
            // If trigger is in left 300px, position menu to the right of trigger using left
            if (rect.left < 300 && spaceOnRight >= menuWidth) {
                // Position to the right of trigger, aligned with left edge
                const left = rect.right + 8; // 8px gap from trigger
                position = { left };
            } else if (spaceOnRight >= menuWidth) {
                // Enough space on right, position to the right using right positioning
                position = { right: windowWidth - rect.right };
            } else if (spaceOnLeft >= menuWidth) {
                // Not enough space on right, but enough on left, position to the left
                position = { right: windowWidth - rect.left + 8 };
            } else {
                // Not enough space on either side, default to right edge
                position = { right: 16 };
            }
            
            // Calculate vertical position based on placement
            if (menuPlacement === 'top-right' || menuPlacement === 'top-left') {
                // Position above the trigger
                top = rect.top - menuHeight - 8;
                // If it goes off screen, position below instead
                if (top < 8) {
                    top = rect.bottom + 8;
                }
            } else {
                // Position below the trigger (default)
                top = rect.bottom + 8;
                // If it goes off screen, position above instead
                if (top + menuHeight > windowHeight - 8) {
                    top = rect.top - menuHeight - 8;
                    // If still off screen, align to bottom
                    if (top < 8) {
                        top = windowHeight - menuHeight - 8;
                    }
                }
            }
            
            position.top = Math.max(8, Math.min(top, windowHeight - menuHeight - 8));
            setMenuPosition(position);
        } else {
            setMenuPosition(null);
        }
    }, [isOpen, menuPlacement]);

    return (
        <>
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                data-tutorial="profile-menu"
                onClick={() => setIsOpen(!isOpen)}
                className={triggerContent
                    ? triggerClassName
                    : "rounded-full shadow-md hover:ring-2 hover:ring-teal-500 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"}
            >
                {triggerContent ? triggerContent : (
                    <UserAvatar name={user?.name} profilePhoto={user?.profilePhoto} size="md" />
                )}
            </button>

            {isOpen && menuPosition && createPortal(
                <div 
                    ref={menuRef}
                    className="fixed w-72 bg-white rounded-lg border border-slate-200 shadow-xl py-2 z-[99999] overflow-hidden text-sm pointer-events-auto"
                    style={{
                        top: `${menuPosition.top}px`,
                        ...(menuPosition.left !== undefined ? { left: `${menuPosition.left}px` } : {}),
                        ...(menuPosition.right !== undefined ? { right: `${menuPosition.right}px` } : {})
                    }}
                >

                    {view === 'main' ? (
                        <>
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-slate-200 bg-white">
                                <div className="flex flex-col items-center">
                                    <div className="mb-3 shadow-sm">
                                        <UserAvatar name={user?.name} profilePhoto={user?.profilePhoto} size="lg" />
                                    </div>
                                    <h3 className="font-normal text-slate-900 text-base">{user?.name || 'User'}</h3>
                                    {user?.companyRole && (
                                        <p className="text-xs text-slate-600 font-medium">{user.companyRole}</p>
                                    )}
                                    <p className="text-xs text-slate-500">{user?.email || 'user@example.com'}</p>
                                </div>
                            </div>

                            {/* Menu Items */}
                            <div className="px-2 py-2 space-y-1">
                                <button
                                    onClick={() => setView('organizations')}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:text-slate-700 group-hover:bg-slate-200 transition-colors">
                                            <Building size={16} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium">Change organization</p>
                                            <p className="text-xs text-slate-400">{currentOrg?.name || 'Select Organization'}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-600" />
                                </button>

                                <button 
                                    onClick={openProfileModal}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors"
                                >
                                    <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:text-slate-700 group-hover:bg-slate-200 transition-colors">
                                        <User size={16} />
                                    </div>
                                    <span className="font-medium">My Profile</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        onNavigate?.('settings');
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors"
                                >
                                    <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:text-slate-700 group-hover:bg-slate-200 transition-colors">
                                        <Settings size={16} />
                                    </div>
                                    <span className="font-medium">Settings</span>
                                </button>
                                
                                {/* Admin Panel - Only visible for admins */}
                                {user?.isAdmin && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            onNavigate?.('admin');
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors"
                                    >
                                        <div className="p-1.5 bg-red-50 rounded text-red-500 group-hover:text-red-600 group-hover:bg-red-100 transition-colors">
                                            <Shield size={16} />
                                        </div>
                                        <span className="font-medium">Admin Panel</span>
                                    </button>
                                )}
                            </div>

                            <div className="border-t border-slate-100 my-1 mx-2"></div>

                            <div className="px-2 pb-2">
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg group transition-colors"
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
                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center">
                                <button
                                    onClick={() => setView('main')}
                                    className="p-1 -ml-1 mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                                >
                                    <ChevronRight className="rotate-180" size={16} />
                                </button>
                                <h3 className="font-normal text-slate-900 text-base">Organizations</h3>
                            </div>

                            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                {organizations.map(org => (
                                    <button
                                        key={org.id}
                                        onClick={() => switchOrganization(org.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg group transition-colors ${user?.orgId === org.id
                                            ? 'bg-slate-100 text-slate-900'
                                            : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded flex items-center justify-center font-normal text-xs ${user?.orgId === org.id
                                                ? 'bg-slate-200 text-slate-700'
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
                                            <div className="w-2 h-2 rounded-full bg-slate-700"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Create Organization Button */}
                            <div className="p-2 border-t border-slate-100">
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        setShowCreateOrgModal(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors"
                                >
                                    <div className="p-1.5 bg-slate-100 rounded text-slate-600 group-hover:bg-slate-200 transition-colors">
                                        <Plus size={16} />
                                    </div>
                                    <span className="font-medium">Create Organization</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>

        {/* My Profile Modal */}
        {showProfileModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowProfileModal(false)}>
                <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-[420px] max-w-full mx-4" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                        <h2 className="text-sm font-normal text-slate-900">My Profile</h2>
                        <button 
                            onClick={() => setShowProfileModal(false)}
                            className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        {/* Profile Photo */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="relative group">
                                <UserAvatar 
                                    name={user?.name} 
                                    profilePhoto={user?.profilePhoto} 
                                    size="xl" 
                                    className="shadow-sm"
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
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                    placeholder="Your name"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Company Role
                                </label>
                                <input
                                    type="text"
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                    placeholder="e.g. Product Manager, Developer, Designer"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-500 cursor-not-allowed"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">Email cannot be changed</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-lg">
                        <button
                            onClick={() => setShowProfileModal(false)}
                            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="px-3 py-2 bg-[#256A65] text-white rounded-lg text-sm hover:bg-[#1e554f] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <Loader2 size={16} className="animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Create Organization Modal */}
        {showCreateOrgModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreateOrgModal(false)}>
                <div className="bg-white rounded-lg border border-slate-200 shadow-lg w-[400px] max-w-full mx-4" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                        <h2 className="text-sm font-normal text-slate-900">Create Organization</h2>
                        <button 
                            onClick={() => setShowCreateOrgModal(false)}
                            className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        <p className="text-xs text-slate-500 mb-4">
                            Create a new organization and become its admin. You can invite team members after creation.
                        </p>
                        
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                Organization Name
                            </label>
                            <input
                                type="text"
                                value={newOrgName}
                                onChange={(e) => setNewOrgName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300"
                                placeholder="e.g. Acme Inc."
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newOrgName.trim()) {
                                        handleCreateOrganization();
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50/50 rounded-b-lg">
                        <button
                            onClick={() => setShowCreateOrgModal(false)}
                            className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateOrganization}
                            disabled={isCreatingOrg || !newOrgName.trim()}
                            className="px-3 py-2 bg-[#256A65] text-white rounded-lg text-sm hover:bg-[#1e554f] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isCreatingOrg && <Loader2 size={16} className="animate-spin" />}
                            Create Organization
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
