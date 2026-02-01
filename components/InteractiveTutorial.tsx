import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    X, 
    CaretRight, 
    CaretLeft,
    Sparkle,
    CursorClick,
    Hand,
    RocketLaunch,
    ChartLineUp,
    TreeStructure,
    Database,
    FileText,
    Gear,
    Lightning
} from '@phosphor-icons/react';

interface TutorialStep {
    id: string;
    title: string;
    description: string;
    targetSelector?: string;
    route?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    action?: 'click' | 'hover' | 'observe';
    waitForElement?: boolean;
    allowInteraction?: boolean;
    fullPage?: boolean;
    icon?: React.ElementType;
    emoji?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to Intemic!',
        description: 'Your all-in-one platform for automating manufacturing operations and regulatory compliance. Let\'s take a 2-minute tour.',
        position: 'center',
        icon: RocketLaunch,
        emoji: '👋'
    },
    {
        id: 'sidebar',
        title: 'Navigation',
        description: 'This sidebar is your command center. All major sections are just one click away.',
        targetSelector: '[data-tutorial="sidebar"]',
        route: '/dashboard',
        position: 'right',
        icon: Lightning,
    },
    {
        id: 'dashboards-nav',
        title: 'Dashboards',
        description: 'Click here to create custom analytics dashboards with charts, tables, and KPIs.',
        targetSelector: '[data-tutorial="nav-dashboard"]',
        route: '/dashboard',
        position: 'right',
        action: 'click',
        icon: ChartLineUp,
        emoji: '📊'
    },
    {
        id: 'dashboards-content',
        title: 'Build Visual Insights',
        description: 'Create interactive dashboards powered by your data. Just describe what you want to see — AI handles the rest with zero hallucination.',
        targetSelector: '[data-tutorial="dashboard-content"]',
        route: '/dashboard',
        position: 'bottom',
        waitForElement: true,
        icon: ChartLineUp,
    },
    {
        id: 'workflows-nav',
        title: 'Workflows',
        description: 'Click here to discover where the magic happens — build automated data pipelines with our visual editor.',
        targetSelector: '[data-tutorial="nav-workflows"]',
        route: '/dashboard',
        position: 'right',
        action: 'click',
        icon: TreeStructure,
        emoji: '⚡'
    },
    {
        id: 'workflows-list',
        title: 'Your Automation Hub',
        description: 'All your workflows in one place. Start from templates or create custom pipelines from scratch.',
        targetSelector: '[data-tutorial="workflows-content"]',
        route: '/workflows',
        position: 'bottom',
        waitForElement: true,
        icon: TreeStructure,
    },
    {
        id: 'create-workflow',
        title: 'Create a Workflow',
        description: 'Click to open the visual editor and start building your first automated pipeline.',
        targetSelector: '[data-tutorial="create-workflow"]',
        route: '/workflows',
        position: 'center',
        action: 'click',
        waitForElement: true,
        icon: TreeStructure,
    },
    {
        id: 'workflow-editor',
        title: 'Visual Workflow Builder',
        description: 'Drag components from the left panel onto the canvas. Connect them to build powerful automation flows. Try it now!',
        targetSelector: '[data-tutorial="workflow-editor"]',
        route: '/workflow/new',
        position: 'center',
        waitForElement: true,
        allowInteraction: true,
        fullPage: true,
        icon: Hand,
        emoji: '🎯'
    },
    {
        id: 'database-nav',
        title: 'Database',
        description: 'Click here to manage your data structure — entities, properties, and relationships.',
        targetSelector: '[data-tutorial="nav-database"]',
        position: 'right',
        action: 'click',
        icon: Database,
    },
    {
        id: 'database-content',
        title: 'Your Data Foundation',
        description: 'Define entities like Customers, Products, Assets — each with custom properties. These power your dashboards, workflows, and reports.',
        targetSelector: '[data-tutorial="database-main"]',
        route: '/database',
        position: 'left',
        waitForElement: true,
        icon: Database,
    },
    {
        id: 'reports-nav',
        title: 'Reports',
        description: 'Click to explore AI-powered report generation.',
        targetSelector: '[data-tutorial="nav-reports"]',
        route: '/database',
        position: 'right',
        action: 'click',
        icon: FileText,
        emoji: '📄'
    },
    {
        id: 'reports-content',
        title: 'Professional Reports',
        description: 'Generate polished reports for stakeholders, compliance, or process improvement. AI writes, your database provides the facts.',
        targetSelector: '[data-tutorial="reports-content"]',
        route: '/reports',
        position: 'left',
        waitForElement: true,
        icon: FileText,
    },
    {
        id: 'settings-nav',
        title: 'Settings',
        description: 'Click to configure your team and preferences.',
        targetSelector: '[data-tutorial="nav-settings"]',
        route: '/reports',
        position: 'right',
        action: 'click',
        icon: Gear,
    },
    {
        id: 'settings-content',
        title: 'Team & Preferences',
        description: 'Invite colleagues, manage roles, and customize your workspace here.',
        targetSelector: '[data-tutorial="settings-content"]',
        route: '/settings',
        position: 'center',
        waitForElement: true,
        icon: Gear,
    },
    {
        id: 'complete',
        title: 'You\'re All Set!',
        description: 'Start exploring and building. You can restart this tour anytime from Settings → General.',
        position: 'center',
        icon: RocketLaunch,
        emoji: '🎉'
    },
];

