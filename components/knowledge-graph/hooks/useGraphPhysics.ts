/**
 * useGraphPhysics - Optimized physics simulation for Knowledge Graph
 * 
 * Uses refs for positions to minimize re-renders during animation.
 * Only triggers state update when simulation settles.
 */

import { useRef, useCallback, useEffect } from 'react';

export interface PhysicsNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    fixed?: boolean;
    parentId?: string;
    orbitRadius?: number;
    orbitAngle?: number;
    type: 'entity' | 'property';
}

export interface PhysicsEdge {
    source: string;
    target: string;
}

interface PhysicsConfig {
    repulsion: number;
    linkAttraction: number;
    centerPull: number;
    damping: number;
    collisionStrength: number;
    minSeparation: number;
}

const DEFAULT_CONFIG: PhysicsConfig = {
    repulsion: 150,
    linkAttraction: 0.02,
    centerPull: 0.0008,
    damping: 0.94,
    collisionStrength: 0.15,
    minSeparation: 70,
};

interface UseGraphPhysicsOptions {
    nodes: PhysicsNode[];
    edges: PhysicsEdge[];
    width: number;
    height: number;
    config?: Partial<PhysicsConfig>;
    onUpdate: (nodes: PhysicsNode[]) => void;
    onSettle: () => void;
}

