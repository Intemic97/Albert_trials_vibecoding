/**
 * NodePaletteSidebar
 * Extracted from Workflows.tsx - Left sidebar with component folders, search, draggable items
 */

import React, { useState } from 'react';
import {
  MagnifyingGlass as Search,
  CaretDoubleLeft as ChevronsLeft,
  CaretDoubleRight as ChevronsRight,
  CaretRight as ChevronRight,
  CaretDown as ChevronDown,
  Clock, Play, Database, GitMerge, WarningCircle as AlertCircle,
  Sparkle as Sparkles, Code, SignOut as LogOut, Envelope as Mail, Wrench
} from '@phosphor-icons/react';
import { type DraggableItem } from '../types';

interface NodePaletteSidebarProps {
  sidebarRef: React.RefObject<HTMLDivElement>;
  sidebarScrollRef: React.RefObject<HTMLDivElement>;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  expandedFolders: Set<string>;
  setExpandedFolders: (folders: Set<string>) => void;
  DRAGGABLE_ITEMS: DraggableItem[];
  filteredItems: DraggableItem[];
  handleDragStart: (e: React.DragEvent, item: DraggableItem) => void;
  getCategoryColors: (categoryName: string) => { bg: string; hover: string };
  getNodeIconColor: (type: string) => string;
}

