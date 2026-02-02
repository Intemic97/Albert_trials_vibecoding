/**
 * Optimized State Hooks
 * Performance-optimized hooks for heavy computations and state management
 */

import { useState, useCallback, useMemo, useRef, useEffect, DependencyList } from 'react';

// ============================================================================
// DEBOUNCED STATE
// ============================================================================

/**
 * Hook that debounces state updates to prevent excessive re-renders
 */
export function useDebouncedState<T>(
    initialValue: T,
    delay: number = 300
): [T, T, (value: T) => void] {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const setValueDebounced = useCallback((newValue: T) => {
        setValue(newValue);
        
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
            setDebouncedValue(newValue);
        }, delay);
    }, [delay]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return [value, debouncedValue, setValueDebounced];
}

// ============================================================================
// THROTTLED CALLBACK
// ============================================================================

/**
 * Hook that throttles a callback to limit execution frequency
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 100
): T {
    const lastRun = useRef<number>(0);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const lastArgsRef = useRef<any[]>([]);

    const throttledCallback = useCallback((...args: Parameters<T>) => {
        const now = Date.now();
        lastArgsRef.current = args;

        if (now - lastRun.current >= delay) {
            lastRun.current = now;
            callback(...args);
        } else {
            // Schedule execution for remaining time
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            timeoutRef.current = setTimeout(() => {
                lastRun.current = Date.now();
                callback(...lastArgsRef.current);
            }, delay - (now - lastRun.current));
        }
    }, [callback, delay]) as T;

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return throttledCallback;
}

// ============================================================================
// MEMOIZED COMPUTATION
// ============================================================================

/**
 * Hook for expensive computations with caching
 */
export function useMemoizedComputation<T, Args extends any[]>(
    computeFn: (...args: Args) => T,
    deps: DependencyList,
    cacheSize: number = 10
): (...args: Args) => T {
    const cacheRef = useRef<Map<string, T>>(new Map());
    
    // Clear cache when deps change
    useEffect(() => {
        cacheRef.current.clear();
    }, deps);

    return useCallback((...args: Args): T => {
        const key = JSON.stringify(args);
        
        if (cacheRef.current.has(key)) {
            return cacheRef.current.get(key)!;
        }
        
        const result = computeFn(...args);
        
        // Limit cache size
        if (cacheRef.current.size >= cacheSize) {
            const firstKey = cacheRef.current.keys().next().value;
            if (firstKey) {
                cacheRef.current.delete(firstKey);
            }
        }
        
        cacheRef.current.set(key, result);
        return result;
    }, [computeFn, cacheSize, ...deps]);
}

// ============================================================================
// LAZY INITIALIZATION
// ============================================================================

/**
 * Hook for lazy initialization of expensive values
 */
export function useLazyInit<T>(
    initFn: () => T
): T {
    const valueRef = useRef<T | null>(null);
    const initializedRef = useRef(false);

    if (!initializedRef.current) {
        valueRef.current = initFn();
        initializedRef.current = true;
    }

    return valueRef.current!;
}

// ============================================================================
// PREVIOUS VALUE
// ============================================================================

/**
 * Hook to track previous value of a state
 */
export function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T>();
    
    useEffect(() => {
        ref.current = value;
    }, [value]);
    
    return ref.current;
}

// ============================================================================
// STABLE CALLBACK
// ============================================================================

/**
 * Hook that returns a stable callback reference
 * Useful for preventing unnecessary re-renders in child components
 */
export function useStableCallback<T extends (...args: any[]) => any>(
    callback: T
): T {
    const callbackRef = useRef<T>(callback);
    
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback((...args: Parameters<T>) => {
        return callbackRef.current(...args);
    }, []) as T;
}

// ============================================================================
// INTERSECTION OBSERVER (VIRTUAL SCROLLING)
// ============================================================================

/**
 * Hook for detecting element visibility (useful for virtual lists)
 */
export function useIntersectionObserver(
    options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
    const elementRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(([entry]) => {
            setIsVisible(entry.isIntersecting);
        }, {
            threshold: 0.1,
            ...options
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [options.root, options.rootMargin, options.threshold]);

    return [elementRef, isVisible];
}

// ============================================================================
// WINDOW SIZE (OPTIMIZED)
// ============================================================================

/**
 * Hook for responsive window size with throttling
 */
export function useWindowSize(throttleMs: number = 100) {
    const [size, setSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0
    });

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        
        const handleResize = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setSize({
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }, throttleMs);
        };

        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(timeoutId);
        };
    }, [throttleMs]);

    return size;
}

// ============================================================================
// RENDER COUNT (DEBUG)
// ============================================================================

/**
 * Debug hook to track component render count
 */
export function useRenderCount(componentName?: string): number {
    const count = useRef(0);
    count.current++;
    
    if (process.env.NODE_ENV === 'development' && componentName) {
        console.debug(`[Render] ${componentName}: ${count.current}`);
    }
    
    return count.current;
}

// ============================================================================
// BATCH STATE UPDATES
// ============================================================================

type BatchUpdater<T> = {
    [K in keyof T]: (value: T[K]) => void;
};

/**
 * Hook for batching multiple state updates
 */
export function useBatchedState<T extends Record<string, any>>(
    initialState: T
): [T, BatchUpdater<T>, (updates: Partial<T>) => void] {
    const [state, setState] = useState<T>(initialState);

    const updatersRef = useRef<BatchUpdater<T>>({} as BatchUpdater<T>);
    
    // Create individual updaters
    useMemo(() => {
        const updaters = {} as BatchUpdater<T>;
        for (const key of Object.keys(initialState) as (keyof T)[]) {
            updaters[key] = (value: T[typeof key]) => {
                setState(prev => ({ ...prev, [key]: value }));
            };
        }
        updatersRef.current = updaters;
    }, []);

    const batchUpdate = useCallback((updates: Partial<T>) => {
        setState(prev => ({ ...prev, ...updates }));
    }, []);

    return [state, updatersRef.current, batchUpdate];
}
