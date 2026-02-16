/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WarningCircle, ArrowClockwise, Bug, House } from '@phosphor-icons/react';

// ============================================================================
// TYPES
// ============================================================================

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    showDetails?: boolean;
    resetKeys?: any[];
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

// ============================================================================
// ERROR BOUNDARY CLASS COMPONENT
// ============================================================================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });
        
        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }

        // Call custom error handler
        this.props.onError?.(error, errorInfo);
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps): void {
        // Reset error state if resetKeys change
        if (this.state.hasError && this.props.resetKeys) {
            const keysChanged = this.props.resetKeys.some(
                (key, index) => key !== prevProps.resetKeys?.[index]
            );
            
            if (keysChanged) {
                this.reset();
            }
        }
    }

    reset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <ErrorFallback
                    error={this.state.error}
                    errorInfo={this.state.errorInfo}
                    onReset={this.reset}
                    showDetails={this.props.showDetails}
                />
            );
        }

        return this.props.children;
    }
}

// ============================================================================
// ERROR FALLBACK UI
// ============================================================================

interface ErrorFallbackProps {
    error: Error | null;
    errorInfo?: ErrorInfo | null;
    onReset?: () => void;
    showDetails?: boolean;
    title?: string;
    description?: string;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    errorInfo,
    onReset,
    showDetails = process.env.NODE_ENV === 'development',
    title = 'Something went wrong',
    description = 'An unexpected error occurred. Please try again.'
}) => {
    const [showStack, setShowStack] = React.useState(false);

    return (
        <div className="flex items-center justify-center min-h-[300px] p-6">
            <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-6 text-center">
                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <WarningCircle size={32} className="text-red-500" weight="light" />
                </div>

                {/* Title */}
                <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                    {title}
                </h2>

                {/* Description */}
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                    {description}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-center gap-3 mb-4">
                    {onReset && (
                        <button
                            onClick={onReset}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <ArrowClockwise size={16} weight="light" />
                            Try Again
                        </button>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
                    >
                        <ArrowClockwise size={16} weight="light" />
                        Reload Page
                    </button>
                </div>

                {/* Home Link */}
                <a
                    href="/"
                    className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                    <House size={12} weight="light" />
                    Go to Home
                </a>

                {/* Error Details (Development) */}
                {showDetails && error && (
                    <div className="mt-6 text-left">
                        <button
                            onClick={() => setShowStack(!showStack)}
                            className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-2"
                        >
                            <Bug size={14} weight="light" />
                            {showStack ? 'Hide' : 'Show'} Error Details
                        </button>

                        {showStack && (
                            <div className="bg-[var(--bg-tertiary)] border border-[var(--border-light)] rounded-lg p-3 overflow-auto max-h-[200px]">
                                <p className="text-xs font-mono text-red-500 mb-2">
                                    {error.name}: {error.message}
                                </p>
                                {error.stack && (
                                    <pre className="text-[10px] font-mono text-[var(--text-tertiary)] whitespace-pre-wrap">
                                        {error.stack}
                                    </pre>
                                )}
                                {errorInfo?.componentStack && (
                                    <>
                                        <p className="text-xs font-mono text-[var(--text-secondary)] mt-2 mb-1">
                                            Component Stack:
                                        </p>
                                        <pre className="text-[10px] font-mono text-[var(--text-tertiary)] whitespace-pre-wrap">
                                            {errorInfo.componentStack}
                                        </pre>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// SECTION ERROR BOUNDARY
// ============================================================================

interface SectionErrorBoundaryProps {
    children: ReactNode;
    sectionName: string;
    onError?: (error: Error, sectionName: string) => void;
}

/**
 * Lightweight error boundary for sections within a page
 */
export const SectionErrorBoundary: React.FC<SectionErrorBoundaryProps> = ({
    children,
    sectionName,
    onError
}) => {
    return (
        <ErrorBoundary
            onError={(error, errorInfo) => {
                console.error(`Error in section "${sectionName}":`, error);
                onError?.(error, sectionName);
            }}
            fallback={
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-600">
                        <WarningCircle size={16} weight="light" />
                        <span className="text-sm">
                            Failed to load {sectionName}
                        </span>
                    </div>
                </div>
            }
        >
            {children}
        </ErrorBoundary>
    );
};

// ============================================================================
// WITH ERROR BOUNDARY HOC
// ============================================================================

/**
 * Higher-order component to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    options?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
    const WithErrorBoundary: React.FC<P> = (props) => (
        <ErrorBoundary {...options}>
            <WrappedComponent {...props} />
        </ErrorBoundary>
    );

    WithErrorBoundary.displayName = `WithErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

    return WithErrorBoundary;
}

// ============================================================================
// HOOK FOR ERROR REPORTING
// ============================================================================

/**
 * Hook to manually report errors
 */
export const useErrorHandler = () => {
    const handleError = React.useCallback((error: Error, context?: string) => {
        console.error(`Error${context ? ` in ${context}` : ''}:`, error);
        
        // In production, you might want to send this to an error tracking service
        // Example: Sentry.captureException(error);
    }, []);

    return { handleError };
};

export default ErrorBoundary;
