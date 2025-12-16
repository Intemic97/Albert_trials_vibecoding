import { useState, useEffect, useRef, useCallback } from 'react';

interface User {
    id: string;
    name: string;
    email?: string;
    profilePhoto?: string;
}

interface CursorPosition {
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
}

export interface RemoteUser {
    id: string;
    visibleId?: string; // Unique visible ID for deduplication (same user = same visibleId)
    user: {
        id: string;
        name: string;
        color: string;
        profilePhoto?: string;
    };
    cursor: CursorPosition | null;
}

interface NodeUpdate {
    nodeId: string;
    x: number;
    y: number;
}

interface ConnectionUpdate {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    outputType?: 'true' | 'false' | 'A' | 'B';
    inputPort?: 'A' | 'B';
}

interface UseCollaborativeCursorsProps {
    workflowId: string | null;
    user: User | null;
    enabled?: boolean;
    onNodeUpdate?: (nodeId: string, x: number, y: number) => void;
    onNodeAdded?: (node: any) => void;
    onNodeDeleted?: (nodeId: string) => void;
    onConnectionAdded?: (connection: ConnectionUpdate) => void;
    onConnectionDeleted?: (connectionId: string) => void;
}

interface UseCollaborativeCursorsReturn {
    remoteCursors: Map<string, RemoteUser>;
    remoteUsers: RemoteUser[]; // Deduplicated list of remote users for avatar display
    sendCursorPosition: (x: number, y: number, canvasX: number, canvasY: number) => void;
    sendNodeMove: (nodeId: string, x: number, y: number) => void;
    sendNodeAdd: (node: any) => void;
    sendNodeDelete: (nodeId: string) => void;
    sendConnectionAdd: (connection: ConnectionUpdate) => void;
    sendConnectionDelete: (connectionId: string) => void;
    isConnected: boolean;
    myColor: string | null;
    activeUsers: number;
}

// Build WebSocket URL dynamically to avoid SSR issues
const getWsUrl = () => {
    if (typeof window === 'undefined') return '';
    return `ws://${window.location.hostname}:3001/ws`;
};

