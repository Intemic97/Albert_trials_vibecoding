import React, { createContext, useContext, useState } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Tabs container component
 */
export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  
  const activeTab = value ?? internalValue;
  const setActiveTab = (id: string) => {
    setInternalValue(id);
    onValueChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

/**
 * Container for tab triggers
 */
export const TabsList: React.FC<TabsListProps> = ({
  children,
  className = '',
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'bg-[var(--bg-tertiary)] p-1 rounded-lg',
    pills: 'gap-2',
    underline: 'border-b border-[var(--border-light)] gap-4',
  };

  return (
    <div
      className={`flex items-center ${variantStyles[variant]} ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
};

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

/**
 * Individual tab trigger button
 */
export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  disabled = false,
  className = '',
  variant = 'default',
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  const variantStyles = {
    default: {
      base: 'px-3 py-1.5 text-sm font-medium rounded transition-all duration-200',
      active: 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm',
      inactive: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
    },
    pills: {
      base: 'px-4 py-2 text-sm font-medium rounded-full transition-all duration-200',
      active: 'bg-[var(--bg-selected)] text-[var(--text-primary)]',
      inactive: 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
    },
    underline: {
      base: 'px-1 py-2 text-sm font-medium border-b-2 -mb-px transition-all duration-200',
      active: 'border-[var(--text-primary)] text-[var(--text-primary)]',
      inactive: 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)]',
    },
  };

  const styles = variantStyles[variant];

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${value}`}
      disabled={disabled}
      onClick={() => setActiveTab(value)}
      className={`
        ${styles.base}
        ${isActive ? styles.active : styles.inactive}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  forceMount?: boolean;
}

/**
 * Content panel for a tab
 */
export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className = '',
  forceMount = false,
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  const { activeTab } = context;
  const isActive = activeTab === value;

  if (!isActive && !forceMount) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      hidden={!isActive}
      className={`
        ${isActive ? 'animate-in fade-in duration-200' : 'hidden'}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

interface SimpleTabsProps {
  tabs: { id: string; label: string; content: React.ReactNode; icon?: React.ReactNode }[];
  defaultTab?: string;
  variant?: 'default' | 'pills' | 'underline';
  className?: string;
}

/**
 * Simple tabs component with predefined structure
 */
export const SimpleTabs: React.FC<SimpleTabsProps> = ({
  tabs,
  defaultTab,
  variant = 'default',
  className = '',
}) => {
  const defaultValue = defaultTab || tabs[0]?.id || '';

  return (
    <Tabs defaultValue={defaultValue} className={className}>
      <TabsList variant={variant}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} variant={variant}>
            {tab.icon && <span className="mr-2">{tab.icon}</span>}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
};
