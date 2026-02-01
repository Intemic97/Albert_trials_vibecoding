import React, { useState, useEffect } from 'react';
import { User, Envelope, Plus, X, Check, Lightning, Crown, Sparkle, CreditCard, ArrowSquareOut, SpinnerGap, LinkSimple, LinkBreak, Copy, CheckCircle, WarningCircle, Sun, Moon, Monitor, Shield } from '@phosphor-icons/react';
import { UserAvatar } from './ProfileMenu';
import { PageHeader } from './PageHeader';
import { API_BASE } from '../config';
import { useTheme } from '../context/ThemeContext';
import { ActivityLog } from './ActivityLog';

// Slack icon component
const SlackIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
);

interface SubscriptionInfo {
    plan: 'free' | 'pro' | 'business';
    status: string;
    currentPeriodEnd?: string;
    hasStripeCustomer: boolean;
}

interface PlanFeature {
    text: string;
    included: boolean;
}

interface PricingPlan {
    id: 'free' | 'pro' | 'business';
    name: string;
    price: string;
    priceValue: number;
    period: string;
    description: string;
    features: PlanFeature[];
    icon: React.ReactNode;
    popular?: boolean;
    gradient: string;
}

interface SettingsProps {
    onViewChange?: (view: string) => void;
    onShowTutorial?: () => void;
}

interface OrgUser {
    id: string;
    name: string;
    email: string;
    role: string;
    profilePhoto?: string;
    companyRole?: string;
}