export const useGraphPhysics = ({
    nodes,
    edges,
    width,
    height,
    config = {},
    onUpdate,
    onSettle,
}: UseGraphPhysicsOptions) => {
    const nodesRef = useRef<PhysicsNode[]>([]);
    const animationRef = useRef<number | null>(null);
    const frameCountRef = useRef(0);
    const isRunningRef = useRef(false);
    const settledRef = useRef(false);
    
    const physics = { ...DEFAULT_CONFIG, ...config };
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Build adjacency map for connected entities
    const connectedEntitiesRef = useRef<Map<string, Set<string>>>(new Map());
    
    useEffect(() => {
        const connected = new Map<string, Set<string>>();
        edges.forEach(edge => {
            if (edge.source.startsWith('entity-') && edge.target.startsWith('entity-')) {
                if (!connected.has(edge.source)) connected.set(edge.source, new Set());
                if (!connected.has(edge.target)) connected.set(edge.target, new Set());
                connected.get(edge.source)!.add(edge.target);
                connected.get(edge.target)!.add(edge.source);
            }
        });
        connectedEntitiesRef.current = connected;
    }, [edges]);
    
    // Initialize nodes ref
    useEffect(() => {
        nodesRef.current = nodes.map(n => ({ ...n }));
        settledRef.current = false;
        frameCountRef.current = 0;
    }, [nodes.length]);
    
    const simulate = useCallback(() => {
        if (!isRunningRef.current) return;
        
        const maxFrames = 400;
        const updateInterval = 3; // Update React state every N frames
        
        if (frameCountRef.current >= maxFrames) {
            isRunningRef.current = false;
            settledRef.current = true;
            onSettle();
            onUpdate([...nodesRef.current]);
            return;
        }
        
        const progress = frameCountRef.current / maxFrames;
        // Very gentle easing - forces start weak and gradually increase
        const forceMultiplier = Math.min(1, progress * progress * 2);
        
        const updated = nodesRef.current;
        const entityMap = new Map<string, PhysicsNode>();
        const connectedEntities = connectedEntitiesRef.current;
        
        // First pass: store entity positions
        updated.forEach(node => {
            if (node.type === 'entity') {
                entityMap.set(node.id, node);
            }
        });
        
        // Calculate territories
        const entityTerritories = new Map<string, number>();
        updated.forEach(node => {
            if (node.type === 'entity') {
                let maxOrbit = 0;
                updated.forEach(other => {
                    if (other.parentId === node.id && other.orbitRadius) {
                        maxOrbit = Math.max(maxOrbit, other.orbitRadius);
                    }
                });
                entityTerritories.set(node.id, maxOrbit + 20);
            }
        });
        
        // Apply forces to entities
        updated.forEach((node, i) => {
            if (node.type !== 'entity' || node.fixed) return;
            
            let fx = 0, fy = 0;
            const nodeTerritory = entityTerritories.get(node.id) || physics.minSeparation / 2;
            const connections = connectedEntities.get(node.id);
            
            updated.forEach((other, j) => {
                if (i === j || other.type !== 'entity') return;
                
                const otherTerritory = entityTerritories.get(other.id) || physics.minSeparation / 2;
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                
                const isConnected = connections?.has(other.id);
                
                if (isConnected) {
                    // Attraction between connected entities
                    const idealDist = nodeTerritory + otherTerritory + 40;
                    if (dist > idealDist) {
                        const pullStrength = (dist - idealDist) * physics.linkAttraction * forceMultiplier;
                        fx -= (dx / dist) * pullStrength;
                        fy -= (dy / dist) * pullStrength;
                    }
                }
                
                // Repulsion when too close
                const minDist = nodeTerritory + otherTerritory;
                if (dist < minDist) {
                    const overlap = minDist - dist;
                    const pushStrength = overlap * physics.collisionStrength * forceMultiplier;
                    fx += (dx / dist) * pushStrength;
                    fy += (dy / dist) * pushStrength;
                } else if (!isConnected && dist < minDist * 1.5) {
                    // Gentle repulsion for unconnected
                    const gentlePush = physics.repulsion * forceMultiplier / (dist * dist + 400);
                    fx += (dx / dist) * gentlePush;
                    fy += (dy / dist) * gentlePush;
                }
            });
            
            // Center pull
            fx += (centerX - node.x) * physics.centerPull * forceMultiplier;
            fy += (centerY - node.y) * physics.centerPull * forceMultiplier;
            
            // Apply velocity
            node.vx = (node.vx + fx * 0.04) * physics.damping;
            node.vy = (node.vy + fy * 0.04) * physics.damping;
            node.x += node.vx;
            node.y += node.vy;
            
            // Soft bounds
            const padding = nodeTerritory + 50;
            if (node.x < padding) node.vx += (padding - node.x) * 0.015;
            if (node.x > width - padding) node.vx -= (node.x - (width - padding)) * 0.015;
            if (node.y < padding) node.vy += (padding - node.y) * 0.015;
            if (node.y > height - padding) node.vy -= (node.y - (height - padding)) * 0.015;
        });
        
        // Update property positions
        updated.forEach(node => {
            if (node.fixed) return;
            if (node.parentId && node.orbitRadius && node.orbitAngle !== undefined) {
                const parent = entityMap.get(node.parentId);
                if (parent) {
                    const targetX = parent.x + Math.cos(node.orbitAngle) * node.orbitRadius;
                    const targetY = parent.y + Math.sin(node.orbitAngle) * node.orbitRadius;
                    node.x += (targetX - node.x) * 0.12;
                    node.y += (targetY - node.y) * 0.12;
                }
            }
        });
        
        frameCountRef.current++;
        
        // Update React state periodically for smooth visual updates
        if (frameCountRef.current % updateInterval === 0) {
            onUpdate([...updated]);
        }
        
        animationRef.current = requestAnimationFrame(simulate);
    }, [width, height, physics, onUpdate, onSettle]);
    
    const start = useCallback(() => {
        if (isRunningRef.current) return;
        isRunningRef.current = true;
        settledRef.current = false;
        frameCountRef.current = 0;
        simulate();
    }, [simulate]);
    
    const stop = useCallback(() => {
        isRunningRef.current = false;
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);
    
    const reset = useCallback(() => {
        stop();
        frameCountRef.current = 0;
        settledRef.current = false;
    }, [stop]);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stop();
        };
    }, [stop]);
    
    return {
        start,
        stop,
        reset,
        isSettled: () => settledRef.current,
        isRunning: () => isRunningRef.current,
    };
};

export default useGraphPhysics;
