/**
 * SidePanel Component
 * 
 * Panel lateral reutilizable con animaciones y soporte para dark/light mode.
 * Se usa para mostrar configuraciones, detalles o formularios sin salir de la vista actual.
 * 
 * Por defecto NO tiene overlay para no bloquear la interacción con el resto de la página.
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
import { X, ArrowSquareOut } from '@phosphor-icons/react';

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
    /** Whether to show overlay behind panel (default: false) */
    showOverlay?: boolean;
    /** Whether to close on overlay click (when overlay is shown) */
    closeOnOverlayClick?: boolean;
    /** Whether to close on click outside the panel (when no overlay) */
    closeOnClickOutside?: boolean;
    /** Whether to close on Escape key */
    closeOnEscape?: boolean;
    /** Top offset (for navigation bar) */
    topOffset?: string;
    /** Additional class names for panel container */
    className?: string;
    /** Z-index for the panel */
    zIndex?: number;
    /** Optional link URL for external navigation */
    externalLink?: string;
    /** Callback when external link is clicked */
    onExternalLinkClick?: () => void;
    /** Header actions (rendered after close button) */
    headerActions?: ReactNode;
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
    showOverlay = false, // Default to false - no blur/overlay
    closeOnOverlayClick = true,
    closeOnClickOutside = true,
    closeOnEscape = true,
    topOffset = '63px',
    className = '',
    zIndex = 40,
    externalLink,
    onExternalLinkClick,
    headerActions,
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

    // Handle click outside (when no overlay)
    useEffect(() => {
        if (!isOpen || !closeOnClickOutside || showOverlay) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Small delay to prevent immediate close on open
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, closeOnClickOutside, showOverlay, onClose]);

    // Handle overlay click (when overlay is shown)
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    }, [closeOnOverlayClick, onClose]);

    // Only prevent body scroll when overlay is shown
    useEffect(() => {
        if (isOpen && showOverlay) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen, showOverlay]);

    if (!shouldRender) return null;

    const panelWidth = width || SIZE_MAP[size];
    const translateClass = position === 'right' 
        ? (isAnimating ? 'translate-x-0' : 'translate-x-[120%]')
        : (isAnimating ? 'translate-x-0' : '-translate-x-[120%]');

    // Floating panel margins
    const margin = '16px';
    const panelTop = `calc(${topOffset} + ${margin})`;
    const panelHeight = `calc(100vh - ${topOffset} - ${margin} * 2)`;

    return (
        <>
            {/* Overlay - only shown when showOverlay is true */}
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

            {/* Floating Panel */}
            <div
                ref={panelRef}
                className={`
                    fixed ${panelWidth} 
                    bg-[var(--bg-card)] border border-[var(--border-medium)] 
                    flex flex-col
                    transform transition-all duration-300 ease-out
                    rounded-2xl overflow-hidden
                    ${translateClass}
                    ${className}
                `}
                style={{
                    top: panelTop,
                    right: position === 'right' ? margin : 'auto',
                    left: position === 'left' ? margin : 'auto',
                    height: panelHeight,
                    maxHeight: panelHeight,
                    zIndex,
                }}
                role="dialog"
                aria-modal={showOverlay ? "true" : "false"}
                aria-labelledby={title ? 'sidepanel-title' : undefined}
            >
                {/* Header */}
                {(title || Icon) && (
                    <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-[var(--bg-card)]">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            {title && (
                                <h3 
                                    id="sidepanel-title"
                                    className="text-base font-medium text-[var(--accent-primary)]"
                                >
                                    {title}
                                </h3>
                            )}
                            {(externalLink || onExternalLinkClick) && (
                                <button
                                    onClick={() => {
                                        if (onExternalLinkClick) onExternalLinkClick();
                                        if (externalLink) window.open(externalLink, '_blank');
                                    }}
                                    className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors shrink-0"
                                    aria-label="Open in new window"
                                >
                                    <ArrowSquareOut 
                                        size={16} 
                                        weight="light" 
                                        className="text-[var(--accent-primary)]" 
                                    />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                            {headerActions}
                            {/* Circular close button */}
                            <button
                                onClick={onClose}
                                className="w-9 h-9 flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] border border-[var(--border-light)] rounded-full transition-colors group"
                                aria-label="Close panel"
                            >
                                <X 
                                    size={16} 
                                    weight="bold" 
                                    className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" 
                                />
                            </button>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--border-light)] shrink-0 bg-[var(--bg-card)]">
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
    <div className={`${noPadding ? '' : 'px-5 py-4'} ${className}`}>
        {children}
    </div>
);

interface SidePanelSectionProps {
    title?: string;
    subtitle?: string;
    children: ReactNode;
    className?: string;
}

export const SidePanelSection: React.FC<SidePanelSectionProps> = ({
    title,
    subtitle,
    children,
    className = '',
}) => (
    <div className={`mb-6 ${className}`}>
        {title && (
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {title}
            </h4>
        )}
        {subtitle && (
            <p className="text-sm text-[var(--text-secondary)] mb-2">
                {subtitle}
            </p>
        )}
        {children}
    </div>
);

interface SidePanelFieldProps {
    label: string;
    value?: string | ReactNode;
    className?: string;
}

export const SidePanelField: React.FC<SidePanelFieldProps> = ({
    label,
    value,
    className = '',
}) => (
    <div className={`mb-4 ${className}`}>
        <dt className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
            {label}
        </dt>
        <dd className="text-sm text-[var(--text-secondary)]">
            {value || '-'}
        </dd>
    </div>
);

interface SidePanelListProps {
    items: Array<{ id: string; label: string; onClick?: () => void; color?: string }>;
    className?: string;
}

export const SidePanelList: React.FC<SidePanelListProps> = ({
    items,
    className = '',
}) => (
    <ul className={`space-y-1 ${className}`}>
        {items.map(item => (
            <li key={item.id} className="flex items-center gap-2">
                <span 
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color || 'var(--text-tertiary)' }}
                />
                {item.onClick ? (
                    <button
                        onClick={item.onClick}
                        className="text-sm text-[var(--accent-primary)] hover:underline text-left"
                    >
                        {item.label}
                    </button>
                ) : (
                    <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
                )}
            </li>
        ))}
    </ul>
);

interface SidePanelDividerProps {
    className?: string;
}

export const SidePanelDivider: React.FC<SidePanelDividerProps> = ({
    className = '',
}) => (
    <div className={`border-t border-[var(--border-light)] my-5 ${className}`} />
);

// ============================================================================
// EXPORTS
// ============================================================================

export default SidePanel;
