import React from 'react';
import { Trash, Database, User, Calendar, Hash, CaretRight } from '@phosphor-icons/react';
import { Entity, ENTITY_TYPE_OPTIONS } from '../types';

interface EntityCardProps {
  entity: Entity;
  onClick: (entity: Entity) => void;
  onDelete?: (entity: Entity) => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({ entity, onClick, onDelete }) => {
  return (
    <div
      onClick={() => onClick(entity)}
      className="bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg p-5 cursor-pointer group relative flex flex-col justify-between min-h-[200px] overflow-hidden transition-all duration-300 ease-out hover:shadow-md hover:border-[var(--border-medium)] hover:scale-[1.01] active:scale-[0.99]"
    >
        <div className="flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--bg-hover)] transition-all duration-300 text-lg">
              {entity.entityType && entity.entityType !== 'generic'
                ? (ENTITY_TYPE_OPTIONS.find(o => o.value === entity.entityType)?.icon || '📋')
                : <Database size={18} weight="light" className="text-[var(--text-secondary)]" />
              }
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-normal text-[var(--text-primary)] transition-colors truncate" style={{ fontFamily: "'Berkeley Mono', monospace" }}>
                {entity.name}
              </h3>
              {entity.entityType && entity.entityType !== 'generic' && (
                <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                  {ENTITY_TYPE_OPTIONS.find(o => o.value === entity.entityType)?.label}
                </span>
              )}
            </div>
          </div>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setTimeout(() => {
                  if (window.confirm('Are you sure you want to delete this entity?')) {
                    onDelete(entity);
                  }
                }, 0);
              }}
              className="text-[var(--text-tertiary)] hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all duration-200 opacity-0 group-hover:opacity-100 flex-shrink-0 active:scale-90"
            >
              <Trash size={16} weight="light" />
            </button>
          )}
        </div>

        {entity.description && (
          <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2 leading-relaxed">
            {entity.description}
          </p>
        )}

        <div className="space-y-2 mt-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <User size={12} weight="light" className="text-[var(--text-tertiary)]" />
            <span className="text-[var(--text-secondary)]">{entity.author}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Calendar size={12} weight="light" className="text-[var(--text-tertiary)]" />
            <span>{entity.lastEdited}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Hash size={12} weight="light" className="text-[var(--text-tertiary)]" />
            <span><span className="text-[var(--text-primary)] font-medium">{entity.properties.length}</span> attributes</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5">
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <CaretRight size={14} weight="light" className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:translate-x-0.5" />
          <span className="opacity-0 group-hover:opacity-100 transition-all duration-200 font-medium text-[var(--text-primary)]">Manage entity</span>
        </div>
      </div>
    </div>
  );
};