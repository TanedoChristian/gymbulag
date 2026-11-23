import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}

const GAP = 4;
const EDGE = 8;

/**
 * Small dropdown menu anchored to its trigger. Closes on outside click, Escape, scroll or resize.
 * The list floats above the page (rendered into <body>), so it is never clipped by, or makes scroll,
 * a scrolling container such as a table, drawer or modal.
 */
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Place the list next to the trigger: below it, or above when there isn't room; kept on screen.
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const r = button.current?.getBoundingClientRect();
    const m = list.current;
    if (!r || !m) return;
    const mw = m.offsetWidth;
    const mh = m.offsetHeight;
    let top = r.bottom + GAP;
    if (top + mh > window.innerHeight - EDGE && r.top - GAP - mh >= EDGE) top = r.top - GAP - mh;
    let left = align === 'right' ? r.right - mw : r.left;
    left = Math.min(Math.max(left, EDGE), window.innerWidth - mw - EDGE);
    setPos({ top: Math.max(top, EDGE), left });
  }, [open, align, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    // Scrolling inside the list itself is fine; anything else would leave it floating in the wrong place.
    const onScroll = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={list}
            role="menu"
            aria-label={label}
            // React events bubble through portals; keep clicks here from reaching e.g. a clickable table row.
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
            className="z-[70] max-h-[calc(100dvh-16px)] min-w-[11rem] animate-fade-in overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
          >
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap px-3 py-2 text-left text-sm font-medium transition hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-700 ${
                  it.danger ? 'text-red-600 dark:text-red-400' : it.active ? 'link-accent' : ''
                }`}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
