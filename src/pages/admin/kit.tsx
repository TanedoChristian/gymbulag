/* Building blocks for the admin panel: page titles, data tables, badges, drawer, pagination. */
import { useEffect, useMemo, useRef, useState, type ReactNode, type ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';

export function PageTitle({ title, desc, actions }: { title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl font-bold leading-tight tracking-wide">{title}</h1>
        {desc && <p className="mt-0.5 text-sm text-steel-mute dark:text-floor-mute">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className = '', flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(title || actions) && (
        <header className="flex items-center gap-3 border-b border-steel/10 px-4 py-3 dark:border-white/[0.06]">
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold">{title}</h2>
          {actions}
        </header>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- badges */

const TONES = {
  green: 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-300',
  red: 'bg-red-500/10 text-red-700 ring-red-600/20 dark:text-red-400',
  volt: 'bg-volt-500/20 text-steel ring-volt-700/25 dark:text-volt-400',
  blue: 'bg-sky-500/10 text-sky-700 ring-sky-600/20 dark:text-sky-300',
  gray: 'bg-steel/[0.07] text-steel-soft ring-steel/10 dark:bg-white/[0.06] dark:text-floor-mute dark:ring-white/10',
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = 'gray', children, title, dot }: { tone?: Tone; children: ReactNode; title?: string; dot?: boolean }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials =
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?';
  const dims = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs';
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-rack font-display font-bold text-volt-500 ${dims}`}>{initials}</span>;
}

/* ----------------------------------------------------------------- tables */

export type SortDir = 'asc' | 'desc';
export interface Sort<K extends string> {
  key: K;
  dir: SortDir;
}

/** Sort rows by one of their keys; clicking the same header flips the direction. */
export function useSort<T, K extends string>(rows: T[], initial: Sort<K>, get: (row: T, key: K) => string | number | null) {
  const [sort, setSort] = useState<Sort<K>>(initial);
  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const x = get(a, sort.key);
      const y = get(b, sort.key);
      if (x === y) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y) : x < y ? -1 : 1;
      return sort.dir === 'asc' ? c : -c;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const toggle = (key: K) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: typeof get(rows[0] as T, key) === 'string' ? 'asc' : 'desc' }));
  return { sorted, sort, toggle };
}

export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-steel/10 bg-steel/[0.03] text-[11px] font-bold uppercase tracking-wider text-steel-mute dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-floor-mute">
        {children}
      </tr>
    </thead>
  );
}

export function Th<K extends string>({
  children,
  sortKey,
  sort,
  onSort,
  className = '',
  ...rest
}: { children?: ReactNode; sortKey?: K; sort?: Sort<K>; onSort?: (k: K) => void; className?: string } & ThHTMLAttributes<HTMLTableCellElement>) {
  const active = sortKey && sort?.key === sortKey;
  return (
    <th scope="col" className={`whitespace-nowrap px-4 py-2.5 font-bold ${className}`} aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined} {...rest}>
      {sortKey && onSort ? (
        <button className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-steel dark:hover:text-white ${active ? 'text-steel dark:text-white' : ''}`} onClick={() => onSort(sortKey)}>
          {children}
          {active ? sort!.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <span className="w-3" />}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Tr({ children, onClick, dim }: { children: ReactNode; onClick?: () => void; dim?: boolean }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-steel/[0.07] last:border-0 dark:border-white/[0.05] ${onClick ? 'cursor-pointer transition hover:bg-steel/[0.035] dark:hover:bg-white/[0.03]' : ''} ${dim ? 'opacity-60' : ''}`}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center text-sm text-steel-mute dark:text-floor-mute">
        {children}
      </td>
    </tr>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex justify-center py-16 text-steel-mute">
      <Loader2 className="animate-spin" />
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
      <span className="flex-1 text-red-600 dark:text-red-400">{message}</span>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- toolbar */

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-steel/10 px-4 py-3 dark:border-white/[0.06]">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative min-w-[12rem] flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel-mute" />
      <input className="input !py-2 !pl-9 !pr-8 text-sm" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value && (
        <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-steel-mute hover:text-steel" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </label>
  );
}

export function SelectFilter<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-steel-mute dark:text-floor-mute">
      <span className="hidden sm:inline">{label}</span>
      <select className="input !w-auto !py-2 !pl-2.5 !pr-8 text-sm font-medium text-steel dark:text-white" value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------- pagination */

export function usePaged<T>(rows: T[], pageSize = 20, resetKey: unknown = null) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [resetKey]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const p = Math.min(page, pages - 1);
  return { rows: rows.slice(p * pageSize, (p + 1) * pageSize), page: p, pages, setPage, total: rows.length, pageSize };
}

export function Pagination({ page, pages, total, pageSize, onPage, noun = 'rows' }: { page: number; pages: number; total: number; pageSize: number; onPage: (p: number) => void; noun?: string }) {
  if (!total) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex items-center gap-2 border-t border-steel/10 px-4 py-2.5 text-xs text-steel-mute dark:border-white/[0.06] dark:text-floor-mute">
      <span className="flex-1 tabular">
        {from}–{to} of {total.toLocaleString()} {noun}
      </span>
      <button className="icon-btn !h-8 !w-8" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft size={16} />
      </button>
      <span className="tabular">
        {page + 1} / {pages}
      </span>
      <button className="icon-btn !h-8 !w-8" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Next page">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- drawer */

/** A panel that slides in from the right (full screen on phones). */
export function Drawer({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative flex h-full w-full max-w-xl flex-col bg-floor shadow-2xl outline-none dark:bg-floor-dark"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button className="icon-btn absolute right-3 top-3 z-10" onClick={onClose} aria-label="Close" style={{ marginTop: 'env(safe-area-inset-top)' }}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

/** Label / value row for detail views. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2 text-sm">
      <dt className="w-32 shrink-0 text-steel-mute dark:text-floor-mute">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}
