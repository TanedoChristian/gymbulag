import { useRef, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { ArrowDown, ArrowLeftRight, ArrowUp, Calculator, Check, History, Info, Minus, MoreHorizontal, Plus, Repeat, StickyNote, Trash2, Trophy, X } from 'lucide-react';
import { ExerciseDetail } from './ExerciseDetail';
import { Menu } from './Menu';
import { NumberField } from './ui';
import { newSet } from '../lib/repo';
import { kgToUnit, trimNumber, unitToKg, formatVolume, otherUnit } from '../lib/units';
import { exerciseVolume, isWorkingSet, type PRKind, summarizeSets } from '../lib/calc';
import { fromKey } from '../lib/date';
import { MUSCLE_COLORS } from '../lib/muscles';
import { useToast } from '../context/Toast';
import type { Exercise, SessionExercise, SetType, Unit, WorkSet } from '../types';

const TYPE_LABEL: Record<SetType, string> = { normal: 'Normal', warmup: 'Warm-up', drop: 'Drop set', failure: 'To failure' };
const TYPE_BADGE: Record<Exclude<SetType, 'normal'>, { text: string; cls: string }> = {
  warmup: { text: 'W', cls: '!text-amber-600 dark:!text-amber-400' },
  drop: { text: 'D', cls: '!text-sky-600 dark:!text-sky-400' },
  failure: { text: 'F', cls: '!text-red-600 dark:!text-red-400' },
};
const PR_LABEL: Record<PRKind, string> = { e1rm: 'Est. 1RM PR', weight: 'Weight PR', reps: 'Rep PR' };

export type ExerciseUpdater = SessionExercise | ((cur: SessionExercise) => SessionExercise);

export interface ExerciseCardProps {
  item: SessionExercise;
  meta: Exercise | undefined;
  index: number;
  count: number;
  unit: Unit;
  live: boolean;
  showRpe: boolean;
  prs: Map<string, PRKind[]>;
  last: { date: string; exercise: SessionExercise } | null;
  onChange: (next: ExerciseUpdater) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onReplace: () => void;
  onSetCompleted: () => void;
  onPlates: (kg: number | null, unit: Unit) => void;
}

export function ExerciseCard({ item, meta, index, count, unit, live, showRpe, prs, last, onChange, onRemove, onMove, onReplace, onSetCompleted, onPlates }: ExerciseCardProps) {
  const toast = useToast();
  const [showNotes, setShowNotes] = useState(item.notes.length > 0);
  const [showGuide, setShowGuide] = useState(false);
  const prevSets = last?.exercise.sets ?? [];
  // Weights are stored in kg; this is only the unit they're typed and shown in.
  const inputUnit: Unit = item.unit ?? unit;
  const fmt = (kg: number) => trimNumber(kgToUnit(kg, inputUnit), 1);
  const switchUnit = () => onChange((cur) => ({ ...cur, unit: otherUnit(cur.unit ?? unit) }));

  const updateSet = (id: string, patch: Partial<WorkSet>) =>
    onChange((cur) => ({ ...cur, sets: cur.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addSet = () =>
    onChange((cur) => {
      const lastSet = cur.sets[cur.sets.length - 1];
      return {
        ...cur,
        sets: [
          ...cur.sets,
          newSet({ type: lastSet && lastSet.type !== 'warmup' ? lastSet.type : 'normal', weight: lastSet?.weight ?? null, reps: lastSet?.reps ?? null }),
        ],
      };
    });

  const removeSet = (id: string) => {
    const idx = item.sets.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const removed = item.sets[idx];
    onChange((cur) => ({ ...cur, sets: cur.sets.filter((s) => s.id !== id) }));
    // Only offer undo when real data was removed — deleting blank placeholder sets stays quick and silent.
    if (removed.reps != null || removed.weight != null) {
      toast(`Set ${idx + 1} removed`, {
        action: {
          label: 'Undo',
          onClick: () =>
            onChange((cur) => {
              const sets = [...cur.sets];
              sets.splice(Math.min(idx, sets.length), 0, removed);
              return { ...cur, sets };
            }),
        },
      });
    }
  };

  const removeLastSet = () => {
    // Prefer removing an empty trailing set; otherwise the last one.
    const lastEmpty = [...item.sets].reverse().find((s) => s.reps == null && s.weight == null);
    const target = lastEmpty ?? item.sets[item.sets.length - 1];
    if (target) removeSet(target.id);
  };

  const copyLast = () => {
    if (!last) return;
    onChange((cur) => ({ ...cur, sets: last.exercise.sets.map((s) => newSet({ type: s.type, weight: s.weight, reps: s.reps })) }));
  };

  const allEmpty = item.sets.every((s) => s.reps == null && s.weight == null);
  const logged = item.sets.filter(isWorkingSet).length;
  const doneCount = item.sets.filter((s) => s.done).length;
  const volume = exerciseVolume(item);
  const prCount = item.sets.filter((s) => prs.has(s.id)).length;
  let workingIndex = 0;

  // Columns: set # | previous | weight | reps | [rpe] | done-or-delete
  const gridCols = showRpe ? 'grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_3.75rem_3.25rem_2.5rem]' : 'grid-cols-[2.25rem_minmax(0,1fr)_5.25rem_4.25rem_2.5rem]';
  const color = meta ? MUSCLE_COLORS[meta.muscle] : '#71717a';

  return (
    <section className="card overflow-hidden" aria-label={meta?.name ?? 'Exercise'}>
      <div className="relative flex items-start gap-3 p-4 pb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold" style={{ background: `${color}1f`, color }} aria-hidden>
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <button type="button" className="group flex max-w-full items-center gap-1.5 text-left" onClick={() => meta && setShowGuide(true)} disabled={!meta} title="How to do it">
            <h3 className="truncate text-base font-bold leading-tight tracking-tight group-hover:text-volt-700 dark:text-volt-400 dark:group-hover:text-volt-300">{meta?.name ?? 'Unknown exercise'}</h3>
            {meta && <Info size={14} className="shrink-0 text-zinc-300 transition group-hover:text-volt-600 dark:text-zinc-600" />}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold capitalize" style={{ color }}>
              {meta?.muscle ?? '—'}
            </span>
            <Dot />
            <span>{live ? `${doneCount}/${item.sets.length} done` : `${logged} ${logged === 1 ? 'set' : 'sets'}`}</span>
            {volume > 0 && (
              <>
                <Dot />
                <span className="tabular">
                  {formatVolume(volume, unit)} {unit}
                </span>
              </>
            )}
            {prCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">
                <Trophy size={11} /> PR
              </span>
            )}
          </div>
        </div>
        <Menu
          label="Exercise options"
          trigger={<MoreHorizontal size={18} />}
          items={[
            { label: 'How to do it', icon: <Info size={16} />, onSelect: () => setShowGuide(true), disabled: !meta },
            { label: 'Move up', icon: <ArrowUp size={16} />, onSelect: () => onMove(-1), disabled: index === 0 },
            { label: 'Move down', icon: <ArrowDown size={16} />, onSelect: () => onMove(1), disabled: index === count - 1 },
            { label: showNotes ? 'Hide note' : 'Add note', icon: <StickyNote size={16} />, onSelect: () => setShowNotes((v) => !v) },
            { label: `Log in ${otherUnit(inputUnit)} instead`, icon: <ArrowLeftRight size={16} />, onSelect: switchUnit },
            { label: 'Replace exercise', icon: <Repeat size={16} />, onSelect: onReplace },
            { label: 'Plate calculator', icon: <Calculator size={16} />, onSelect: () => onPlates([...item.sets].reverse().find((s) => s.weight != null)?.weight ?? null, inputUnit) },
            { label: 'Remove exercise', icon: <Trash2 size={16} />, onSelect: onRemove, danger: true },
          ]}
        />
      </div>

      {last && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-300">
          <History size={13} className="shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-zinc-900 dark:text-white">Last · {format(fromKey(last.date), 'MMM d')}</span>
            <span className="tabular"> — {summarizeSets(last.exercise.sets, fmt) || 'no sets'}</span>
          </span>
          {allEmpty && (
            <button className="shrink-0 rounded-lg bg-volt-500/15 px-2 py-1 font-bold text-volt-700 dark:text-volt-400 hover:bg-volt-500/20 dark:text-volt-300" onClick={copyLast}>
              Copy all
            </button>
          )}
        </div>
      )}

      {showNotes && (
        <div className="px-4 pb-3">
          <textarea
            className="input min-h-[2.5rem] resize-y !py-2 text-sm"
            rows={1}
            placeholder="Notes (seat height, grip, cues…)"
            value={item.notes}
            onChange={(e) => onChange((cur) => ({ ...cur, notes: e.target.value }))}
            aria-label="Exercise notes"
          />
        </div>
      )}

      {item.sets.length > 0 && (
        <div role="table" aria-label="Sets" className="pb-1">
          <div role="row" className={`grid ${gridCols} items-center gap-2 px-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500`}>
            <span role="columnheader" className="text-center">Set</span>
            <span role="columnheader">Previous</span>
            <span role="columnheader" className="flex justify-center">
              <button
                type="button"
                onClick={switchUnit}
                className="inline-flex items-center gap-1 rounded-md bg-volt-500/15 px-1.5 py-0.5 font-extrabold text-volt-700 dark:text-volt-400 transition hover:bg-volt-500/20 dark:text-volt-300"
                aria-label={`Weights in ${inputUnit}. Switch to ${otherUnit(inputUnit)}`}
                title={`Switch to ${otherUnit(inputUnit)}`}
              >
                {inputUnit}
                <ArrowLeftRight size={10} strokeWidth={2.5} />
              </button>
            </span>
            <span role="columnheader" className="text-center">Reps</span>
            {showRpe && <span role="columnheader" className="text-center">RPE</span>}
            <span role="columnheader" className="flex justify-center">
              {live ? <Check size={13} strokeWidth={3} /> : <span className="sr-only">Delete</span>}
            </span>
          </div>
          {item.sets.map((s, i) => {
            if (s.type !== 'warmup') workingIndex++;
            return (
              <SetRow
                key={s.id}
                set={s}
                label={s.type === 'normal' ? String(workingIndex) : TYPE_BADGE[s.type].text}
                labelCls={s.type === 'normal' ? '' : TYPE_BADGE[s.type].cls}
                prev={prevSets[i]}
                unit={inputUnit}
                live={live}
                showRpe={showRpe}
                gridCols={gridCols}
                prs={prs.get(s.id)}
                onPatch={(p) => updateSet(s.id, p)}
                onRemove={() => removeSet(s.id)}
                onCompleted={onSetCompleted}
                fmt={fmt}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 p-2 dark:border-white/[0.05]">
        <button className="btn-ghost !py-2.5 link-accent" onClick={addSet}>
          <Plus size={16} strokeWidth={2.5} /> Add set
        </button>
        <button className="btn-ghost !py-2.5 text-zinc-500 dark:text-zinc-400" onClick={removeLastSet} disabled={item.sets.length === 0}>
          <Minus size={16} strokeWidth={2.5} /> Remove set
        </button>
      </div>
      {showGuide && meta && <ExerciseDetail exercise={meta} onClose={() => setShowGuide(false)} />}
    </section>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden />;
}

const REVEAL = 84;

/** Swipe a row left on touch screens to reveal a delete button. */
function SwipeToDelete({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; locked: 'h' | 'v' | null } | null>(null);
  const moved = useRef(false);

  return (
    <div className="relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
      {/* Rendered only while swiped, so it never shows through the (translucent) row. */}
      {(dragging || dx !== 0) && (
        <button
          type="button"
          onClick={onDelete}
          className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 bg-red-500 text-sm font-bold text-white"
          style={{ width: REVEAL }}
        >
          <Trash2 size={16} /> Delete
        </button>
      )}
      <div
        className={`relative ${dragging || dx !== 0 ? 'bg-white dark:bg-zinc-900' : ''} ${dragging ? '' : 'transition-transform duration-200 ease-out'}`}
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          start.current = { x: e.clientX, y: e.clientY, base: dx, locked: null };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const st = start.current;
          if (!st) return;
          const ddx = e.clientX - st.x;
          const ddy = e.clientY - st.y;
          if (!st.locked && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) st.locked = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v';
          if (st.locked !== 'h') return;
          moved.current = true;
          setDragging(true);
          setDx(Math.max(-REVEAL - 24, Math.min(0, st.base + ddx)));
        }}
        onPointerUp={() => {
          if (start.current?.locked === 'h') setDx((d) => (d < -REVEAL / 2 ? -REVEAL : 0));
          start.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDx(0);
        }}
        onClickCapture={(e) => {
          // A swipe shouldn't also count as a tap on whatever was under the finger.
          if (moved.current) {
            e.stopPropagation();
            e.preventDefault();
            moved.current = false;
          } else if (dx !== 0) {
            e.stopPropagation();
            setDx(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface SetRowProps {
  set: WorkSet;
  label: string;
  labelCls: string;
  prev: WorkSet | undefined;
  unit: Unit;
  live: boolean;
  showRpe: boolean;
  gridCols: string;
  prs: PRKind[] | undefined;
  onPatch: (p: Partial<WorkSet>) => void;
  onRemove: () => void;
  onCompleted: () => void;
  fmt: (kg: number) => string;
}

function SetRow({ set, label, labelCls, prev, unit, live, showRpe, gridCols, prs, onPatch, onRemove, onCompleted, fmt }: SetRowProps) {
  const displayWeight = set.weight == null ? null : Number(trimNumber(kgToUnit(set.weight, unit), 2));
  const alt = otherUnit(unit);
  const prevText = prev && (prev.reps != null || prev.weight != null) ? (prev.weight ? `${fmt(prev.weight)} × ${prev.reps ?? '?'}` : `${prev.reps ?? '?'} reps`) : '—';
  const prLabel = prs?.length ? prs.map((p) => PR_LABEL[p]).join(', ') : '';

  const toggleDone = () => {
    if (set.done) return onPatch({ done: false });
    // Ticking an empty set fills it from last time, like writing "same as before".
    const patch: Partial<WorkSet> = { done: true };
    if (set.weight == null && prev?.weight != null) patch.weight = prev.weight;
    if (set.reps == null && prev?.reps != null) patch.reps = prev.reps;
    onPatch(patch);
    onCompleted();
  };

  const rowTint = live && set.done ? 'bg-emerald-500/[0.07]' : prLabel ? 'bg-amber-400/[0.06]' : '';

  return (
    <SwipeToDelete onDelete={onRemove}>
      <div role="row" className={`grid ${gridCols} items-start gap-2 px-4 pb-0.5 pt-1.5 transition-colors ${rowTint}`}>
        <div role="cell" className="relative flex h-10 items-center justify-center">
          {prLabel && (
            <span
              className="pointer-events-none absolute -right-1.5 -top-0.5 z-10 flex h-[18px] w-[18px] animate-pop items-center justify-center rounded-sm bg-amber-400 text-amber-950 shadow ring-2 ring-white dark:ring-zinc-900"
              title={prLabel}
            >
              <Trophy size={10} strokeWidth={2.75} />
            </span>
          )}
          <Menu
            label={`Set ${label} options${prLabel ? ` — ${prLabel}` : ''}`}
            align="left"
            triggerClassName={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold tabular text-zinc-500 transition hover:bg-zinc-900/[0.06] dark:text-zinc-400 dark:hover:bg-white/[0.08] ${labelCls}`}
            trigger={label}
            items={[
              ...(['normal', 'warmup', 'drop', 'failure'] as SetType[]).map((t) => ({
                label: TYPE_LABEL[t],
                active: set.type === t,
                icon: <span className={`w-4 text-center text-xs font-bold ${t === 'normal' ? '' : TYPE_BADGE[t].cls}`}>{t === 'normal' ? '#' : TYPE_BADGE[t].text}</span>,
                onSelect: () => onPatch({ type: t }),
              })),
              { label: 'Delete set', icon: <Trash2 size={16} />, danger: true, onSelect: onRemove },
            ]}
          />
        </div>
        <div role="cell" className="flex h-10 min-w-0 items-center">
          <button
            className="min-w-0 truncate rounded-md text-left text-[13px] font-medium text-zinc-400 tabular transition hover:text-volt-700 dark:text-volt-400 disabled:hover:text-zinc-400 dark:text-zinc-500 dark:hover:text-volt-300"
            disabled={!prev}
            onClick={() => prev && onPatch({ weight: prev.weight, reps: prev.reps })}
            title={prev ? 'Tap to copy' : undefined}
          >
            {prevText}
          </button>
        </div>
        <div role="cell" className="flex flex-col items-stretch">
          <NumberField
            className="set-input"
            value={displayWeight}
            placeholder={prev?.weight != null ? fmt(prev.weight) : '0'}
            onChange={(v) => onPatch({ weight: v == null ? null : unitToKg(v, unit) })}
            aria-label={`Weight in ${unit}`}
            max={9999}
          />
          {/* Live conversion to the other unit, e.g. 100 kg → ≈ 220.5 lb */}
          <span className="mt-0.5 h-3 text-center text-[10px] font-medium leading-3 text-zinc-400 tabular dark:text-zinc-500" aria-live="polite">
            {set.weight != null && set.weight > 0 ? `≈ ${trimNumber(kgToUnit(set.weight, alt), 1)} ${alt}` : ''}
          </span>
        </div>
        <div role="cell">
          <NumberField integer className="set-input" value={set.reps} placeholder={prev?.reps != null ? String(prev.reps) : '0'} onChange={(v) => onPatch({ reps: v })} aria-label="Reps" max={999} />
        </div>
        {showRpe && (
          <div role="cell">
            <NumberField className="set-input" value={set.rpe} decimals={1} placeholder="–" onChange={(v) => onPatch({ rpe: v })} aria-label="RPE" max={10} />
          </div>
        )}
        <div role="cell" className="flex h-10 items-center justify-center">
          {live ? (
            <button
              onClick={toggleDone}
              aria-pressed={set.done}
              aria-label={set.done ? 'Mark set not done' : 'Mark set done'}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition active:scale-90 ${
                set.done
                  ? 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.8)]'
                  : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]'
              }`}
            >
              <Check size={18} strokeWidth={3} />
            </button>
          ) : (
            <button
              onClick={onRemove}
              aria-label={`Delete set ${label}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-red-500/10 hover:text-red-500 active:scale-90 dark:text-zinc-600 dark:hover:text-red-400"
            >
              <X size={17} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </SwipeToDelete>
  );
}
