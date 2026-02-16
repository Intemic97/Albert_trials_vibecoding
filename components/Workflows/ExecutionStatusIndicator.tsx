/**
 * Execution Status Indicator
 * Shows real-time execution status for a workflow
 */

import React from 'react';
import { 
    SpinnerGap, 
    CheckCircle, 
    XCircle, 
    Clock,
    Lightning,
    Stop
} from '@phosphor-icons/react';
import { useExecutionProgress } from '../../hooks';

interface ExecutionStatusIndicatorProps {
    workflowId: string;
    size?: 'sm' | 'md';
    showLabel?: boolean;
}

export const ExecutionStatusIndicator: React.FC<ExecutionStatusIndicatorProps> = ({
    workflowId,
    size = 'sm',
    showLabel = false
}) => {
    const { getWorkflowExecution, isExecuting } = useExecutionProgress();
    
    const execution = getWorkflowExecution(workflowId);
    const running = isExecuting(workflowId);
    
    if (!execution && !running) {
        return null;
    }

    const iconSize = size === 'sm' ? 14 : 18;
    const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

    const renderContent = () => {
        if (running || execution?.status === 'running' || execution?.status === 'pending') {
            return (
                <div className="flex items-center gap-1.5">
                    <SpinnerGap 
                        size={iconSize} 
                        className="text-[#256A65] animate-spin" 
                        weight="light" 
                    />
                    {showLabel && (
                        <span className={`${textSize} text-[#256A65] font-medium`}>
                            {execution?.progress?.percentage 
                                ? `${execution.progress.percentage}%`
                                : 'Running...'}
                        </span>
                    )}
                </div>
            );
        }

        if (execution?.status === 'completed') {
            return (
                <div className="flex items-center gap-1.5">
                    <CheckCircle 
                        size={iconSize} 
                        className="text-green-500" 
                        weight="fill" 
                    />
                    {showLabel && (
                        <span className={`${textSize} text-green-600`}>Completed</span>
                    )}
                </div>
            );
        }

        if (execution?.status === 'failed') {
            return (
                <div className="flex items-center gap-1.5">
                    <XCircle 
                        size={iconSize} 
                        className="text-red-500" 
                        weight="fill" 
                    />
                    {showLabel && (
                        <span className={`${textSize} text-red-600`}>Failed</span>
                    )}
                </div>
            );
        }

        if (execution?.status === 'cancelled') {
            return (
                <div className="flex items-center gap-1.5">
                    <Stop 
                        size={iconSize} 
                        className="text-amber-500" 
                        weight="fill" 
                    />
                    {showLabel && (
                        <span className={`${textSize} text-amber-600`}>Cancelled</span>
                    )}
                </div>
            );
        }

        return null;
    };

    return renderContent();
};

// Mini progress bar component
export const ExecutionProgressBar: React.FC<{ workflowId: string }> = ({ workflowId }) => {
    const { getWorkflowExecution } = useExecutionProgress();
    const execution = getWorkflowExecution(workflowId);
    
    if (!execution || !['running', 'pending'].includes(execution.status)) {
        return null;
    }

    const percentage = execution.progress?.percentage || 0;

    return (
        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1 overflow-hidden">
            <div 
                className="bg-[#256A65] h-1 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};

export default ExecutionStatusIndicator;
