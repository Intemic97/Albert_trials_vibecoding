/**
 * SidePanel Component
 * 
 * Panel lateral reutilizable con animaciones y soporte para dark/light mode.
 * Se usa para mostrar configuraciones, detalles o formularios sin salir de la vista actual.
 * 
 * @example
 * <SidePanel
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Panel Title"
 *   icon={Gear}
 * >
 *   <p>Content goes here</p>
 * </SidePanel>
 */
import React, { ReactNode, useEffect, useRef, useCallback, useState } from 'react';
import { X } from '@phosphor-icons/react';

// ============================================================================
// TYPES
// ============================================================================

export type SidePanelSize = 'sm' | 'md' | 'lg' | 'xl';
export type SidePanelPosition = 'right' | 'left';

interface SidePanelProps {
    /** Whether the panel is open */
    isOpen: boolean;
    /** Callback when the panel should close */
    onClose: () => void;
    /** Panel title */
    title?: string;
    /** Optional subtitle/description */
    description?: string;
    /** Icon component to display in header */
    icon?: React.ComponentType<any>;
    /** Background color for icon container */
    iconBgColor?: string;
    /** Icon color */
    iconColor?: string;
    /** Panel content */
    children: ReactNode;
    /** Footer content (buttons, actions) */
    footer?: ReactNode;
    /** Panel width preset */
    size?: SidePanelSize;
    /** Custom width (overrides size) */
    width?: string;
    /** Panel position */
    position?: SidePanelPosition;
    /** Whether to show overlay behind panel */
    showOverlay?: boolean;
    /** Whether to close on overlay click */
    closeOnOverlayClick?: boolean;
    /** Whether to close on Escape key */
    closeOnEscape?: boolean;
    /** Top offset (for navigation bar) */
    topOffset?: string;
    /** Additional class names for panel container */
    className?: string;
    /** Z-index for the panel */
    zIndex?: number;
}

// Size mappings
const SIZE_MAP: Record<SidePanelSize, string> = {
    sm: 'w-[320px]',
    md: 'w-[420px]',
    lg: 'w-[560px]',
    xl: 'w-[700px]',
};

// ============================================================================
// COMPONENT
// ============================================================================

export const SidePanel: React.FC<SidePanelProps> = ({
    isOpen,
    onClose,
    title,
    description,
    icon: Icon,
    iconBgColor,
    iconColor,
    children,
    footer,
    size = 'lg',
    width,
    position = 'right',
    showOverlay = true,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    topOffset = '63px',
    className = '',
    zIndex = 40,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    // Handle open/close animations
    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            // Small delay to trigger animation
            requestAnimationFrame(() => {
                setIsAnimating(true);
            });
        } else if (shouldRender) {
            setIsAnimating(false);
            // Wait for animation to complete before unmounting
            const timer = setTimeout(() => {
                setShouldRender(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, shouldRender]);

    // Handle Escape key
    useEffect(() => {
        if (!isOpen || !closeOnEscape) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, closeOnEscape, onClose]);

    // Handle click outside
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    }, [closeOnOverlayClick, onClose]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    if (!shouldRender) return null;

    const panelWidth = width || SIZE_MAP[size];
    const translateClass = position === 'right' 
        ? (isAnimating ? 'translate-x-0' : 'translate-x-full')
        : (isAnimating ? 'translate-x-0' : '-translate-x-full');
    const positionClass = position === 'right' ? 'right-0' : 'left-0';
    const borderClass = position === 'right' ? 'border-l' : 'border-r';

    return (
        <>
            {/* Overlay */}
            {showOverlay && (
                <div
                    className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
                        isAnimating ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{ zIndex: zIndex - 1 }}
                    onClick={handleOverlayClick}
                    aria-hidden="true"
                />
            )}

            {/* Panel */}
            <div
                ref={panelRef}
                className={`
                    fixed ${positionClass} ${panelWidth} 
                    bg-[var(--bg-card)] ${borderClass} border-[var(--border-light)] 
                    flex flex-col shadow-2xl
                    transform transition-transform duration-300 ease-out
                    ${translateClass}
                    ${className}
                `}
                style={{
                    top: topOffset,
                    height: `calc(100vh - ${topOffset})`,
                    maxHeight: `calc(100vh - ${topOffset})`,
                    zIndex,
                }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'sidepanel-title' : undefined}
            >
                {/* Header */}
                {(title || Icon) && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-light)] shrink-0 bg-[var(--bg-card)]">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            {Icon && (
                                <div 
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        iconBgColor || 'bg-[var(--bg-tertiary)]'
                                    }`}
                                >
                                    <Icon 
                                        size={18} 
                                        weight="light" 
                                        className={iconColor || 'text-[var(--text-secondary)]'} 
                                    />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                {title && (
                                    <h3 
                                        id="sidepanel-title"
                                        className="text-sm font-medium text-[var(--text-primary)] truncate"
                                        style={{ fontFamily: "'Berkeley Mono', monospace" }}
                                    >
                                        {title}
                                    </h3>
                                )}
                                {description && (
                                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-1">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors shrink-0 ml-3 group"
                            aria-label="Close panel"
                        >
                            <X 
                                size={16} 
                                weight="light" 
                                className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]" 
                            />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border-light)] shrink-0 bg-[var(--bg-card)]">
                        {footer}
                    </div>
                )}
            </div>
        </>
    );
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface SidePanelContentProps {
    children: ReactNode;
    className?: string;
    noPadding?: boolean;
}

export const SidePanelContent: React.FC<SidePanelContentProps> = ({
    children,
    className = '',
    noPadding = false,
}) => (
    <div className={`${noPadding ? '' : 'px-4 py-4'} ${className}`}>
        {children}
    </div>
);

interface SidePanelSectionProps {
    title?: string;
    description?: string;
    children: ReactNode;
    className?: string;
}

export const SidePanelSection: React.FC<SidePanelSectionProps> = ({
    title,
    description,
    children,
    className = '',
}) => (
    <div className={`mb-5 ${className}`}>
        {title && (
            <h4 className="text-xs font-medium text-[var(--text-primary)] mb-1.5">
                {title}
            </h4>
        )}
        {description && (
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
                {description}
            </p>
        )}
        {children}
    </div>
);

interface SidePanelDividerProps {
    className?: string;
}

export const SidePanelDivider: React.FC<SidePanelDividerProps> = ({
    className = '',
}) => (
    <div className={`border-t border-[var(--border-light)] my-4 ${className}`} />
);

// ============================================================================
// EXPORTS
// ============================================================================

export default SidePanel;
