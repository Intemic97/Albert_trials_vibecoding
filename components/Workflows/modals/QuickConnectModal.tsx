/**
 * QuickConnectModal
 * Extracted from Workflows.tsx - Quick Connect Component Search Modal (~95 lines)
 */

import React from 'react';
import { MagnifyingGlass as Search } from '@phosphor-icons/react';

interface QuickConnectModalProps {
  show: boolean;
  connectingFromNodeId: string | null;
  componentSearchQuery: string;
  setComponentSearchQuery: (query: string) => void;
  onClose: () => void;
  onSelect: (type: string) => void;
  draggableItems: any[];
  getNodeIconBg: (type: string) => string;
}

export const QuickConnectModal: React.FC<QuickConnectModalProps> = ({
  show, connectingFromNodeId, componentSearchQuery, setComponentSearchQuery,
  onClose, onSelect, draggableItems, getNodeIconBg
}) => {
  if (!show || !connectingFromNodeId) return null;

  const filteredItems = draggableItems.filter(item =>
    item.type !== 'trigger' &&
    item.type !== 'comment' &&
    (componentSearchQuery === '' ||
      item.label.toLowerCase().includes(componentSearchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(componentSearchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(componentSearchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none" onClick={onClose}>
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-light)] shadow-2xl w-full max-w-md pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border-light)] bg-gradient-to-r from-[var(--accent-primary)]/5 to-transparent">
          <h3 className="text-base font-normal text-[var(--text-primary)]">Connect Component</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Search and select a component to connect</p>
        </div>

        {/* Search Input */}
        <div className="px-6 py-4 border-b border-[var(--border-light)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} weight="light" />
            <input
              type="text"
              value={componentSearchQuery}
              onChange={(e) => setComponentSearchQuery(e.target.value)}
              placeholder="Search components..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-medium)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent placeholder:text-[var(--text-tertiary)]"
              autoFocus
            />
          </div>
        </div>

        {/* Components List */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => onSelect(item.type)}
                className="w-full flex items-start gap-3 p-3 rounded-lg border border-[var(--border-light)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all text-left mb-2 group"
              >
                <div className="p-1.5 rounded-lg flex-shrink-0">
                  <Icon size={14} className={getNodeIconBg(item.type)} weight="light" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-normal text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                    {item.label}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {item.description}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-1">
                    {item.category}
                  </div>
                </div>
              </button>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">
              No components found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-light)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--border-medium)] rounded-lg hover:bg-[var(--bg-tertiary)] text-sm font-medium text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};




