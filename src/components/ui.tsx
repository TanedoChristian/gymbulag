import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* ---------------------------------- Modal --------------------------------- */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === 'Tab' && panel.current) {
        const focusables = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) {
        const auto = panel.current.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
        (auto ?? panel.current).focus();
      }
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full ${width} animate-slide-up flex-col rounded-t-lg border border-steel/10 bg-floor-soft shadow-2xl outline-none dark:border-white/10 dark:bg-rack-raised sm:rounded-lg`}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-floor-mute dark:bg-rack-edge sm:hidden" aria-hidden />
        <div className="flex items-center justify-between gap-2 px-5 pb-3 pt-3 sm:pt-4">
          <h2 id={titleId} className="font-display text-xl font-bold tracking-wide">
            {title}
          </h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pt-1">{children}</div>
        {footer && <div className="border-t border-zinc-200/70 px-5 py-3 pb-safe dark:border-white/[0.06]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------- NumberField ------------------------------ */

interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | null;
  onChange: (v: number | null) => void;
  decimals?: number;
  integer?: boolean;
  max?: number;
}

function fmt(v: number | null, decimals: number): string {
  return v == null ? '' : String(Number(v.toFixed(decimals)));
}

/**
 * Numeric text input that tolerates intermediate states like "72." and
 * comma decimals, and opens the numeric keypad on mobile.
 */
export function NumberField({ value, onChange, decimals = 2, integer, max, className = '', onFocus, onBlur, ...rest }: NumberFieldProps) {
  const [text, setText] = useState(() => fmt(value, decimals));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(fmt(value, decimals));
  }, [value, decimals]);

  return (
    <input
      {...rest}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      enterKeyHint="next"
      className={className}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(fmt(value, decimals));
        onBlur?.(e);
      }}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.').trim();
        const re = integer ? /^\d*$/ : /^\d*\.?\d*$/;
        if (!re.test(t)) return;
        setText(t);
        if (t === '' || t === '.') return onChange(null);
        let n = parseFloat(t);
        if (max != null && n > max) n = max;
        onChange(n);
      }}
    />
  );
}

/* -------------------------------- Segmented ------------------------------- */

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-md bg-steel/[0.07] p-1 dark:bg-white/[0.06]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`rounded-sm font-semibold transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} ${
              active
                ? 'bg-floor-soft text-steel shadow-sm dark:bg-rack-edge dark:text-white'
                : 'text-steel-mute hover:text-steel dark:text-floor-mute dark:hover:text-white'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------- Toggle --------------------------------- */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-md transition ${checked ? 'bg-volt-500' : 'bg-floor-mute dark:bg-rack-edge'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-sm bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

/* ------------------------------- Misc pieces ------------------------------ */

export function StatTile({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-steel-mute dark:text-floor-mute">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 font-mono text-[26px] font-bold leading-none tracking-tight tabular">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-steel-mute dark:text-floor-mute">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-rack text-volt-500">
        {icon}
      </div>
      <h3 className="font-display text-xl font-bold tracking-wide">{title}</h3>
      {children && <div className="mt-2 max-w-sm text-sm leading-relaxed text-steel-mute dark:text-floor-mute">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, left, right }: { title: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-steel/10 bg-floor/90 backdrop-blur-xl dark:border-white/[0.06] dark:bg-floor-dark/90"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-14 max-w-app items-center gap-2 px-4 lg:max-w-app-wide lg:px-8">
        {left}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold leading-tight tracking-wide">{title}</h1>
          {subtitle && <div className="truncate text-xs font-medium text-steel-mute dark:text-floor-mute">{subtitle}</div>}
        </div>
        {right}
      </div>
    </header>
  );
}

/** Horizontally scrollable underline-free pill tabs. */
export function TabBar<T extends string>({ value, onChange, tabs, ariaLabel }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; icon?: ReactNode }[]; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-2 font-display text-sm font-semibold tracking-wide transition ${
              on
                ? 'bg-rack text-steel-bright shadow-sm dark:bg-volt-500 dark:text-volt-ink'
                : 'text-steel-mute hover:bg-steel/[0.06] hover:text-steel dark:text-floor-mute dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            <span className="hidden sm:inline-flex">{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Loading">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-floor-mute border-t-volt-600 dark:border-rack-edge dark:border-t-volt-400" />
    </div>
  );
}
