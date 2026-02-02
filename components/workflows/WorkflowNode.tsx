import React from 'react';
import { Play, Database, Copy, X, DotsThreeVertical } from '@phosphor-icons/react';
import { WorkflowNode as WorkflowNodeType, NodeType } from './types';
import { NODE_ICONS } from './constants';

interface WorkflowNodeProps {
  node: WorkflowNodeType;
  isSelected: boolean;
  isDragging: boolean;
  scale: number;
  
  // Node state
  isConfigured: boolean;
  topTag?: {
    label: string;
    color: string;
    icon: React.ElementType;
  } | null;
  
  // Handlers
  onNodeClick: (nodeId: string) => void;
  onNodeDragStart: (e: React.MouseEvent, nodeId: string) => void;
  onRunNode: (nodeId: string) => void;
  onViewData: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onConfigure: (nodeId: string) => void;
  onCommentChange?: (nodeId: string, text: string) => void;
  
  // Connection handlers
  onOutputConnectorMouseDown?: (e: React.MouseEvent, nodeId: string, outputType?: 'true' | 'false' | 'A' | 'B') => void;
  onInputConnectorMouseUp?: (e: React.MouseEvent, nodeId: string, inputPort?: 'A' | 'B') => void;
  
  // Connection state
  isConnecting?: boolean;
  connectingFromNodeId?: string;
  
  // Custom rendering
  children?: React.ReactNode;
}

/**
 * Get icon component for a node type
 */
export const getNodeIcon = (type: NodeType): React.ElementType => {
  return NODE_ICONS[type] || NODE_ICONS.action;
};

/**
 * Get icon color class for a node type
 */
export const getNodeIconColor = (type: NodeType): string => {
  switch (type) {
    case 'trigger':
    case 'webhook':
      return 'text-amber-600';
    case 'fetchData':
    case 'mysql':
    case 'sapFetch':
    case 'limsFetch':
      return 'text-[#256A65]';
    case 'llm':
    case 'agent':
      return 'text-[#256A65]';
    case 'python':
      return 'text-[#84C4D1]';
    case 'condition':
    case 'join':
    case 'splitColumns':
      return 'text-[var(--text-secondary)]';
    case 'sendEmail':
    case 'sendSMS':
      return 'text-green-600';
    case 'esios':
      return 'text-yellow-600';
    case 'climatiq':
      return 'text-emerald-600';
    case 'humanApproval':
      return 'text-orange-600';
    case 'alertAgent':
      return 'text-red-600';
    default:
      return 'text-[var(--text-secondary)]';
  }
};

/**
 * Get node border color based on status
 */
export const getNodeStatusBorder = (status?: string): string => {
  switch (status) {
    case 'completed':
      return 'border-2 border-green-200';
    case 'running':
      return 'border-2 border-yellow-200';
    case 'error':
      return 'border-2 border-red-200';
    case 'waiting':
      return 'border-2 border-orange-200';
    default:
      return 'border border-[var(--border-light)]';
  }
};

/**
 * Individual workflow node component
 */
