import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Footprints, Plus, Trash2, Zap } from 'lucide-react';
import { db } from '../db';
import { createActivity, updateActivity } from '../lib/repo';
import { KIND_COLOR, KIND_LABEL, activityPace, dayTotals, formatKm, formatPace, formatSteps } from '../lib/cardio';
import { trimNumber } from '../lib/units';
import { useToast } from '../context/Toast';
import { NumberField, Segmented } from './ui';
import type { Activity, ActivityKind } from '../types';

export function KindIcon({ kind, size = 16 }: { kind: ActivityKind; size?: number }) {
  return kind === 'run' ? <Zap size={size} /> : <Footprints size={size} />;
}

/** Walks and runs for one day. Lives on the day page next to gym sessions. */
export function ActivitySection({ date }: { date: string }) {
  const list = useLiveQuery(() => db.activities.where('date').equals(date).sortBy('createdAt'), [date]);
  const add = (kind: ActivityKind) => void createActivity(date, kind);

  if (list === undefined) return null;

  if (list.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-zinc-300/80 p-3 dark:border-white/10">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Footprints size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Walk or run</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">Steps, km and time</span>
        </span>
        <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => add('walk')}>
          <Plus size={13} /> Walk
        </button>
        <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => add('run')}>
          <Plus size={13} /> Run
        </button>
      </div>
    );
  }

  const total = dayTotals(list).get(date);

  return (
    <section className="space-y-2" aria-label="Walks and runs">
      <div className="flex items-center gap-2 px-1">
        <h2 className="eyebrow flex flex-1 items-center gap-1.5">
          <Footprints size={13} /> Walks & runs
          {total && list.length > 1 && (
            <span className="font-semibold normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
              · {[total.distance && `${formatKm(total.distance)} km`, total.steps && `${formatSteps(total.steps)} steps`].filter(Boolean).join(' · ')}
            </span>
          )}
        </h2>
        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => add('walk')}>
          <Plus size={13} /> Walk
        </button>
        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => add('run')}>
          <Plus size={13} /> Run
        </button>
      </div>
      {list.map((a) => (
        <ActivityCard key={a.id} a={a} />
      ))}
    </section>
  );
}

function ActivityCard({ a }: { a: Activity }) {
  const toast = useToast();
  const set = (patch: Partial<Activity>) => void updateActivity(a.id, patch);
  const pace = activityPace(a);
  const color = KIND_COLOR[a.kind];

  const remove = async () => {
    await db.activities.delete(a.id);
    toast(`${KIND_LABEL[a.kind]} removed`, { action: { label: 'Undo', onClick: () => void db.activities.put(a) } });
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 p-3 pb-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: color }}>
          <KindIcon kind={a.kind} />
        </span>
        <Segmented
          ariaLabel="Activity type"
          size="sm"
          value={a.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'walk', label: 'Walk' },
            { value: 'run', label: 'Run' },
          ]}
        />
        <div className="ml-auto text-right text-xs text-zinc-500 dark:text-zinc-400">
          {pace != null && (
            <>
              <div className="font-bold text-zinc-900 tabular dark:text-zinc-100">{formatPace(pace)}</div>
              <div>{a.distance && a.duration ? `${trimNumber((a.distance / a.duration) * 60, 1)} km/h` : ''}</div>
            </>
          )}
        </div>
        <button className="icon-btn -mr-1 !text-zinc-400 hover:!text-red-600" onClick={remove} aria-label={`Remove ${KIND_LABEL[a.kind].toLowerCase()}`}>
          <Trash2 size={16} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 px-3 pb-3">
        <Field label="Steps">
          <NumberField className="input tabular" integer value={a.steps} onChange={(v) => set({ steps: v })} max={500_000} placeholder="0" aria-label="Steps" />
        </Field>
        <Field label="Distance (km)">
          <NumberField className="input tabular" decimals={2} value={a.distance} onChange={(v) => set({ distance: v })} max={1000} placeholder="0.0" aria-label="Distance in km" />
        </Field>
        <Field label="Time (min)">
          <NumberField className="input tabular" decimals={1} value={a.duration} onChange={(v) => set({ duration: v })} max={1440} placeholder="0" aria-label="Time in minutes" />
        </Field>
      </div>
      <div className="border-t border-zinc-100 px-3 py-2 dark:border-white/[0.05]">
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
          placeholder="Notes (route, how it felt…)"
          defaultValue={a.notes}
          onBlur={(e) => e.target.value !== a.notes && set({ notes: e.target.value })}
          aria-label="Notes"
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="label !mb-1 block truncate text-[11px]">{label}</span>
      {children}
    </label>
  );
}