export const Settings: React.FC<SettingsProps> = ({ onViewChange, onShowTutorial }) => {
    const { mode, setMode, isDark } = useTheme();
    const [activeTab, setActiveTab] = useState<'general' | 'team' | 'integrations' | 'activity'>('general');
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [isInviting, setIsInviting] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [tutorialEnabled, setTutorialEnabled] = useState(() => {
        return !localStorage.getItem('intemic_tutorial_completed');
    });
    
    // Slack Integration State
    const [slackConnected, setSlackConnected] = useState(false);
    const [slackTeamName, setSlackTeamName] = useState('');
    const [slackConnectedAt, setSlackConnectedAt] = useState('');
    const [slackBotToken, setSlackBotToken] = useState('');
    const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
    const [isConnectingSlack, setIsConnectingSlack] = useState(false);
    const [slackFeedback, setSlackFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [copiedWebhook, setCopiedWebhook] = useState(false);
    
    // Company Information State
    const [companyInfo, setCompanyInfo] = useState({
        name: '',
        industry: '',
        employees: '',
        website: '',
        linkedinUrl: '',
        headquarters: '',
        foundingYear: '',
        overview: ''
    });
    const [isSavingCompany, setIsSavingCompany] = useState(false);
    
    // Billing state
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [billingFeedback, setBillingFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    
    // Pricing plans configuration
    const pricingPlans: PricingPlan[] = [
        {
            id: 'free',
            name: 'Gratuito',
            price: '0€',
            priceValue: 0,
            period: '/mes',
            description: 'Perfecto para empezar y explorar',
            icon: <Sparkle weight="light" className="w-6 h-6" />,
            gradient: 'from-slate-500 to-slate-600',
            features: [
                { text: '3 workflows activos', included: true },
                { text: '100 ejecuciones/mes', included: true },
                { text: '1 usuario', included: true },
                { text: 'Soporte por email', included: true },
                { text: 'Integraciones avanzadas', included: false },
                { text: 'API access', included: false },
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '15€',
            priceValue: 15,
            period: '/mes',
            description: 'Para equipos en crecimiento',
            icon: <Lightning weight="light" className="w-6 h-6" />,
            popular: true,
            gradient: 'from-teal-500 to-emerald-600',
            features: [
                { text: 'Workflows ilimitados', included: true },
                { text: '5.000 ejecuciones/mes', included: true },
                { text: 'Hasta 5 usuarios', included: true },
                { text: 'Soporte prioritario', included: true },
                { text: 'Integraciones avanzadas', included: true },
                { text: 'API access', included: false },
            ]
        },
        {
            id: 'business',
            name: 'Business',
            price: '45€',
            priceValue: 45,
            period: '/mes',
            description: 'Para empresas y equipos grandes',
            icon: <Crown weight="light" className="w-6 h-6" />,
            gradient: 'from-violet-500 to-purple-600',
            features: [
                { text: 'Workflows ilimitados', included: true },
                { text: 'Ejecuciones ilimitadas', included: true },
                { text: 'Usuarios ilimitados', included: true },
                { text: 'Soporte 24/7 dedicado', included: true },
                { text: 'Integraciones avanzadas', included: true },
                { text: 'API access completo', included: true },
            ]
        }
    ];

    // Check for billing success/cancel from URL params
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const billingStatus = urlParams.get('billing');
        
        if (billingStatus === 'success') {
            setBillingFeedback({ type: 'success', message: '¡Pago completado con éxito! Tu plan ha sido actualizado.' });
            setActiveTab('billing');
            // Clean URL
            window.history.replaceState({}, '', '/settings');
            // Refresh subscription data
            fetchSubscription();
        } else if (billingStatus === 'cancelled') {
            setBillingFeedback({ type: 'error', message: 'El pago fue cancelado.' });
            setActiveTab('billing');
            window.history.replaceState({}, '', '/settings');
        }
    }, []);

    const fetchSubscription = async () => {
        setIsLoadingSubscription(true);
        try {
            const res = await fetch(`${API_BASE}/billing/subscription`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setSubscription(data);
            }
        } catch (error) {
            console.error('Error fetching subscription:', error);
        } finally {
            setIsLoadingSubscription(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'billing') {
            fetchSubscription();
        }
    }, [activeTab]);

    const handleUpgrade = async (planId: 'pro' | 'business') => {
        setIsProcessingPayment(true);
        setBillingFeedback(null);
        
        try {
            const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: planId }),
                credentials: 'include'
            });
            
            const data = await res.json();
            
            if (res.ok && data.url) {
                // Redirect to Stripe Checkout
                window.location.href = data.url;
            } else {
                setBillingFeedback({ type: 'error', message: data.error || 'Error al procesar el pago' });
            }
        } catch (error) {
            setBillingFeedback({ type: 'error', message: 'Error de conexión. Por favor, inténtalo de nuevo.' });
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleManageSubscription = async () => {
        setIsProcessingPayment(true);
        try {
            const res = await fetch(`${API_BASE}/billing/create-portal-session`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await res.json();
            
            if (res.ok && data.url) {
                window.location.href = data.url;
            } else {
                setBillingFeedback({ type: 'error', message: data.error || 'Error al abrir el portal de facturación' });
            }
        } catch (error) {
            setBillingFeedback({ type: 'error', message: 'Error de conexión' });
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const getPlanButtonText = (planId: 'free' | 'pro' | 'business'): string => {
        if (!subscription) return 'Cargando...';
        if (subscription.plan === planId) return 'Plan actual';
        if (planId === 'free') return 'Downgrade';
        
        const currentPlanValue = pricingPlans.find(p => p.id === subscription.plan)?.priceValue || 0;
        const targetPlanValue = pricingPlans.find(p => p.id === planId)?.priceValue || 0;
        
        return targetPlanValue > currentPlanValue ? 'Upgrade' : 'Cambiar plan';
    };

    const isPlanDisabled = (planId: 'free' | 'pro' | 'business'): boolean => {
        if (!subscription) return true;
        return subscription.plan === planId || planId === 'free';
    };

    // Sync tutorialEnabled with localStorage (e.g., when tutorial completes while on this page)
    useEffect(() => {
        const checkTutorialStatus = () => {
            const isCompleted = localStorage.getItem('intemic_tutorial_completed') === 'true';
            setTutorialEnabled(!isCompleted);
        };
        
        // Check on mount
        checkTutorialStatus();
        
        // Listen for tutorial completion event
        window.addEventListener('tutorialCompleted', checkTutorialStatus);
        
        // Also listen for storage changes (from other tabs)
        window.addEventListener('storage', checkTutorialStatus);
        
        return () => {
            window.removeEventListener('tutorialCompleted', checkTutorialStatus);
            window.removeEventListener('storage', checkTutorialStatus);
        };
    }, []);

    useEffect(() => {
        if (activeTab === 'team') {
            fetchUsers();
        } else if (activeTab === 'general') {
            fetchCompanyInfo();
        } else if (activeTab === 'integrations') {
            fetchSlackStatus();
            fetchSlackWebhookInfo();
        }
    }, [activeTab]);
    
    // Slack Integration Functions
    const fetchSlackStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/integrations/slack`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setSlackConnected(data.connected);
                setSlackTeamName(data.teamName || '');
                setSlackConnectedAt(data.connectedAt || '');
            }
        } catch (error) {
            console.error('Error fetching Slack status:', error);
        }
    };
    
    const fetchSlackWebhookInfo = async () => {
        try {
            const res = await fetch(`${API_BASE}/integrations/slack/webhook-info`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setSlackWebhookUrl(data.webhookUrl);
            }
        } catch (error) {
            console.error('Error fetching Slack webhook info:', error);
        }
    };
    
    const connectSlack = async () => {
        if (!slackBotToken.trim()) {
            setSlackFeedback({ type: 'error', message: 'Please enter a bot token' });
            return;
        }
        
        setIsConnectingSlack(true);
        setSlackFeedback(null);
        
        try {
            const res = await fetch(`${API_BASE}/integrations/slack/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ botToken: slackBotToken })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                setSlackConnected(true);
                setSlackTeamName(data.teamName);
                setSlackConnectedAt(new Date().toISOString());
                setSlackBotToken('');
                setSlackFeedback({ type: 'success', message: `Connected to ${data.teamName}!` });
            } else {
                setSlackFeedback({ type: 'error', message: data.error || 'Failed to connect' });
            }
        } catch (error) {
            console.error('Error connecting Slack:', error);
            setSlackFeedback({ type: 'error', message: 'Connection failed. Please try again.' });
        } finally {
            setIsConnectingSlack(false);
        }
    };
    
    const disconnectSlack = async () => {
        if (!confirm('Are you sure you want to disconnect Slack? The Database Assistant will no longer respond to Slack messages.')) {
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/integrations/slack/disconnect`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (res.ok) {
                setSlackConnected(false);
                setSlackTeamName('');
                setSlackConnectedAt('');
                setSlackFeedback({ type: 'success', message: 'Slack disconnected successfully' });
            }
        } catch (error) {
            console.error('Error disconnecting Slack:', error);
            setSlackFeedback({ type: 'error', message: 'Failed to disconnect' });
        }
    };
    
    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(slackWebhookUrl);
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2000);
    };
    
    const fetchCompanyInfo = async () => {
        try {
            const res = await fetch(`${API_BASE}/company`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setCompanyInfo(data);
            }
        } catch (error) {
            console.error('Error fetching company info:', error);
        }
    };

    const updateCompanyInfo = async () => {
        setIsSavingCompany(true);
        try {
            const res = await fetch(`${API_BASE}/company`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(companyInfo),
                credentials: 'include'
            });
            if (res.ok) {
                setFeedback({ type: 'success', message: 'Company information saved successfully!' });
            } else {
                setFeedback({ type: 'error', message: 'Failed to save company information' });
            }
        } catch (error) {
            console.error('Error saving company info:', error);
            setFeedback({ type: 'error', message: 'An error occurred' });
        } finally {
            setIsSavingCompany(false);
        }
        setTimeout(() => setFeedback(null), 3000);
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE}/organization/users`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setUsers(data);
                } else {
                    console.error('Expected array from users API, got:', data);
                    setUsers([]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
            setUsers([]);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/organization/invite`, {
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
        <div className="flex flex-col h-full bg-[var(--bg-primary)]" data-tutorial="settings-content">
            {/* Header */}
            <PageHeader title="Settings" subtitle="Manage organization and preferences" />

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                    <div className="flex gap-0.5 bg-[var(--bg-tertiary)] p-0.5 rounded-lg w-fit mb-6 border border-[var(--border-light)]">
                        {[
                            { id: 'general', label: 'General' },
                            { id: 'team', label: 'Team' },
                            { id: 'integrations', label: 'Integrations' },
                            { id: 'activity', label: 'Activity Log', icon: Shield }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === tab.id
                                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                            >
                                {tab.icon && <tab.icon size={14} />}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'team' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-normal text-slate-800">Team Members</h2>
                                    <p className="text-[var(--text-secondary)] text-sm">Manage who has access to this organization.</p>
                                </div>
                                <button
                                    onClick={() => setIsInviting(true)}
                                    className="flex items-center btn-3d btn-primary-3d text-sm hover:bg-[#1e554f] text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Plus size={16} weight="light" className="mr-2" />
                                    Invite Member
                                </button>
                            </div>

                            {feedback && (
                                <div className={`p-4 rounded-lg text-sm font-medium ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {feedback.message}
                                </div>
                            )}

                            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-[var(--bg-tertiary)]/50 border-b border-[var(--border-light)]">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">User</th>
                                            <th className="px-6 py-4 text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Role</th>
                                            <th className="px-6 py-4 text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Email</th>
                                            <th className="px-6 py-4 text-xs font-normal text-[var(--text-secondary)] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map((user) => (
                                            <tr key={user.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar name={user.name} profilePhoto={user.profilePhoto} size="sm" />
                                                        <div>
                                                            <span className="font-medium text-[var(--text-primary)]">{user.name}</span>
                                                            {user.companyRole && (
                                                                <p className="text-xs text-[var(--text-tertiary)]">{user.companyRole}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${user.role === 'admin'
                                                        ? 'bg-[#256A65]/10 text-[#256A65] border border-[#256A65]/30'
                                                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-light)]'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                                                    {user.email}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button className="text-[var(--text-tertiary)] hover:text-red-600 transition-colors">
                                                        <span className="sr-only">Remove</span>
                                                        <X size={16} weight="light" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div className="mb-5">
                                <h2 className="text-base font-normal text-[var(--text-primary)] tracking-tight mb-0.5">Preferences</h2>
                                <p className="text-xs text-[var(--text-secondary)] font-light">Customize your experience.</p>
                            </div>

                            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] overflow-hidden">
                                {/* Theme Setting */}
                                <div className="p-5 flex items-center justify-between border-b border-[var(--border-light)]">
                                    <div className="flex-1">
                                        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Appearance</h3>
                                        <p className="text-xs text-[var(--text-secondary)] font-light">
                                            Choose your preferred color theme
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg">
                                        <button
                                            onClick={() => setMode('light')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                                                mode === 'light'
                                                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                            }`}
                                            title="Light mode"
                                        >
                                            <Sun size={14} weight="light" />
                                            Light
                                        </button>
                                        <button
                                            onClick={() => setMode('dark')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                                                mode === 'dark'
                                                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                            }`}
                                            title="Dark mode"
                                        >
                                            <Moon size={14} weight="light" />
                                            Dark
                                        </button>
                                        <button
                                            onClick={() => setMode('system')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                                                mode === 'system'
                                                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                            }`}
                                            title="System preference"
                                        >
                                            <Monitor size={14} weight="light" />
                                            System
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Tutorial Setting */}
                                <div className="p-5 flex items-center justify-between border-b border-[var(--border-light)] last:border-b-0">
                                    <div className="flex-1">
                                        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-0.5">Product Tutorial</h3>
                                        <p className="text-xs text-[var(--text-secondary)] font-light">
                                                {tutorialEnabled 
                                                    ? 'Tutorial will show on next page refresh'
                                                    : 'Enable to see the guided tour again'
                                                }
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (tutorialEnabled) {
                                                localStorage.setItem('intemic_tutorial_completed', 'true');
                                                setTutorialEnabled(false);
                                            } else {
                                                localStorage.removeItem('intemic_tutorial_completed');
                                                setTutorialEnabled(true);
                                                // Optionally show tutorial immediately
                                                if (onShowTutorial) {
                                                    onShowTutorial();
                                                }
                                            }
                                        }}
                                        className="relative inline-flex items-center focus:outline-none"
                                        aria-label="Toggle tutorial"
                                    >
                                        <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                            tutorialEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-medium)]'
                                        }`}>
                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-[var(--bg-card)] rounded-full shadow-sm transition-transform duration-200 ${
                                                tutorialEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`} />
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Company Information Section */}
                            <div className="mt-8 mb-5">
                                <h2 className="text-base font-normal text-[var(--text-primary)] tracking-tight mb-0.5">Company Information</h2>
                                <p className="text-xs text-[var(--text-secondary)] font-light">Manage your company's core information.</p>
                            </div>

                            {feedback && (
                                <div className={`p-4 rounded-lg text-sm font-medium ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {feedback.message}
                                </div>
                            )}

                            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="font-medium text-slate-800">Company Profile</h3>
                                        <p className="text-sm text-[var(--text-secondary)] font-light">Update your organization details. You can use them in Reports for faster document generation</p>
                                    </div>
                                    <button
                                        onClick={updateCompanyInfo}
                                        disabled={isSavingCompany}
                                        className="btn-3d btn-primary-3d text-sm text-white rounded-lg font-medium hover:bg-[#1e554f] transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSavingCompany ? (
                                            <>
                                                <SpinnerGap weight="light" className="w-4 h-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Company Name</label>
                                        <input
                                            type="text"
                                            value={companyInfo.name}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Industry</label>
                                        <input
                                            type="text"
                                            value={companyInfo.industry}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, industry: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Number of Employees</label>
                                        <select
                                            value={companyInfo.employees}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, employees: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        >
                                            <option value="">Select...</option>
                                            <option value="1-10">1-10</option>
                                            <option value="11-50">11-50</option>
                                            <option value="51-200">51-200</option>
                                            <option value="201-500">201-500</option>
                                            <option value="500+">500+</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Website</label>
                                        <input
                                            type="url"
                                            value={companyInfo.website}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">LinkedIn URL</label>
                                        <input
                                            type="url"
                                            value={companyInfo.linkedinUrl}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, linkedinUrl: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Headquarters Location</label>
                                        <input
                                            type="text"
                                            value={companyInfo.headquarters}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, headquarters: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Founding Year</label>
                                        <input
                                            type="text"
                                            value={companyInfo.foundingYear}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, foundingYear: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Company Overview</label>
                                        <textarea
                                            rows={4}
                                            value={companyInfo.overview}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, overview: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                            placeholder="Brief overview of your company..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-normal text-slate-800">Planes y Facturación</h2>
                                    <p className="text-[var(--text-secondary)] text-sm">Elige el plan que mejor se adapte a tus necesidades.</p>
                                </div>
                                {subscription?.hasStripeCustomer && (
                                    <button
                                        onClick={handleManageSubscription}
                                        disabled={isProcessingPayment}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-card)] btn-3d btn-secondary-3d text-sm transition-colors disabled:opacity-50"
                                    >
                                        <CreditCard size={16} weight="light" />
                                        Gestionar facturación
                                        <ArrowSquareOut size={14} weight="light" />
                                    </button>
                                )}
                            </div>

                            {/* Billing Feedback */}
                            {billingFeedback && (
                                <div className={`p-4 rounded-lg text-sm font-medium flex items-center gap-3 ${
                                    billingFeedback.type === 'success' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {billingFeedback.type === 'success' ? (
                                        <Check weight="light" className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                        <X weight="light" className="w-5 h-5 text-red-500" />
                                    )}
                                    {billingFeedback.message}
                                </div>
                            )}

                            {/* Current Plan Badge */}
                            {subscription && (
                                <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border-light)]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-lg bg-[rgb(91,121,128)] text-white">
                                                {pricingPlans.find(p => p.id === subscription.plan)?.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm text-[var(--text-secondary)]">Plan actual</p>
                                                <p className="font-normal text-slate-800 capitalize">
                                                    {pricingPlans.find(p => p.id === subscription.plan)?.name || 'Gratuito'}
                                                </p>
                                            </div>
                                        </div>
                                        {subscription.currentPeriodEnd && subscription.plan !== 'free' && (
                                            <div className="text-right">
                                                <p className="text-sm text-[var(--text-secondary)]">Próxima facturación</p>
                                                <p className="font-medium text-[var(--text-primary)]">
                                                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Pricing Cards */}
                            {isLoadingSubscription ? (
                                <div className="flex items-center justify-center py-16">
                                    <SpinnerGap weight="light" className="w-8 h-8 text-teal-500 animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {pricingPlans.map((plan) => {
                                        const isCurrentPlan = subscription?.plan === plan.id;
                                        const isDisabled = isPlanDisabled(plan.id);
                                        
                                        return (
                                            <div
                                                key={plan.id}
                                                className={`relative bg-[var(--bg-card)] rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                                                    isCurrentPlan 
                                                        ? 'border-teal-500 shadow-lg shadow-teal-500/10' 
                                                        : plan.popular 
                                                            ? 'border-teal-200 hover:border-teal-400 hover:shadow-lg' 
                                                            : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:shadow-md'
                                                }`}
                                            >
                                                {/* Popular Badge */}
                                                {plan.popular && !isCurrentPlan && (
                                                    <div className="absolute top-0 right-0">
                                                        <div className="bg-[rgb(91,121,128)] text-white text-xs font-medium px-3 py-1 rounded-bl-lg">
                                                            POPULAR
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Current Plan Badge */}
                                                {isCurrentPlan && (
                                                    <div className="absolute top-0 right-0">
                                                        <div className="bg-[var(--bg-selected)] text-white text-xs font-medium px-3 py-1 rounded-bl-lg flex items-center gap-1">
                                                            <Check size={12} weight="light" />
                                                            ACTUAL
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="p-6">
                                                    {/* Plan Icon & Name */}
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-2.5 rounded-lg bg-[rgb(91,121,128)] text-white">
                                                            {plan.icon}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base font-normal text-[var(--text-primary)]">{plan.name}</h3>
                                                            <p className="text-xs text-[var(--text-secondary)]">{plan.description}</p>
                                                        </div>
                                                    </div>

                                                    {/* Price */}
                                                    <div className="mb-6">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-3xl font-normal text-[var(--text-primary)]">{plan.price}</span>
                                                            <span className="text-[var(--text-secondary)] font-medium">{plan.period}</span>
                                                        </div>
                                                    </div>

                                                    {/* Features */}
                                                    <ul className="space-y-3 mb-6">
                                                        {plan.features.map((feature, idx) => (
                                                            <li key={idx} className="flex items-center gap-2.5">
                                                                {feature.included ? (
                                                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgb(91,121,128)] flex items-center justify-center">
                                                                        <Check weight="light" className="w-3 h-3 text-white" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                                                                        <X weight="light" className="w-3 h-3 text-[var(--text-tertiary)]" />
                                                                    </div>
                                                                )}
                                                                <span className={`text-sm ${feature.included ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                                                                    {feature.text}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>

                                                    {/* CTA Button */}
                                                    <button
                                                        onClick={() => plan.id !== 'free' && handleUpgrade(plan.id)}
                                                        disabled={isDisabled || isProcessingPayment}
                                                        className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                                                            isCurrentPlan
                                                                ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-default'
                                                                : plan.id === 'free'
                                                                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-not-allowed'
                                                                    : 'bg-[rgb(91,121,128)] text-white hover:bg-[#1e554f]'
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    >
                                                        {isProcessingPayment ? (
                                                            <>
                                                                <SpinnerGap weight="light" className="w-4 h-4 animate-spin" />
                                                                Procesando...
                                                            </>
                                                        ) : (
                                                            <>
                                                                {!isCurrentPlan && plan.id !== 'free' && <CreditCard size={16} weight="light" />}
                                                                {getPlanButtonText(plan.id)}
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Payment Security Note */}
                            <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)] pt-4">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                <span>Pagos seguros procesados por</span>
                                <svg className="h-5" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M59.64 14.28C59.64 9.54 57.44 6 53.46 6C49.46 6 46.92 9.54 46.92 14.24C46.92 19.76 49.88 22.5 54.1 22.5C56.18 22.5 57.74 22.02 58.96 21.34V17.56C57.74 18.2 56.34 18.6 54.6 18.6C52.9 18.6 51.4 18.02 51.2 15.92H59.6C59.6 15.68 59.64 14.72 59.64 14.28ZM51.14 12.54C51.14 10.52 52.32 9.68 53.44 9.68C54.52 9.68 55.64 10.52 55.64 12.54H51.14Z" fill="#635BFF"/>
                                    <path fillRule="evenodd" clipRule="evenodd" d="M40.32 6C38.58 6 37.48 6.82 36.86 7.38L36.62 6.28H32.54V25L36.94 24.04V21.56C37.58 22.02 38.52 22.5 39.92 22.5C42.94 22.5 45.64 20.1 45.64 14.06C45.62 8.56 42.88 6 40.32 6ZM39.24 18.42C38.28 18.42 37.7 18.1 37.3 17.68L37.28 10.96C37.72 10.48 38.32 10.18 39.24 10.18C40.76 10.18 41.8 11.92 41.8 14.28C41.8 16.7 40.78 18.42 39.24 18.42Z" fill="#635BFF"/>
                                    <path fillRule="evenodd" clipRule="evenodd" d="M27.56 5.02L31.98 4.06V0.14L27.56 1.08V5.02Z" fill="#635BFF"/>
                                    <path d="M31.98 6.28H27.56V22.22H31.98V6.28Z" fill="#635BFF"/>
                                    <path fillRule="evenodd" clipRule="evenodd" d="M23.04 7.7L22.76 6.28H18.74V22.22H23.14V11.32C24.16 9.98 25.88 10.24 26.44 10.44V6.28C25.86 6.06 23.98 5.72 23.04 7.7Z" fill="#635BFF"/>
                                    <path fillRule="evenodd" clipRule="evenodd" d="M14.14 2.3L9.82 3.24L9.8 17.76C9.8 20.48 11.78 22.5 14.48 22.5C15.96 22.5 17.04 22.24 17.64 21.92V18.06C17.06 18.3 14.12 19.14 14.12 16.42V10.36H17.64V6.28H14.12L14.14 2.3Z" fill="#635BFF"/>
                                    <path fillRule="evenodd" clipRule="evenodd" d="M4.42 10.96C4.42 10.24 5 9.94 5.96 9.94C7.36 9.94 9.14 10.38 10.54 11.14V6.96C9 6.32 7.48 6.06 5.96 6.06C2.38 6.06 0 7.96 0 10.96C0 15.62 6.4 14.86 6.4 16.88C6.4 17.74 5.68 18.04 4.66 18.04C3.12 18.04 1.14 17.42 0 16.54V20.76C1.44 21.44 2.9 21.72 4.66 21.72C8.32 21.72 10.84 19.86 10.84 16.84C10.82 11.78 4.42 12.7 4.42 10.96Z" fill="#635BFF"/>
                                </svg>
                            </div>
                        </div>
                    )}

                    {activeTab === 'integrations' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-normal text-slate-800">Integrations</h2>
                                    <p className="text-[var(--text-secondary)] text-sm">Connect external services to enhance your workspace.</p>
                                </div>
                            </div>

                            {/* Slack Feedback */}
                            {slackFeedback && (
                                <div className={`p-4 rounded-lg flex items-center gap-2 ${
                                    slackFeedback.type === 'success' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {slackFeedback.type === 'success' ? <CheckCircle size={18} weight="light" /> : <WarningCircle size={18} weight="light" />}
                                    {slackFeedback.message}
                                </div>
                            )}

                            {/* Slack Integration Card */}
                            <div className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg overflow-hidden">
                                <div className="p-6">
                                    <div className="flex items-start gap-4">
                                        {/* Slack Logo */}
                                        <div className="w-12 h-12 bg-[rgb(91,121,128)] rounded-lg flex items-center justify-center text-white">
                                            <SlackIcon />
                                        </div>
                                        
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-normal text-slate-800">Slack</h3>
                                                {slackConnected && (
                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                                        Connected
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-[var(--text-secondary)] mt-1">
                                                Query your database directly from Slack. Mention the app or send a DM to ask questions about your data.
                                            </p>

                                            {slackConnected ? (
                                                <div className="mt-4 space-y-4">
                                                    {/* Connected Status */}
                                                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                                                    Connected to <span className="text-[var(--text-primary)]">{slackTeamName}</span>
                                                                </p>
                                                                {slackConnectedAt && (
                                                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                                        Since {new Date(slackConnectedAt).toLocaleDateString()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={disconnectSlack}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <LinkBreak size={14} weight="light" />
                                                                Disconnect
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Usage Instructions */}
                                                    <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                                                        <h4 className="text-sm font-medium text-teal-800 mb-2">How to use</h4>
                                                        <ul className="text-sm text-teal-700 space-y-1">
                                                            <li>• Mention the app: <code className="bg-teal-100 px-1 rounded">@YourApp how many customers do we have?</code></li>
                                                            <li>• Or send a direct message to the app</li>
                                                            <li>• The Database Assistant will analyze your data and respond</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-4 space-y-4">
                                                    {/* Setup Instructions */}
                                                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
                                                        <h4 className="text-sm font-normal text-[var(--text-primary)] mb-3">Setup Instructions</h4>
                                                        <ol className="text-sm text-[var(--text-secondary)] space-y-2">
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-[var(--bg-selected)] rounded-full flex items-center justify-center text-xs font-medium">1</span>
                                                                <span>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">api.slack.com/apps</a> and create a new app</span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-[var(--bg-selected)] rounded-full flex items-center justify-center text-xs font-medium">2</span>
                                                                <span>In <strong>OAuth & Permissions</strong>, add scopes: <code className="bg-[var(--bg-selected)] px-1 rounded text-xs">chat:write</code>, <code className="bg-[var(--bg-selected)] px-1 rounded text-xs">app_mentions:read</code>, <code className="bg-[var(--bg-selected)] px-1 rounded text-xs">im:history</code></span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-[var(--bg-selected)] rounded-full flex items-center justify-center text-xs font-medium">3</span>
                                                                <span>Install the app and copy the <strong>Bot User OAuth Token</strong></span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-[var(--bg-selected)] rounded-full flex items-center justify-center text-xs font-medium">4</span>
                                                                <span>In <strong>Event Subscriptions</strong>, enable events and set the Request URL (below)</span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-[var(--bg-selected)] rounded-full flex items-center justify-center text-xs font-medium">5</span>
                                                                <span>Subscribe to events: <code className="bg-[var(--bg-selected)] px-1 rounded text-xs">app_mention</code>, <code className="bg-[var(--bg-selected)] px-1 rounded text-xs">message.im</code></span>
                                                            </li>
                                                        </ol>
                                                    </div>

                                                    {/* Webhook URL */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                                            Request URL (for Event Subscriptions)
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={slackWebhookUrl}
                                                                className="flex-1 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg text-sm text-[var(--text-primary)] font-mono"
                                                            />
                                                            <button
                                                                onClick={copyWebhookUrl}
                                                                className="px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] border border-[var(--border-light)] rounded-lg transition-colors flex items-center gap-1.5"
                                                            >
                                                                {copiedWebhook ? <Check size={16} weight="light" className="text-emerald-500" /> : <Copy size={16} weight="light" className="text-[var(--text-secondary)]" />}
                                                            </button>
                                                        </div>
                                                        <p className="mt-1 text-xs text-amber-600">
                                                            Note: For local development, use ngrok to expose your server.
                                                        </p>
                                                    </div>

                                                    {/* Bot Token Input */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                                                            Bot User OAuth Token
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={slackBotToken}
                                                            onChange={(e) => setSlackBotToken(e.target.value)}
                                                            placeholder="xoxb-..."
                                                            className="w-full px-3 py-2 border border-[var(--border-medium)] rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                                                        />
                                                    </div>

                                                    {/* Connect Button */}
                                                    <button
                                                        onClick={connectSlack}
                                                        disabled={isConnectingSlack || !slackBotToken.trim()}
                                                        className="flex items-center gap-2 btn-3d btn-primary-3d text-sm hover:bg-[#1e554f] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isConnectingSlack ? (
                                                            <>
                                                                <SpinnerGap size={16} weight="light" className="animate-spin" />
                                                                Connecting...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <LinkSimple size={16} weight="light" />
                                                                Connect Slack
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* More integrations coming soon */}
                            <div className="bg-[var(--bg-tertiary)] border border-dashed border-[var(--border-medium)] rounded-lg p-8 text-center">
                                <div className="w-12 h-12 bg-[var(--bg-selected)] rounded-lg mx-auto flex items-center justify-center mb-3">
                                    <Sparkle size={24} weight="light" className="text-[var(--text-tertiary)]" />
                                </div>
                                <h3 className="text-[var(--text-primary)] font-medium mb-1">More integrations coming soon</h3>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    We're working on integrations with more tools. Stay tuned!
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="-m-8">
                            <ActivityLog />
                        </div>
                    )}
                </div>

                {/* Invite Modal */}
                {isInviting && (
                    <div className="fixed inset-0 bg-[#256A65]/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-light)] shadow-xl w-full max-w-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-[var(--border-light)] flex items-center justify-between bg-[var(--bg-tertiary)]/50">
                                <h3 className="font-normal text-slate-800">Invite Team Member</h3>
                                <button onClick={() => setIsInviting(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                                    <X size={20} weight="light" />
                                </button>
                            </div>
                            <form onSubmit={handleInvite} className="p-6">
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Envelope weight="light" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border-medium)] focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                                            placeholder="colleague@company.com"
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                                        Invitation will be sent via email. If they have an account, they'll be added immediately.
                                    </p>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsInviting(false)}
                                        className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-3d btn-primary-3d text-sm hover:bg-[#1e554f] text-white rounded-lg text-sm font-medium transition-colors"
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