export function useCollaborativeCursors({
    workflowId,
    user,
    enabled = true,
    onNodeUpdate,
    onNodeAdded,
    onNodeDeleted,
    onConnectionAdded,
    onConnectionDeleted
}: UseCollaborativeCursorsProps): UseCollaborativeCursorsReturn {
    const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteUser>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [myColor, setMyColor] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const lastSentPositionRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const isCleaningUpRef = useRef(false);
    
    // Store callbacks in refs to prevent effect re-runs
    const onNodeUpdateRef = useRef(onNodeUpdate);
    const onNodeAddedRef = useRef(onNodeAdded);
    const onNodeDeletedRef = useRef(onNodeDeleted);
    const onConnectionAddedRef = useRef(onConnectionAdded);
    const onConnectionDeletedRef = useRef(onConnectionDeleted);
    
    // Update refs when callbacks change
    useEffect(() => {
        onNodeUpdateRef.current = onNodeUpdate;
        onNodeAddedRef.current = onNodeAdded;
        onNodeDeletedRef.current = onNodeDeleted;
        onConnectionAddedRef.current = onConnectionAdded;
        onConnectionDeletedRef.current = onConnectionDeleted;
    }, [onNodeUpdate, onNodeAdded, onNodeDeleted, onConnectionAdded, onConnectionDeleted]);

    // Cleanup function
    const cleanup = useCallback(() => {
        if (isCleaningUpRef.current) return;
        isCleaningUpRef.current = true;
        
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            // Send leave message before closing
            if (wsRef.current.readyState === WebSocket.OPEN) {
                try {
                    wsRef.current.send(JSON.stringify({ type: 'leave' }));
                } catch (e) {
                    // Ignore send errors during cleanup
                }
            }
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        setRemoteCursors(new Map());
        isCleaningUpRef.current = false;
    }, []);

    // Connect to WebSocket
    useEffect(() => {
        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        
        // Clean up any existing connection first
        if (wsRef.current) {
            console.log('[Collab] Cleaning up existing connection');
            // Mark as cleaning up to prevent reconnection
            isCleaningUpRef.current = true;
            if (wsRef.current.readyState === WebSocket.OPEN) {
                try {
                    wsRef.current.send(JSON.stringify({ type: 'leave' }));
                } catch (e) { /* ignore */ }
            }
            wsRef.current.close();
            wsRef.current = null;
            isCleaningUpRef.current = false;
        }
        
        if (!enabled || !workflowId || !user) {
            setIsConnected(false);
            setRemoteCursors(new Map());
            return;
        }

        const connect = () => {
            try {
                const wsUrl = getWsUrl();
                if (!wsUrl) return;
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    console.log('[Collab] WebSocket connected, joining workflow:', workflowId);
                    setIsConnected(true);
                    // Join the workflow room
                    ws.send(JSON.stringify({
                        type: 'join',
                        workflowId,
                        user: {
                            id: user.id,
                            name: user.name || user.email?.split('@')[0] || 'Anonymous',
                            email: user.email,
                            profilePhoto: user.profilePhoto
                        }
                    }));
                };

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);

                        switch (message.type) {
                            case 'room_state': {
                                // Initial state with existing users
                                console.log('[Collab] Room state received, existing users:', message.users.length);
                                const newCursors = new Map<string, RemoteUser>();
                                message.users.forEach((u: RemoteUser) => {
                                    newCursors.set(u.id, u);
                                });
                                setRemoteCursors(newCursors);
                                setMyColor(message.yourColor);
                                break;
                            }

                            case 'user_joined': {
                                console.log('[Collab] User joined:', message.user.name);
                                setRemoteCursors(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(message.id, {
                                        id: message.id,
                                        user: message.user,
                                        cursor: null
                                    });
                                    return newMap;
                                });
                                break;
                            }

                            case 'cursor_update': {
                                setRemoteCursors(prev => {
                                    const newMap = new Map(prev);
                                    const existing = newMap.get(message.id);
                                    if (existing) {
                                        newMap.set(message.id, {
                                            ...existing,
                                            cursor: message.cursor
                                        });
                                    }
                                    return newMap;
                                });
                                break;
                            }

                            case 'user_left': {
                                setRemoteCursors(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(message.id);
                                    return newMap;
                                });
                                break;
                            }

                            // Node collaboration events
                            case 'node_update': {
                                if (onNodeUpdateRef.current) {
                                    onNodeUpdateRef.current(message.nodeId, message.x, message.y);
                                }
                                break;
                            }

                            case 'node_added': {
                                if (onNodeAddedRef.current) {
                                    onNodeAddedRef.current(message.node);
                                }
                                break;
                            }

                            case 'node_deleted': {
                                if (onNodeDeletedRef.current) {
                                    onNodeDeletedRef.current(message.nodeId);
                                }
                                break;
                            }

                            case 'connection_added': {
                                if (onConnectionAddedRef.current) {
                                    onConnectionAddedRef.current(message.connection);
                                }
                                break;
                            }

                            case 'connection_deleted': {
                                if (onConnectionDeletedRef.current) {
                                    onConnectionDeletedRef.current(message.connectionId);
                                }
                                break;
                            }
                        }
                    } catch (err) {
                        console.error('Error parsing WebSocket message:', err);
                    }
                };

                ws.onclose = () => {
                    console.log('[Collab] WebSocket disconnected');
                    setIsConnected(false);
                    wsRef.current = null;
                    
                    // Only attempt to reconnect if we're not intentionally cleaning up
                    if (!isCleaningUpRef.current && enabled && workflowId) {
                        reconnectTimeoutRef.current = window.setTimeout(() => {
                            console.log('[Collab] Attempting reconnect...');
                            connect();
                        }, 3000);
                    }
                };

                ws.onerror = (err) => {
                    console.error('[Collab] WebSocket error:', err);
                };
            } catch (err) {
                console.error('Failed to create WebSocket:', err);
            }
        };

        connect();

        // Handle page unload/refresh
        const handleBeforeUnload = () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'leave' }));
                wsRef.current.close();
            }
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            cleanup();
        };
    }, [workflowId, user?.id, enabled, cleanup]);

    // Throttled cursor position sender
    const sendCursorPosition = useCallback((x: number, y: number, canvasX: number, canvasY: number) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const now = Date.now();
        const last = lastSentPositionRef.current;

        // Throttle: only send if 50ms passed or position changed significantly
        if (last) {
            const timeDiff = now - last.time;
            const posDiff = Math.abs(x - last.x) + Math.abs(y - last.y);
            
            if (timeDiff < 50 && posDiff < 5) {
                return;
            }
        }

        lastSentPositionRef.current = { x, y, time: now };

        wsRef.current.send(JSON.stringify({
            type: 'cursor_move',
            x,
            y,
            canvasX,
            canvasY
        }));
    }, []);

    // Send node movement
    const sendNodeMove = useCallback((nodeId: string, x: number, y: number) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'node_move',
            nodeId,
            x,
            y
        }));
    }, []);

    // Send node add
    const sendNodeAdd = useCallback((node: any) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'node_add',
            node
        }));
    }, []);

    // Send node delete
    const sendNodeDelete = useCallback((nodeId: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'node_delete',
            nodeId
        }));
    }, []);

    // Send connection add
    const sendConnectionAdd = useCallback((connection: ConnectionUpdate) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'connection_add',
            connection
        }));
    }, []);

    // Send connection delete
    const sendConnectionDelete = useCallback((connectionId: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'connection_delete',
            connectionId
        }));
    }, []);

    // Deduplicate remote users by their actual user ID (not socket ID)
    // This handles the case where the same user has multiple tabs open
    const remoteUsers = Array.from(remoteCursors.values()).reduce((acc: RemoteUser[], remote) => {
        // Check if we already have a user with the same user.id
        const existingIndex = acc.findIndex(u => u.user.id === remote.user.id);
        if (existingIndex === -1) {
            acc.push(remote);
        }
        return acc;
    }, []);

    return {
        remoteCursors,
        remoteUsers,
        sendCursorPosition,
        sendNodeMove,
        sendNodeAdd,
        sendNodeDelete,
        sendConnectionAdd,
        sendConnectionDelete,
        isConnected,
        myColor,
        activeUsers: remoteUsers.length + (isConnected ? 1 : 0)
    };
}

