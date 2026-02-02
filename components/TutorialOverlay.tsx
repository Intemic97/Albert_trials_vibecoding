import React, { useState, useEffect } from 'react';
import { 
    X, 
    CaretRight, 
    CaretLeft,
    SquaresFour, 
    ChartLineUp, 
    FlowArrow, 
    Database, 
    FileText,
    GearSix,
    Sparkle,
    CheckCircle
} from '@phosphor-icons/react';

interface TutorialStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    highlight?: string; // CSS selector or section name to highlight
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to Intemic! 👋',
        description: 'Let us show you around. This quick tour will help you discover all the powerful features available to streamline your data workflows.',
        icon: <Sparkle className="w-8 h-8" weight="light" />,
    },
    {
        id: 'overview',
        title: 'Overview Dashboard',
        description: 'Your command center. See key metrics, pending approvals, and quick access to your most important workflows. Customize KPIs to track what matters most to your business.',
        icon: <SquaresFour className="w-8 h-8" weight="light" />,
        highlight: 'overview'
    },
    {
        id: 'dashboards',
        title: 'Dashboards',
        description: 'Create beautiful, interactive dashboards with charts and visualizations. Share them with your team or make them public with a single click.',
        icon: <ChartLineUp className="w-8 h-8" weight="light" />,
        highlight: 'dashboards'
    },
    {
        id: 'workflows',
        title: 'Workflows',
        description: 'The heart of Intemic. Build automated workflows with our visual drag-and-drop editor. Connect data sources, add transformations, and set up triggers - no coding required.',
        icon: <FlowArrow className="w-8 h-8" weight="light" />,
        highlight: 'workflows'
    },
    {
        id: 'database',
        title: 'Database',
        description: 'Define your data structure with custom entities and properties. Think of it as your own flexible database schema that adapts to your business needs.',
        icon: <Database className="w-8 h-8" weight="light" />,
        highlight: 'database'
    },
    {
        id: 'reports',
        title: 'Reports',
        description: 'Generate detailed reports from your data. Export to various formats and schedule automatic report generation to keep stakeholders informed.',
        icon: <FileText className="w-8 h-8" weight="light" />,
        highlight: 'reports'
    },
    {
        id: 'settings',
        title: 'Settings',
        description: 'Manage your profile, team members, and organization settings. Invite colleagues to collaborate and control access permissions.',
        icon: <GearSix className="w-8 h-8" weight="light" />,
        highlight: 'settings'
    },
    {
        id: 'complete',
        title: "You're all set! 🎉",
        description: "You've completed the tour. Start exploring and building amazing workflows. Need help? Click the Documentation link in the sidebar anytime.",
        icon: <CheckCircle className="w-8 h-8" weight="light" />,
    }
];

interface TutorialOverlayProps {
    onComplete: () => void;
    onSkip: () => void;
}

export function TutorialOverlay({ onComplete, onSkip }: TutorialOverlayProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isExiting, setIsExiting] = useState(false);

    const step = TUTORIAL_STEPS[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
    const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

    const handleNext = () => {
        if (isLastStep) {
            handleComplete();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        setIsExiting(true);
        setTimeout(() => {
            onComplete();
        }, 300);
    };

    const handleSkip = () => {
        setIsExiting(true);
        setTimeout(() => {
            onSkip();
        }, 300);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'Escape') {
                handleSkip();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentStep]);

    return (
        <div 
            className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${
                isExiting ? 'opacity-0' : 'opacity-100'
            }`}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />

            {/* Modal */}
            <div 
                className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden transform transition-all duration-300 ${
                    isExiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
                }`}
            >
                {/* Progress bar */}
                <div className="h-1 bg-[var(--bg-tertiary)]">
                    <div 
                        className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Skip button */}
                {!isLastStep && (
                    <button
                        onClick={handleSkip}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                        title="Skip tutorial (Esc)"
                    >
                        <X size={20} weight="light" />
                    </button>
                )}

                {/* Content */}
                <div className="p-8">
                    {/* Step indicator */}
                    <div className="flex items-center justify-center gap-1.5 mb-6">
                        {TUTORIAL_STEPS.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentStep(index)}
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                    index === currentStep 
                                        ? 'w-6 bg-teal-500' 
                                        : index < currentStep 
                                            ? 'bg-teal-300' 
                                            : 'bg-[var(--bg-selected)]'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Icon */}
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${
                        isLastStep 
                            ? 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600'
                            : isFirstStep
                                ? 'bg-gradient-to-br from-[#84C4D1]/30 to-[#256A65]/20 text-[#256A65]'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    }`}>
                        {step.icon}
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-normal text-slate-800 text-center mb-3">
                        {step.title}
                    </h2>

                    {/* Description */}
                    <p className="text-[var(--text-secondary)] text-center leading-relaxed mb-8">
                        {step.description}
                    </p>

                    {/* Navigation buttons */}
                    <div className="flex items-center justify-between gap-4">
                        <button
                            onClick={handlePrev}
                            disabled={isFirstStep}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                                isFirstStep
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                        >
                            <CaretLeft size={18} weight="light" />
                            Back
                        </button>

                        <span className="text-sm text-slate-400">
                            {currentStep + 1} of {TUTORIAL_STEPS.length}
                        </span>

                        <button
                            onClick={handleNext}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                                isLastStep
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25'
                                    : 'bg-[var(--bg-selected)] text-[var(--text-primary)] hover:opacity-90 shadow-lg'
                            }`}
                        >
                            {isLastStep ? (
                                <>
                                    Get Started
                                    <Sparkle size={18} weight="light" />
                                </>
                            ) : (
                                <>
                                    Next
                                    <CaretRight size={18} weight="light" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Keyboard hint */}
                <div className="px-8 pb-4 text-center">
                    <p className="text-xs text-slate-400">
                        Use <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-slate-500">←</kbd> <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-slate-500">→</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-slate-500">Esc</kbd> to skip
                    </p>
                </div>
            </div>
        </div>
    );
}

