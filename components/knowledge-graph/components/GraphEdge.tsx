/**
 * GraphEdge - Renders a connection between nodes
 */

import React, { memo, useMemo } from 'react';
import type { PhysicsNode } from '../hooks/useGraphPhysics';

interface GraphEdgeProps {
    sourceNode: PhysicsNode;
    targetNode: PhysicsNode;
    isHighlighted?: boolean;
    isEntityConnection?: boolean;
}

export const GraphEdge: React.FC<GraphEdgeProps> = memo(({
    sourceNode,
    targetNode,
    isHighlighted,
    isEntityConnection,
}) => {
    const path = useMemo(() => {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        
        // Start and end points adjusted for node radii
        const startX = sourceNode.x + (dx / dist) * sourceNode.radius;
        const startY = sourceNode.y + (dy / dist) * sourceNode.radius;
        const endX = targetNode.x - (dx / dist) * targetNode.radius;
        const endY = targetNode.y - (dy / dist) * targetNode.radius;
        
        if (isEntityConnection) {
            // Curved path for entity-to-entity connections
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            
            // Perpendicular offset for curve
            const perpX = -dy / dist;
            const perpY = dx / dist;
            const curveOffset = Math.min(30, dist * 0.15);
            
            const ctrlX = midX + perpX * curveOffset;
            const ctrlY = midY + perpY * curveOffset;
            
            return `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
        }
        
        // Straight line for property connections
        return `M ${startX} ${startY} L ${endX} ${endY}`;
    }, [sourceNode, targetNode, isEntityConnection]);
    
    const strokeColor = isEntityConnection
        ? 'var(--accent-primary)'
        : 'var(--border-dark)';
    
    const strokeWidth = isHighlighted ? 2.5 : (isEntityConnection ? 1.5 : 1);
    const opacity = isHighlighted ? 0.9 : (isEntityConnection ? 0.5 : 0.4);
    
    return (
        <g>
            {/* Glow effect for highlighted */}
            {isHighlighted && (
                <path
                    d={path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth + 4}
                    opacity={0.2}
                />
            )}
            
            {/* Main path */}
            <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeDasharray={isEntityConnection ? undefined : '4 2'}
            />
            
            {/* Arrow for entity connections */}
            {isEntityConnection && (
                <ArrowHead
                    endX={targetNode.x - ((targetNode.x - sourceNode.x) / (Math.sqrt((targetNode.x - sourceNode.x) ** 2 + (targetNode.y - sourceNode.y) ** 2) || 1)) * targetNode.radius}
                    endY={targetNode.y - ((targetNode.y - sourceNode.y) / (Math.sqrt((targetNode.x - sourceNode.x) ** 2 + (targetNode.y - sourceNode.y) ** 2) || 1)) * targetNode.radius}
                    angle={Math.atan2(targetNode.y - sourceNode.y, targetNode.x - sourceNode.x)}
                    color={strokeColor}
                    isHighlighted={isHighlighted}
                />
            )}
        </g>
    );
});

GraphEdge.displayName = 'GraphEdge';

// Arrow head component
const ArrowHead: React.FC<{
    endX: number;
    endY: number;
    angle: number;
    color: string;
    isHighlighted?: boolean;
}> = memo(({ endX, endY, angle, color, isHighlighted }) => {
    const arrowSize = isHighlighted ? 8 : 6;
    const arrowAngle = Math.PI / 6;
    
    const x1 = endX - arrowSize * Math.cos(angle - arrowAngle);
    const y1 = endY - arrowSize * Math.sin(angle - arrowAngle);
    const x2 = endX - arrowSize * Math.cos(angle + arrowAngle);
    const y2 = endY - arrowSize * Math.sin(angle + arrowAngle);
    
    return (
        <polygon
            points={`${endX},${endY} ${x1},${y1} ${x2},${y2}`}
            fill={color}
            opacity={isHighlighted ? 0.9 : 0.5}
        />
    );
});

ArrowHead.displayName = 'ArrowHead';

export default GraphEdge;
