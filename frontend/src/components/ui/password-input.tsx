import * as React from 'react';
import { Eye, EyeClosed, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(({ className, ...props }, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        className={cn(
          'flex h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 pr-12 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-aura-500 focus:ring-2 focus:ring-aura-500/20',
          className
        )}
        {...props}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-700 transition-colors focus:outline-none"
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <Eye className="h-5 w-5" /> : <EyeClosed className="h-5 w-5" />}
      </button>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';
