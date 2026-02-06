/**
 * GraphMinimap - Miniature overview of the graph for navigation
 */

import React, { useMemo } from 'react';
import type { PhysicsNode } from '../hooks/useGraphPhysics';

interface GraphMinimapProps {
    nodes: PhysicsNode[];
    viewportWidth: number;
    viewportHeight: number;
    zoom: number;
    offsetX: number;
    offsetY: number;
    onViewportChange: (offsetX: number, offsetY: number) => void;
}

export const GraphMinimap: React.FC<GraphMinimapProps> = ({
    nodes,
    viewportWidth,
    viewportHeight,
    zoom,
    offsetX,
    offsetY,
    onViewportChange,
}) => {
    const minimapSize = { width: 180, height: 120 };
    
    const { bounds, scale } = useMemo(() => {
        const entityNodes = nodes.filter(n => n.type === 'entity');
        if (entityNodes.length === 0) {
            return {
                bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 800 },
                scale: 0.15,
            };
        }
        
        const padding = 100;
        const minX = Math.min(...entityNodes.map(n => n.x)) - padding;
        const maxX = Math.max(...entityNodes.map(n => n.x)) + padding;
        const minY = Math.min(...entityNodes.map(n => n.y)) - padding;
        const maxY = Math.max(...entityNodes.map(n => n.y)) + padding;
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        const scaleX = minimapSize.width / contentWidth;
        const scaleY = minimapSize.height / contentHeight;
        const s = Math.min(scaleX, scaleY) * 0.9;
        
        return {
            bounds: { minX, maxX, minY, maxY },
            scale: s,
        };
    }, [nodes, minimapSize]);
    
    // Calculate viewport rect in minimap coordinates
    const viewportRect = useMemo(() => {
        const vpLeft = -offsetX / zoom;
        const vpTop = -offsetY / zoom;
        const vpWidth = viewportWidth / zoom;
        const vpHeight = viewportHeight / zoom;
        
        return {
            x: (vpLeft - bounds.minX) * scale,
            y: (vpTop - bounds.minY) * scale,
            width: vpWidth * scale,
            height: vpHeight * scale,
        };
    }, [bounds, scale, zoom, offsetX, offsetY, viewportWidth, viewportHeight]);
    
    const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        // Convert click to world coordinates
        const worldX = clickX / scale + bounds.minX;
        const worldY = clickY / scale + bounds.minY;
        
        // Center viewport on clicked point
        const newOffsetX = -worldX * zoom + viewportWidth / 2;
        const newOffsetY = -worldY * zoom + viewportHeight / 2;
        
        onViewportChange(newOffsetX, newOffsetY);
    };
    
    return (
        <div 
            className="absolute bottom-4 right-4 bg-[var(--bg-card)]/90 backdrop-blur-sm rounded-lg border border-[var(--border-light)] p-2 shadow-lg"
            style={{ width: minimapSize.width + 16, height: minimapSize.height + 16 }}
        >
            <svg
                width={minimapSize.width}
                height={minimapSize.height}
                className="cursor-pointer"
                onClick={handleMinimapClick}
            >
                {/* Background */}
                <rect
                    x={0}
                    y={0}
                    width={minimapSize.width}
                    height={minimapSize.height}
                    fill="var(--bg-secondary)"
                    rx={4}
                />
                
                {/* Nodes */}
                {nodes.filter(n => n.type === 'entity').map(node => (
                    <circle
                        key={node.id}
                        cx={(node.x - bounds.minX) * scale}
                        cy={(node.y - bounds.minY) * scale}
                        r={4}
                        fill="var(--accent-primary)"
                        opacity={0.8}
                    />
                ))}
                
                {/* Viewport indicator */}
                <rect
                    x={Math.max(0, viewportRect.x)}
                    y={Math.max(0, viewportRect.y)}
                    width={Math.min(minimapSize.width, viewportRect.width)}
                    height={Math.min(minimapSize.height, viewportRect.height)}
                    fill="var(--accent-primary)"
                    fillOpacity={0.15}
                    stroke="var(--accent-primary)"
                    strokeWidth={1.5}
                    rx={2}
                />
            </svg>
        </div>
    );
};

export default GraphMinimap;
