import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, API_UNAUTHORIZED_EVENT } from '../src/api';
import type { AuthMeResponse } from '../src/api';
import i18n from '../src/i18n';

interface User {
    id: string;
    name: string;
    email: string;
    orgId: string;
    profilePhoto?: string;
    companyRole?: string;
    locale?: 'es' | 'en';
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
    updateProfile: (updates: { name?: string; companyRole?: string; profilePhoto?: string; locale?: 'es' | 'en' }) => Promise<boolean>;
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

    useEffect(() => {
        const onUnauthorized = () => {
            setUser(null);
            setOrganizations([]);
        };
        window.addEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
        return () => window.removeEventListener(API_UNAUTHORIZED_EVENT, onUnauthorized);
    }, []);

    useEffect(() => {
        if (user?.locale && i18n.language !== user.locale) {
            i18n.changeLanguage(user.locale);
        }
    }, [user?.locale]);

    const checkAuth = async () => {
        try {
            const data = await api.get<AuthMeResponse>('auth/me');
            setUser(data.user);
            fetchOrganizations();
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOrganizations = async () => {
        try {
            const data = await api.get<Organization[]>('auth/organizations');
            setOrganizations(Array.isArray(data) ? data : []);
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
            await api.post('auth/logout');
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setUser(null);
            setOrganizations([]);
        }
    };

    const switchOrganization = async (orgId: string) => {
        try {
            await api.post('auth/switch-org', { orgId });
            window.location.reload();
        } catch (error) {
            console.error('Switch organization error:', error);
        }
    };

    const updateProfile = async (updates: { name?: string; companyRole?: string; profilePhoto?: string; locale?: 'es' | 'en' }): Promise<boolean> => {
        try {
            const data = await api.put<{ user: User }>('profile', updates);
            setUser(data.user);
            return true;
        } catch (error) {
            console.error('Update profile error:', error);
            return false;
        }
    };

    const completeOnboarding = async (data: { role: string; industry: string; useCase: string; source: string }): Promise<boolean> => {
        try {
            await api.post('auth/onboarding', data);
            setUser(prev => prev ? { ...prev, onboardingCompleted: true } : null);
            return true;
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
