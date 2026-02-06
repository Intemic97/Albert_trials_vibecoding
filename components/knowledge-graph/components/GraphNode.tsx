/**
 * GraphNode - Renders entity or property node in the graph
 */

import React, { memo } from 'react';
import type { PhysicsNode } from '../hooks/useGraphPhysics';

interface GraphNodeProps {
    node: PhysicsNode;
    label: string;
    isSelected: boolean;
    isHovered: boolean;
    isHighlighted: boolean;
    isDragging: boolean;
    color?: string;
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

export const GraphNode: React.FC<GraphNodeProps> = memo(({
    node,
    label,
    isSelected,
    isHovered,
    isHighlighted,
    isDragging,
    color,
    onMouseDown,
    onClick,
    onMouseEnter,
    onMouseLeave,
}) => {
    const isEntity = node.type === 'entity';
    const nodeColor = color || (isEntity ? 'var(--accent-primary)' : 'var(--accent-success)');
    const scale = isHovered || isSelected ? 1.08 : 1;
    
    // Calculate label width
    const labelLength = label.length;
    const labelWidth = Math.max(60, Math.min(labelLength * 7, 140));
    
    if (isEntity) {
        // Entity node - larger, more prominent
        return (
            <g
                transform={`translate(${node.x}, ${node.y}) scale(${scale})`}
                style={{ 
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                }}
                onMouseDown={onMouseDown}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {/* Shadow */}
                <ellipse
                    cx={2}
                    cy={3}
                    rx={node.radius + 4}
                    ry={node.radius * 0.35 + 4}
                    fill="rgba(0,0,0,0.15)"
                />
                
                {/* Glow effect for highlighted */}
                {isHighlighted && (
                    <circle
                        r={node.radius + 12}
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth={3}
                        opacity={0.3}
                        className="animate-pulse"
                    />
                )}
                
                {/* Selection ring */}
                {isSelected && (
                    <circle
                        r={node.radius + 6}
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth={2.5}
                        strokeDasharray="6 3"
                    />
                )}
                
                {/* Main circle */}
                <circle
                    r={node.radius}
                    fill="var(--bg-card)"
                    stroke={nodeColor}
                    strokeWidth={isSelected || isHovered ? 3 : 2}
                />
                
                {/* Inner gradient */}
                <circle
                    r={node.radius - 3}
                    fill={`url(#entityGradient-${node.id})`}
                    opacity={0.1}
                />
                
                {/* Gradient definition */}
                <defs>
                    <radialGradient id={`entityGradient-${node.id}`}>
                        <stop offset="0%" stopColor={nodeColor} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={nodeColor} stopOpacity={0} />
                    </radialGradient>
                </defs>
                
                {/* Label */}
                <text
                    y={node.radius + 16}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize={11}
                    fontWeight={500}
                    style={{ pointerEvents: 'none' }}
                >
                    {label.length > 18 ? label.substring(0, 16) + '...' : label}
                </text>
                
                {/* Entity type indicator */}
                <circle
                    cx={node.radius * 0.6}
                    cy={-node.radius * 0.6}
                    r={5}
                    fill={nodeColor}
                />
            </g>
        );
    }
    
    // Property node - smaller, simpler
    return (
        <g
            transform={`translate(${node.x}, ${node.y}) scale(${scale})`}
            style={{ 
                cursor: 'pointer',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Highlight glow */}
            {isHighlighted && (
                <circle
                    r={node.radius + 8}
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth={2}
                    opacity={0.3}
                    className="animate-pulse"
                />
            )}
            
            {/* Selection indicator */}
            {isSelected && (
                <circle
                    r={node.radius + 4}
                    fill="none"
                    stroke={nodeColor}
                    strokeWidth={2}
                />
            )}
            
            {/* Main circle */}
            <circle
                r={node.radius}
                fill={isSelected || isHovered ? nodeColor : 'var(--bg-secondary)'}
                stroke={nodeColor}
                strokeWidth={isSelected || isHovered ? 2 : 1.5}
                opacity={isSelected || isHovered ? 1 : 0.9}
            />
            
            {/* Label background */}
            <rect
                x={node.radius + 6}
                y={-8}
                width={labelWidth}
                height={16}
                rx={3}
                fill="var(--bg-card)"
                fillOpacity={isHovered || isSelected ? 1 : 0.85}
                stroke={isSelected ? nodeColor : 'var(--border-light)'}
                strokeWidth={isSelected ? 1.5 : 0.5}
            />
            
            {/* Label */}
            <text
                x={node.radius + 10}
                y={4}
                fill={isSelected ? nodeColor : 'var(--text-secondary)'}
                fontSize={10}
                fontWeight={isSelected ? 500 : 400}
                style={{ pointerEvents: 'none' }}
            >
                {label.length > 16 ? label.substring(0, 14) + '...' : label}
            </text>
        </g>
    );
});

GraphNode.displayName = 'GraphNode';

export default GraphNode;
