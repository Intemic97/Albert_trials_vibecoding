import React from 'react';
import { Connection, WorkflowNode } from './types';
import { CANVAS_CONSTANTS } from './constants';

interface ConnectionLineProps {
  connection: Connection;
  fromNode: WorkflowNode;
  toNode: WorkflowNode;
  isRunning?: boolean;
  isHovered?: boolean;
  onHover?: (connectionId: string | null) => void;
  onDelete?: (connectionId: string) => void;
}

/**
 * Calculate connection path between two nodes
 */
const calculatePath = (
  fromNode: WorkflowNode,
  toNode: WorkflowNode,
  outputType?: 'true' | 'false' | 'A' | 'B',
  inputPort?: 'A' | 'B'
): { x1: number; y1: number; x2: number; y2: number; path: string } => {
  const { NODE_HALF_WIDTH, CONNECTOR_RADIUS } = CANVAS_CONSTANTS;

  // Calculate X positions
  const x1 = fromNode.x + NODE_HALF_WIDTH + CONNECTOR_RADIUS;
  const x2 = toNode.x - NODE_HALF_WIDTH - CONNECTOR_RADIUS;

  // Calculate Y positions using fixed offsets from node center
  let y1 = fromNode.y;
  let y2 = toNode.y;

  // Adjust Y1 for special output types (fixed offset: 37px from center)
  if (fromNode.type === 'condition' || fromNode.type === 'splitColumns') {
    if (outputType === 'true' || outputType === 'A') {
      y1 = fromNode.y - 37;
    } else if (outputType === 'false' || outputType === 'B') {
      y1 = fromNode.y + 37;
    }
  }

  // Adjust Y2 for join node inputs (fixed offsets from center)
  if (toNode.type === 'join') {
    if (inputPort === 'A') {
      y2 = toNode.y - 5;
    } else if (inputPort === 'B') {
      y2 = toNode.y + 25;
    }
  }

  // Calculate bezier control points - smoother curves
  const dx = Math.abs(x2 - x1);
  const curvature = Math.min(dx * 0.5, Math.max(80, dx * 0.4));
  const c1x = x1 + curvature;
  const c1y = y1;
  const c2x = x2 - curvature;
  const c2y = y2;

  const path = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;

  return { x1, y1, x2, y2, path };
};

/**
 * Get stroke color based on connection type
 */
const getStrokeColor = (
  outputType?: 'true' | 'false' | 'A' | 'B',
  isRunning?: boolean
): string => {
  if (isRunning) return '#CFE8ED';
  
  switch (outputType) {
    case 'true':
      return '#10b981'; // green
    case 'false':
      return '#ef4444'; // red
    case 'A':
      return '#3b82f6'; // blue
    case 'B':
      return '#a855f7'; // purple
    default:
      return '#cbd5e1'; // slate-300
  }
};

/**
 * Connection line component
 */
export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  connection,
  fromNode,
  toNode,
  isRunning = false,
  isHovered = false,
  onHover,
  onDelete,
}) => {
  const { path, x2, y2 } = calculatePath(
    fromNode,
    toNode,
    connection.outputType,
    connection.inputPort
  );

  const strokeColor = getStrokeColor(connection.outputType, isRunning);
  const strokeWidth = isRunning ? 3 : 2;

  return (
    <g className="connection-group" style={{ pointerEvents: 'none' }}>
      {/* Invisible wider path for hover detection */}
      {!isRunning && (
        <path
          d={path}
          stroke="transparent"
          strokeWidth="8"
          fill="none"
          className="cursor-pointer"
          style={{ pointerEvents: 'stroke' }}
          onMouseEnter={() => onHover?.(connection.id)}
          onMouseLeave={() => onHover?.(null)}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(connection.id);
          }}
        />
      )}

      {/* Main connection line */}
      <path
        d={path}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={isRunning ? 'none' : '5,5'}
        style={{
          filter: isRunning ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' : 'none',
          transition: 'all 0.2s ease',
          opacity: isHovered ? 0.5 : 1,
        }}
      />

      {/* End point circle */}
      <circle
        cx={x2}
        cy={y2}
        r={isRunning ? 5 : 4}
        fill={strokeColor}
        style={{
          transition: 'all 0.2s ease',
        }}
      />

      {/* Delete button on hover */}
      {isHovered && !isRunning && (
        <g
          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(connection.id);
          }}
        >
          <circle
            cx={(fromNode.x + toNode.x) / 2}
            cy={(fromNode.y + toNode.y) / 2}
            r="12"
            fill="white"
            stroke="#ef4444"
            strokeWidth="2"
          />
          <text
            x={(fromNode.x + toNode.x) / 2}
            y={(fromNode.y + toNode.y) / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ef4444"
            fontSize="14"
            fontWeight="bold"
          >
            ×
          </text>
        </g>
      )}
    </g>
  );
};

/**
 * Dragging connection line (while creating a new connection)
 */
interface DraggingConnectionProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  outputType?: 'true' | 'false' | 'A' | 'B';
}

export const DraggingConnection: React.FC<DraggingConnectionProps> = ({
  startX,
  startY,
  endX,
  endY,
  outputType,
}) => {
  const strokeColor = getStrokeColor(outputType);
  
  // Calculate bezier control points - smoother curves
  const dx = Math.abs(endX - startX);
  const curvature = Math.min(dx * 0.5, Math.max(80, dx * 0.4));
  const c1x = startX + curvature;
  const c1y = startY;
  const c2x = endX - curvature;
  const c2y = endY;

  const path = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;

  return (
    <g className="dragging-connection" style={{ pointerEvents: 'none' }}>
      {/* Shadow line */}
      <path
        d={path}
        stroke={strokeColor}
        strokeWidth="4"
        fill="none"
        strokeDasharray="5,5"
        opacity="0.2"
      />
      
      {/* Main line */}
      <path
        d={path}
        stroke={strokeColor}
        strokeWidth="3"
        fill="none"
        strokeDasharray="5,5"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
      />
      
      {/* End point circle */}
      <circle cx={endX} cy={endY} r="5" fill={strokeColor} />
    </g>
  );
};

export default ConnectionLine;
