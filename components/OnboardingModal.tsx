import React, { useState } from 'react';
import { 
    Briefcase, 
    Buildings, 
    Target, 
    Megaphone, 
    ArrowRight, 
    ArrowLeft,
    SpinnerGap,
    RocketLaunch,
    CheckCircle,
    User,
    Desktop,
    ChartBar,
    Gear,
    ClipboardText,
    DotsThreeCircle,
    ForkKnife,
    Pill,
    Flask,
    Drop,
    Factory,
    Lightning,
    TrendUp,
    Database,
    Microscope,
    ShieldCheck,
    MagnifyingGlass,
    LinkedinLogo,
    Users,
    PresentationChart,
    EnvelopeSimple
} from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

interface OnboardingModalProps {
    onComplete: () => void;
}

const ROLES = [
    { id: 'it-manager', label: 'IT Manager', icon: Desktop },
    { id: 'data-analyst', label: 'Data Analyst', icon: ChartBar },
    { id: 'process-engineer', label: 'Process Engineer', icon: Gear },
    { id: 'operations-manager', label: 'Operations Manager', icon: ClipboardText },
    { id: 'executive', label: 'Executive / C-Level', icon: Briefcase },
    { id: 'other', label: 'Other', icon: DotsThreeCircle },
];

const INDUSTRIES = [
    { id: 'food-beverage', label: 'Food & Beverage', icon: ForkKnife },
    { id: 'pharma', label: 'Pharmaceutical', icon: Pill },
    { id: 'chemical', label: 'Chemical', icon: Flask },
    { id: 'water-treatment', label: 'Water Treatment', icon: Drop },
    { id: 'manufacturing', label: 'Manufacturing', icon: Factory },
    { id: 'energy', label: 'Energy', icon: Lightning },
    { id: 'other', label: 'Other', icon: DotsThreeCircle },
];

const USE_CASES = [
    { id: 'automated-reporting', label: 'Automated Reporting', icon: TrendUp },
    { id: 'process-optimization', label: 'Process Optimization', icon: Target },
    { id: 'data-warehouse', label: 'Data Warehouse & BI', icon: Database },
    { id: 'doe', label: 'Design of Experiments', icon: Microscope },
    { id: 'compliance', label: 'Regulatory Compliance', icon: ShieldCheck },
    { id: 'exploring', label: 'Just Exploring', icon: MagnifyingGlass },
];

const SOURCES = [
    { id: 'linkedin', label: 'LinkedIn', icon: LinkedinLogo },
    { id: 'google', label: 'Google Search', icon: MagnifyingGlass },
    { id: 'referral', label: 'From a Friend', icon: Users },
    { id: 'event', label: 'Event / Congress', icon: PresentationChart },
    { id: 'email', label: 'Email', icon: EnvelopeSimple },
    { id: 'other', label: 'Other', icon: DotsThreeCircle },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
    const { user, completeOnboarding } = useAuth();
    const { t } = useTranslation();
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        role: '',
        industry: '',
        useCase: '',
        source: ''
    });

    const steps = [
        {
            key: 'role',
            icon: Briefcase,
            title: t('onboarding.roleTitle'),
            subtitle: t('onboarding.roleSubtitle'),
            options: ROLES,
        },
        {
            key: 'industry',
            icon: Buildings,
            title: t('onboarding.industryTitle'),
            subtitle: t('onboarding.industrySubtitle'),
            options: INDUSTRIES,
        },
        {
            key: 'useCase',
            icon: Target,
            title: t('onboarding.useCaseTitle'),
            subtitle: t('onboarding.useCaseSubtitle'),
            options: USE_CASES,
        },
        {
            key: 'source',
            icon: Megaphone,
            title: t('onboarding.sourceTitle'),
            subtitle: t('onboarding.sourceSubtitle'),
            options: SOURCES,
        },
    ];

    const currentStep = steps[step];
    const isLastStep = step === steps.length - 1;
    const canProceed = formData[currentStep.key as keyof typeof formData].length > 0;

    const handleNext = async () => {
        if (isLastStep) {
            setIsSubmitting(true);
            const success = await completeOnboarding(formData);
            setIsSubmitting(false);
            if (success) {
                onComplete();
            }
        } else {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    const handleSelect = (value: string) => {
        setFormData(prev => ({
            ...prev,
            [currentStep.key]: value
        }));
    };

    const Icon = currentStep.icon;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)] shadow-2xl w-full max-w-xl overflow-hidden">
                {/* Header with gradient accent */}
                <div className="relative px-8 pt-8 pb-6">
                    {/* Decorative gradient */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent-primary)] via-emerald-400 to-cyan-400" />
                    
                    {/* Welcome message */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]">
                            {user?.name?.[0]?.toUpperCase() || <User size={20} />}
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                                {t('onboarding.welcome')}, {user?.name?.split(' ')[0] || 'there'}!
                            </h1>
                            <p className="text-sm text-[var(--text-tertiary)]">
                                {t('onboarding.setupWorkspace')}
                            </p>
                        </div>
                    </div>
                    
                    {/* Progress steps */}
                    <div className="flex items-center gap-2">
                        {steps.map((s, i) => (
                            <div key={i} className="flex-1 flex items-center">
                                <div 
                                    className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                                        i < step 
                                            ? 'bg-[var(--accent-primary)]' 
                                            : i === step 
                                                ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary)]/30'
                                                : 'bg-[var(--border-light)]'
                                    }`}
                                />
                                {i < steps.length - 1 && (
                                    <div className={`w-2 h-2 rounded-full mx-1 transition-all duration-300 ${
                                        i < step ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-light)]'
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="px-8 pb-6">
                    {/* Question header */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                <Icon size={18} className="text-[var(--accent-primary)]" weight="duotone" />
                            </div>
                            <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                                {t('onboarding.stepOf', { current: step + 1, total: steps.length })}
                            </span>
                        </div>
                        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                            {currentStep.title}
                        </h2>
                        <p className="text-sm text-[var(--text-tertiary)]">
                            {currentStep.subtitle}
                        </p>
                    </div>

                    {/* Options grid */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {currentStep.options.map((option) => {
                            const isSelected = formData[currentStep.key as keyof typeof formData] === option.id;
                            const OptionIcon = option.icon;
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleSelect(option.id)}
                                    className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                                        isSelected
                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                            : 'border-[var(--border-light)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                                        isSelected ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                    }`}>
                                        <OptionIcon size={18} weight="duotone" />
                                    </span>
                                    <span className={`text-sm font-medium ${
                                        isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                                    }`}>
                                        {option.label}
                                    </span>
                                    {isSelected && (
                                        <CheckCircle 
                                            size={18} 
                                            weight="fill" 
                                            className="absolute top-2 right-2 text-[var(--accent-primary)]" 
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-[var(--border-light)] bg-[var(--bg-tertiary)]/50 flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        disabled={step === 0}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            step === 0
                                ? 'text-[var(--text-tertiary)] cursor-not-allowed'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <ArrowLeft size={16} weight="bold" />
                        {t('common.back')}
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed || isSubmitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent-primary)]/20"
                    >
                        {isSubmitting ? (
                            <>
                                <SpinnerGap size={18} className="animate-spin" />
                                <span>{t('onboarding.settingUp')}</span>
                            </>
                        ) : isLastStep ? (
                            <>
                                <span>{t('onboarding.getStarted')}</span>
                                <RocketLaunch size={18} weight="fill" />
                            </>
                        ) : (
                            <>
                                <span>{t('common.continue')}</span>
                                <ArrowRight size={18} weight="bold" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
