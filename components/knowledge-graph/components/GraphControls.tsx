/**
 * GraphControls - Zoom and view controls
 */

import React from 'react';
import { Plus, Minus, ArrowsOut, ArrowCounterClockwise, Crosshair } from '@phosphor-icons/react';

interface GraphControlsProps {
    zoom: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onResetView: () => void;
    onFitToContent: () => void;
    onCenterSelected?: () => void;
    hasSelection?: boolean;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
    zoom,
    onZoomIn,
    onZoomOut,
    onResetView,
    onFitToContent,
    onCenterSelected,
    hasSelection,
}) => {
    const buttonClass = "p-2.5 bg-[var(--bg-card)] border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed";
    
    return (
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
            {/* Zoom controls */}
            <div className="flex flex-col bg-[var(--bg-card)]/90 backdrop-blur-sm rounded-lg border border-[var(--border-light)] shadow-lg overflow-hidden">
                <button
                    onClick={onZoomIn}
                    className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-light)]"
                    title="Acercar"
                >
                    <Plus size={18} weight="bold" />
                </button>
                <div className="px-2.5 py-1.5 text-xs font-medium text-center text-[var(--text-tertiary)] bg-[var(--bg-secondary)]">
                    {Math.round(zoom * 100)}%
                </div>
                <button
                    onClick={onZoomOut}
                    className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border-t border-[var(--border-light)]"
                    title="Alejar"
                >
                    <Minus size={18} weight="bold" />
                </button>
            </div>
            
            {/* View controls */}
            <div className="flex flex-col bg-[var(--bg-card)]/90 backdrop-blur-sm rounded-lg border border-[var(--border-light)] shadow-lg overflow-hidden">
                <button
                    onClick={onFitToContent}
                    className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-light)]"
                    title="Ajustar al contenido"
                >
                    <ArrowsOut size={18} />
                </button>
                <button
                    onClick={onResetView}
                    className="p-2.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    title="Reiniciar vista"
                >
                    <ArrowCounterClockwise size={18} />
                </button>
            </div>
            
            {/* Center on selection */}
            {hasSelection && onCenterSelected && (
                <button
                    onClick={onCenterSelected}
                    className={buttonClass}
                    title="Centrar en selección"
                >
                    <Crosshair size={18} />
                </button>
            )}
        </div>
    );
};

export default GraphControls;
