/**
 * Confirm Dialog Component
 * Accessible confirmation dialog with keyboard support
 */

import React, { useRef, useEffect } from 'react';
import { Warning, Trash, Check, X, Info } from '@phosphor-icons/react';
import { FocusTrap, useEscapeKey } from './Accessibility';

// ============================================================================
// TYPES
// ============================================================================

type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
    loading?: boolean;
    children?: React.ReactNode;
}

// ============================================================================
// VARIANT STYLES
// ============================================================================

const variantStyles: Record<DialogVariant, {
    icon: React.ReactNode;
    iconBg: string;
    buttonBg: string;
    buttonHover: string;
}> = {
    danger: {
        icon: <Trash size={24} className="text-red-600" weight="light" />,
        iconBg: 'bg-red-100',
        buttonBg: 'bg-red-600',
        buttonHover: 'hover:bg-red-700',
    },
    warning: {
        icon: <Warning size={24} className="text-amber-600" weight="light" />,
        iconBg: 'bg-amber-100',
        buttonBg: 'bg-amber-600',
        buttonHover: 'hover:bg-amber-700',
    },
    info: {
        icon: <Info size={24} className="text-blue-600" weight="light" />,
        iconBg: 'bg-blue-100',
        buttonBg: 'bg-blue-600',
        buttonHover: 'hover:bg-blue-700',
    },
    success: {
        icon: <Check size={24} className="text-green-600" weight="light" />,
        iconBg: 'bg-green-100',
        buttonBg: 'bg-green-600',
        buttonHover: 'hover:bg-green-700',
    },
};

// ============================================================================
// COMPONENT
// ============================================================================

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger',
    loading = false,
    children,
}) => {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const styles = variantStyles[variant];

    // Handle escape key
    useEscapeKey(onClose, isOpen && !loading);

    // Focus cancel button on open
    useEffect(() => {
        if (isOpen && cancelButtonRef.current) {
            cancelButtonRef.current.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!loading) {
            onConfirm();
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !loading) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? "confirm-dialog-description" : undefined}
        >
            <FocusTrap active={isOpen} initialFocus={cancelButtonRef}>
                <div 
                    className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Content */}
                    <div className="p-6">
                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center flex-shrink-0`}>
                                {styles.icon}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                                <h3 
                                    id="confirm-dialog-title"
                                    className="text-lg font-medium text-[var(--text-primary)]"
                                >
                                    {title}
                                </h3>
                                {description && (
                                    <p 
                                        id="confirm-dialog-description"
                                        className="mt-2 text-sm text-[var(--text-secondary)]"
                                    >
                                        {description}
                                    </p>
                                )}
                                {children && (
                                    <div className="mt-3">
                                        {children}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-6 py-4 bg-[var(--bg-tertiary)]/30 border-t border-[var(--border-light)] rounded-b-xl flex items-center justify-end gap-3">
                        <button
                            ref={cancelButtonRef}
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {cancelText}
                        </button>
                        <button
                            ref={confirmButtonRef}
                            onClick={handleConfirm}
                            disabled={loading}
                            className={`px-4 py-2 ${styles.buttonBg} ${styles.buttonHover} text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                        >
                            {loading && (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            )}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </FocusTrap>
        </div>
    );
};

// ============================================================================
// HOOK FOR CONFIRM DIALOG
// ============================================================================

interface UseConfirmDialogOptions {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
}

interface UseConfirmDialogReturn {
    isOpen: boolean;
    open: () => Promise<boolean>;
    close: () => void;
    DialogComponent: React.FC;
}

export function useConfirmDialog(options: UseConfirmDialogOptions): UseConfirmDialogReturn {
    const [isOpen, setIsOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const resolveRef = React.useRef<((value: boolean) => void) | null>(null);

    const open = React.useCallback(() => {
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
            setIsOpen(true);
        });
    }, []);

    const close = React.useCallback(() => {
        setIsOpen(false);
        setLoading(false);
        if (resolveRef.current) {
            resolveRef.current(false);
            resolveRef.current = null;
        }
    }, []);

    const confirm = React.useCallback(() => {
        setIsOpen(false);
        setLoading(false);
        if (resolveRef.current) {
            resolveRef.current(true);
            resolveRef.current = null;
        }
    }, []);

    const DialogComponent: React.FC = React.useCallback(() => (
        <ConfirmDialog
            isOpen={isOpen}
            onClose={close}
            onConfirm={confirm}
            loading={loading}
            {...options}
        />
    ), [isOpen, close, confirm, loading, options]);

    return { isOpen, open, close, DialogComponent };
}

export default ConfirmDialog;
