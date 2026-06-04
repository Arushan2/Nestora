import * as React from 'react';
import { cn } from '../../lib/utils';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ isOpen, onClose, children, className }: DialogProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-950/45 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      {/* Content Container */}
      <div className={cn("relative z-10 w-full max-w-2xl transform overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-6 shadow-glow transition-all duration-300 md:p-8 animate-in fade-in zoom-in-95 duration-200", className)}>
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-50 rounded-full p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors"
          aria-label="Close dialog"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left pb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-2xl font-bold tracking-tight text-ink-900', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-ink-600', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-ink-100 mt-6', className)} {...props} />;
}
