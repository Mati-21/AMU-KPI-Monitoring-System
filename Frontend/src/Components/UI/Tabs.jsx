import React, { createContext, useContext, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

const TabsContext = createContext(null);

const useTabsContext = () => useContext(TabsContext);

export const getTabTriggerClass = (isActive) =>
  cn(
    'px-5 py-2 rounded-lg text-sm font-medium border transition-colors',
    isActive ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground hover:bg-muted'
  );

export const Tabs = ({ defaultValue, value, onValueChange, className = '', children }) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const activeValue = isControlled ? value : internalValue;

  const setActiveValue = (nextValue) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    if (typeof onValueChange === 'function') {
      onValueChange(nextValue);
    }
  };

  const contextValue = useMemo(
    () => ({
      activeValue,
      setActiveValue,
    }),
    [activeValue]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ className = '', children }) => {
  return <div className={cn('inline-flex items-center gap-2', className)}>{children}</div>;
};

export const TabsTrigger = ({ value, className = '', children, onClick, ...props }) => {
  const context = useTabsContext();
  const isActive = context?.activeValue === value;

  const handleClick = (event) => {
    context?.setActiveValue(value);
    onClick?.(event);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      className={cn(getTabTriggerClass(isActive), className)}
      {...props}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, className = '', children }) => {
  const context = useTabsContext();

  if (context?.activeValue !== value) {
    return null;
  }

  return <div className={cn('mt-4', className)}>{children}</div>;
};
