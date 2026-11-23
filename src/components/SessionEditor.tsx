import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Check, ChevronDown, ClipboardList, Clock, Copy, Dumbbell, Loader2, Pencil, Play, Plus, Square, Timer, Trash2, Trophy } from 'lucide-react';
import { useSessionDraft } from '../hooks/useSessionDraft';
import { useAllSessions, useExerciseMap, useSettings, useTemplates } from '../hooks/data';
import { computePRs, lastPerformance, sessionTitle, sessionVolume, sessionWorkingSets } from '../lib/calc';
import { durationMinutes, formatDuration, nowHHmm } from '../lib/date';
import { formatVolume, kgToUnit, trimNumber, unitToKg } from '../lib/units';
import { applyTemplate, newSessionExercise, newSet, saveSessionAsTemplate, saveSettings } from '../lib/repo';
import { db } from '../db';
import { ExerciseCard, type ExerciseUpdater } from './ExerciseCard';
import { ExercisePicker } from './ExercisePicker';
import { PlateCalculator } from './PlateCalculator';
import { TemplatePicker, TemplateRow } from './TemplatePicker';
import { Modal, NumberField, Segmented, Spinner } from './ui';
import { useToast } from '../context/Toast';
import { useRestTimer } from '../context/RestTimer';
import type { Session, Template, Unit } from '../types';

