import React, { useState, useEffect } from 'react';
import { User, Mail, Plus, X, Search, Building, BookOpen, ToggleLeft, ToggleRight, Check, Zap, Crown, Sparkles, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { ProfileMenu, UserAvatar } from './ProfileMenu';
import { API_BASE } from '../config';

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
    const [activeTab, setActiveTab] = useState<'general' | 'team' | 'billing'>('general');
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [isInviting, setIsInviting] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [tutorialEnabled, setTutorialEnabled] = useState(() => {
        return !localStorage.getItem('intemic_tutorial_completed');
    });
    
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
            icon: <Sparkles className="w-6 h-6" />,
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
            icon: <Zap className="w-6 h-6" />,
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
            icon: <Crown className="w-6 h-6" />,
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
        }
    }, [activeTab]);

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
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">Preferences</h2>
                                <p className="text-slate-500 text-sm">Customize your experience.</p>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Tutorial Setting */}
                                <div className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-teal-50 rounded-xl">
                                            <BookOpen className="w-6 h-6 text-teal-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-slate-800">Product Tutorial</h3>
                                            <p className="text-sm text-slate-500">
                                                {tutorialEnabled 
                                                    ? 'Tutorial will show on next page refresh'
                                                    : 'Enable to see the guided tour again'
                                                }
                                            </p>
                                        </div>
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
                                        className="flex items-center"
                                    >
                                        {tutorialEnabled ? (
                                            <ToggleRight className="w-12 h-12 text-teal-500" />
                                        ) : (
                                            <ToggleLeft className="w-12 h-12 text-slate-300" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-800">Planes y Facturación</h2>
                                    <p className="text-slate-500 text-sm">Elige el plan que mejor se adapte a tus necesidades.</p>
                                </div>
                                {subscription?.hasStripeCustomer && (
                                    <button
                                        onClick={handleManageSubscription}
                                        disabled={isProcessingPayment}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                    >
                                        <CreditCard size={16} />
                                        Gestionar facturación
                                        <ExternalLink size={14} />
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
                                        <Check className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                        <X className="w-5 h-5 text-red-500" />
                                    )}
                                    {billingFeedback.message}
                                </div>
                            )}

                            {/* Current Plan Badge */}
                            {subscription && (
                                <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${
                                                pricingPlans.find(p => p.id === subscription.plan)?.gradient || 'from-slate-500 to-slate-600'
                                            } text-white`}>
                                                {pricingPlans.find(p => p.id === subscription.plan)?.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-500">Plan actual</p>
                                                <p className="font-semibold text-slate-800 capitalize">
                                                    {pricingPlans.find(p => p.id === subscription.plan)?.name || 'Gratuito'}
                                                </p>
                                            </div>
                                        </div>
                                        {subscription.currentPeriodEnd && subscription.plan !== 'free' && (
                                            <div className="text-right">
                                                <p className="text-sm text-slate-500">Próxima facturación</p>
                                                <p className="font-medium text-slate-700">
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
                                    <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {pricingPlans.map((plan) => {
                                        const isCurrentPlan = subscription?.plan === plan.id;
                                        const isDisabled = isPlanDisabled(plan.id);
                                        
                                        return (
                                            <div
                                                key={plan.id}
                                                className={`relative bg-white rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
                                                    isCurrentPlan 
                                                        ? 'border-teal-500 shadow-lg shadow-teal-500/10' 
                                                        : plan.popular 
                                                            ? 'border-teal-200 hover:border-teal-400 hover:shadow-lg' 
                                                            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                                                }`}
                                            >
                                                {/* Popular Badge */}
                                                {plan.popular && !isCurrentPlan && (
                                                    <div className="absolute top-0 right-0">
                                                        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                                            POPULAR
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Current Plan Badge */}
                                                {isCurrentPlan && (
                                                    <div className="absolute top-0 right-0">
                                                        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                                                            <Check size={12} />
                                                            ACTUAL
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="p-6">
                                                    {/* Plan Icon & Name */}
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${plan.gradient} text-white`}>
                                                            {plan.icon}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
                                                            <p className="text-xs text-slate-500">{plan.description}</p>
                                                        </div>
                                                    </div>

                                                    {/* Price */}
                                                    <div className="mb-6">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                                                            <span className="text-slate-500 font-medium">{plan.period}</span>
                                                        </div>
                                                    </div>

                                                    {/* Features */}
                                                    <ul className="space-y-3 mb-6">
                                                        {plan.features.map((feature, idx) => (
                                                            <li key={idx} className="flex items-center gap-2.5">
                                                                {feature.included ? (
                                                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                                                                        <X className="w-3 h-3 text-slate-400" />
                                                                    </div>
                                                                )}
                                                                <span className={`text-sm ${feature.included ? 'text-slate-700' : 'text-slate-400'}`}>
                                                                    {feature.text}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>

                                                    {/* CTA Button */}
                                                    <button
                                                        onClick={() => plan.id !== 'free' && handleUpgrade(plan.id)}
                                                        disabled={isDisabled || isProcessingPayment}
                                                        className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                                                            isCurrentPlan
                                                                ? 'bg-slate-100 text-slate-500 cursor-default'
                                                                : plan.id === 'free'
                                                                    ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                                                                    : plan.popular
                                                                        ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600 shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30'
                                                                        : 'bg-slate-800 text-white hover:bg-slate-900'
                                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    >
                                                        {isProcessingPayment ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                Procesando...
                                                            </>
                                                        ) : (
                                                            <>
                                                                {!isCurrentPlan && plan.id !== 'free' && <CreditCard size={16} />}
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
                            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 pt-4">
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
