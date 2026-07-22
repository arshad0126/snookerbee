import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

interface ToastAction { label: string; onPress: () => void; }
interface ToastItem { id: number; message: string; action?: ToastAction; }

interface ToastContextValue {
  show: (message: string, options?: { action?: ToastAction; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue['show']>((message, options) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, message, action: options?.action }]);
    window.setTimeout(() => dismiss(id), options?.durationMs ?? DEFAULT_DURATION);
  }, [dismiss]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="ui-toast-host" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="ui-toast">
              <span className="ui-toast-msg">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="ui-toast-action"
                  onClick={() => { t.action?.onPress(); dismiss(t.id); }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}
