import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    X, 
    CaretRight, 
    CaretLeft,
    Sparkle,
    CursorClick,
    DotsSixVertical
} from '@phosphor-icons/react';

interface TutorialMedia {
    type: 'video' | 'gif' | 'image';
    src: string; // Path to the media file (e.g., '/tutorial/drag-drop.mp4')
    alt?: string; // Alt text for accessibility
}

interface TutorialStep {
    id: string;
    title: string;
    description: string;
    targetSelector?: string; // CSS selector for the element to highlight
    route?: string; // Route to navigate to
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    action?: 'click' | 'hover' | 'observe'; // What the user should do
    waitForElement?: boolean; // Wait for the element to appear
    media?: TutorialMedia; // Optional video/gif/image to show
    allowInteraction?: boolean; // Allow user to interact with highlighted area (no overlay blocking)
    fullPage?: boolean; // Highlight the entire page content area (no spotlight)
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to Intemic! 👋',
        description: 'Intemic helps manufacturing companies to automate their operations and regulatory compliance, reducing time and costs. Let\'s take a quick tour of the platform. We\'ll guide you through each section step by step.',
        position: 'center',
    },
    {
        id: 'sidebar',
        title: 'Navigation Sidebar',
        description: 'This is your main navigation. Click on any section to explore different parts of the platform.',
        targetSelector: '[data-tutorial="sidebar"]',
        route: '/dashboard',
        position: 'right',
    },
    {
        id: 'dashboards-nav',
        title: 'Dashboards Section',
        description: 'Click on "Dashboards" to create custom analytics views with charts, tables, and KPIs.',
        targetSelector: '[data-tutorial="nav-dashboard"]',
        route: '/dashboard',
        position: 'right',
        action: 'click',
    },
    {
        id: 'dashboards-content',
        title: 'Custom Dashboards 📊',
        description: 'Build interactive dashboards that you can share with your team. Just by writting a prompt, add charts, tables, and insights powered by your database entities, with zero hallucination.',
        targetSelector: '[data-tutorial="dashboard-content"]',
        route: '/dashboard',
        position: 'bottom',
        waitForElement: true,
    },
    {
        id: 'workflows-nav',
        title: 'Workflows Section',
        description: 'Click on "Workflows" to see where the magic happens - build automated, agentic data pipelines with our visual editor.',
        targetSelector: '[data-tutorial="nav-workflows"]',
        route: '/dashboard',
        position: 'right',
        action: 'click',
    },
    {
        id: 'workflows-list',
        title: 'Your Workflows',
        description: 'Here you can see all your workflows. You can start with pre-built templates or create your own from scratch.',
        targetSelector: '[data-tutorial="workflows-content"]',
        route: '/workflows',
        position: 'bottom',
        waitForElement: true,
    },
    {
        id: 'create-workflow',
        title: 'Create Your First Workflow',
        description: 'Click here to create a new workflow. This opens the visual editor where you can build your data pipeline.',
        targetSelector: '[data-tutorial="create-workflow"]',
        route: '/workflows',
        position: 'center',
        action: 'click',
        waitForElement: true,
    },
    {
        id: 'workflow-editor',
        title: 'Build Your Workflows! 🎯',
        description: 'This is the workflow editor. On the left you have the Components panel with all the building blocks. On the right is the Canvas where you build your workflows, in real-time collaboration if you are with your colleagues.\n\nTry it now! Drag a component from the left and drop it on the canvas.',
        targetSelector: '[data-tutorial="workflow-editor"]',
        route: '/workflow/new',
        position: 'center',
        waitForElement: true,
        allowInteraction: true,
        fullPage: true,
        // To add a video: media: { type: 'video', src: '/tutorial/drag-drop-demo.mp4' }
    },
    {
        id: 'database-nav',
        title: 'Database Section',
        description: 'Now let\'s check the Database. Click here to define your data structure with custom entities and properties.',
        targetSelector: '[data-tutorial="nav-database"]',
        position: 'right',
        action: 'click',
    },
    {
        id: 'database-content',
        title: 'Data Structures',
        description: 'Your company has many different entities: Customers, Products, Orders, Factories, Assets, etc... All of them with their custom properties and relationships. Create and manage your own entities and its properties, which can be used in dashboards, workflows and reports.',
        targetSelector: '[data-tutorial="database-main"]',
        route: '/database',
        position: 'left',
        waitForElement: true,
    },
    {
        id: 'reports-nav',
        title: 'Reports Section',
        description: 'Click on "Reports" to generate AI-powered insights and analysis from your data.',
        targetSelector: '[data-tutorial="nav-reports"]',
        route: '/database',
        position: 'right',
        action: 'click',
    },
    {
        id: 'reports-content',
        title: 'AI Reports 📄',
        description: 'Generate professional reports with AI assistance. Choose from templates or create custom reports that can be used for stakeholder presentations, regulatory compliance or internal data-driven process improvement. Again, reading from your database to ensure zero hallucinations.',
        targetSelector: '[data-tutorial="reports-content"]',
        route: '/reports',
        position: 'left',
        waitForElement: true,
    },
    {
        id: 'settings-nav',
        title: 'Settings',
        description: 'Click on "Settings" to manage your team, profile, and organization preferences.',
        targetSelector: '[data-tutorial="nav-settings"]',
        route: '/reports',
        position: 'right',
        action: 'click',
    },
    {
        id: 'settings-content',
        title: 'Team Management',
        description: 'Invite team members, manage roles, and configure your organization settings here.',
        targetSelector: '[data-tutorial="settings-content"]',
        route: '/settings',
        position: 'center',
        waitForElement: true,
    },
    {
        id: 'complete',
        title: 'You\'re Ready! 🎉',
        description: 'That\'s the tour! Start exploring and building amazing workflows. You can restart this tutorial anytime from Settings > General.',
        position: 'center',
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
            // Wait for navigation and DOM update
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
        
        // Also update periodically in case elements move
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
        
        // Trigger the actual element's click handler
        const element = document.querySelector(step.targetSelector) as HTMLElement;
        if (element) {
            element.click();
        }
        
        // Advance to next step after a small delay
        setTimeout(() => {
            setCurrentStep(prev => prev + 1);
        }, 150);
    }, [step]);

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            // If this step has action: 'click', trigger the click and advance
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

    const handleSkip = () => {
        onSkip();
    };

    // Calculate tooltip position - ensure it's always fully visible
    const getTooltipStyle = (): React.CSSProperties => {
        if (!targetRect || step.position === 'center') {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            };
        }

        const padding = 20;
        const tooltipWidth = step.media ? 420 : 360;
        // More accurate height estimate based on content
        const baseHeight = 280; // Base height for title, description, buttons
        const mediaHeight = step.media ? 200 : 0;
        const hintHeight = targetRect ? 50 : 0;
        const tooltipHeight = baseHeight + mediaHeight + hintHeight;
        
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const safeBottom = viewportHeight - tooltipHeight - padding;
        const safeRight = viewportWidth - tooltipWidth - padding;

        // Calculate ideal position based on step.position
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

        // Clamp to ensure tooltip stays within viewport
        // Ensure it doesn't go below the viewport (most important!)
        top = Math.max(padding, Math.min(top, safeBottom));
        // Ensure it doesn't go off the right edge
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

        // Create a rounded rectangle cutout
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

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Overlay with spotlight cutout - always allows interaction with highlighted area */}
            {step.fullPage ? (
                // Full page mode: light overlay, no spotlight
                <div 
                    className="absolute inset-0 bg-slate-950/40 transition-all duration-300 pointer-events-none"
                />
            ) : (
                // Normal mode: spotlight cutout - the cutout area is naturally interactive
                <div 
                    className="absolute inset-0 bg-slate-950/70 transition-all duration-300 pointer-events-none"
                    style={targetRect ? { clipPath: getSpotlightClipPath() } : {}}
                />
            )}

            {/* Highlight border around target - only when not full page */}
            {targetRect && !step.fullPage && (
                <div
                    className="absolute border-2 border-teal-400 rounded-xl pointer-events-none transition-all duration-300 animate-pulse"
                    style={{
                        left: targetRect.left - 8,
                        top: targetRect.top - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                        boxShadow: '0 0 0 4px rgba(20, 184, 166, 0.2), 0 0 20px rgba(20, 184, 166, 0.3)',
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

            {/* Tooltip */}
            <div
                className={`${step.media ? 'w-[420px]' : 'w-[360px]'} bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 pointer-events-auto`}
                style={{
                    ...getTooltipStyle(),
                    maxHeight: 'calc(100vh - 40px)', // Never exceed viewport height
                }}
            >
                {/* Progress bar */}
                <div className="h-1 bg-[var(--bg-tertiary)] shrink-0">
                    <div 
                        className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Content - scrollable if too tall */}
                <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
                    {/* Step indicator */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-teal-600">
                            <Sparkle size={16} weight="light" />
                            <span className="text-xs font-medium">
                                Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                            </span>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="text-slate-400 hover:text-[var(--text-secondary)] p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                            title="Skip tutorial"
                        >
                            <X size={18} weight="light" />
                        </button>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-normal text-slate-800 mb-2">
                        {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-4">
                        {step.description}
                    </p>

                    {/* Media (video/gif/image) */}
                    {step.media && (
                        <div className="mb-4 rounded-lg overflow-hidden border border-slate-200 bg-[var(--bg-tertiary)]">
                            {step.media.type === 'video' ? (
                                <video
                                    src={step.media.src}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="w-full h-auto max-h-[180px] object-contain"
                                >
                                    Your browser does not support the video tag.
                                </video>
                            ) : (
                                <img
                                    src={step.media.src}
                                    alt={step.media.alt || step.title}
                                    className="w-full h-auto max-h-[180px] object-contain"
                                />
                            )}
                        </div>
                    )}

                    {/* Action hint */}
                    {(step.fullPage || step.action === 'click') && (
                        <div className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 px-3 py-2 rounded-lg mb-4">
                            {step.fullPage ? (
                                <>
                                    <DotsSixVertical size={14} weight="light" />
                                    <span>Try it! Drag components onto the canvas, then click Next</span>
                                </>
                            ) : (
                                <>
                                    <CursorClick size={14} weight="light" />
                                    <span>Click the highlighted element to continue</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handlePrev}
                            disabled={isFirstStep}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isFirstStep
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                        >
                            <CaretLeft size={16} weight="light" />
                            Back
                        </button>

                        <div className="flex gap-1">
                            {TUTORIAL_STEPS.map((_, index) => (
                                <div
                                    key={index}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                                        index === currentStep
                                            ? 'w-4 bg-teal-500'
                                            : index < currentStep
                                                ? 'bg-teal-300'
                                                : 'bg-[var(--bg-selected)]'
                                    }`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isLastStep
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600'
                                    : 'bg-slate-800 text-white hover:bg-slate-700'
                            }`}
                        >
                            {isLastStep ? 'Finish' : 'Next'}
                            <CaretRight size={16} weight="light" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading state during transitions */}
            {isTransitioning && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}

