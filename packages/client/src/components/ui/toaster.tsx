import { useState, createContext, useContext, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (options: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((options: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...options, id }]);

    // Auto-remove after 5 seconds
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const toast = useCallback((options: Omit<Toast, 'id'>) => addToast(options), [addToast]);
  const success = useCallback((title: string, description?: string) =>
    addToast({ type: 'success', title, description }), [addToast]);
  const error = useCallback((title: string, description?: string) =>
    addToast({ type: 'error', title, description }), [addToast]);
  const info = useCallback((title: string, description?: string) =>
    addToast({ type: 'info', title, description }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none md:bottom-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto w-full max-w-sm rounded-lg p-4 shadow-lg border flex items-start gap-3 animate-in slide-in-from-bottom-5',
              t.type === 'success' && 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800',
              t.type === 'error' && 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',
              t.type === 'info' && 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
            )}
          >
            {t.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'font-medium text-sm',
                t.type === 'success' && 'text-green-800 dark:text-green-200',
                t.type === 'error' && 'text-red-800 dark:text-red-200',
                t.type === 'info' && 'text-blue-800 dark:text-blue-200'
              )}>
                {t.title}
              </p>
              {t.description && (
                <p className={cn(
                  'text-sm mt-1',
                  t.type === 'success' && 'text-green-700 dark:text-green-300',
                  t.type === 'error' && 'text-red-700 dark:text-red-300',
                  t.type === 'info' && 'text-blue-700 dark:text-blue-300'
                )}>
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className={cn(
                'shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10',
                t.type === 'success' && 'text-green-600 dark:text-green-400',
                t.type === 'error' && 'text-red-600 dark:text-red-400',
                t.type === 'info' && 'text-blue-600 dark:text-blue-400'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
