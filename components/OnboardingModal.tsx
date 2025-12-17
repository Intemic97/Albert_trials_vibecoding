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
            blue: { bg: 'bg-blue-100', icon: 'text-blue-600', border: 'border-blue-200', ring: 'ring-blue-500' },
            purple: { bg: 'bg-purple-100', icon: 'text-purple-600', border: 'border-purple-200', ring: 'ring-purple-500' },
            teal: { bg: 'bg-teal-100', icon: 'text-teal-600', border: 'border-teal-200', ring: 'ring-teal-500' },
            orange: { bg: 'bg-orange-100', icon: 'text-orange-600', border: 'border-orange-200', ring: 'ring-orange-500' }
        };
        return colors[color] || colors.blue;
    };

    const colors = getColorClasses(currentQuestion.color);
    const Icon = currentQuestion.icon;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-gradient-to-br from-teal-500 to-teal-600 px-6 py-8 text-white">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Welcome to Intemic!</h1>
                            <p className="text-teal-100 text-sm">Hi {user?.name}, let's get to know you</p>
                        </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="flex gap-2">
                        {questions.map((_, i) => (
                            <div 
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                    i <= step ? 'bg-white' : 'bg-white/30'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 ${colors.bg} rounded-full mb-4`}>
                            <Icon size={16} className={colors.icon} />
                            <span className={`text-sm font-medium ${colors.icon}`}>
                                Question {step + 1} of {questions.length}
                            </span>
                        </div>
                        
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">
                            {currentQuestion.title}
                        </h2>
                    </div>

                    <input
                        type="text"
                        value={formData[currentQuestion.key as keyof typeof formData]}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder={currentQuestion.placeholder}
                        className={`w-full px-4 py-3 border-2 ${colors.border} rounded-xl focus:outline-none focus:ring-2 ${colors.ring} focus:border-transparent transition-all text-slate-800 placeholder:text-slate-400`}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && canProceed) {
                                handleNext();
                            }
                        }}
                        autoFocus
                    />

                    <p className="text-xs text-slate-400 mt-2 italic">
                        {currentQuestion.placeholder}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex justify-between items-center">
                    <button
                        onClick={() => step > 0 && setStep(step - 1)}
                        className={`text-sm text-slate-500 hover:text-slate-700 transition-colors ${
                            step === 0 ? 'invisible' : ''
                        }`}
                    >
                        ← Back
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed || isSubmitting}
                        className={`flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:from-teal-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/25`}
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
