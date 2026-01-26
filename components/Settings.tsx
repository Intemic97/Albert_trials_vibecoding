import React, { useState, useEffect } from 'react';
import { User, Mail, Plus, X, Search, Building, BookOpen, ToggleLeft, ToggleRight, Check, Zap, Crown, Sparkles, CreditCard, ExternalLink, Loader2, Building2, Link2, Unlink, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { UserAvatar } from './ProfileMenu';
import { API_BASE } from '../config';

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
    const [activeTab, setActiveTab] = useState<'general' | 'team' | 'billing' | 'integrations'>('general');
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
    
    // Upgrade modal state
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [useCase, setUseCase] = useState('');
    const [isSendingRequest, setIsSendingRequest] = useState(false);
    
    // Pricing plans configuration
    const pricingPlans: PricingPlan[] = [
        {
            id: 'free',
            name: 'Free',
            price: '0€',
            priceValue: 0,
            period: '/month',
            description: 'Perfect to start and explore',
            icon: <Sparkles className="w-6 h-6" />,
            gradient: 'from-slate-500 to-slate-600',
            features: [
                { text: '3 active workflows', included: true },
                { text: '100 executions/month', included: true },
                { text: '1 user', included: true },
                { text: 'Email support', included: true },
                { text: 'Advanced integrations', included: false },
                { text: 'API access', included: false },
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            price: '15€',
            priceValue: 15,
            period: '/month',
            description: 'For growing teams',
            icon: <Zap className="w-6 h-6" />,
            popular: true,
            gradient: 'from-teal-500 to-emerald-600',
            features: [
                { text: 'Unlimited workflows', included: true },
                { text: '5,000 executions/month', included: true },
                { text: 'Up to 5 users', included: true },
                { text: 'Priority support', included: true },
                { text: 'Advanced integrations', included: true },
                { text: 'API access', included: false },
            ]
        },
        {
            id: 'business',
            name: 'Business',
            price: '45€',
            priceValue: 45,
            period: '/month',
            description: 'For companies and large teams',
            icon: <Crown className="w-6 h-6" />,
            gradient: 'from-violet-500 to-purple-600',
            features: [
                { text: 'Unlimited workflows', included: true },
                { text: 'Unlimited executions', included: true },
                { text: 'Unlimited users', included: true },
                { text: '24/7 dedicated support', included: true },
                { text: 'Advanced integrations', included: true },
                { text: 'Full API access', included: true },
            ]
        }
    ];

    // Check for billing success/cancel from URL params
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const billingStatus = urlParams.get('billing');
        
        if (billingStatus === 'success') {
            setBillingFeedback({ type: 'success', message: 'Payment completed successfully! Your plan has been updated.' });
            setActiveTab('billing');
            // Clean URL
            window.history.replaceState({}, '', '/settings');
            // Refresh subscription data
            fetchSubscription();
        } else if (billingStatus === 'cancelled') {
            setBillingFeedback({ type: 'error', message: 'Payment was cancelled.' });
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
                setBillingFeedback({ type: 'error', message: data.error || 'Error processing payment' });
            }
        } catch (error) {
            setBillingFeedback({ type: 'error', message: 'Connection error. Please try again.' });
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
                setBillingFeedback({ type: 'error', message: data.error || 'Error opening billing portal' });
            }
        } catch (error) {
            setBillingFeedback({ type: 'error', message: 'Connection error' });
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleRequestQuotation = async () => {
        if (!useCase.trim()) {
            setBillingFeedback({ type: 'error', message: 'Please describe your use case' });
            return;
        }

        setIsSendingRequest(true);
        setBillingFeedback(null);

        try {
            const res = await fetch(`${API_BASE}/billing/request-quotation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ useCase }),
                credentials: 'include'
            });

            const data = await res.json();

            if (res.ok) {
                setBillingFeedback({ type: 'success', message: 'Request sent! We\'ll get back to you soon.' });
                setShowUpgradeModal(false);
                setUseCase('');
            } else {
                setBillingFeedback({ type: 'error', message: data.error || 'Failed to send request' });
            }
        } catch (error) {
            setBillingFeedback({ type: 'error', message: 'Connection error. Please try again.' });
        } finally {
            setIsSendingRequest(false);
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
        <div className="flex flex-col h-full bg-slate-50" data-tutorial="settings-content">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
                <div>
                    <h1 className="text-lg font-normal text-slate-900 tracking-tight">Settings</h1>
                    <p className="text-[11px] text-slate-500 font-light">Manage organization and preferences</p>
                </div>
                <div />
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-lg font-normal text-slate-900 mb-5">Settings</h1>

                    <div className="flex gap-0.5 bg-slate-50 p-0.5 rounded-lg w-fit mb-6 border border-slate-200">
                        {['General', 'Team', 'Plan', 'Integrations'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab === 'Plan' ? 'billing' : tab.toLowerCase() as any)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    (tab === 'Plan' && activeTab === 'billing') || (activeTab === tab.toLowerCase())
                                    ? 'bg-white text-slate-900'
                                    : 'text-slate-500 hover:text-slate-700'
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
                                    <h2 className="text-lg font-normal text-slate-800">Team Members</h2>
                                    <p className="text-slate-500 text-sm">Manage who has access to this organization.</p>
                                </div>
                                <button
                                    onClick={() => setIsInviting(true)}
                                    className="flex items-center btn-3d btn-primary-3d text-sm hover:bg-[#1e554f] text-white rounded-lg text-sm font-medium transition-colors"
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

                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">User</th>
                                            <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Role</th>
                                            <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Email</th>
                                            <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map((user) => (
                                            <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar name={user.name} profilePhoto={user.profilePhoto} size="sm" />
                                                        <div>
                                                            <span className="font-medium text-slate-700">{user.name}</span>
                                                            {user.companyRole && (
                                                                <p className="text-xs text-slate-400">{user.companyRole}</p>
                                                            )}
                                                        </div>
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

                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div className="mb-5">
                                <h2 className="text-base font-normal text-slate-900 tracking-tight mb-0.5">Preferences</h2>
                                <p className="text-xs text-slate-500 font-light">Customize your experience.</p>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                {/* Tutorial Setting */}
                                <div className="p-5 flex items-center justify-between border-b border-slate-100 last:border-b-0">
                                    <div className="flex-1">
                                        <h3 className="text-sm font-medium text-slate-900 mb-0.5">Product Tutorial</h3>
                                        <p className="text-xs text-slate-500 font-light">
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
                                            tutorialEnabled ? 'bg-[rgb(91,121,128)]' : 'bg-slate-200'
                                        }`}>
                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                                tutorialEnabled ? 'translate-x-5' : 'translate-x-0'
                                            }`} />
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Company Information Section */}
                            <div className="mt-8 mb-5">
                                <h2 className="text-base font-normal text-slate-900 tracking-tight mb-0.5">Company Information</h2>
                                <p className="text-xs text-slate-500 font-light">Manage your company's core information.</p>
                            </div>

                            {feedback && (
                                <div className={`p-4 rounded-lg text-sm font-medium ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {feedback.message}
                                </div>
                            )}

                            <div className="bg-white rounded-lg border border-slate-200 p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="font-medium text-slate-800">Company Profile</h3>
                                        <p className="text-sm text-slate-500 font-light">Update your organization details. You can use them in Reports for faster document generation</p>
                                    </div>
                                    <button
                                        onClick={updateCompanyInfo}
                                        disabled={isSavingCompany}
                                        className="btn-3d btn-primary-3d text-sm text-white rounded-lg font-medium hover:bg-[#1e554f] transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSavingCompany ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                                        <input
                                            type="text"
                                            value={companyInfo.name}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                                        <input
                                            type="text"
                                            value={companyInfo.industry}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, industry: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Number of Employees</label>
                                        <select
                                            value={companyInfo.employees}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, employees: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                                        <input
                                            type="url"
                                            value={companyInfo.website}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn URL</label>
                                        <input
                                            type="url"
                                            value={companyInfo.linkedinUrl}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, linkedinUrl: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Headquarters Location</label>
                                        <input
                                            type="text"
                                            value={companyInfo.headquarters}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, headquarters: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Founding Year</label>
                                        <input
                                            type="text"
                                            value={companyInfo.foundingYear}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, foundingYear: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Company Overview</label>
                                        <textarea
                                            rows={4}
                                            value={companyInfo.overview}
                                            onChange={(e) => setCompanyInfo({ ...companyInfo, overview: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
                                    <h2 className="text-lg font-normal text-slate-800">Plan</h2>
                                    <p className="text-slate-500 text-sm">Manage your current plan and request upgrades.</p>
                                </div>
                            </div>

                            {/* Billing Feedback */}
                            {billingFeedback && (
                                <div className={`p-4 rounded-lg text-sm font-medium flex items-center gap-3 ${
                                    billingFeedback.type === 'success' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {billingFeedback.type === 'success' ? (
                                        <Check className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                        <X className="w-5 h-5 text-red-500" />
                                    )}
                                    {billingFeedback.message}
                                </div>
                            )}

                            {/* Current Plan Card */}
                            {isLoadingSubscription ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                                </div>
                            ) : subscription && (
                                <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 rounded-lg bg-[rgb(91,121,128)] text-white">
                                                <CreditCard size={24} />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500 mb-1">Current plan</p>
                                                <p className="text-2xl font-normal text-slate-800 capitalize">
                                                    {pricingPlans.find(p => p.id === subscription.plan)?.name || 'Free'}
                                                </p>
                                                {subscription.currentPeriodEnd && subscription.plan !== 'free' && (
                                                    <p className="text-sm text-slate-500 mt-1">
                                                        Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowUpgradeModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#15324d] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                        >
                                            <Crown size={18} />
                                            Upgrade
                                        </button>
                                    </div>

                                    {subscription?.hasStripeCustomer && subscription.plan !== 'free' && (
                                        <div className="mt-6 pt-6 border-t border-slate-200">
                                            <button
                                                onClick={handleManageSubscription}
                                                disabled={isProcessingPayment}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                <CreditCard size={16} />
                                                Manage billing
                                                <ExternalLink size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'integrations' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-normal text-slate-800">Integrations</h2>
                                    <p className="text-slate-500 text-sm">Connect external services to enhance your workspace.</p>
                                </div>
                            </div>

                            {/* Slack Feedback */}
                            {slackFeedback && (
                                <div className={`p-4 rounded-lg flex items-center gap-2 ${
                                    slackFeedback.type === 'success' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {slackFeedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                                    {slackFeedback.message}
                                </div>
                            )}

                            {/* Slack Integration Card */}
                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
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
                                            <p className="text-sm text-slate-500 mt-1">
                                                Query your database directly from Slack. Mention the app or send a DM to ask questions about your data.
                                            </p>

                                            {slackConnected ? (
                                                <div className="mt-4 space-y-4">
                                                    {/* Connected Status */}
                                                    <div className="bg-slate-50 rounded-lg p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-700">
                                                                    Connected to <span className="text-slate-900">{slackTeamName}</span>
                                                                </p>
                                                                {slackConnectedAt && (
                                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                                        Since {new Date(slackConnectedAt).toLocaleDateString()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={disconnectSlack}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            >
                                                                <Unlink size={14} />
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
                                                    <div className="bg-slate-50 rounded-lg p-4">
                                                        <h4 className="text-sm font-normal text-slate-700 mb-3">Setup Instructions</h4>
                                                        <ol className="text-sm text-slate-600 space-y-2">
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                                                                <span>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">api.slack.com/apps</a> and create a new app</span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                                                                <span>In <strong>OAuth & Permissions</strong>, add scopes: <code className="bg-slate-200 px-1 rounded text-xs">chat:write</code>, <code className="bg-slate-200 px-1 rounded text-xs">app_mentions:read</code>, <code className="bg-slate-200 px-1 rounded text-xs">im:history</code></span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                                                                <span>Install the app and copy the <strong>Bot User OAuth Token</strong></span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium">4</span>
                                                                <span>In <strong>Event Subscriptions</strong>, enable events and set the Request URL (below)</span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="flex-shrink-0 w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium">5</span>
                                                                <span>Subscribe to events: <code className="bg-slate-200 px-1 rounded text-xs">app_mention</code>, <code className="bg-slate-200 px-1 rounded text-xs">message.im</code></span>
                                                            </li>
                                                        </ol>
                                                    </div>

                                                    {/* Webhook URL */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                            Request URL (for Event Subscriptions)
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                readOnly
                                                                value={slackWebhookUrl}
                                                                className="flex-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 font-mono"
                                                            />
                                                            <button
                                                                onClick={copyWebhookUrl}
                                                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                                                            >
                                                                {copiedWebhook ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} className="text-slate-500" />}
                                                            </button>
                                                        </div>
                                                        <p className="mt-1 text-xs text-amber-600">
                                                            Note: For local development, use ngrok to expose your server.
                                                        </p>
                                                    </div>

                                                    {/* Bot Token Input */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                            Bot User OAuth Token
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={slackBotToken}
                                                            onChange={(e) => setSlackBotToken(e.target.value)}
                                                            placeholder="xoxb-..."
                                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
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
                                                                <Loader2 size={16} className="animate-spin" />
                                                                Connecting...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Link2 size={16} />
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
                            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-8 text-center">
                                <div className="w-12 h-12 bg-slate-200 rounded-lg mx-auto flex items-center justify-center mb-3">
                                    <Sparkles size={24} className="text-slate-400" />
                                </div>
                                <h3 className="text-slate-700 font-medium mb-1">More integrations coming soon</h3>
                                <p className="text-sm text-slate-500">
                                    We're working on integrations with more tools. Stay tuned!
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Invite Modal */}
                {isInviting && (
                    <div className="fixed inset-0 bg-[#256A65]/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="font-normal text-slate-800">Invite Team Member</h3>
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
                                        className="btn-3d btn-primary-3d text-sm hover:bg-[#1e554f] text-white rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Send Invitation
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Upgrade Modal */}
                {showUpgradeModal && (
                    <div className="fixed inset-0 bg-[#256A65]/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-[#1e3a5f] text-white">
                                        <Crown size={18} />
                                    </div>
                                    <h3 className="font-normal text-slate-800">Request Upgrade</h3>
                                </div>
                                <button 
                                    onClick={() => {
                                        setShowUpgradeModal(false);
                                        setUseCase('');
                                    }} 
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-slate-600 mb-4">
                                    Tell us about your use case and we'll get back to you with a personalized quote.
                                </p>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Describe your use case
                                    </label>
                                    <textarea
                                        value={useCase}
                                        onChange={(e) => setUseCase(e.target.value)}
                                        rows={6}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-none"
                                        placeholder="E.g., We need to manage 100+ workflows with a team of 15 people, with unlimited executions..."
                                    />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowUpgradeModal(false);
                                            setUseCase('');
                                        }}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleRequestQuotation}
                                        disabled={isSendingRequest || !useCase.trim()}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#15324d] text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSendingRequest ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Mail size={16} />
                                                Request quotation
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
