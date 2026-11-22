import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}

/** Small dropdown menu anchored to its trigger. Closes on outside click / Escape. */
export function Menu({
  trigger,
  items,
  align = 'right',
  label,
  triggerClassName = 'icon-btn',
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  label: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          const r = root.current?.getBoundingClientRect();
          setDropUp(!!r && window.innerHeight - r.bottom < 260);
          setOpen((o) => !o);
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-30 min-w-[11rem] animate-fade-in overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-700 ${
                it.danger ? 'text-red-600 dark:text-red-400' : it.active ? 'text-indigo-600 dark:text-indigo-400' : ''
              }`}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