export const WorkflowNode: React.FC<WorkflowNodeProps> = ({
  node,
  isSelected,
  isDragging,
  scale,
  isConfigured,
  topTag,
  onNodeClick,
  onNodeDragStart,
  onRunNode,
  onViewData,
  onDuplicate,
  onDelete,
  onConfigure,
  onCommentChange,
  onOutputConnectorMouseDown,
  onInputConnectorMouseUp,
  isConnecting,
  connectingFromNodeId,
  children,
}) => {
  const Icon = getNodeIcon(node.type);
  const iconColor = getNodeIconColor(node.type);
  const statusBorder = getNodeStatusBorder(node.status);
  
  const hasData = node.data || node.inputData || node.outputData;
  
  return (
    <div
      data-node-id={node.id}
      onClick={() => onNodeClick(node.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onConfigure(node.id);
      }}
      onMouseDown={(e) => onNodeDragStart(e, node.id)}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        transform: 'translate(-50%, -50%)',
        width: '320px',
        cursor: 'grab',
        zIndex: isSelected ? 20 : 10,
      }}
      className={`
        flex flex-col rounded-xl shadow-md group relative select-none
        bg-[var(--bg-card)] text-[var(--text-primary)]
        ${statusBorder}
        ${isDragging ? '' : 'transition-all duration-200'}
        ${isSelected ? 'ring-2 ring-[var(--accent-primary)]' : ''}
        hover:shadow-lg hover:border-[var(--border-medium)]
      `.trim().replace(/\s+/g, ' ')}
    >
      {/* Top Tag (Not Configured / Status) */}
      {topTag && (
        <div 
          className={`absolute -top-10 left-1/2 flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap z-20 ${topTag.color} shadow-md`}
          style={{ transform: 'translate(-50%, 0)', pointerEvents: 'none' }}
        >
          {React.createElement(topTag.icon, { size: 13, weight: "light" })}
          <span className="truncate">{topTag.label}</span>
        </div>
      )}

      {/* Hover Action Buttons */}
      <div 
        className="absolute -top-9 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all z-30"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRunNode(node.id);
          }}
          className="p-2 bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)] rounded-lg shadow-md border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[#256A65] transition-all active:scale-90"
          title="Run Node"
        >
          <Play size={14} weight="light" />
        </button>
        
        {hasData && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewData(node.id);
            }}
            className="p-2 bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)] rounded-lg shadow-md border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-90"
            title="View Data"
          >
            <Database size={14} weight="light" />
          </button>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(node.id);
          }}
          className="p-2 bg-[var(--bg-card)] hover:bg-[#256A65]/10 rounded-lg shadow-md border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[#256A65] transition-all active:scale-90"
          title="Duplicate Node"
        >
          <Copy size={14} weight="light" />
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
          className="p-2 bg-[var(--bg-card)] hover:bg-red-50 rounded-lg shadow-md border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-red-600 transition-all active:scale-90"
          title="Delete Node"
        >
          <X size={14} weight="light" />
        </button>
      </div>

      {/* Node Content */}
      <div className="flex flex-col p-5 min-w-0">
        {node.type === 'comment' ? (
          /* Comment Node */
          <textarea
            value={node.config?.commentText || ''}
            onChange={(e) => onCommentChange?.(node.id, e.target.value)}
            placeholder="Write a comment..."
            className="w-full p-3 text-sm bg-transparent border-none resize-none focus:outline-none text-[var(--text-primary)] min-h-[60px] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          /* Regular Node */
          <>
            {/* Header */}
            <div className="flex items-center gap-4 py-2">
              <div className="p-2.5 rounded-lg flex-shrink-0 flex items-center justify-center">
                <Icon size={20} className={iconColor} weight="light" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 
                  className="text-xl font-normal text-[var(--text-primary)] break-words leading-snug"
                  style={{ fontFamily: "'Berkeley Mono', monospace" }}
                >
                  {node.config?.customName || node.label}
                </h3>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfigure(node.id);
                }}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100"
                title="Configure"
              >
                <DotsThreeVertical size={16} weight="light" />
              </button>
            </div>

            {/* Custom content from parent */}
            {children}
          </>
        )}
      </div>

      {/* Output Connector - Right side */}
      {node.type !== 'output' && node.type !== 'comment' && (
        <div 
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 group/connector cursor-crosshair z-30 pointer-events-auto"
          onMouseDown={(e) => {
            e.stopPropagation();
            onOutputConnectorMouseDown?.(e, node.id);
          }}
        >
          <div className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto" />
          <div className={`
            w-5 h-5 bg-[var(--bg-card)] border-2 rounded-full transition-all shadow-sm pointer-events-none
            ${connectingFromNodeId === node.id 
              ? 'border-[#256A65] scale-125 bg-[#256A65]/10 shadow-md' 
              : 'border-[var(--border-medium)] group-hover/connector:border-[#256A65] group-hover/connector:bg-[#256A65]/10 group-hover/connector:scale-110 group-hover/connector:shadow-md'}
          `} />
        </div>
      )}

      {/* Input Connector - Left side */}
      {node.type !== 'trigger' && node.type !== 'webhook' && (
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 group/connector z-30 pointer-events-auto"
        >
          <div 
            className="absolute inset-0 -m-2 cursor-crosshair pointer-events-auto"
            onMouseUp={(e) => {
              e.stopPropagation();
              onInputConnectorMouseUp?.(e, node.id);
            }}
          />
          <div className={`
            w-5 h-5 bg-[var(--bg-card)] border-2 rounded-full transition-all shadow-sm pointer-events-none
            border-[var(--border-medium)] 
            group-hover/connector:border-[#256A65] group-hover/connector:bg-[#256A65]/10 
            group-hover/connector:scale-110 group-hover/connector:shadow-md
          `} />
        </div>
      )}
    </div>
  );
};

export default WorkflowNode;
