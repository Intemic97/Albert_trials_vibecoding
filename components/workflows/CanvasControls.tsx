import React from 'react';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsOut, Sparkle } from '@phosphor-icons/react';

interface CanvasControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToContent: () => void;
  onOpenAiAssistant?: () => void;
  showAiButton?: boolean;
}

/**
 * Canvas control buttons (zoom, fit, AI assistant)
 */
export const CanvasControls: React.FC<CanvasControlsProps> = ({
  scale,
  onZoomIn,
  onZoomOut,
  onFitToContent,
  onOpenAiAssistant,
  showAiButton = true,
}) => {
  const scalePercent = Math.round(scale * 100);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-[var(--bg-card)] rounded-full shadow-sm border border-[var(--border-light)] px-4 py-2">
      {/* AI Assistant Button */}
      {showAiButton && onOpenAiAssistant && (
        <>
          <button
            onClick={onOpenAiAssistant}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            title="AI Workflow Assistant"
          >
            <Sparkle size={16} className="text-[#256A65]" weight="light" />
            <span className="text-sm text-[var(--text-primary)]">Ask</span>
          </button>
          
          <div className="w-px h-5 bg-[var(--border-light)]" />
        </>
      )}

      {/* Zoom Out */}
      <button
        onClick={onZoomOut}
        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90"
        title="Zoom Out"
      >
        <MagnifyingGlassMinus size={18} weight="light" />
      </button>

      {/* Zoom Level */}
      <span className="text-sm font-medium text-[var(--text-primary)] min-w-[48px] text-center">
        {scalePercent}%
      </span>

      {/* Zoom In */}
      <button
        onClick={onZoomIn}
        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90"
        title="Zoom In"
      >
        <MagnifyingGlassPlus size={18} weight="light" />
      </button>

      {/* Fit to Content */}
      <button
        onClick={onFitToContent}
        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-90"
        title="Fit to Content"
      >
        <ArrowsOut size={18} weight="light" />
      </button>
    </div>
  );
};

export default CanvasControls;
