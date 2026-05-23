import * as React from 'react';
import { cn } from '../../lib/utils';

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({ defaultValue, value, onValueChange, className, ...props }: React.HTMLAttributes<HTMLDivElement> & {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeValue = value ?? internalValue;

  const setValue = React.useCallback(
    (nextValue: string) => {
      setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value: activeValue, setValue }}>
      <div className={cn('space-y-4', className)} {...props} />
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid grid-cols-2 rounded-full bg-ink-100 p-1', className)} {...props} />;
}

export function TabsTrigger({ value, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = React.useContext(TabsContext);

  if (context === null) {
    throw new Error('TabsTrigger must be used inside Tabs.');
  }

  const active = context.value === value;

  return (
    <button
      type="button"
      onClick={() => context.setValue(value)}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-medium transition-colors',
        active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900',
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ value, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = React.useContext(TabsContext);

  if (context === null) {
    throw new Error('TabsContent must be used inside Tabs.');
  }

  if (context.value !== value) {
    return null;
  }

  return (
    <div className={cn('outline-none', className)} {...props}>
      {children}
    </div>
  );
}
