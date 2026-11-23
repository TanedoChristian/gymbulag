import { Minus, Plus, Timer, X } from 'lucide-react';
import { useRestTimer } from '../context/RestTimer';

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function RestTimerBar() {
  const { state, remaining, adjust, stop } = useRestTimer();
  if (!state) return null;
  const done = remaining === 0;
  const pct = Math.min(100, ((state.duration - remaining) / state.duration) * 100);

  return (
    <div className="fixed inset-x-0 z-40 flex justify-center px-3 lg:px-4" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.75rem)' }}>
      <div
        className={`relative w-full max-w-md overflow-hidden rounded-lg shadow-rack ring-1 lg:bottom-0 ${
          done ? 'animate-volt-pulse bg-volt-500 text-volt-ink ring-volt-600' : 'bg-rack text-steel-bright ring-white/10'
        }`}
        role="timer"
        aria-live="off"
      >
        <div className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${done ? 'bg-black/10' : 'bg-volt-500/25'}`} style={{ width: `${pct}%` }} />
        <div className="relative flex items-center gap-2 px-3 py-2">
          <Timer size={18} className="ml-1 opacity-80" />
          <div className="flex-1">
            <div className="font-display text-[11px] font-medium uppercase tracking-wider opacity-70">{done ? 'Rest over' : 'Rest'}</div>
            <div className={`font-mono text-xl font-bold tabular leading-none ${done ? 'animate-pop' : ''}`}>{done ? 'Go!' : mmss(remaining)}</div>
          </div>
          {!done && (
            <>
              <button className="flex h-9 items-center gap-0.5 rounded-md bg-white/10 px-2.5 text-sm font-semibold hover:bg-white/20" onClick={() => adjust(-15)} aria-label="Subtract 15 seconds">
                <Minus size={14} />15
              </button>
              <button className="flex h-9 items-center gap-0.5 rounded-md bg-white/10 px-2.5 text-sm font-semibold hover:bg-white/20" onClick={() => adjust(15)} aria-label="Add 15 seconds">
                <Plus size={14} />15
              </button>
            </>
          )}
          <button className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/20" onClick={stop} aria-label="Stop timer">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
