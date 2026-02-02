import { useState, useCallback, useEffect } from 'react';

type SetValue<T> = T | ((prevValue: T) => T);

interface UseLocalStorageOptions<T> {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
  onError?: (error: Error) => void;
}

/**
 * Hook for persisting state in localStorage with automatic sync
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: SetValue<T>) => void, () => void] {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    onError = console.error,
  } = options;

  // Get initial value from localStorage or use default
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? deserializer(item) : initialValue;
    } catch (error) {
      onError(error as Error);
      return initialValue;
    }
  }, [key, initialValue, deserializer, onError]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Set value in state and localStorage
  const setValue = useCallback((value: SetValue<T>) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, serializer(valueToStore));
        // Dispatch event for other tabs/windows
        window.dispatchEvent(new StorageEvent('storage', {
          key,
          newValue: serializer(valueToStore),
        }));
      }
    } catch (error) {
      onError(error as Error);
    }
  }, [key, storedValue, serializer, onError]);

  // Remove value from localStorage
  const removeValue = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      setStoredValue(initialValue);
    } catch (error) {
      onError(error as Error);
    }
  }, [key, initialValue, onError]);

  // Listen for changes in other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          setStoredValue(deserializer(event.newValue));
        } catch (error) {
          onError(error as Error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, deserializer, onError]);

  return [storedValue, setValue, removeValue];
}

/**
 * Hook for session storage (cleared when browser closes)
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, (value: SetValue<T>) => void, () => void] {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    onError = console.error,
  } = options;

  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      return item ? deserializer(item) : initialValue;
    } catch (error) {
      onError(error as Error);
      return initialValue;
    }
  }, [key, initialValue, deserializer, onError]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback((value: SetValue<T>) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, serializer(valueToStore));
      }
    } catch (error) {
      onError(error as Error);
    }
  }, [key, storedValue, serializer, onError]);

  const removeValue = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key);
      }
      setStoredValue(initialValue);
    } catch (error) {
      onError(error as Error);
    }
  }, [key, initialValue, onError]);

  return [storedValue, setValue, removeValue];
}
