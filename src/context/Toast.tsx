import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ToastOptions {
  action?: { label: string; onClick: () => void };
  tone?: 'default' | 'error' | 'success';
  duration?: number;
}
interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

const ToastCtx = createContext<(message: string, opts?: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, message, ...opts }]);
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3000));
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }}
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md animate-slide-up items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${
              t.tone === 'error'
                ? 'bg-red-600 text-white ring-red-700'
                : 'bg-zinc-900 text-zinc-50 ring-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-200'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className="font-semibold text-indigo-300 hover:underline dark:text-indigo-700"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button aria-label="Dismiss" className="opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