export function SessionEditor({ id }: { id: string }) {
  const { draft, update, discard, saveState } = useSessionDraft(id);
  const sessions = useAllSessions();
  const exMap = useExerciseMap();
  const settings = useSettings();
  const toast = useToast();
  const timer = useRestTimer();
  const navigate = useNavigate();
  const live = settings.logMode === 'live';
  const templates = useTemplates();
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; itemId: string } | null>(null);
  const [plates, setPlates] = useState<{ kg: number | null; unit: Unit } | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Use the live draft in place of the stored copy so PRs update while typing.
  const merged = useMemo(() => {
    if (!sessions || !draft) return sessions ?? [];
    return sessions.some((s) => s.id === draft.id) ? sessions.map((s) => (s.id === draft.id ? draft : s)) : [...sessions, draft];
  }, [sessions, draft]);
  const prs = useMemo(() => computePRs(merged), [merged]);

  const lastByExercise = useMemo(() => {
    const m = new Map<string, ReturnType<typeof lastPerformance>>();
    if (!draft || !sessions) return m;
    for (const ex of draft.exercises) if (!m.has(ex.exerciseId)) m.set(ex.exerciseId, lastPerformance(sessions, ex.exerciseId, draft));
    return m;
  }, [sessions, draft]);

  if (draft === undefined) return <Spinner />;
  if (draft === null) return <div className="py-12 text-center text-sm text-zinc-500">This session no longer exists.</div>;

  const set = (patch: Partial<Session>) => update((s) => ({ ...s, ...patch }));
  const setItem = (itemId: string, next: ExerciseUpdater) =>
    update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === itemId ? (typeof next === 'function' ? next(e) : next) : e)) }));

  const addExercises = (ids: string[]) =>
    update((s) => {
      const added = ids.map((exerciseId) => {
        const last = sessions ? lastPerformance(sessions, exerciseId, s) : null;
        // Same number of sets as last time (values shown as placeholders), or the default for new exercises.
        const count = Math.max(1, last?.exercise.sets.length ?? settings.defaultSets);
        return newSessionExercise(
          exerciseId,
          Array.from({ length: count }, (_, i) => newSet({ type: last?.exercise.sets[i]?.type ?? 'normal' })),
          last?.exercise.unit,
        );
      });
      return { ...s, exercises: [...s.exercises, ...added] };
    });

  const loadTemplate = (t: Template) => {
    let added = 0;
    let skipped = 0;
    update((s) => {
      const r = applyTemplate(s, t);
      added = r.added;
      skipped = r.skipped;
      return r.session;
    });
    toast(
      added === 0
        ? `Everything in ${t.name} is already in this session`
        : `Added ${added} exercise${added === 1 ? '' : 's'} from ${t.name}${skipped ? ` (${skipped} already here)` : ''}`,
      { tone: added ? 'success' : 'default' },
    );
  };

  const replaceExercise = (itemId: string, exerciseId: string) =>
    update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === itemId ? { ...e, exerciseId } : e)) }));

  const removeItem = (itemId: string) => {
    const idx = draft.exercises.findIndex((e) => e.id === itemId);
    const removed = draft.exercises[idx];
    update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== itemId) }));
    toast(`Removed ${exMap.get(removed.exerciseId)?.name ?? 'exercise'}`, {
      action: {
        label: 'Undo',
        onClick: () =>
          update((s) => {
            const ex = [...s.exercises];
            ex.splice(Math.min(idx, ex.length), 0, removed);
            return { ...s, exercises: ex };
          }),
      },
    });
  };

  const moveItem = (itemId: string, dir: -1 | 1) =>
    update((s) => {
      const i = s.exercises.findIndex((e) => e.id === itemId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.exercises.length) return s;
      const ex = [...s.exercises];
      [ex[i], ex[j]] = [ex[j], ex[i]];
      return { ...s, exercises: ex };
    });

  const onSetCompleted = () => {
    if (!live) return;
    if (!draft.startedAt) set({ startedAt: nowHHmm() });
    if (settings.autoRestTimer && settings.restSeconds > 0) timer.start(settings.restSeconds);
  };

  const deleteSession = async () => {
    discard();
    const snapshot = draft;
    await db.sessions.delete(draft.id);
    navigate(`/day/${snapshot.date}`, { replace: true });
    toast('Session deleted', {
      action: {
        label: 'Undo',
        onClick: () => void db.sessions.put(snapshot).then(() => navigate(`/day/${snapshot.date}?s=${snapshot.id}`, { replace: true })),
      },
    });
  };

  const saveTemplate = async () => {
    await saveSessionAsTemplate(draft, templateName);
    setTemplateOpen(false);
    toast('Saved as template', { tone: 'success' });
  };

  const volume = sessionVolume(draft);
  const workingSets = sessionWorkingSets(draft);
  const duration = durationMinutes(draft.startedAt, draft.endedAt);
  const prCount = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => prs.has(s.id)).length, 0);
  const bwDisplay = draft.bodyweight == null ? null : Number(trimNumber(kgToUnit(draft.bodyweight, settings.unit), 1));
  const autoTitle = sessionTitle({ ...draft, name: '' }, exMap);

  return (
    <div className="space-y-3">
      {/* Session header */}
      <div className="card overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                className="peer w-full rounded-xl bg-transparent py-1 pr-7 text-[22px] font-extrabold tracking-tight outline-none placeholder:text-zinc-900 focus:placeholder:text-zinc-300 dark:placeholder:text-white dark:focus:placeholder:text-zinc-600"
                value={draft.name}
                placeholder={autoTitle}
                onChange={(e) => set({ name: e.target.value })}
                aria-label="Session name"
                maxLength={80}
              />
              <Pencil size={14} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-zinc-300 peer-focus:opacity-0 dark:text-zinc-600" />
            </div>
            <SaveBadge state={saveState} />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <Metric label="Exercises" value={draft.exercises.length} />
            <Metric label="Sets" value={workingSets} />
            <Metric label={settings.unit} value={formatVolume(volume, settings.unit)} />
            <Metric
              label={prCount === 1 ? 'PR' : 'PRs'}
              highlight={prCount > 0}
              value={
                <span className="inline-flex items-center gap-1">
                  {prCount}
                  {prCount > 0 && <Trophy size={14} />}
                </span>
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2.5 dark:border-white/[0.05] dark:bg-white/[0.02]">
          <Segmented
            ariaLabel="Logging mode"
            size="sm"
            value={settings.logMode}
            onChange={(logMode) => saveSettings({ logMode })}
            options={[
              { value: 'quick', label: <span className="inline-flex items-center gap-1"><Pencil size={12} /> Quick log</span> },
              { value: 'live', label: <span className="inline-flex items-center gap-1"><Timer size={12} /> Live</span> },
            ]}
          />
          {live &&
            (!draft.startedAt ? (
              <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => set({ startedAt: nowHHmm(), endedAt: null })}>
                <Play size={13} /> Start
              </button>
            ) : !draft.endedAt ? (
              <>
                <ElapsedClock start={draft.startedAt} />
                <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => set({ endedAt: nowHHmm() })}>
                  <Square size={12} /> Finish
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <Check size={13} /> {formatDuration(duration)}
              </span>
            ))}
          <button className="btn-ghost ml-auto !px-2.5 !py-1.5 text-xs" onClick={() => setDetailsOpen((v) => !v)} aria-expanded={detailsOpen}>
            Details <ChevronDown size={14} className={`transition ${detailsOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {detailsOpen && (
          <div className="grid animate-fade-in grid-cols-3 gap-2 border-t border-zinc-100 p-4 dark:border-white/[0.05]">
            <label>
              <span className="label">Start</span>
              <input type="time" className="input !px-2" value={draft.startedAt ?? ''} onChange={(e) => set({ startedAt: e.target.value || null })} />
            </label>
            <label>
              <span className="label">End</span>
              <input type="time" className="input !px-2" value={draft.endedAt ?? ''} onChange={(e) => set({ endedAt: e.target.value || null })} />
            </label>
            <label>
              <span className="label">Bodyweight</span>
              <div className="relative">
                <NumberField className="input !pr-8" value={bwDisplay} placeholder="—" onChange={(v) => set({ bodyweight: v == null ? null : unitToKg(v, settings.unit) })} max={999} />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{settings.unit}</span>
              </div>
            </label>
            <label className="col-span-3">
              <span className="label">Notes</span>
              <textarea className="input min-h-[4.5rem] resize-y" placeholder="How did it feel? Sleep, energy, pain…" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
            </label>
          </div>
        )}
      </div>

      {/* Exercises */}
      {draft.exercises.length === 0 ? (
        <div className="card p-5">
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-volt-500 text-volt-ink">
              <Dumbbell size={24} />
            </div>
            <div className="text-base font-bold">What did you train?</div>
            <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
              {templates?.length ? 'Tap a template to load all its exercises, or add exercises one by one.' : live ? 'Add exercises, then tick each set as you finish it.' : 'Add exercises and type in the weight and reps for each set.'}
            </p>
          </div>
          {!!templates?.length && (
            <>
              <div className="eyebrow mb-2 mt-5 flex items-center gap-1.5">
                <ClipboardList size={13} /> Your templates
              </div>
              <ul className="space-y-2">
                {templates.map((t) => (
                  <li key={t.id}>
                    <TemplateRow t={t} onPick={loadTemplate} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        draft.exercises.map((item, i) => (
          <ExerciseCard
            key={item.id}
            item={item}
            meta={exMap.get(item.exerciseId)}
            index={i}
            count={draft.exercises.length}
            unit={settings.unit}
            live={live}
            showRpe={settings.showRpe}
            prs={prs}
            last={lastByExercise.get(item.exerciseId) ?? null}
            onChange={(next) => setItem(item.id, next)}
            onRemove={() => removeItem(item.id)}
            onMove={(dir) => moveItem(item.id, dir)}
            onReplace={() => setPicker({ mode: 'replace', itemId: item.id })}
            onSetCompleted={onSetCompleted}
            onPlates={(kg, unit) => setPlates({ kg, unit })}
          />
        ))
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className="btn-primary !rounded-2xl !py-3.5 text-[15px]" onClick={() => setPicker({ mode: 'add' })}>
          <Plus size={18} strokeWidth={2.5} /> Add exercise
        </button>
        <button className="btn-secondary !rounded-2xl !px-4 !py-3.5" onClick={() => setTemplatePickerOpen(true)}>
          <ClipboardList size={17} /> Use template
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1 pt-1">
        <button className="btn-ghost !py-2 text-xs" onClick={() => setPlates({ kg: null, unit: settings.unit })}>
          <Calculator size={15} /> Plates
        </button>
        <button
          className="btn-ghost !py-2 text-xs"
          disabled={draft.exercises.length === 0}
          onClick={() => {
            setTemplateName(draft.name || autoTitle);
            setTemplateOpen(true);
          }}
        >
          <Copy size={15} /> Save as template
        </button>
        <button className="btn-ghost !py-2 text-xs !text-red-600 dark:!text-red-400" onClick={deleteSession}>
          <Trash2 size={15} /> Delete session
        </button>
      </div>

      <ExercisePicker
        open={!!picker}
        onClose={() => setPicker(null)}
        multiple={picker?.mode === 'add'}
        title={picker?.mode === 'replace' ? 'Replace exercise' : 'Add exercises'}
        onPick={(ids) => {
          if (picker?.mode === 'replace') replaceExercise(picker.itemId, ids[0]);
          else addExercises(ids);
        }}
      />
      <TemplatePicker open={templatePickerOpen} onClose={() => setTemplatePickerOpen(false)} onPick={loadTemplate} />
      <PlateCalculator open={!!plates} onClose={() => setPlates(null)} unit={plates?.unit ?? settings.unit} barWeightKg={settings.barWeight} initialKg={plates?.kg} />
      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Save as template"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setTemplateOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveTemplate} disabled={!templateName.trim()}>
              Save template
            </button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">Reuse this exercise list, sets and weights on any day.</p>
        <label>
          <span className="label">Template name</span>
          <input data-autofocus className="input" value={templateName} onChange={(e) => setTemplateName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && templateName.trim() && saveTemplate()} maxLength={60} />
        </label>
      </Modal>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl px-1 py-2.5 text-center ${highlight ? 'bg-gradient-to-b from-amber-300/25 to-amber-400/10 text-amber-600 dark:text-amber-400' : 'bg-zinc-900/[0.04] dark:bg-white/[0.05]'}`}>
      <div className="text-lg font-extrabold leading-tight tracking-tight tabular">{value}</div>
      <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

function SaveBadge({ state }: { state: ReturnType<typeof useSessionDraft>['saveState'] }) {
  if (state === 'idle') return null;
  if (state === 'error') return <span className="text-xs font-semibold text-red-600">Not saved — retrying…</span>;
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-zinc-900/[0.04] px-2 py-1 text-[11px] font-semibold text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400" aria-live="polite">
      {state === 'pending' ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} strokeWidth={3} className="text-emerald-500" />}
      {state === 'pending' ? 'Saving' : 'Saved'}
    </span>
  );
}

function ElapsedClock({ start }: { start: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const h = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(h);
  }, []);
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 tabular dark:text-zinc-400">
      <Clock size={13} /> {formatDuration(durationMinutes(start, nowHHmm()))}
    </span>
  );
}
