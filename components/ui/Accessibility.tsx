/**
 * Accessibility Components and Utilities
 * Provides components and hooks for better accessibility
 */

import React, { useEffect, useRef, useCallback, useState, createContext, useContext } from 'react';

// ============================================================================
// VISUALLY HIDDEN (Screen Reader Only)
// ============================================================================

interface VisuallyHiddenProps {
    children: React.ReactNode;
    as?: keyof JSX.IntrinsicElements;
}

/**
 * Hides content visually but keeps it accessible to screen readers
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ 
    children, 
    as: Component = 'span' 
}) => {
    return (
        <Component
            style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                padding: '0',
                margin: '-1px',
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: '0',
            }}
        >
            {children}
        </Component>
    );
};

// ============================================================================
// SKIP LINK
// ============================================================================

interface SkipLinkProps {
    href: string;
    children?: React.ReactNode;
}

/**
 * Skip to main content link for keyboard users
 */
export const SkipLink: React.FC<SkipLinkProps> = ({ 
    href, 
    children = 'Skip to main content' 
}) => {
    return (
        <a
            href={href}
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#256A65] focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
        >
            {children}
        </a>
    );
};

// ============================================================================
// FOCUS TRAP
// ============================================================================

interface FocusTrapProps {
    children: React.ReactNode;
    active?: boolean;
    restoreFocus?: boolean;
    initialFocus?: React.RefObject<HTMLElement>;
}

/**
 * Traps focus within a container (useful for modals)
 */
export const FocusTrap: React.FC<FocusTrapProps> = ({
    children,
    active = true,
    restoreFocus = true,
    initialFocus
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!active) return;

        // Store the previously focused element
        previousFocusRef.current = document.activeElement as HTMLElement;

        // Focus initial element or first focusable
        const focusInitial = () => {
            if (initialFocus?.current) {
                initialFocus.current.focus();
            } else if (containerRef.current) {
                const focusable = getFocusableElements(containerRef.current);
                if (focusable.length > 0) {
                    focusable[0].focus();
                }
            }
        };

        // Small delay to ensure DOM is ready
        const timer = setTimeout(focusInitial, 10);

        return () => {
            clearTimeout(timer);
            // Restore focus when unmounting
            if (restoreFocus && previousFocusRef.current) {
                previousFocusRef.current.focus();
            }
        };
    }, [active, restoreFocus, initialFocus]);

    useEffect(() => {
        if (!active || !containerRef.current) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const focusable = getFocusableElements(containerRef.current!);
            if (focusable.length === 0) return;

            const firstFocusable = focusable[0];
            const lastFocusable = focusable[focusable.length - 1];

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [active]);

    return (
        <div ref={containerRef}>
            {children}
        </div>
    );
};

// ============================================================================
// LIVE REGION
// ============================================================================

interface LiveRegionProps {
    children: React.ReactNode;
    politeness?: 'polite' | 'assertive' | 'off';
    atomic?: boolean;
    relevant?: 'additions' | 'removals' | 'text' | 'all';
}

/**
 * Announces dynamic content changes to screen readers
 */
export const LiveRegion: React.FC<LiveRegionProps> = ({
    children,
    politeness = 'polite',
    atomic = true,
    relevant = 'additions text'
}) => {
    return (
        <div
            role="status"
            aria-live={politeness}
            aria-atomic={atomic}
            aria-relevant={relevant}
        >
            {children}
        </div>
    );
};

// ============================================================================
// ANNOUNCER (Programmatic Announcements)
// ============================================================================

interface AnnouncerContextType {
    announce: (message: string, politeness?: 'polite' | 'assertive') => void;
}

const AnnouncerContext = createContext<AnnouncerContextType | null>(null);

export const AnnouncerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [politeMessage, setPoliteMessage] = useState('');
    const [assertiveMessage, setAssertiveMessage] = useState('');

    const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
        if (politeness === 'assertive') {
            setAssertiveMessage('');
            // Small delay to ensure the change is detected
            setTimeout(() => setAssertiveMessage(message), 50);
        } else {
            setPoliteMessage('');
            setTimeout(() => setPoliteMessage(message), 50);
        }
    }, []);

    return (
        <AnnouncerContext.Provider value={{ announce }}>
            {children}
            {/* Hidden live regions for announcements */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: '0',
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: '0',
                }}
            >
                {politeMessage}
            </div>
            <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: '0',
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: '0',
                }}
            >
                {assertiveMessage}
            </div>
        </AnnouncerContext.Provider>
    );
};

export const useAnnouncer = () => {
    const context = useContext(AnnouncerContext);
    if (!context) {
        // Return a no-op if not wrapped in provider
        return { announce: () => {} };
    }
    return context;
};

// ============================================================================
// ROVING TABINDEX
// ============================================================================

interface RovingTabIndexProps {
    children: React.ReactNode;
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
}

