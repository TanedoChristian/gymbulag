import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Scale, TrendingDown, TrendingUp, X } from 'lucide-react';
import { db } from '../db';
import { setBodyWeight } from '../lib/repo';
import { fromKey } from '../lib/date';
import { formatDelta, kgToUnit, trimNumber, unitToKg } from '../lib/units';
import { useBodyWeights, useSettings } from '../hooks/data';
import { useToast } from '../context/Toast';
import { NumberField } from './ui';
import type { Unit } from '../types';
import type { WeightGoal } from '../lib/tdee';

/** Known body weight (kg) for each day: weigh-ins first, then session bodyweight. */
export function useWeightByDate(): Map<string, number> {
  const all = useBodyWeights();
  return useMemo(() => new Map((all ?? []).map((w) => [w.date, w.kg])), [all]);
}

/** Green when the change goes the way your goal says, amber when it goes the other way. */
export function deltaTone(diffKg: number, goal: WeightGoal): 'good' | 'bad' | 'neutral' {
  if (Math.abs(diffKg) < 0.05) return 'neutral';
  if (goal.startsWith('lose')) return diffKg < 0 ? 'good' : 'bad';
  if (goal.startsWith('gain')) return diffKg > 0 ? 'good' : 'bad';
  return Math.abs(diffKg) <= 1 ? 'good' : 'neutral';
}

const TONE_CLASS = {
  good: 'bg-emerald-500 text-white',
  bad: 'bg-amber-500 text-white',
  neutral: 'bg-black/55 text-white backdrop-blur',
} as const;

/** Small "−2.3 kg" chip, coloured by your weight goal. */
export function DeltaChip({ diffKg, unit, goal, suffix, className = '' }: { diffKg: number; unit: Unit; goal: WeightGoal; suffix?: string; className?: string }) {
  const tone = deltaTone(diffKg, goal);
  const Icon = diffKg < 0 ? TrendingDown : TrendingUp;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular ${TONE_CLASS[tone]} ${className}`}>
      {Math.abs(diffKg) >= 0.05 && <Icon size={12} />}
      {formatDelta(kgToUnit(diffKg, unit), unit)}
      {suffix && <span className="font-semibold opacity-80">{suffix}</span>}
    </span>
  );
}

/** Body weight for one day, shown on the day page under the progress photo. */
export function DayWeightCard({ date }: { date: string }) {
  const settings = useSettings();
  const toast = useToast();
  const unit = settings.unit;
  const entry = useLiveQuery(() => db.weights.get(date), [date]);
  const all = useBodyWeights();

  // Previous known weight before this day (weigh-in or session), to show the change.
  const prev = useMemo(() => {
    if (!all) return null;
    for (let i = all.length - 1; i >= 0; i--) if (all[i].date < date) return all[i];
    return null;
  }, [all, date]);
  const sessionKg = all?.find((w) => w.date === date && w.source === 'session')?.kg ?? null;
  const kg = entry?.kg ?? null;
  const shownKg = kg ?? sessionKg;
  const display = kg == null ? null : Number(trimNumber(kgToUnit(kg, unit), 1));

  const clear = async () => {
    const old = await setBodyWeight(date, null);
    if (old) toast('Weight removed', { action: { label: 'Undo', onClick: () => void db.weights.put(old) } });
  };

  return (
    <div className="card flex items-center gap-3 p-2.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
        <Scale size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">Body weight</div>
        <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {shownKg != null && prev ? (
            <>
              <span className={deltaTone(shownKg - prev.kg, settings.weightGoal) === 'bad' ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-semibold text-emerald-600 dark:text-emerald-400'}>
                {formatDelta(kgToUnit(shownKg - prev.kg, unit), unit)}
              </span>{' '}
              vs {format(fromKey(prev.date), 'MMM d')}
            </>
          ) : kg == null && sessionKg != null ? (
            `${trimNumber(kgToUnit(sessionKg, unit), 1)} ${unit} from your session`
          ) : prev ? (
            `Last: ${trimNumber(kgToUnit(prev.kg, unit), 1)} ${unit} on ${format(fromKey(prev.date), 'MMM d')}`
          ) : (
            'Shown on your progress photos'
          )}
        </div>
      </div>
      <div className="relative w-28 shrink-0">
        <NumberField
          className="input !pr-9 text-right font-bold tabular"
          decimals={1}
          value={display}
          placeholder={sessionKg != null ? trimNumber(kgToUnit(sessionKg, unit), 1) : '—'}
          max={unit === 'kg' ? 400 : 880}
          aria-label={`Body weight in ${unit}`}
          onChange={(v) => void setBodyWeight(date, v == null || v <= 0 ? null : unitToKg(v, unit))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{unit}</span>
      </div>
      {kg != null && (
        <button className="icon-btn -ml-1 !h-8 !w-8 text-zinc-400" onClick={clear} aria-label="Remove body weight">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