export const NodePaletteSidebar: React.FC<NodePaletteSidebarProps> = ({
  sidebarRef, sidebarScrollRef, isSidebarCollapsed, setIsSidebarCollapsed,
  searchQuery, setSearchQuery, expandedFolders, setExpandedFolders,
  DRAGGABLE_ITEMS, filteredItems, handleDragStart, getCategoryColors, getNodeIconColor
}) => {
  return (
    <div ref={sidebarRef} data-tutorial="node-palette" className={`${isSidebarCollapsed ? 'w-14' : 'w-64'} bg-[var(--bg-tertiary)] border-r border-[var(--border-light)] flex flex-col shadow-sm z-10 transition-all duration-300 overflow-hidden`} style={{ height: '100%', maxHeight: '100%' }}>
      {!isSidebarCollapsed ? (
        <>
          <div className="p-4 border-b border-[var(--border-light)] bg-[var(--bg-card)] shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-normal text-[var(--text-primary)]" style={{ fontFamily: "'Berkeley Mono', monospace" }}>Components</h2>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                title="Collapse panel"
              >
                <ChevronsLeft size={16} weight="light" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={14} weight="light" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                name="component-search-nofill"
                className="w-full pl-9 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent placeholder:text-[var(--text-tertiary)]"
              />
            </div>
          </div>

          <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto bg-[var(--bg-card)] custom-scrollbar" style={{ minHeight: 0, height: 0, flex: '1 1 0%' }}>
            {/* Folder Structure */}
            {(() => {
              // Organize items into folders
              const folderStructure: { [key: string]: { icon: React.ElementType, items: DraggableItem[] } } = {
                'Recents': { icon: Clock, items: [] },
                'Triggers': { icon: Play, items: DRAGGABLE_ITEMS.filter(i => ['trigger', 'webhook'].includes(i.type)) },
                'Data Sources': { icon: Database, items: DRAGGABLE_ITEMS.filter(i => ['fetchData', 'excelInput', 'pdfInput', 'http', 'mysql', 'sapFetch', 'limsFetch', 'opcua', 'mqtt', 'osiPi', 'esios', 'climatiq', 'weather', 'manualInput'].includes(i.type)) },
                'Data Operations': { icon: GitMerge, items: DRAGGABLE_ITEMS.filter(i => ['join', 'splitColumns', 'addField', 'action'].includes(i.type)) },
                'Control Flow': { icon: AlertCircle, items: DRAGGABLE_ITEMS.filter(i => ['condition', 'humanApproval', 'alertAgent', 'dataVisualization'].includes(i.type)) },
                'Models': { icon: Sparkles, items: DRAGGABLE_ITEMS.filter(i => ['llm', 'statisticalAnalysis', 'franmit', 'conveyor'].includes(i.type)) },
                'Code': { icon: Code, items: DRAGGABLE_ITEMS.filter(i => ['python'].includes(i.type)) },
                'Output & Logging': { icon: LogOut, items: DRAGGABLE_ITEMS.filter(i => ['output', 'webhookResponse', 'saveRecords'].includes(i.type)) },
                'Notifications': { icon: Mail, items: DRAGGABLE_ITEMS.filter(i => ['sendEmail', 'sendSMS', 'sendWhatsApp', 'pdfReport'].includes(i.type)) },
                'Utils': { icon: Wrench, items: DRAGGABLE_ITEMS.filter(i => ['comment'].includes(i.type)) },
              };

              folderStructure['Recents'].items = [];
              
              const visibleFolders = Object.entries(folderStructure).filter(([folderName, folder]) => {
                if (folderName === 'Recents') return true;
                if (searchQuery === '' && folder.items.length === 0) return false;
                if (searchQuery !== '') {
                  const folderMatches = folderName.toLowerCase().includes(searchQuery.toLowerCase());
                  const itemsMatch = folder.items.some(item => 
                    item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.description.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  return folderMatches || itemsMatch;
                }
                return true;
              });

              return visibleFolders.map(([folderName, folder]) => {
                const filteredFolderItems = folder.items.filter(item => {
                  if (searchQuery === '') return true;
                  return item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.description.toLowerCase().includes(searchQuery.toLowerCase());
                });
                
                const isExpanded = expandedFolders.has(folderName) || (searchQuery !== '' && filteredFolderItems.length > 0);

                if (folderName !== 'Recents' && filteredFolderItems.length === 0 && searchQuery === '') return null;
                if (filteredFolderItems.length === 0 && searchQuery !== '') return null;

                return (
                  <div key={folderName} className="border-b border-[var(--border-light)]">
                    {/* Folder Header */}
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedFolders);
                        if (isExpanded) {
                          newExpanded.delete(folderName);
                        } else {
                          newExpanded.add(folderName);
                        }
                        setExpandedFolders(newExpanded);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2 ${getCategoryColors(folderName).bg} ${getCategoryColors(folderName).hover} transition-colors text-left`}
                    >
                      <div className="flex items-center gap-2.5">
                        {React.createElement(folder.icon, { size: 14, className: "text-[var(--text-secondary)] flex-shrink-0", weight: "light" })}
                        <span className="text-xs font-medium text-[var(--text-primary)]">{folderName}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                      ) : (
                        <ChevronRight size={12} className="text-[var(--text-tertiary)] flex-shrink-0" weight="light" />
                      )}
                    </button>

                    {/* Folder Items */}
                    {isExpanded && filteredFolderItems.length > 0 && (
                      <div className="pb-1">
                        {filteredFolderItems.map((item) => (
                          <div
                            key={item.label}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            className="flex items-center gap-2.5 px-4 py-1.5 pl-8 hover:bg-[var(--bg-tertiary)] cursor-grab transition-colors group"
                          >
                            {React.createElement(item.icon, { size: 13, className: `${getNodeIconColor(item.type)} flex-shrink-0`, weight: "light" })}
                            <span className="text-xs text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </>
      ) : (
        /* Collapsed view - icons only */
        <>
          <div className="p-2 border-b border-[var(--border-light)] bg-[var(--bg-card)] flex justify-center">
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
              title="Expand panel"
            >
              <ChevronsRight size={18} weight="light" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2 space-y-1.5 custom-scrollbar" style={{ minHeight: 0, height: 0, flex: '1 1 0%' }}>
            {filteredItems.map((item) => (
              <div
                key={item.label}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className="mx-2 p-1.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md shadow-sm cursor-grab group flex items-center justify-center"
                title={item.label}
              >
                <div className={`p-1 rounded ${item.category === 'Triggers' ? 'bg-cyan-100 text-cyan-700' :
                  item.category === 'Data' ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' :
                    item.category === 'Logic' ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' :
                      'bg-[#84C4D1]/20 text-[var(--accent-primary)]'
                  }`}>
                  {React.createElement(item.icon, { size: 16, weight: "light" })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};




