import { Button } from './button';
import { HelpCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-ink-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
        <button
          onClick={onCancel}
          className="absolute right-5 top-5 rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900 transition-all"
          aria-label="Cancel dialog"
        >
          <X className="h-4.5 w-4.5" />
        </button>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1.5 pt-1">
            <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
            <p className="text-xs font-semibold text-ink-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="rounded-full text-xs font-bold px-5 py-2 h-auto"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-ink-900 hover:bg-ink-800 text-white text-xs font-bold px-5 py-2 h-auto"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
