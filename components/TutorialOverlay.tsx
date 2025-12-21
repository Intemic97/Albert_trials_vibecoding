import React, { useState, useEffect } from 'react';
import { 
    X, 
    ChevronRight, 
    ChevronLeft,
    LayoutDashboard, 
    BarChart3, 
    GitBranch, 
    Database, 
    FileText,
    Settings,
    Sparkles,
    CheckCircle
} from 'lucide-react';

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
        icon: <Sparkles className="w-8 h-8" />,
    },
    {
        id: 'overview',
        title: 'Overview Dashboard',
        description: 'Your command center. See key metrics, pending approvals, and quick access to your most important workflows. Customize KPIs to track what matters most to your business.',
        icon: <LayoutDashboard className="w-8 h-8" />,
        highlight: 'overview'
    },
    {
        id: 'dashboards',
        title: 'Dashboards',
        description: 'Create beautiful, interactive dashboards with charts and visualizations. Share them with your team or make them public with a single click.',
        icon: <BarChart3 className="w-8 h-8" />,
        highlight: 'dashboards'
    },
    {
        id: 'workflows',
        title: 'Workflows',
        description: 'The heart of Intemic. Build automated workflows with our visual drag-and-drop editor. Connect data sources, add transformations, and set up triggers - no coding required.',
        icon: <GitBranch className="w-8 h-8" />,
        highlight: 'workflows'
    },
    {
        id: 'database',
        title: 'Database',
        description: 'Define your data structure with custom entities and properties. Think of it as your own flexible database schema that adapts to your business needs.',
        icon: <Database className="w-8 h-8" />,
        highlight: 'database'
    },
    {
        id: 'reports',
        title: 'Reports',
        description: 'Generate detailed reports from your data. Export to various formats and schedule automatic report generation to keep stakeholders informed.',
        icon: <FileText className="w-8 h-8" />,
        highlight: 'reports'
    },
    {
        id: 'settings',
        title: 'Settings',
        description: 'Manage your profile, team members, and organization settings. Invite colleagues to collaborate and control access permissions.',
        icon: <Settings className="w-8 h-8" />,
        highlight: 'settings'
    },
    {
        id: 'complete',
        title: "You're all set! 🎉",
        description: "You've completed the tour. Start exploring and building amazing workflows. Need help? Click the Documentation link in the sidebar anytime.",
        icon: <CheckCircle className="w-8 h-8" />,
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
                <div className="h-1 bg-slate-100">
                    <div 
                        className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Skip button */}
                {!isLastStep && (
                    <button
                        onClick={handleSkip}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Skip tutorial (Esc)"
                    >
                        <X size={20} />
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
                                            : 'bg-slate-200'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Icon */}
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center ${
                        isLastStep 
                            ? 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600'
                            : isFirstStep
                                ? 'bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600'
                                : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600'
                    }`}>
                        {step.icon}
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-slate-800 text-center mb-3">
                        {step.title}
                    </h2>

                    {/* Description */}
                    <p className="text-slate-600 text-center leading-relaxed mb-8">
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
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <ChevronLeft size={18} />
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
                                    : 'bg-gradient-to-r from-slate-700 to-slate-800 text-white hover:from-slate-600 hover:to-slate-700 shadow-lg shadow-slate-500/25'
                            }`}
                        >
                            {isLastStep ? (
                                <>
                                    Get Started
                                    <Sparkles size={18} />
                                </>
                            ) : (
                                <>
                                    Next
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Keyboard hint */}
                <div className="px-8 pb-4 text-center">
                    <p className="text-xs text-slate-400">
                        Use <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">←</kbd> <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">→</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">Esc</kbd> to skip
                    </p>
                </div>
            </div>
        </div>
    );
}

