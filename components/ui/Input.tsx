import React, { forwardRef } from 'react';

export type InputSize = 'sm' | 'md';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  error?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  label?: string;
  hint?: string;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  size = 'sm',
  error,
  icon,
  iconRight,
  label,
  hint,
  className = '',
  ...props
}, ref) => {
  const inputClasses = `
    w-full bg-[var(--bg-card)] text-[var(--text-primary)]
    border rounded-lg
    placeholder:text-[var(--text-tertiary)]
    focus:outline-none focus:ring-1
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeStyles[size]}
    ${icon ? 'pl-9' : ''}
    ${iconRight ? 'pr-9' : ''}
    ${error 
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
      : 'border-[var(--border-light)] focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]'
    }
    ${className}
  `.trim().replace(/\s+/g, ' ');

  const inputElement = (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={inputClasses}
        {...props}
      />
      {iconRight && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
          {iconRight}
        </span>
      )}
    </div>
  );

  if (label || hint || error) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-xs font-medium text-[var(--text-primary)]">
            {label}
          </label>
        )}
        {inputElement}
        {(error || hint) && (
          <p className={`text-xs ${error ? 'text-red-500' : 'text-[var(--text-tertiary)]'}`}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }

  return inputElement;
});

Input.displayName = 'Input';

// Textarea variant
interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  size?: InputSize;
  error?: string;
  label?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  size = 'sm',
  error,
  label,
  hint,
  className = '',
  ...props
}, ref) => {
  const textareaClasses = `
    w-full bg-[var(--bg-card)] text-[var(--text-primary)]
    border rounded-lg resize-none
    placeholder:text-[var(--text-tertiary)]
    focus:outline-none focus:ring-1
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeStyles[size]}
    ${error 
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
      : 'border-[var(--border-light)] focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]'
    }
    ${className}
  `.trim().replace(/\s+/g, ' ');

  const textareaElement = (
    <textarea
      ref={ref}
      className={textareaClasses}
      {...props}
    />
  );

  if (label || hint || error) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-xs font-medium text-[var(--text-primary)]">
            {label}
          </label>
        )}
        {textareaElement}
        {(error || hint) && (
          <p className={`text-xs ${error ? 'text-red-500' : 'text-[var(--text-tertiary)]'}`}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }

  return textareaElement;
});

Textarea.displayName = 'Textarea';

// Select variant
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: InputSize;
  error?: string;
  label?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  size = 'sm',
  error,
  label,
  hint,
  options,
  className = '',
  ...props
}, ref) => {
  const selectClasses = `
    w-full bg-[var(--bg-card)] text-[var(--text-primary)]
    border rounded-lg appearance-none cursor-pointer
    focus:outline-none focus:ring-1
    transition-colors duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeStyles[size]}
    pr-8
    ${error 
      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
      : 'border-[var(--border-light)] focus:ring-[var(--border-medium)] focus:border-[var(--border-medium)]'
    }
    ${className}
  `.trim().replace(/\s+/g, ' ');

  const selectElement = (
    <div className="relative">
      <select ref={ref} className={selectClasses} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-tertiary)]">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </span>
    </div>
  );

  if (label || hint || error) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-xs font-medium text-[var(--text-primary)]">
            {label}
          </label>
        )}
        {selectElement}
        {(error || hint) && (
          <p className={`text-xs ${error ? 'text-red-500' : 'text-[var(--text-tertiary)]'}`}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }

  return selectElement;
});

Select.displayName = 'Select';

export default Input;
