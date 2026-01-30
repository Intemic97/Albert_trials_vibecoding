import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { User, SignOut, CaretRight, Buildings, GearSix, Camera, X, SpinnerGap, ShieldCheck, Plus } from '@phosphor-icons/react';
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
        <div className={`${sizeClasses[size]} rounded-full bg-[var(--bg-selected)] text-white flex items-center justify-center font-normal ${className}`}>
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
                // For sidebar menu, position so menu bottom aligns with trigger bottom
                // This places the menu at the same level as the profile button
                top = rect.bottom - menuHeight;
                // Ensure menu doesn't go above screen
                if (top < 8) top = 8;
            } else if (spaceOnRight >= menuWidth) {
                // Enough space on right, position to the right using right positioning
                position = { right: windowWidth - rect.right };
                // Calculate vertical position based on placement
                if (menuPlacement === 'top-right' || menuPlacement === 'top-left') {
                    top = rect.top - menuHeight - 8;
                    if (top < 8) top = rect.bottom + 8;
                } else {
                    top = rect.bottom + 8;
                    if (top + menuHeight > windowHeight - 8) {
                        top = rect.top - menuHeight - 8;
                        if (top < 8) top = windowHeight - menuHeight - 8;
                    }
                }
            } else if (spaceOnLeft >= menuWidth) {
                // Not enough space on right, but enough on left, position to the left
                position = { right: windowWidth - rect.left + 8 };
                top = rect.bottom + 8;
            } else {
                // Not enough space on either side, default to right edge
                position = { right: 16 };
                top = rect.bottom + 8;
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
                    className="fixed w-60 bg-[var(--sidebar-bg)] rounded-lg border border-[var(--sidebar-border)] py-2 z-[99999] overflow-hidden text-sm font-sans pointer-events-auto transition-colors duration-200"
                    style={{
                        top: `${menuPosition.top}px`,
                        ...(menuPosition.left !== undefined ? { left: `${menuPosition.left}px` } : {}),
                        ...(menuPosition.right !== undefined ? { right: `${menuPosition.right}px` } : {})
                    }}
                >

                    {view === 'main' ? (
                        <>
                            {/* Header */}
                            <div className="px-4 py-3 border-b border-[var(--sidebar-border)]">
                                <div className="flex items-center gap-3">
                                    <UserAvatar name={user?.name} profilePhoto={user?.profilePhoto} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-normal text-[var(--sidebar-text)] text-sm truncate">{user?.name || 'User'}</h3>
                                        <p className="text-xs text-[var(--text-tertiary)] truncate">{user?.email || 'user@example.com'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Menu Items */}
                            <div className="px-3 py-2 space-y-0.5">
                                <button
                                    onClick={() => setView('organizations')}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-left group text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]"
                                >
                                    <div className="flex items-center">
                                        <Buildings size={16} weight="light" className="mr-3 transition-colors duration-200 ease-in-out text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)]" />
                                        <div className="text-left">
                                            <span className="text-sm">Change organization</span>
                                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{currentOrg?.name || 'Select'}</p>
                                        </div>
                                    </div>
                                    <CaretRight size={16} weight="light" className="text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)] transition-colors duration-200 ease-in-out" />
                                </button>

                                <button 
                                    onClick={openProfileModal}
                                    className="w-full flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-left group text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]"
                                >
                                    <User size={16} weight="light" className="mr-3 transition-colors duration-200 ease-in-out text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)]" />
                                    <span className="transition-colors duration-200 ease-in-out">My Profile</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        onNavigate?.('settings');
                                    }}
                                    className="w-full flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-left group text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]"
                                >
                                    <GearSix size={16} weight="light" className="mr-3 transition-colors duration-200 ease-in-out text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)]" />
                                    <span className="transition-colors duration-200 ease-in-out">Settings</span>
                                </button>
                                
                                {/* Admin Panel - Only visible for admins */}
                                {user?.isAdmin && (
                                    <button
                                        onClick={() => {
                                            setIsOpen(false);
                                            onNavigate?.('admin');
                                        }}
                                        className="w-full flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-left group text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]"
                                    >
                                        <ShieldCheck size={16} weight="light" className="mr-3 transition-colors duration-200 ease-in-out text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)]" />
                                        <span className="transition-colors duration-200 ease-in-out">Admin Panel</span>
                                    </button>
                                )}
                            </div>

                            <div className="border-t border-[var(--sidebar-border)] my-1 mx-3"></div>

                            <div className="px-3 pb-2">
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-left group text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]"
                                >
                                    <SignOut size={16} weight="light" className="mr-3 transition-colors duration-200 ease-in-out text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)]" />
                                    <span className="transition-colors duration-200 ease-in-out">Log Out</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Organizations Submenu */}
                            <div className="px-4 py-3 border-b border-[var(--sidebar-border)] flex items-center">
                                <button
                                    onClick={() => setView('main')}
                                    className="p-1 -ml-1 mr-2 text-[var(--sidebar-icon)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)] rounded-lg transition-colors"
                                >
                                    <CaretRight className="rotate-180" size={16} weight="light" />
                                </button>
                                <h3 className="font-normal text-[var(--sidebar-text)] text-sm">Organizations</h3>
                            </div>

                            <div className="px-3 py-2 space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                                {organizations.map(org => (
                                    <button
                                        key={org.id}
                                        onClick={() => switchOrganization(org.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-left group ${user?.orgId === org.id
                                            ? 'bg-[var(--sidebar-bg-active)] text-[var(--sidebar-text-active)]'
                                            : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]'
                                            }`}
                                    >
                                        <div className="flex items-center">
                                            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs mr-3 font-normal transition-colors duration-200 ease-in-out ${user?.orgId === org.id
                                                ? 'bg-white/20 text-white'
                                                : 'bg-[var(--bg-tertiary)] text-[var(--sidebar-icon)] group-hover:bg-[var(--bg-selected)] group-hover:text-white'
                                                }`}>
                                                {org.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="text-left">
                                                <span className="transition-colors duration-200 ease-in-out">{org.name}</span>
                                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5 capitalize">{org.role}</p>
                                            </div>
                                        </div>
                                        {user?.orgId === org.id && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-white transition-colors duration-200 ease-in-out"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Create Organization Button */}
                            <div className="px-3 py-2 border-t border-[var(--sidebar-border)]">
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        setShowCreateOrgModal(true);
                                    }}
                                    className="w-full flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-left group text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]"
                                >
                                    <Plus size={16} weight="light" className="mr-3 transition-colors duration-200 ease-in-out text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)]" />
                                    <span className="transition-colors duration-200 ease-in-out">Create Organization</span>
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
                <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-[420px] max-w-full mx-4" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)] bg-slate-50/50">
                        <h2 className="text-sm font-normal text-[var(--text-primary)]">My Profile</h2>
                        <button 
                            onClick={() => setShowProfileModal(false)}
                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                        >
                            <X size={20} weight="light" className="text-[var(--text-tertiary)]" />
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
                                        <SpinnerGap size={24} weight="light" className="text-white animate-spin" />
                                    ) : (
                                        <Camera size={24} weight="light" className="text-white" />
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-[var(--text-tertiary)] mt-2">Click to change photo</p>
                        </div>

                        {/* Form Fields */}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                    placeholder="Your name"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    Company Role
                                </label>
                                <input
                                    type="text"
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
                                    placeholder="e.g. Product Manager, Developer, Designer"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg bg-slate-50 text-sm text-[var(--text-secondary)] cursor-not-allowed"
                                />
                                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Email cannot be changed</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-light)] bg-slate-50/50 rounded-b-lg">
                        <button
                            onClick={() => setShowProfileModal(false)}
                            className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="btn-3d btn-primary-3d text-sm text-white rounded-lg text-sm hover:bg-[#1e554f] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSaving && <SpinnerGap size={16} weight="light" className="animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Create Organization Modal */}
        {showCreateOrgModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowCreateOrgModal(false)}>
                <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-lg w-[400px] max-w-full mx-4" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)] bg-slate-50/50">
                        <h2 className="text-sm font-normal text-[var(--text-primary)]">Create Organization</h2>
                        <button 
                            onClick={() => setShowCreateOrgModal(false)}
                            className="p-1 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                        >
                            <X size={20} weight="light" className="text-[var(--text-tertiary)]" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        <p className="text-xs text-[var(--text-secondary)] mb-4">
                            Create a new organization and become its admin. You can invite team members after creation.
                        </p>
                        
                        <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                                Organization Name
                            </label>
                            <input
                                type="text"
                                value={newOrgName}
                                onChange={(e) => setNewOrgName(e.target.value)}
                                className="w-full px-3 py-2 border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]"
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
                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-light)] bg-slate-50/50 rounded-b-lg">
                        <button
                            onClick={() => setShowCreateOrgModal(false)}
                            className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateOrganization}
                            disabled={isCreatingOrg || !newOrgName.trim()}
                            className="btn-3d btn-primary-3d text-sm text-white rounded-lg text-sm hover:bg-[#1e554f] transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isCreatingOrg && <SpinnerGap size={16} weight="light" className="animate-spin" />}
                            Create Organization
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
