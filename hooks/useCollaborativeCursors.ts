import { useState, useEffect, useRef, useCallback } from 'react';

interface User {
    id: string;
    name: string;
    email?: string;
    profilePhoto?: string;
    orgId?: string;
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

interface NodePropsUpdate {
    status?: string;
    config?: any;
    inputData?: any;
    outputData?: any;
    label?: string;
    data?: any;
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
    onNodePropsUpdated?: (nodeId: string, updates: NodePropsUpdate) => void;
    onWorkflowRunning?: (userName: string) => void;
    onWorkflowCompleted?: (userName: string) => void;
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
    sendNodePropsUpdate: (nodeId: string, updates: NodePropsUpdate) => void;
    sendWorkflowRunStart: () => void;
    sendWorkflowRunComplete: () => void;
    isConnected: boolean;
    myColor: string | null;
    activeUsers: number;
}

// Build WebSocket URL dynamically based on current protocol and environment
const getWsUrl = () => {
    if (typeof window === 'undefined') return '';
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // includes port if present
    
    // In development (localhost), connect directly to the backend on port 3001
    // In production (HTTPS), use the same host (nginx will proxy /ws to the backend)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `ws://${window.location.hostname}:3001/ws`;
    }
    
    // Production: use secure WebSocket through the same host (nginx proxy)
    return `${protocol}//${host}/ws`;
};

