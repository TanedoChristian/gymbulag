import { useEffect, useState } from 'react';
import { MousePointerClick } from 'lucide-react';
import type { MuscleGroup } from '../../types';
import { capitalize } from '../../lib/muscles';
import { MUSCLE_PART_META, type BodyView, type MusclePart } from '../../lib/anatomy';
import { BodyMap } from './BodyMap';

interface Props {
  exerciseName: string;
  muscleGroup: MuscleGroup;
  primary: MusclePart[];
  secondary: MusclePart[];
}

const PRIMARY = '#e5322d';
const SECONDARY = '#f59e0b';

export function MuscleHitPanel({ exerciseName, muscleGroup, primary, secondary }: Props) {
  const [focus, setFocus] = useState<MusclePart | null>(primary[0] ?? secondary[0] ?? null);
  useEffect(() => {
    setFocus(primary[0] ?? secondary[0] ?? null);
  }, [exerciseName, primary, secondary]);

  const active = new Set([...primary, ...secondary]);
  const selected = focus ? MUSCLE_PART_META[focus] : null;
  const isPrimary = focus ? primary.includes(focus) : false;
  const roleColor = isPrimary ? PRIMARY : SECONDARY;

  const select = (part: MusclePart) => {
    if (active.has(part)) setFocus(part);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[17px] font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Muscles worked</h3>
          <p className="mt-0.5 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{exerciseName}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-red-600 dark:text-red-400">
            <span className="h-2 w-2 rounded-full" style={{ background: PRIMARY }} />
            Primary · {primary.length}
          </span>
          {secondary.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-400">
              <span className="h-2 w-2 rounded-full" style={{ background: SECONDARY }} />
              Assist · {secondary.length}
            </span>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3" aria-label="Front and back muscle maps">
        <BodyCard view="front" primary={primary} secondary={secondary} focus={focus} onSelect={select} />
        <BodyCard view="back" primary={primary} secondary={secondary} focus={focus} onSelect={select} />
      </section>

      <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
        <MousePointerClick size={13} />
        Tap a coloured muscle to inspect it
      </p>

      {selected && focus && (
        <section
          className="overflow-hidden rounded-[20px] border bg-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.25)] dark:bg-white/[0.04] dark:shadow-none"
          style={{ borderColor: `${roleColor}38` }}
          aria-live="polite"
        >
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${roleColor}, ${roleColor}55)` }} />
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: roleColor }}>
                  {isPrimary ? 'Primary target' : 'Assisting muscle'}
                </div>
                <h4 className="mt-1 truncate text-base font-extrabold tracking-tight">{selected.label}</h4>
                <p className="truncate text-[11px] font-medium italic text-zinc-400">{selected.scientific}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex gap-1" aria-label={isPrimary ? 'High activation' : 'Moderate activation'}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className="h-4 w-1.5 rounded-full"
                      style={{ background: i < (isPrimary ? 5 : 3) ? roleColor : 'rgba(120,120,120,0.18)' }}
                    />
                  ))}
                </div>
                <div className="mt-1 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: roleColor }}>
                  {isPrimary ? 'High' : 'Moderate'}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300">{selected.functionCue}</p>
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <MuscleGroupList title="Primary" subtitle="Main drivers" parts={primary} focus={focus} onSelect={select} primary />
        {secondary.length > 0 ? (
          <MuscleGroupList title="Assisting" subtitle="Stabilizers" parts={secondary} focus={focus} onSelect={select} />
        ) : (
          <div className="flex items-center rounded-[20px] border border-dashed border-zinc-200 px-4 py-3 dark:border-white/10">
            <p className="text-xs leading-relaxed text-zinc-500">
              <span className="font-bold text-zinc-700 dark:text-zinc-200">Isolation focus.</span> No major assisting muscle is emphasised.
            </p>
          </div>
        )}
      </section>

      <p className="text-center text-[11px] font-medium text-zinc-400">
        Logged as <span className="font-bold text-zinc-600 dark:text-zinc-300">{capitalize(muscleGroup)}</span>
      </p>
    </div>
  );
}

function BodyCard({
  view,
  primary,
  secondary,
  focus,
  onSelect,
}: {
  view: BodyView;
  primary: MusclePart[];
  secondary: MusclePart[];
  focus: MusclePart | null;
  onSelect: (part: MusclePart) => void;
}) {
  const inView = (part: MusclePart) => {
    const v = MUSCLE_PART_META[part].view;
    return v === view || v === 'both';
  };
  const hits = [...primary.filter(inView), ...secondary.filter(inView)];
  const focusHere = focus != null && hits.includes(focus);

  return (
    <figure
      className={`overflow-hidden rounded-[22px] border bg-gradient-to-b from-slate-50 via-slate-100/80 to-slate-200/70 shadow-[0_14px_34px_-22px_rgba(15,23,42,0.35)] transition dark:from-[#161c28] dark:via-[#111620] dark:to-[#0c1018] ${
        focusHere ? 'border-red-400/60 dark:border-red-400/35' : 'border-slate-200/90 dark:border-white/10'
      }`}
    >
      <figcaption className="flex items-center justify-between px-3.5 pt-3">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{view}</span>
        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-300">
          {hits.length ? `${hits.length} hit${hits.length === 1 ? '' : 's'}` : '—'}
        </span>
      </figcaption>
      <div className="mx-auto h-[310px] w-full max-w-[176px] px-1 pb-2 sm:h-[360px] sm:max-w-[200px]">
        <BodyMap view={view} primary={primary} secondary={secondary} focus={focus} onSelectPart={onSelect} />
      </div>
    </figure>
  );
}

function MuscleGroupList({
  title,
  subtitle,
  parts,
  focus,
  onSelect,
  primary = false,
}: {
  title: string;
  subtitle: string;
  parts: MusclePart[];
  focus: MusclePart | null;
  onSelect: (part: MusclePart) => void;
  primary?: boolean;
}) {
  const color = primary ? PRIMARY : SECONDARY;
  return (
    <div className="rounded-[20px] border border-zinc-200/80 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035]">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h4 className="text-xs font-extrabold tracking-tight">{title}</h4>
        <p className="truncate text-[10px] font-medium text-zinc-400">{subtitle}</p>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {parts.map((part) => {
          const meta = MUSCLE_PART_META[part];
          const selected = focus === part;
          return (
            <li key={part}>
              <button
                type="button"
                onClick={() => onSelect(part)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition active:scale-[0.99] ${
                  selected
                    ? 'shadow-sm'
                    : 'border-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.05]'
                }`}
                style={selected ? { background: `${color}14`, borderColor: `${color}30` } : undefined}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-4" style={{ background: color, ['--tw-ring-color' as string]: `${color}22` }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold leading-tight">{meta.short}</span>
                </span>
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                  style={selected ? { background: color, color: '#fff' } : { background: `${color}14`, color }}
                >
                  {primary ? 'High' : 'Med'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
