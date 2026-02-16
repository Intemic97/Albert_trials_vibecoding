/**
 * NodeConfigSidePanel
 * 
 * Panel lateral flotante especializado para configuración de nodos de workflow.
 * Diseño limpio sin sombras, bordes sutiles y esquinas redondeadas.
 * 
 * @example
 * <NodeConfigSidePanel
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Configure Node"
 * >
 *   <form>...</form>
 * </NodeConfigSidePanel>
 */
import React, { ReactNode } from 'react';
import { SidePanel, SidePanelContent } from './ui/SidePanel';

// ============================================================================
// TYPES
// ============================================================================

interface NodeConfigSidePanelProps {
    /** Whether the panel is open */
    isOpen: boolean;
    /** Callback when the panel should close */
    onClose: () => void;
    /** Panel title */
    title: string;
    /** Optional icon component (not displayed by default for cleaner look) */
    icon?: React.ComponentType<any>;
    /** Optional description/subtitle */
    description?: string;
    /** Panel content */
    children: ReactNode;
    /** Footer content (buttons, actions) */
    footer?: ReactNode;
    /** Panel width - supports preset sizes or custom widths */
    width?: 'sm' | 'md' | 'lg' | 'xl' | string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const NodeConfigSidePanel: React.FC<NodeConfigSidePanelProps> = ({
    isOpen,
    onClose,
    title,
    icon,
    description,
    children,
    footer,
    width = 'lg'
}) => {
    // Determine if width is a preset size or custom
    const isPresetSize = ['sm', 'md', 'lg', 'xl'].includes(width);
    
    return (
        <SidePanel
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            description={description}
            icon={icon}
            footer={footer}
            size={isPresetSize ? width as 'sm' | 'md' | 'lg' | 'xl' : 'lg'}
            width={!isPresetSize ? width : undefined}
            position="right"
            showOverlay={false}
            closeOnClickOutside={true}
            closeOnEscape={true}
            topOffset="63px"
            zIndex={40}
        >
            <SidePanelContent>
                {children}
            </SidePanelContent>
        </SidePanel>
    );
};

// ============================================================================
// HELPER COMPONENTS FOR NODE CONFIGURATION
// ============================================================================

interface ConfigFieldProps {
    label: string;
    description?: string;
    required?: boolean;
    children: ReactNode;
    className?: string;
}

export const ConfigField: React.FC<ConfigFieldProps> = ({
    label,
    description,
    required = false,
    children,
    className = ''
}) => (
    <div className={`mb-4 ${className}`}>
        <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
            {label}
            {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {children}
        {description && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                {description}
            </p>
        )}
    </div>
);

interface ConfigTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
}

export const ConfigTextarea: React.FC<ConfigTextareaProps> = ({
    value,
    onChange,
    placeholder,
    rows = 3,
    className = ''
}) => (
    <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`
            w-full px-3 py-2 text-xs
            text-[var(--text-primary)]
            bg-[var(--bg-secondary)]
            border border-[var(--border-light)] rounded-lg
            focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]
            resize-none
            placeholder:text-[var(--text-tertiary)]
            transition-colors
            ${className}
        `}
    />
);

interface ConfigInputProps {
    type?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const ConfigInput: React.FC<ConfigInputProps> = ({
    type = 'text',
    value,
    onChange,
    placeholder,
    className = ''
}) => (
    <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`
            w-full px-3 py-2 text-xs
            text-[var(--text-primary)]
            bg-[var(--bg-secondary)]
            border border-[var(--border-light)] rounded-lg
            focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]
            placeholder:text-[var(--text-tertiary)]
            transition-colors
            ${className}
        `}
    />
);

interface ConfigSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    className?: string;
}

export const ConfigSelect: React.FC<ConfigSelectProps> = ({
    value,
    onChange,
    options,
    placeholder,
    className = ''
}) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
            w-full px-3 py-2 text-xs
            text-[var(--text-primary)]
            bg-[var(--bg-secondary)]
            border border-[var(--border-light)] rounded-lg
            focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]
            transition-colors
            ${className}
        `}
    >
        {placeholder && (
            <option value="" disabled>
                {placeholder}
            </option>
        )}
        {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
                {opt.label}
            </option>
        ))}
    </select>
);

interface ConfigButtonProps {
    children: ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
    disabled?: boolean;
    type?: 'button' | 'submit';
    className?: string;
}

export const ConfigButton: React.FC<ConfigButtonProps> = ({
    children,
    onClick,
    variant = 'secondary',
    disabled = false,
    type = 'button',
    className = ''
}) => {
    const baseClasses = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
        primary: 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white',
        secondary: 'bg-[var(--bg-tertiary)] hover:bg-[var(--bg-selected)] text-[var(--text-primary)] border border-[var(--border-light)]',
        ghost: 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        >
            {children}
        </button>
    );
};

interface ConfigAlertProps {
    type?: 'info' | 'warning' | 'error' | 'success';
    children: ReactNode;
    className?: string;
}

export const ConfigAlert: React.FC<ConfigAlertProps> = ({
    type = 'info',
    children,
    className = ''
}) => {
    const typeClasses = {
        info: 'bg-[#84C4D1]/10 border-[#84C4D1]/20 text-[#84C4D1]',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-400',
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    };

    return (
        <div className={`px-3 py-2 text-xs rounded-lg border ${typeClasses[type]} ${className}`}>
            {children}
        </div>
    );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default NodeConfigSidePanel;
