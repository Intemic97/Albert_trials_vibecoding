import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronRight, Building, Settings } from 'lucide-react';

export const ProfileMenu: React.FC = () => {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    // Get initials
    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold shadow-md hover:bg-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
                {initials}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-teal-600 text-white flex items-center justify-center text-2xl font-bold mb-3 shadow-sm">
                                {initials}
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg">{user?.name || 'User'}</h3>
                            <p className="text-sm text-slate-500">{user?.email || 'user@example.com'}</p>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="px-2 py-2 space-y-1">
                        <button className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                                    <Building size={16} />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium">Change organization</p>
                                    <p className="text-xs text-slate-400">Intemic_community</p>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-teal-600" />
                        </button>

                        <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors">
                            <div className="p-1.5 bg-slate-100 rounded text-slate-500 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                                <User size={16} />
                            </div>
                            <span className="font-medium">My Profile</span>
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg group transition-colors">
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
                </div>
            )}
        </div>
    );
};
