import { useState, useCallback, useRef } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface UseNotificationsReturn {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

/**
 * Hook for managing notifications/toasts
 */
export const useNotifications = (defaultDuration = 5000): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeNotification = useCallback((id: string) => {
    // Clear timeout if exists
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id'>): string => {
    const id = generateId();
    const duration = notification.duration ?? defaultDuration;
    
    const newNotification: Notification = {
      ...notification,
      id,
      dismissible: notification.dismissible ?? true,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-dismiss if duration is set
    if (duration > 0) {
      const timeout = setTimeout(() => {
        removeNotification(id);
      }, duration);
      timeoutsRef.current.set(id, timeout);
    }

    return id;
  }, [defaultDuration, removeNotification]);

  const clearAll = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    return addNotification({ type: 'success', title, message });
  }, [addNotification]);

  const error = useCallback((title: string, message?: string) => {
    return addNotification({ type: 'error', title, message, duration: 8000 });
  }, [addNotification]);

  const warning = useCallback((title: string, message?: string) => {
    return addNotification({ type: 'warning', title, message });
  }, [addNotification]);

  const info = useCallback((title: string, message?: string) => {
    return addNotification({ type: 'info', title, message });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
  };
};

/**
 * Get styles for notification type
 */
export const getNotificationStyles = (type: NotificationType) => {
  switch (type) {
    case 'success':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-500',
        title: 'text-green-800',
        message: 'text-green-600',
      };
    case 'error':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        icon: 'text-red-500',
        title: 'text-red-800',
        message: 'text-red-600',
      };
    case 'warning':
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: 'text-yellow-500',
        title: 'text-yellow-800',
        message: 'text-yellow-600',
      };
    case 'info':
    default:
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-500',
        title: 'text-blue-800',
        message: 'text-blue-600',
      };
  }
};
