import React, { createContext, useContext } from 'react';

// Simple Tabs implementation with React Context
const TabsContext = createContext({ value: '', onValueChange: () => {} });

export function Tabs({ value, onValueChange, className = '', children }) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className = '', children }) {
  return <div className={`inline-flex items-center gap-2 ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, className = '', children }) {
  const ctx = useContext(TabsContext);
  const isActive = ctx.value === value;
  const base = 'px-3 py-1.5 rounded-md text-sm transition-colors';
  const active = 'bg-blue-600 text-white';
  const inactive = 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  return (
    <button
      type="button"
      className={`${base} ${isActive ? active : inactive} ${className}`}
      onClick={() => ctx.onValueChange?.(value)}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = '', children }) {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={className}>{children}</div>;
}

export default Tabs;