/**
 * Manages keyboard navigation within a group of elements
 */
export const RovingTabIndex: React.FC<RovingTabIndexProps> = ({
    children,
    orientation = 'horizontal',
    loop = true
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!containerRef.current) return;

        const items = Array.from(
            containerRef.current.querySelectorAll('[data-roving-item]')
        ) as HTMLElement[];

        if (items.length === 0) return;

        let nextIndex = focusedIndex;
        const isHorizontal = orientation === 'horizontal' || orientation === 'both';
        const isVertical = orientation === 'vertical' || orientation === 'both';

        switch (e.key) {
            case 'ArrowRight':
                if (isHorizontal) {
                    e.preventDefault();
                    nextIndex = loop
                        ? (focusedIndex + 1) % items.length
                        : Math.min(focusedIndex + 1, items.length - 1);
                }
                break;
            case 'ArrowLeft':
                if (isHorizontal) {
                    e.preventDefault();
                    nextIndex = loop
                        ? (focusedIndex - 1 + items.length) % items.length
                        : Math.max(focusedIndex - 1, 0);
                }
                break;
            case 'ArrowDown':
                if (isVertical) {
                    e.preventDefault();
                    nextIndex = loop
                        ? (focusedIndex + 1) % items.length
                        : Math.min(focusedIndex + 1, items.length - 1);
                }
                break;
            case 'ArrowUp':
                if (isVertical) {
                    e.preventDefault();
                    nextIndex = loop
                        ? (focusedIndex - 1 + items.length) % items.length
                        : Math.max(focusedIndex - 1, 0);
                }
                break;
            case 'Home':
                e.preventDefault();
                nextIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                nextIndex = items.length - 1;
                break;
        }

        if (nextIndex !== focusedIndex) {
            setFocusedIndex(nextIndex);
            items[nextIndex].focus();
        }
    }, [focusedIndex, orientation, loop]);

    return (
        <div 
            ref={containerRef} 
            onKeyDown={handleKeyDown}
            role="group"
        >
            {React.Children.map(children, (child, index) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child as React.ReactElement<any>, {
                        'data-roving-item': true,
                        tabIndex: index === focusedIndex ? 0 : -1,
                        onFocus: () => setFocusedIndex(index),
                    });
                }
                return child;
            })}
        </div>
    );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const FOCUSABLE_SELECTORS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
].join(', ');

/**
 * Gets all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1'
    ) as HTMLElement[];
}

/**
 * Checks if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
    return element.matches(FOCUSABLE_SELECTORS);
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to manage focus within a container
 */
export function useFocusManager(containerRef: React.RefObject<HTMLElement>) {
    const focusFirst = useCallback(() => {
        if (!containerRef.current) return;
        const focusable = getFocusableElements(containerRef.current);
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    }, [containerRef]);

    const focusLast = useCallback(() => {
        if (!containerRef.current) return;
        const focusable = getFocusableElements(containerRef.current);
        if (focusable.length > 0) {
            focusable[focusable.length - 1].focus();
        }
    }, [containerRef]);

    const focusNext = useCallback(() => {
        if (!containerRef.current) return;
        const focusable = getFocusableElements(containerRef.current);
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
        if (currentIndex < focusable.length - 1) {
            focusable[currentIndex + 1].focus();
        }
    }, [containerRef]);

    const focusPrevious = useCallback(() => {
        if (!containerRef.current) return;
        const focusable = getFocusableElements(containerRef.current);
        const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
        if (currentIndex > 0) {
            focusable[currentIndex - 1].focus();
        }
    }, [containerRef]);

    return { focusFirst, focusLast, focusNext, focusPrevious };
}

/**
 * Hook to detect if user is navigating with keyboard
 */
export function useKeyboardNavigation(): boolean {
    const [isKeyboardNav, setIsKeyboardNav] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                setIsKeyboardNav(true);
            }
        };

        const handleMouseDown = () => {
            setIsKeyboardNav(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousedown', handleMouseDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    return isKeyboardNav;
}

/**
 * Hook to manage escape key to close
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean = true) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onEscape();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onEscape, enabled]);
}

/**
 * Hook to return focus to trigger element
 */
export function useReturnFocus(triggerRef: React.RefObject<HTMLElement>, active: boolean) {
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (active) {
            previousFocusRef.current = document.activeElement as HTMLElement;
        } else if (previousFocusRef.current) {
            previousFocusRef.current.focus();
            previousFocusRef.current = null;
        }
    }, [active]);
}

export default {
    VisuallyHidden,
    SkipLink,
    FocusTrap,
    LiveRegion,
    AnnouncerProvider,
    useAnnouncer,
    RovingTabIndex,
    getFocusableElements,
    isFocusable,
    useFocusManager,
    useKeyboardNavigation,
    useEscapeKey,
    useReturnFocus,
};