interface InteractiveTutorialProps {
    onComplete: () => void;
    onSkip: () => void;
}

export function InteractiveTutorial({ onComplete, onSkip }: InteractiveTutorialProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const step = TUTORIAL_STEPS[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
    const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

    // Find and highlight target element
    const updateTargetPosition = useCallback(() => {
        if (!step.targetSelector) {
            setTargetRect(null);
            return;
        }

        const element = document.querySelector(step.targetSelector);
        if (element) {
            const rect = element.getBoundingClientRect();
            setTargetRect(rect);
        } else {
            setTargetRect(null);
        }
    }, [step.targetSelector]);

    // Navigate to the correct route
    useEffect(() => {
        if (step.route && location.pathname !== step.route) {
            setIsTransitioning(true);
            navigate(step.route);
            setTimeout(() => {
                setIsTransitioning(false);
                updateTargetPosition();
            }, 300);
        } else {
            updateTargetPosition();
        }
    }, [step, navigate, location.pathname, updateTargetPosition]);

    // Update position on resize/scroll
    useEffect(() => {
        const handleUpdate = () => updateTargetPosition();
        window.addEventListener('resize', handleUpdate);
        window.addEventListener('scroll', handleUpdate, true);
        
        const interval = setInterval(handleUpdate, 500);

        return () => {
            window.removeEventListener('resize', handleUpdate);
            window.removeEventListener('scroll', handleUpdate, true);
            clearInterval(interval);
        };
    }, [updateTargetPosition]);

    // Wait for element to appear
    useEffect(() => {
        if (step.waitForElement && step.targetSelector) {
            const checkElement = setInterval(() => {
                const element = document.querySelector(step.targetSelector!);
                if (element) {
                    updateTargetPosition();
                    clearInterval(checkElement);
                }
            }, 100);
            
            return () => clearInterval(checkElement);
        }
    }, [step, updateTargetPosition]);

    // Handle clicks on the highlighted element for 'click' action steps
    const handleHighlightClick = useCallback(() => {
        if (step.action !== 'click' || !step.targetSelector) return;
        
        const element = document.querySelector(step.targetSelector) as HTMLElement;
        if (element) {
            element.click();
        }
        
        setTimeout(() => {
            setCurrentStep(prev => prev + 1);
        }, 150);
    }, [step]);

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            if (step.action === 'click' && step.targetSelector) {
                const element = document.querySelector(step.targetSelector) as HTMLElement;
                if (element) {
                    element.click();
                }
            }
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    // Calculate tooltip position
    const getTooltipStyle = (): React.CSSProperties => {
        if (!targetRect || step.position === 'center') {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            };
        }

        const padding = 24;
        const tooltipWidth = 380;
        const tooltipHeight = 320;
        
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const safeBottom = viewportHeight - tooltipHeight - padding;
        const safeRight = viewportWidth - tooltipWidth - padding;

        let top: number;
        let left: number;

        switch (step.position) {
            case 'right':
                top = targetRect.top;
                left = targetRect.right + padding;
                break;
            case 'left':
                top = targetRect.top;
                left = targetRect.left - tooltipWidth - padding;
                break;
            case 'bottom':
                top = targetRect.bottom + padding;
                left = targetRect.left;
                break;
            case 'top':
                top = targetRect.top - tooltipHeight - padding;
                left = targetRect.left;
                break;
            default:
                top = viewportHeight / 2 - tooltipHeight / 2;
                left = viewportWidth / 2 - tooltipWidth / 2;
        }

        top = Math.max(padding, Math.min(top, safeBottom));
        left = Math.max(padding, Math.min(left, safeRight));

        return {
            position: 'fixed',
            top,
            left,
        };
    };

    // Get spotlight clip path
    const getSpotlightClipPath = (): string => {
        if (!targetRect) return '';
        
        const padding = 8;
        const x = targetRect.left - padding;
        const y = targetRect.top - padding;
        const width = targetRect.width + padding * 2;
        const height = targetRect.height + padding * 2;
        const radius = 12;

        return `
            polygon(
                0% 0%, 
                0% 100%, 
                ${x}px 100%, 
                ${x}px ${y + radius}px,
                ${x + radius}px ${y}px,
                ${x + width - radius}px ${y}px,
                ${x + width}px ${y + radius}px,
                ${x + width}px ${y + height - radius}px,
                ${x + width - radius}px ${y + height}px,
                ${x + radius}px ${y + height}px,
                ${x}px ${y + height - radius}px,
                ${x}px 100%,
                100% 100%, 
                100% 0%
            )
        `;
    };

    const Icon = step.icon || Sparkle;

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Overlay with spotlight cutout */}
            <div 
                className={`absolute inset-0 transition-all duration-300 pointer-events-none ${
                    step.fullPage ? 'bg-black/40' : 'bg-black/60'
                }`}
                style={targetRect && !step.fullPage ? { clipPath: getSpotlightClipPath() } : {}}
            />

            {/* Highlight border around target */}
            {targetRect && !step.fullPage && (
                <div
                    className="absolute rounded-xl pointer-events-none transition-all duration-300"
                    style={{
                        left: targetRect.left - 8,
                        top: targetRect.top - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                        border: '2px solid var(--accent-primary)',
                        boxShadow: '0 0 0 4px rgba(37, 106, 101, 0.15), 0 0 30px rgba(37, 106, 101, 0.2)',
                    }}
                />
            )}

            {/* Clickable area for 'click' action steps */}
            {targetRect && step.action === 'click' && !step.fullPage && (
                <div
                    onClick={handleHighlightClick}
                    className="absolute cursor-pointer rounded-xl transition-all duration-300 pointer-events-auto"
                    style={{
                        left: targetRect.left - 8,
                        top: targetRect.top - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                    }}
                />
            )}

            {/* Tooltip Card */}
            <div
                className="w-[380px] bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 pointer-events-auto"
                style={getTooltipStyle()}
            >
                {/* Progress bar */}
                <div className="h-1 bg-[var(--bg-tertiary)]">
                    <div 
                        className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-emerald-400 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                {step.emoji ? (
                                    <span className="text-xl">{step.emoji}</span>
                                ) : (
                                    <Icon size={20} className="text-[var(--accent-primary)]" weight="duotone" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)]">
                                <Sparkle size={12} className="text-[var(--accent-primary)]" weight="fill" />
                                {currentStep + 1} / {TUTORIAL_STEPS.length}
                            </div>
                        </div>
                        <button
                            onClick={onSkip}
                            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                            title="Skip tour"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                        {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
                        {step.description}
                    </p>

                    {/* Action hint */}
                    {(step.fullPage || step.action === 'click') && (
                        <div className="flex items-center gap-2 text-xs text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-4 py-3 rounded-xl mb-5 border border-[var(--accent-primary)]/20">
                            {step.fullPage ? (
                                <>
                                    <Hand size={16} weight="fill" />
                                    <span>Try dragging components onto the canvas!</span>
                                </>
                            ) : (
                                <>
                                    <CursorClick size={16} weight="fill" />
                                    <span>Click the highlighted element</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handlePrev}
                            disabled={isFirstStep}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isFirstStep
                                    ? 'text-[var(--text-tertiary)] cursor-not-allowed'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                        >
                            <CaretLeft size={16} weight="bold" />
                            Back
                        </button>

                        {/* Step dots */}
                        <div className="flex gap-1">
                            {TUTORIAL_STEPS.map((_, index) => (
                                <div
                                    key={index}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                        index === currentStep
                                            ? 'w-4 bg-[var(--accent-primary)]'
                                            : index < currentStep
                                                ? 'w-1.5 bg-[var(--accent-primary)]/50'
                                                : 'w-1.5 bg-[var(--border-medium)]'
                                    }`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                isLastStep
                                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 text-white shadow-lg shadow-[var(--accent-primary)]/20'
                                    : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]'
                            }`}
                        >
                            {isLastStep ? 'Let\'s Go!' : 'Next'}
                            <CaretRight size={16} weight="bold" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading state during transitions */}
            {isTransitioning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] flex items-center justify-center shadow-xl">
                        <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                    </div>
                </div>
            )}
        </div>
    );
}
