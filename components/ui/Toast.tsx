import React, { useEffect, useState } from 'react';
import { X, CheckCircle, WarningCircle, Warning, Info } from '@phosphor-icons/react';
import { Notification, NotificationType } from '../../hooks/useNotifications';

interface ToastProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

const iconMap: Record<NotificationType, React.ElementType> = {
  success: CheckCircle,
  error: WarningCircle,
  warning: Warning,
  info: Info,
};

const styleMap: Record<NotificationType, { bg: string; border: string; icon: string; title: string }> = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    title: 'text-green-800 dark:text-green-200',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    title: 'text-red-800 dark:text-red-200',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500',
    title: 'text-yellow-800 dark:text-yellow-200',
  },
  info: {
    bg: 'bg-[#84C4D1]/20 dark:bg-[#84C4D1]/10',
    border: 'border-[#84C4D1]/40 dark:border-[#84C4D1]/30',
    icon: 'text-[var(--accent-primary)]',
    title: 'text-[var(--accent-primary)] dark:text-[#84C4D1]',
  },
};

/**
 * Individual Toast notification
 */
export const Toast: React.FC<ToastProps> = ({ notification, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const Icon = iconMap[notification.type];
  const styles = styleMap[notification.type];

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(notification.id), 200);
  };

  return (
    <div
      className={`
        transform transition-all duration-200 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div
        className={`
          flex items-start gap-3 p-4 rounded-lg border shadow-lg
          ${styles.bg} ${styles.border}
          min-w-[320px] max-w-[420px]
        `}
      >
        <Icon className={`w-5 h-5 ${styles.icon} flex-shrink-0 mt-0.5`} weight="light" />
        
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${styles.title}`}>
            {notification.title}
          </p>
          {notification.message && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {notification.message}
            </p>
          )}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-2 text-sm font-medium text-[var(--text-primary)] hover:underline"
            >
              {notification.action.label}
            </button>
          )}
        </div>

        {notification.dismissible !== false && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-[var(--text-tertiary)]" weight="light" />
          </button>
        )}
      </div>
    </div>
  );
};

interface ToastContainerProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const positionClasses: Record<string, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

/**
 * Container for Toast notifications
 */
export const ToastContainer: React.FC<ToastContainerProps> = ({
  notifications,
  onDismiss,
  position = 'top-right',
}) => {
  if (notifications.length === 0) return null;

  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 ${positionClasses[position]}`}
      aria-live="polite"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <Toast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

/**
 * Simple toast function for standalone usage
 */
export const showToast = (
  type: NotificationType,
  title: string,
  message?: string
): void => {
  // This would need a global state manager or context
  // For now, it's a placeholder that logs
  console.log(`[Toast ${type}] ${title}${message ? `: ${message}` : ''}`);
};
