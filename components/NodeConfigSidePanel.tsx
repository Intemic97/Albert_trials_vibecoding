import React, { ReactNode, useEffect } from 'react';
import { X, LucideIcon } from 'lucide-react';

interface NodeConfigSidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    icon: LucideIcon;
    iconBgColor?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    width?: string;
}

export const NodeConfigSidePanel: React.FC<NodeConfigSidePanelProps> = ({
    isOpen,
    onClose,
    title,
    icon: Icon,
    iconBgColor = 'bg-slate-100',
    description,
    children,
    footer,
    width = 'w-[300px]'
}) => {
    // Handle Escape key to close
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    // Prevent body scroll when panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay - Click outside to close */}
            <div
                className="fixed inset-0 z-30 bg-transparent"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Side Panel */}
            <div 
                className={`fixed top-[63px] right-0 ${width} bg-white border-l border-slate-200 z-40 flex flex-col transform transition-transform duration-300 ease-out translate-x-0`}
                style={{
                    animation: 'slideInRight 0.3s ease-out',
                    height: 'calc(100vh - 63px)',
                    maxHeight: 'calc(100vh - 63px)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                            <Icon size={14} className="text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-medium text-slate-900 truncate">
                                {title}
                            </h3>
                            {description && (
                                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-md transition-colors shrink-0 ml-2"
                        aria-label="Close panel"
                    >
                        <X size={14} className="text-slate-400" />
                    </button>
                </div>
                
                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
                    {children}
                </div>
                
                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </>
    );
};
