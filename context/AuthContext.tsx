import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../config';

interface User {
    id: string;
    name: string;
    email: string;
    orgId: string;
    profilePhoto?: string;
    companyRole?: string;
    isAdmin?: boolean;
    onboardingCompleted?: boolean;
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
    updateProfile: (updates: { name?: string; companyRole?: string; profilePhoto?: string }) => Promise<boolean>;
    completeOnboarding: (data: { role: string; industry: string; useCase: string; source: string }) => Promise<boolean>;
    refreshOrganizations: () => Promise<void>;
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
                if (Array.isArray(data)) {
                    setOrganizations(data);
                } else {
                    console.error('Expected array from organizations API, got:', data);
                    setOrganizations([]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
            setOrganizations([]);
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

    const updateProfile = async (updates: { name?: string; companyRole?: string; profilePhoto?: string }): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE}/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Update profile error:', error);
            return false;
        }
    };

    const completeOnboarding = async (data: { role: string; industry: string; useCase: string; source: string }): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE}/auth/onboarding`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (res.ok) {
                setUser(prev => prev ? { ...prev, onboardingCompleted: true } : null);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Complete onboarding error:', error);
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, organizations, login, logout, switchOrganization, updateProfile, completeOnboarding, refreshOrganizations: fetchOrganizations }}>
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
