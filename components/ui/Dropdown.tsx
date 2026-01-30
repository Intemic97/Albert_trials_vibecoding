import React, { useState, useRef, useEffect } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react';

interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  selectedId?: string;
  align?: 'left' | 'right';
  width?: 'auto' | 'full' | number;
  className?: string;
}

/**
 * Dropdown menu component
 */
export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  onSelect,
  selectedId,
  align = 'left',
  width = 'auto',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: DropdownItem) => {
    if (item.disabled || item.divider) return;
    onSelect(item.id);
    setIsOpen(false);
  };

  const widthClass = typeof width === 'number' 
    ? `w-[${width}px]` 
    : width === 'full' 
      ? 'w-full' 
      : 'w-auto min-w-[160px]';

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1 py-1
            bg-[var(--bg-card)] border border-[var(--border-light)]
            rounded-lg shadow-lg
            ${align === 'right' ? 'right-0' : 'left-0'}
            ${widthClass}
          `}
        >
          {items.map((item, index) => {
            if (item.divider) {
              return (
                <div
                  key={`divider-${index}`}
                  className="my-1 border-t border-[var(--border-light)]"
                />
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                  transition-colors duration-150
                  ${item.disabled
                    ? 'text-[var(--text-tertiary)] cursor-not-allowed'
                    : item.danger
                      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                  }
                  ${selectedId === item.id ? 'bg-[var(--bg-tertiary)]' : ''}
                `}
              >
                {item.icon && (
                  <span className="w-4 h-4 flex items-center justify-center">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {selectedId === item.id && (
                  <Check className="w-4 h-4 text-[var(--text-secondary)]" weight="light" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface SelectDropdownProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Select-style dropdown
 */
export const SelectDropdown: React.FC<SelectDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
}) => {
  const selectedOption = options.find(opt => opt.value === value);

  const items: DropdownItem[] = options.map(opt => ({
    id: opt.value,
    label: opt.label,
  }));

  const trigger = (
    <button
      disabled={disabled}
      className={`
        flex items-center justify-between gap-2 px-3 py-2
        bg-[var(--bg-card)] border border-[var(--border-light)]
        rounded-lg text-sm min-w-[160px]
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:border-[var(--border-medium)]'
        }
        ${className}
      `}
    >
      <span className={selectedOption ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}>
        {selectedOption?.label || placeholder}
      </span>
      <CaretDown className="w-4 h-4 text-[var(--text-tertiary)]" weight="light" />
    </button>
  );

  return (
    <Dropdown
      trigger={trigger}
      items={items}
      onSelect={onChange}
      selectedId={value}
      width="full"
    />
  );
};

interface MenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Generic menu component with custom content
 */
export const Menu: React.FC<MenuProps> = ({
  trigger,
  children,
  align = 'left',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className={`relative inline-block ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1 p-2
            bg-[var(--bg-card)] border border-[var(--border-light)]
            rounded-lg shadow-lg min-w-[200px]
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
          onClick={() => setIsOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
};

interface MenuItemProps {
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Menu item for use inside Menu component
 */
export const MenuItem: React.FC<MenuItemProps> = ({
  onClick,
  icon,
  children,
  danger = false,
  disabled = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded
        transition-colors duration-150
        ${disabled
          ? 'text-[var(--text-tertiary)] cursor-not-allowed'
          : danger
            ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
            : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        }
      `}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  );
};

/**
 * Divider for Menu
 */
export const MenuDivider: React.FC = () => (
  <div className="my-1 border-t border-[var(--border-light)]" />
);
