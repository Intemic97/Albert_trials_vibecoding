import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../config';

interface User {
    id: string;
    name: string;
    email: string;
    orgId: string;
}

interface Organization {
    id: string;
    name: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    organizations: Organization[];
    login: (user: User) => void;
    logout: () => void;
    switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                fetchOrganizations();
            } else {
                setUser(null);
                setOrganizations([]);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOrganizations = async () => {
        try {
            const res = await fetch(`${API_BASE}/auth/organizations`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setOrganizations(data);
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
        }
    };

    const login = (userData: User) => {
        setUser(userData);
        fetchOrganizations();
    };

    const logout = async () => {
        try {
            await fetch(`${API_BASE}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            setUser(null);
            setOrganizations([]);
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const switchOrganization = async (orgId: string) => {
        try {
            const res = await fetch(`${API_BASE}/auth/switch-org`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orgId }),
                credentials: 'include'
            });

            if (res.ok) {
                // Reload the page to reset all application state (entities, etc.) with the new context
                window.location.reload();
            } else {
                console.error('Failed to switch organization');
            }
        } catch (error) {
            console.error('Switch organization error:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, organizations, login, logout, switchOrganization }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
