/**
 * FolderCluster - Visual grouping of entities by folder
 */

import React, { memo, useMemo } from 'react';
import { Folder as FolderIcon } from '@phosphor-icons/react';

interface PhysicsNode {
    id: string;
    x: number;
    y: number;
    radius: number;
    type: 'entity' | 'property';
    entityId?: string;
}

interface Folder {
    id: string;
    name: string;
    color?: string;
    entityIds: string[];
}

interface FolderClusterProps {
    folder: Folder;
    nodes: PhysicsNode[];
    isHighlighted?: boolean;
}

export const FolderCluster: React.FC<FolderClusterProps> = memo(({
    folder,
    nodes,
    isHighlighted,
}) => {
    // Find all entity nodes that belong to this folder
    const folderEntityIds = new Set(folder.entityIds || []);
    
    const clusterData = useMemo(() => {
        const entityNodes = nodes.filter(n => 
            n.type === 'entity' && 
            n.entityId && 
            folderEntityIds.has(n.entityId)
        );
        
        if (entityNodes.length === 0) return null;
        
        // Calculate bounding box with padding
        const padding = 60;
        const minX = Math.min(...entityNodes.map(n => n.x)) - padding;
        const maxX = Math.max(...entityNodes.map(n => n.x)) + padding;
        const minY = Math.min(...entityNodes.map(n => n.y)) - padding;
        const maxY = Math.max(...entityNodes.map(n => n.y)) + padding;
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Calculate center
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Generate a smooth blob path (rounded rectangle with organic curves)
        const rx = Math.min(30, width / 4);
        const ry = Math.min(30, height / 4);
        
        return {
            x: minX,
            y: minY,
            width,
            height,
            centerX,
            centerY,
            rx,
            ry,
            entityCount: entityNodes.length,
        };
    }, [nodes, folderEntityIds]);
    
    if (!clusterData) return null;
    
    const folderColor = folder.color || '#F59E0B';
    
    return (
        <g>
            {/* Background area */}
            <rect
                x={clusterData.x}
                y={clusterData.y}
                width={clusterData.width}
                height={clusterData.height}
                rx={clusterData.rx}
                ry={clusterData.ry}
                fill={folderColor}
                fillOpacity={isHighlighted ? 0.15 : 0.06}
                stroke={folderColor}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeOpacity={isHighlighted ? 0.5 : 0.2}
                strokeDasharray={isHighlighted ? undefined : '6 4'}
            />
            
            {/* Folder label at top-left corner */}
            <g transform={`translate(${clusterData.x + 12}, ${clusterData.y + 16})`}>
                <rect
                    x={-6}
                    y={-11}
                    width={Math.min(folder.name.length * 7 + 32, 140)}
                    height={20}
                    rx={4}
                    fill="rgba(0,0,0,0.5)"
                />
                <FolderIcon
                    size={12}
                    weight="fill"
                    style={{ color: folderColor }}
                />
                <text
                    x={16}
                    y={4}
                    fill={folderColor}
                    fontSize={10}
                    fontWeight={500}
                    style={{ pointerEvents: 'none' }}
                >
                    {folder.name.length > 14 ? folder.name.substring(0, 12) + '...' : folder.name}
                </text>
            </g>
        </g>
    );
});

FolderCluster.displayName = 'FolderCluster';

export default FolderCluster;
