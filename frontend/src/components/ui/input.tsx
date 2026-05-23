import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-aura-500 focus:ring-2 focus:ring-aura-500/20',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
