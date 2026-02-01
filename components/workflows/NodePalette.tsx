import React, { useState, useMemo } from 'react';
import { MagnifyingGlass, CaretDown, CaretRight, CaretDoubleLeft, CaretDoubleRight, ClockCounterClockwise } from '@phosphor-icons/react';
import { DraggableItem, NodeType } from './types';
import { DRAGGABLE_ITEMS } from './constants';

interface NodePaletteProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  recentNodes: NodeType[];
  onDragStart: (item: DraggableItem) => void;
  onDragEnd: () => void;
}

const CATEGORIES = [
  { id: 'Recents', label: 'Recents', defaultOpen: true },
  { id: 'Triggers', label: 'Triggers', defaultOpen: false },
  { id: 'Data', label: 'Data Sources', defaultOpen: false },
  { id: 'Logic', label: 'Data Operations', defaultOpen: false },
  { id: 'Actions', label: 'Control Flow', defaultOpen: false },
  { id: 'Other', label: 'Models', defaultOpen: false },
  { id: 'Agents', label: 'Agents', defaultOpen: false },
  { id: 'Code', label: 'Code', defaultOpen: false },
  { id: 'OutputLogging', label: 'Output & Logging', defaultOpen: false },
  { id: 'Notifications', label: 'Notifications', defaultOpen: false },
  { id: 'Advanced', label: 'Advanced', defaultOpen: false },
];

export const NodePalette: React.FC<NodePaletteProps> = ({
  isCollapsed,
  onToggleCollapse,
  recentNodes,
  onDragStart,
  onDragEnd,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: cat.defaultOpen }), {})
  );

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return DRAGGABLE_ITEMS;
    const query = searchQuery.toLowerCase();
    return DRAGGABLE_ITEMS.filter(
      item => 
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, DraggableItem[]> = {};
    CATEGORIES.forEach(cat => {
      groups[cat.id] = [];
    });
    
    filteredItems.forEach(item => {
      if (groups[item.category]) {
        groups[item.category].push(item);
      }
    });
    
    return groups;
  }, [filteredItems]);

  // Get recent items
  const recentItems = useMemo(() => {
    return recentNodes
      .map(type => DRAGGABLE_ITEMS.find(item => item.type === type))
      .filter(Boolean) as DraggableItem[];
  }, [recentNodes]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-[var(--bg-tertiary)] border-r border-[var(--border-light)] flex flex-col shadow-sm z-10">
        <button
          onClick={onToggleCollapse}
          className="p-3 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-light)]"
          title="Expand panel"
        >
          <CaretDoubleRight size={18} className="text-[var(--text-secondary)]" weight="light" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-[var(--bg-tertiary)] border-r border-[var(--border-light)] flex flex-col shadow-sm z-10 transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-card)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-[var(--text-primary)]">Components</span>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            title="Collapse panel"
          >
            <CaretDoubleLeft size={16} className="text-[var(--text-secondary)]" weight="light" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" weight="light" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[var(--border-medium)] placeholder:text-[var(--text-tertiary)]"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-card)] custom-scrollbar">
        {/* Recents */}
        {recentItems.length > 0 && !searchQuery && (
          <div className="border-b border-[var(--border-light)]">
            <button
              onClick={() => toggleCategory('Recents')}
              className="w-full flex items-center justify-between px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <ClockCounterClockwise size={14} className="text-[var(--text-tertiary)]" weight="light" />
                <span className="text-xs font-medium text-[var(--text-secondary)]">Recents</span>
              </div>
              {expandedCategories['Recents'] ? (
                <CaretDown size={14} className="text-[var(--text-tertiary)]" weight="light" />
              ) : (
                <CaretRight size={14} className="text-[var(--text-tertiary)]" weight="light" />
              )}
            </button>
            
            {expandedCategories['Recents'] && (
              <div className="p-2 space-y-1">
                {recentItems.slice(0, 5).map((item, idx) => (
                  <PaletteItem
                    key={`recent-${idx}`}
                    item={item}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Other categories */}
        {CATEGORIES.filter(cat => cat.id !== 'Recents').map((category) => {
          const items = groupedItems[category.id] || [];
          if (items.length === 0 && !searchQuery) return null;

          return (
            <div key={category.id} className="border-b border-[var(--border-light)]">
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors text-left"
              >
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  {category.label}
                </span>
                {expandedCategories[category.id] ? (
                  <CaretDown size={14} className="text-[var(--text-tertiary)]" weight="light" />
                ) : (
                  <CaretRight size={14} className="text-[var(--text-tertiary)]" weight="light" />
                )}
              </button>
              
              {expandedCategories[category.id] && items.length > 0 && (
                <div className="p-2 space-y-1">
                  {items.map((item, idx) => (
                    <PaletteItem
                      key={`${category.id}-${idx}`}
                      item={item}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Individual palette item
interface PaletteItemProps {
  item: DraggableItem;
  onDragStart: (item: DraggableItem) => void;
  onDragEnd: () => void;
}

const PaletteItem: React.FC<PaletteItemProps> = ({ item, onDragStart, onDragEnd }) => {
  const Icon = item.icon;
  
  const handleDragStart = (e: React.DragEvent) => {
    console.log('Drag start:', item.type);
    e.dataTransfer.setData('application/workflow-node', item.type);
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(item);
  };
  
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className="flex items-center gap-3 p-2 rounded-lg cursor-grab hover:bg-[var(--bg-hover)] transition-colors group active:cursor-grabbing"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        item.category === 'Triggers' ? 'bg-amber-100 text-amber-700' :
        item.category === 'Data' ? 'bg-[#256A65]/10 text-[#256A65]' :
        item.category === 'Logic' ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' :
        'bg-[#84C4D1]/20 text-[#256A65]'
      }`}>
        <Icon size={16} weight="light" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
          {item.label}
        </p>
        <p className="text-[10px] text-[var(--text-tertiary)] truncate">
          {item.description}
        </p>
      </div>
    </div>
  );
};

export default NodePalette;