export function useCollaborativeCursors({
    workflowId,
    user,
    enabled = true,
    onNodeUpdate,
    onNodeAdded,
    onNodeDeleted,
    onConnectionAdded,
    onConnectionDeleted,
    onNodePropsUpdated,
    onWorkflowRunning,
    onWorkflowCompleted
}: UseCollaborativeCursorsProps): UseCollaborativeCursorsReturn {
    const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteUser>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [myColor, setMyColor] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const lastSentPositionRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const isCleaningUpRef = useRef(false);
    
    // CRITICAL: Store workflowId in a ref to avoid stale closure issues
    // This ensures we always validate against the CURRENT workflowId, not the one from when the effect was created
    const currentWorkflowIdRef = useRef<string | null>(workflowId);
    
    // Track which workflow the server has confirmed we're in
    // This prevents processing messages from old workflows during the join transition
    const confirmedWorkflowIdRef = useRef<string | null>(null);
    
    // Store callbacks in refs to prevent effect re-runs
    const onNodeUpdateRef = useRef(onNodeUpdate);
    const onNodeAddedRef = useRef(onNodeAdded);
    const onNodeDeletedRef = useRef(onNodeDeleted);
    const onConnectionAddedRef = useRef(onConnectionAdded);
    const onConnectionDeletedRef = useRef(onConnectionDeleted);
    const onNodePropsUpdatedRef = useRef(onNodePropsUpdated);
    const onWorkflowRunningRef = useRef(onWorkflowRunning);
    const onWorkflowCompletedRef = useRef(onWorkflowCompleted);
    
    // Update refs when callbacks change
    useEffect(() => {
        onNodeUpdateRef.current = onNodeUpdate;
        onNodeAddedRef.current = onNodeAdded;
        onNodeDeletedRef.current = onNodeDeleted;
        onConnectionAddedRef.current = onConnectionAdded;
        onConnectionDeletedRef.current = onConnectionDeleted;
        onNodePropsUpdatedRef.current = onNodePropsUpdated;
        onWorkflowRunningRef.current = onWorkflowRunning;
        onWorkflowCompletedRef.current = onWorkflowCompleted;
    }, [onNodeUpdate, onNodeAdded, onNodeDeleted, onConnectionAdded, onConnectionDeleted, onNodePropsUpdated, onWorkflowRunning, onWorkflowCompleted]);


    // Cleanup function - keeps isCleaningUpRef true to prevent reconnection
    const cleanup = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        
        isCleaningUpRef.current = true;
        
        if (wsRef.current) {
            const ws = wsRef.current;
            wsRef.current = null;
            
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify({ type: 'leave' }));
                } catch (e) { /* ignore */ }
            }
            
            setTimeout(() => ws.close(), 50);
        }
        
        setIsConnected(false);
        setRemoteCursors(new Map());
    }, []);

    // Connect to WebSocket
    useEffect(() => {
        // CRITICAL: Update refs synchronously at the START of this effect
        // This ensures the refs are always in sync before any async operations
        currentWorkflowIdRef.current = workflowId;
        // Reset confirmed workflow - we haven't joined the new one yet
        confirmedWorkflowIdRef.current = null;
        
        // Clear any pending reconnection
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        
        // Clean up any existing connection first
        if (wsRef.current) {
            const oldWs = wsRef.current;
            wsRef.current = null;
            
            if (oldWs.readyState === WebSocket.OPEN) {
                try {
                    oldWs.send(JSON.stringify({ type: 'leave' }));
                } catch (e) { /* ignore */ }
            }
            oldWs.close();
        }
        
        setRemoteCursors(new Map());
        setIsConnected(false);
        isCleaningUpRef.current = false;
        
        if (!enabled || !workflowId || !user) {
            return;
        }

        const connect = () => {
            try {
                const wsUrl = getWsUrl();
                if (!wsUrl) return;
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    setIsConnected(true);
                    ws.send(JSON.stringify({
                        type: 'join',
                        workflowId,
                        orgId: user.orgId,
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

                        const wantedWorkflowId = currentWorkflowIdRef.current;
                        const confirmedWorkflowId = confirmedWorkflowIdRef.current;
                        
                        if (message.type === 'room_state') {
                            if (message.workflowId !== wantedWorkflowId) return;
                            confirmedWorkflowIdRef.current = message.workflowId;
                        } else {
                            if (!confirmedWorkflowId || message.workflowId !== confirmedWorkflowId) return;
                        }

                        switch (message.type) {
                            case 'room_state': {
                                const newCursors = new Map<string, RemoteUser>();
                                message.users.forEach((u: RemoteUser) => {
                                    newCursors.set(u.id, u);
                                });
                                setRemoteCursors(newCursors);
                                setMyColor(message.yourColor);
                                break;
                            }

                            case 'user_joined': {
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

                            case 'node_props_updated': {
                                if (onNodePropsUpdatedRef.current) {
                                    onNodePropsUpdatedRef.current(message.nodeId, message.updates);
                                }
                                break;
                            }

                            case 'workflow_running': {
                                if (onWorkflowRunningRef.current) {
                                    onWorkflowRunningRef.current(message.userName);
                                }
                                break;
                            }

                            case 'workflow_completed': {
                                if (onWorkflowCompletedRef.current) {
                                    onWorkflowCompletedRef.current(message.userName);
                                }
                                break;
                            }
                        }
                    } catch (err) {
                        console.error('Error parsing WebSocket message:', err);
                    }
                };

                ws.onclose = () => {
                    setIsConnected(false);
                    wsRef.current = null;
                    
                    const shouldReconnect = !isCleaningUpRef.current && 
                                           enabled && 
                                           currentWorkflowIdRef.current === workflowId;
                    
                    if (shouldReconnect) {
                        reconnectTimeoutRef.current = window.setTimeout(() => {
                            if (currentWorkflowIdRef.current === workflowId) {
                                connect();
                            }
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

    // Send node properties update (status, config, data, etc.)
    const sendNodePropsUpdate = useCallback((nodeId: string, updates: NodePropsUpdate) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'node_update_props',
            nodeId,
            updates
        }));
    }, []);

    // Send workflow run start notification
    const sendWorkflowRunStart = useCallback(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'workflow_run_start'
        }));
    }, []);

    // Send workflow run complete notification
    const sendWorkflowRunComplete = useCallback(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: 'workflow_run_complete'
        }));
    }, []);

    // Filter out own user's cursors and deduplicate remote users by their actual user ID
    // This handles: 1) Not showing your own cursor, 2) Showing one avatar per user even with multiple tabs
    const filteredRemoteCursors = new Map<string, RemoteUser>();
    remoteCursors.forEach((remote, key) => {
        // Skip cursors from the current user (same user.id)
        if (user && remote.user.id === user.id) {
            return;
        }
        filteredRemoteCursors.set(key, remote);
    });

    const remoteUsers = Array.from(filteredRemoteCursors.values()).reduce((acc: RemoteUser[], remote) => {
        // Check if we already have a user with the same user.id
        const existingIndex = acc.findIndex(u => u.user.id === remote.user.id);
        if (existingIndex === -1) {
            acc.push(remote);
        }
        return acc;
    }, []);

    return {
        remoteCursors: filteredRemoteCursors,
        remoteUsers,
        sendCursorPosition,
        sendNodeMove,
        sendNodeAdd,
        sendNodeDelete,
        sendConnectionAdd,
        sendConnectionDelete,
        sendNodePropsUpdate,
        sendWorkflowRunStart,
        sendWorkflowRunComplete,
        isConnected,
        myColor,
        activeUsers: remoteUsers.length + (isConnected ? 1 : 0)
    };
}

