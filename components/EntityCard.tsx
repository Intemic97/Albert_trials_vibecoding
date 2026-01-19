import React from 'react';
import { MoreHorizontal, Trash2, Database, User, Calendar, Hash, ChevronRight } from 'lucide-react';
import { Entity } from '../types';

interface EntityCardProps {
  entity: Entity;
  onClick: (entity: Entity) => void;
  onDelete?: (entity: Entity) => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({ entity, onClick, onDelete }) => {
  return (
    <div
      onClick={() => onClick(entity)}
      className="bg-white rounded-xl border-2 border-slate-200 p-5 transition-all duration-200 cursor-pointer group relative flex flex-col justify-between min-h-[200px] overflow-hidden hover:border-[#256A65]"
    >
      <div className="flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0 group-hover:from-slate-100 group-hover:to-slate-200 transition-all">
              <Database size={18} className="text-slate-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-slate-700 transition-colors truncate">
                {entity.name}
              </h3>
            </div>
          </div>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this entity?')) {
                  onDelete(entity);
                }
              }}
              className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {entity.description && (
          <p className="text-sm text-slate-600 mb-4 line-clamp-2 leading-relaxed">
            {entity.description}
          </p>
        )}

        <div className="space-y-2 mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <User size={12} className="text-slate-400" />
            <span className="text-slate-600">{entity.author}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar size={12} className="text-slate-400" />
            <span>{entity.lastEdited}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Hash size={12} className="text-slate-400" />
            <span><span className="text-slate-600 font-medium">{entity.properties.length}</span> attributes</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity font-medium text-purple-600">Manage entity</span>
        </div>
      </div>
    </div>
  );
};