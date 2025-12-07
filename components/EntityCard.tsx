import React from 'react';
import { MoreHorizontal, Edit3 } from 'lucide-react';
import { Entity } from '../types';

interface EntityCardProps {
  entity: Entity;
  onClick: (entity: Entity) => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({ entity, onClick }) => {
  return (
    <div 
      onClick={() => onClick(entity)}
      className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group relative flex flex-col justify-between min-h-[200px]"
    >
      <div>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">
            {entity.name}
          </h3>
          <button className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
            <MoreHorizontal size={20} />
          </button>
        </div>
        
        {entity.description && (
          <p className="text-slate-500 text-sm mb-4 line-clamp-2">
            {entity.description}
          </p>
        )}

        <div className="space-y-2 mt-4">
          <p className="text-xs text-slate-400">
            Creator: <span className="text-slate-600">{entity.author}</span>
          </p>
          <p className="text-xs text-slate-400">
            Last edited: <span className="text-slate-600">{entity.lastEdited}</span>
          </p>
          <p className="text-xs text-slate-400">
             Attributes: <span className="text-slate-600 font-medium">{entity.properties.length}</span>
          </p>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100 opacity-0 group-hover:opacity-100 transition-opacity">
          Editable
        </span>
      </div>
    </div>
  );
};