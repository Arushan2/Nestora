import { Button } from './button';
import { AlertCircle, X, Info, CheckCircle2 } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  confirmText?: string;
  type?: 'info' | 'error' | 'success';
}

export function AlertModal({
  isOpen,
  title,
  message,
  onClose,
  confirmText = 'OK',
  type = 'info'
}: AlertModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBgClass = () => {
    switch (type) {
      case 'error':
        return 'bg-red-50 text-red-600';
      case 'success':
        return 'bg-green-50 text-green-600';
      default:
        return 'bg-blue-50 text-blue-600';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-ink-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900 transition-all"
          aria-label="Close dialog"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        <div className="flex items-start gap-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getBgClass()}`}>
            {getIcon()}
          </div>
          <div className="flex-1 space-y-1.5 pt-1">
            <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
            <p className="text-xs font-semibold text-ink-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            onClick={onClose}
            className="rounded-full bg-ink-900 hover:bg-ink-800 text-white text-xs font-bold px-6 py-2 h-auto"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
