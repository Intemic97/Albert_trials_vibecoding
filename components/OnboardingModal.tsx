import React, { useState } from 'react';
import { Sparkles, Briefcase, Building2, Target, Megaphone, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface OnboardingModalProps {
    onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
    const { user, completeOnboarding } = useAuth();
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        role: '',
        industry: '',
        useCase: '',
        source: ''
    });

    const questions = [
        {
            key: 'role',
            icon: Briefcase,
            title: 'What is your role?',
            placeholder: 'e.g., IT Manager, Data Analyst, Process Engineer, Operations Manager...',
            color: 'blue'
        },
        {
            key: 'industry',
            icon: Building2,
            title: 'In what industry do you work?',
            placeholder: 'e.g., Food & Beverage, Chemical Manufacturing, Water Treatment, Pharma...',
            color: 'purple'
        },
        {
            key: 'useCase',
            icon: Target,
            title: 'Do you have any use case in mind?',
            placeholder: 'e.g., Automated Reporting, Design of Experiments, Process Optimization, Data Warehouse & BI...',
            color: 'teal'
        },
        {
            key: 'source',
            icon: Megaphone,
            title: 'How did you hear about us?',
            placeholder: 'e.g., LinkedIn, Email, Congress, From a Friend, Google Search...',
            color: 'orange'
        }
    ];

    const currentQuestion = questions[step];
    const isLastStep = step === questions.length - 1;
    const canProceed = formData[currentQuestion.key as keyof typeof formData].trim().length > 0;

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

    const handleInputChange = (value: string) => {
        setFormData(prev => ({
            ...prev,
            [currentQuestion.key]: value
        }));
    };

    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; icon: string; border: string; ring: string }> = {
            blue: { bg: 'bg-slate-50', icon: 'text-slate-900', border: 'border-slate-200', ring: 'ring-slate-300' },
            purple: { bg: 'bg-slate-50', icon: 'text-slate-900', border: 'border-slate-200', ring: 'ring-slate-300' },
            teal: { bg: 'bg-slate-50', icon: 'text-slate-900', border: 'border-slate-200', ring: 'ring-slate-300' },
            orange: { bg: 'bg-slate-50', icon: 'text-slate-900', border: 'border-slate-200', ring: 'ring-slate-300' }
        };
        return colors[color] || colors.blue;
    };

    const colors = getColorClasses(currentQuestion.color);
    const Icon = currentQuestion.icon;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 text-slate-900 border-b border-slate-200 bg-white">
                    <div>
                        <h1 className="text-lg font-normal">Welcome to Intemic</h1>
                        <p className="text-slate-500 text-xs">Hi {user?.name}, let's get to know you</p>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="flex gap-2 mt-4">
                        {questions.map((_, i) => (
                            <div 
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                    i <= step ? 'bg-slate-900' : 'bg-slate-200'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-50 rounded-md mb-3 border border-slate-200">
                            <Icon size={14} className="text-slate-600" />
                            <span className="text-xs font-medium text-slate-600">
                                Question {step + 1} of {questions.length}
                            </span>
                        </div>
                        
                        <h2 className="text-base font-normal text-slate-900 mb-2 tracking-tight">
                            {currentQuestion.title}
                        </h2>
                    </div>

                    <input
                        type="text"
                        value={formData[currentQuestion.key as keyof typeof formData]}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder={currentQuestion.placeholder}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 transition-all bg-white text-slate-900 placeholder:text-slate-400 text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && canProceed) {
                                handleNext();
                            }
                        }}
                        autoFocus
                    />

                    <p className="text-[11px] text-slate-400 mt-2 italic">
                        {currentQuestion.placeholder}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex justify-between items-center">
                    <button
                        onClick={() => step > 0 && setStep(step - 1)}
                        className={`text-xs text-slate-500 hover:text-slate-700 transition-colors ${
                            step === 0 ? 'invisible' : ''
                        }`}
                    >
                        ← Back
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed || isSubmitting}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : isLastStep ? (
                            <>
                                <span>Get Started</span>
                                <Sparkles size={18} />
                            </>
                        ) : (
                            <>
                                <span>Continue</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
