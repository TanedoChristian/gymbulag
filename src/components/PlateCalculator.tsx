import { useState } from 'react';
import { Modal, NumberField } from './ui';
import { calculatePlates, PLATE_SETS } from '../lib/plates';
import { kgToUnit, trimNumber, unitToKg } from '../lib/units';
import { saveSettings } from '../lib/repo';
import type { Unit } from '../types';

const PLATE_STYLE: Record<string, { color: string; h: number }> = {
  // kg (IWF colours)
  'kg-25': { color: '#dc2626', h: 100 },
  'kg-20': { color: '#2563eb', h: 100 },
  'kg-15': { color: '#eab308', h: 90 },
  'kg-10': { color: '#16a34a', h: 80 },
  'kg-5': { color: '#f4f4f5', h: 64 },
  'kg-2.5': { color: '#18181b', h: 52 },
  'kg-1.25': { color: '#a1a1aa', h: 44 },
  'lb-45': { color: '#2563eb', h: 100 },
  'lb-35': { color: '#eab308', h: 92 },
  'lb-25': { color: '#16a34a', h: 82 },
  'lb-10': { color: '#f4f4f5', h: 64 },
  'lb-5': { color: '#dc2626', h: 52 },
  'lb-2.5': { color: '#a1a1aa', h: 44 },
};

export function PlateCalculator({
  open,
  onClose,
  unit,
  barWeightKg,
  initialKg,
}: {
  open: boolean;
  onClose: () => void;
  unit: Unit;
  barWeightKg: number;
  initialKg?: number | null;
}) {
  if (!open) return null;
  return <Body onClose={onClose} unit={unit} barWeightKg={barWeightKg} initialKg={initialKg} />;
}

function Body({ onClose, unit, barWeightKg, initialKg }: { onClose: () => void; unit: Unit; barWeightKg: number; initialKg?: number | null }) {
  const defaultBar = Number(trimNumber(kgToUnit(barWeightKg, unit), 1));
  const [target, setTarget] = useState<number | null>(initialKg ? Number(trimNumber(kgToUnit(initialKg, unit), 2)) : unit === 'kg' ? 100 : 225);
  const [bar, setBar] = useState<number | null>(defaultBar);
  const plates = PLATE_SETS[unit];
  const res = calculatePlates(target ?? 0, bar ?? 0, plates);

  return (
    <Modal open onClose={onClose} title="Plate calculator" size="sm">
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Target ({unit})</span>
          <NumberField data-autofocus className="input text-lg font-bold" value={target} onChange={setTarget} />
        </label>
        <label>
          <span className="label">Bar ({unit})</span>
          <NumberField
            className="input text-lg font-bold"
            value={bar}
            onChange={setBar}
            onBlur={() => bar != null && saveSettings({ barWeight: unitToKg(bar, unit) })}
          />
        </label>
      </div>

      <div className="mt-5 flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 px-2 dark:bg-zinc-800" aria-hidden>
        <div className="h-3 w-10 rounded-l bg-zinc-400" />
        <div className="h-6 w-2 bg-zinc-500" />
        {res.perSide.map((p, i) => {
          const s = PLATE_STYLE[`${unit}-${p}`] ?? { color: '#71717a', h: 50 };
          return <div key={i} className="mx-px w-3.5 rounded-sm border border-black/20" style={{ height: `${s.h}%`, background: s.color }} title={`${p}`} />;
        })}
        <div className="h-3 w-6 rounded-r bg-zinc-400" />
      </div>

      <div className="mt-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Each side</div>
        <div className="mt-1 text-lg font-bold">
          {res.perSide.length ? res.perSide.map((p) => trimNumber(p)).join(' + ') : (target ?? 0) <= (bar ?? 0) ? 'Empty bar' : '—'}
        </div>
        {res.perSide.length > 0 && (
          <div className="text-sm text-zinc-500">
            {trimNumber(res.perSide.reduce((a, b) => a + b, 0))} {unit} per side
          </div>
        )}
        {res.remainder > 0 && (
          <div className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Closest loadable: {trimNumber(res.achieved)} {unit} ({trimNumber(res.remainder)} {unit} short)
          </div>
        )}
      </div>
    </Modal>
  );
}
