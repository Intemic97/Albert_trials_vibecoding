/**
 * Hook para confirmaciones destructivas usando ConfirmDialog.
 * Sustituye window.confirm() por un diálogo consistente (accesible, mismo estilo, i18n).
 *
 * Uso:
 *   const { confirmDestructive, DestructiveConfirmDialog } = useDestructiveConfirm();
 *   // En el JSX: <DestructiveConfirmDialog />
 *   const ok = await confirmDestructive({ title: t('...'), description: t('...') });
 *   if (ok) await handleDelete();
 */

import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export interface DestructiveConfirmOptions {
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
}

export function useDestructiveConfirm() {
    const { t } = useTranslation();
    const [pending, setPending] = useState<DestructiveConfirmOptions | null>(null);
    const [loading, setLoading] = useState(false);
    const resolveRef = useRef<((value: boolean) => void) | null>(null);

    const confirmDestructive = useCallback((options: DestructiveConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setPending(options);
        });
    }, []);

    const handleClose = useCallback(() => {
        setPending(null);
        setLoading(false);
        if (resolveRef.current) {
            resolveRef.current(false);
            resolveRef.current = null;
        }
    }, []);

    const handleConfirm = useCallback(() => {
        setPending(null);
        setLoading(false);
        if (resolveRef.current) {
            resolveRef.current(true);
            resolveRef.current = null;
        }
    }, []);

    const DestructiveConfirmDialog = useCallback(() => {
        if (!pending) return null;
        return (
            <ConfirmDialog
                isOpen={true}
                onClose={handleClose}
                onConfirm={handleConfirm}
                title={pending.title}
                description={pending.description}
                confirmText={pending.confirmText ?? t('common.delete')}
                cancelText={pending.cancelText ?? t('common.cancel')}
                variant="danger"
                loading={loading}
            />
        );
    }, [pending, loading, handleClose, handleConfirm, t]);

    return { confirmDestructive, DestructiveConfirmDialog, setLoading };
}
