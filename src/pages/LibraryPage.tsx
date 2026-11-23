import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Archive, CalendarPlus, ChevronRight, ClipboardList, Copy, FilePlus2, LineChart, Minus, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import { db } from '../db';
import { useAllSessions, useExerciseMap, useExercises, useTemplates } from '../hooks/data';
import { addTemplateToDate, createCustomExercise } from '../lib/repo';
import { toKey, todayKey } from '../lib/date';
import { addDays } from 'date-fns';
import { MUSCLE_COLORS, capitalize } from '../lib/muscles';
import { uid } from '../lib/id';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { EmptyState, Modal, PageHeader, Segmented, Spinner, Toggle } from '../components/ui';
import { useToast } from '../context/Toast';
import { useConfirm } from '../context/Confirm';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup, type Template } from '../types';

export default function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'templates' ? 'templates' : 'exercises';
  return (
    <>
      <PageHeader
        title="Library"
        right={
          <Segmented
            ariaLabel="Library section"
            size="sm"
            value={tab}
            onChange={(v) => setParams({ tab: v }, { replace: true })}
            options={[
              { value: 'exercises', label: 'Exercises' },
              { value: 'templates', label: 'Templates' },
            ]}
          />
        }
      />
      <div className="mx-auto max-w-app lg:max-w-app-wide px-4 pt-4">{tab === 'exercises' ? <ExercisesTab /> : <TemplatesTab />}</div>
    </>
  );
}

/* -------------------------------- Exercises ------------------------------- */

function ExercisesTab() {
  const exercises = useExercises();
  const sessions = useAllSessions();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [viewing, setViewing] = useState<Exercise | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions ?? []) for (const id of new Set(s.exercises.map((e) => e.exerciseId))) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [sessions]);

  if (!exercises) return <Spinner />;
  const needle = q.trim().toLowerCase();
  const list = exercises
    .filter((e) => showArchived || !e.archived)
    .filter((e) => !muscle || e.muscle === muscle)
    .filter((e) => !needle || e.name.toLowerCase().includes(needle));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className="input !pl-9" placeholder={`Search ${exercises.length} exercises…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
        </div>
        <button className="btn-primary" onClick={() => setEditing('new')}>
          <Plus size={16} /> New
        </button>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
        <button className={muscle === null ? 'chip-on' : 'chip-off'} onClick={() => setMuscle(null)}>
          All
        </button>
        {MUSCLE_GROUPS.map((m) => (
          <button key={m} className={muscle === m ? 'chip-on' : 'chip-off'} onClick={() => setMuscle(muscle === m ? null : m)}>
            {m}
          </button>
        ))}
      </div>
      <label className="flex items-center justify-end gap-2 text-xs text-zinc-500">
        Show archived <Toggle checked={showArchived} onChange={setShowArchived} label="Show archived exercises" />
      </label>

      <ul className="card divide-y divide-zinc-100 dark:divide-zinc-800">
        {list.map((ex) => (
          <li key={ex.id}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50" onClick={() => setViewing(ex)}>
              <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: MUSCLE_COLORS[ex.muscle] }} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${ex.archived ? 'text-zinc-400 line-through' : ''}`}>{ex.name}</span>
                <span className="block text-xs capitalize text-zinc-500">
                  {ex.muscle} · {ex.equipment}
                  {ex.custom && ' · custom'}
                </span>
              </span>
              {usage.get(ex.id) ? <span className="text-xs font-semibold text-zinc-500 tabular">{usage.get(ex.id)}×</span> : null}
              <ChevronRight size={16} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-4 py-8 text-center text-sm text-zinc-500">No exercises match.</li>}
      </ul>

      {viewing && !editing && (
        <ExerciseDetail
          exercise={viewing}
          usage={usage.get(viewing.id) ?? 0}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}
      {editing && <ExerciseEditor exercise={editing === 'new' ? null : editing} initialName={editing === 'new' ? q : ''} usage={editing === 'new' ? 0 : usage.get(editing.id) ?? 0} onClose={() => setEditing(null)} allNames={exercises.map((e) => e.name.toLowerCase())} />}
    </div>
  );
}

function ExerciseEditor({ exercise, initialName, usage, onClose, allNames }: { exercise: Exercise | null; initialName: string; usage: number; onClose: () => void; allNames: string[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [muscle, setMuscle] = useState<MuscleGroup>(exercise?.muscle ?? 'chest');
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell');
  const trimmed = name.trim();
  const duplicate = trimmed && allNames.includes(trimmed.toLowerCase()) && trimmed.toLowerCase() !== exercise?.name.toLowerCase();

  const save = async () => {
    if (!trimmed || duplicate) return;
    if (exercise) await db.exercises.update(exercise.id, { name: trimmed, muscle, equipment, updatedAt: Date.now() });
    else await createCustomExercise({ name: trimmed, muscle, equipment });
    toast(exercise ? 'Exercise updated' : `Created “${trimmed}”`);
    onClose();
  };

  const toggleArchive = async () => {
    if (!exercise) return;
    await db.exercises.update(exercise.id, { archived: !exercise.archived, updatedAt: Date.now() });
    toast(exercise.archived ? 'Restored' : 'Archived — hidden from the picker, history kept');
    onClose();
  };

  const remove = async () => {
    if (!exercise) return;
    const ok = await confirm({ title: `Delete “${exercise.name}”?`, message: 'This custom exercise is not used in any session. This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await db.exercises.delete(exercise.id);
    toast('Exercise deleted');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={exercise ? 'Edit exercise' : 'New exercise'}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {exercise && (
            <>
              {exercise.custom && usage === 0 ? (
                <button className="btn-ghost !px-3 text-red-600 dark:text-red-400" onClick={remove}>
                  <Trash2 size={16} /> Delete
                </button>
              ) : (
                <button className="btn-ghost !px-3" onClick={toggleArchive}>
                  <Archive size={16} /> {exercise.archived ? 'Unarchive' : 'Archive'}
                </button>
              )}
              {usage > 0 && (
                <Link className="btn-ghost !px-3" to={`/progress?tab=exercise&ex=${encodeURIComponent(exercise.id)}`}>
                  <LineChart size={16} /> Progress
                </Link>
              )}
            </>
          )}
          <button className="btn-primary ml-auto" onClick={save} disabled={!trimmed || !!duplicate}>
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="label">Name</span>
          <input data-autofocus className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} onKeyDown={(e) => e.key === 'Enter' && save()} />
          {duplicate && <span className="mt-1 block text-xs text-red-600">An exercise with this name already exists.</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Muscle group</span>
            <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleGroup)}>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {capitalize(m)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Equipment</span>
            <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
              {EQUIPMENT.map((m) => (
                <option key={m} value={m}>
                  {capitalize(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {exercise && usage > 0 && <p className="text-xs text-zinc-500">Used in {usage} session{usage > 1 ? 's' : ''}. Renaming updates your whole history.</p>}
      </div>
    </Modal>
  );
}

/* -------------------------------- Templates ------------------------------- */

function TemplatesTab() {
  const templates = useTemplates();
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState<{ template: Template; isNew: boolean } | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [scheduling, setScheduling] = useState<Template | null>(null);
  const [scheduleDate, setScheduleDate] = useState(todayKey());

  if (!templates) return <Spinner />;

  /** New template, either blank or a copy of an existing one to tweak. */
  const startNew = (from?: Template) => {
    const now = Date.now();
    setChoosing(false);
    setEditing({
      isNew: true,
      template: {
        id: uid(),
        name: from ? `${from.name} copy` : '',
        exercises: from ? from.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x })) })) : [],
        createdAt: now,
        updatedAt: now,
      },
    });
  };

  const start = async (t: Template, date = todayKey()) => {
    const s = await addTemplateToDate(date, t);
    navigate(`/day/${date}?s=${s.id}`);
  };

  const remove = async (t: Template) => {
    await db.templates.delete(t.id);
    toast(`Deleted “${t.name}”`, { action: { label: 'Undo', onClick: () => void db.templates.put(t) } });
  };

  return (
    <div className="space-y-3">
      <button className="btn-primary w-full !py-3" onClick={() => (templates.length ? setChoosing(true) : startNew())}>
        <Plus size={16} strokeWidth={2.5} /> New template
      </button>
      {templates.length === 0 ? (
        <EmptyState icon={<ClipboardList />} title="No templates yet">
          Templates are reusable workouts (e.g. “Push day”). Create one here, or tap “Save as template” on any logged session.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => {
            const muscles = [...new Set(t.exercises.map((e) => exMap.get(e.exerciseId)?.muscle).filter(Boolean))] as MuscleGroup[];
            const sets = t.exercises.reduce((n, e) => n + e.sets.length, 0);
            return (
              <li key={t.id} className="card overflow-hidden">
                <button className="flex w-full items-start gap-3 p-4 pb-3 text-left" onClick={() => setEditing({ template: t, isNew: false })}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-rack text-volt-500">
                    <ClipboardList size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-base font-bold tracking-tight">
                      {t.name} <Pencil size={12} className="text-zinc-300 dark:text-zinc-600" />
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {t.exercises.length} exercises · {sets} sets
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {muscles.slice(0, 5).map((m) => (
                        <span key={m} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize" style={{ background: `${MUSCLE_COLORS[m]}1f`, color: MUSCLE_COLORS[m] }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
                <ol className="mx-4 mb-3 space-y-0.5 text-[13px] text-zinc-600 dark:text-zinc-300">
                  {t.exercises.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-4 shrink-0 text-right font-semibold text-zinc-400 tabular">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{exMap.get(e.exerciseId)?.name ?? '?'}</span>
                      <span className="text-zinc-400 tabular">×{e.sets.length}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex gap-2 border-t border-zinc-100 p-2 dark:border-white/[0.05]">
                  <button className="btn-primary flex-1 !py-2.5" onClick={() => start(t)} disabled={t.exercises.length === 0}>
                    <Play size={15} /> Start today
                  </button>
                  <button
                    className="btn-secondary !px-3"
                    onClick={() => {
                      setScheduleDate(todayKey());
                      setScheduling(t);
                    }}
                    disabled={t.exercises.length === 0}
                    aria-label={`Start ${t.name} on another date`}
                    title="Start on another date"
                  >
                    <CalendarPlus size={16} />
                  </button>
                  <button className="btn-secondary !px-3" onClick={() => startNew(t)} aria-label={`Duplicate ${t.name}`} title="Duplicate">
                    <Copy size={16} />
                  </button>
                  <button className="btn-ghost !px-3 !text-red-600 dark:!text-red-400" onClick={() => remove(t)} aria-label={`Delete ${t.name}`} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={choosing} onClose={() => setChoosing(false)} title="New template" size="sm">
        <button className="card card-hover flex w-full items-center gap-3 p-3.5 text-left" onClick={() => startNew()}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900/[0.05] dark:bg-white/[0.06]">
            <FilePlus2 size={18} />
          </span>
          <span className="flex-1">
            <span className="block font-bold">Blank template</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">Pick exercises from scratch</span>
          </span>
          <ChevronRight size={18} className="text-zinc-400" />
        </button>
        <div className="eyebrow mb-2 mt-5">Or start from an existing template</div>
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id}>
              <button className="card card-hover flex w-full items-center gap-3 p-3.5 text-left" onClick={() => startNew(t)}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-volt-500/15 link-accent">
                  <Copy size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{t.name}</span>
                  <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{t.exercises.map((e) => exMap.get(e.exerciseId)?.name ?? '?').join(' · ')}</span>
                </span>
                <ChevronRight size={18} className="text-zinc-400" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">You'll get a copy to rename and change. The original stays as it is.</p>
      </Modal>

      <Modal
        open={!!scheduling}
        onClose={() => setScheduling(null)}
        title={`Start ${scheduling?.name ?? ''} on…`}
        size="sm"
        footer={
          <button className="btn-primary w-full" disabled={!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)} onClick={() => scheduling && start(scheduling, scheduleDate)}>
            <Play size={15} /> Add to this date
          </button>
        }
      >
        <label className="block">
          <span className="label">Date</span>
          <input type="date" className="input" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} data-autofocus />
        </label>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            ['Yesterday', -1],
            ['Today', 0],
            ['Tomorrow', 1],
          ].map(([label, d]) => {
            const key = toKey(addDays(new Date(), d as number));
            return (
              <button key={label} className={scheduleDate === key ? 'chip-on !normal-case' : 'chip-off !normal-case'} onClick={() => setScheduleDate(key)}>
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Logging after training? Pick the day you trained. If that day already has an empty session, the template fills it.</p>
      </Modal>

      {editing && <TemplateEditor template={editing.template} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TemplateEditor({ template, isNew, onClose }: { template: Template; isNew: boolean; onClose: () => void }) {
  const exMap = useExerciseMap();
  const allTemplates = useTemplates();
  const toast = useToast();
  const [t, setT] = useState<Template>(template);
  const [picking, setPicking] = useState(false);

  const setSets = (i: number, n: number) =>
    setT((cur) => {
      const ex = [...cur.exercises];
      const sets = [...ex[i].sets];
      const lastSet = sets[sets.length - 1] ?? { type: 'normal' as const, reps: null, weight: null };
      while (sets.length < n) sets.push({ ...lastSet });
      sets.length = Math.max(1, n);
      ex[i] = { ...ex[i], sets };
      return { ...cur, exercises: ex };
    });

  const move = (i: number, d: -1 | 1) =>
    setT((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.exercises.length) return cur;
      const ex = [...cur.exercises];
      [ex[i], ex[j]] = [ex[j], ex[i]];
      return { ...cur, exercises: ex };
    });

  const save = async () => {
    await db.templates.put({ ...t, name: t.name.trim(), updatedAt: Date.now() });
    toast('Template saved');
    onClose();
  };

  return (
    <>
      <Modal
        open={!picking}
        onClose={onClose}
        title={isNew ? 'New template' : 'Edit template'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!t.name.trim() || t.exercises.length === 0} onClick={save}>
              Save
            </button>
          </div>
        }
      >
        <label className="block">
          <span className="label">Name</span>
          <input data-autofocus className="input" placeholder="e.g. Push day" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} maxLength={60} />
        </label>
        <div className="label mt-4">Exercises</div>
        <ul className="space-y-2">
          {t.exercises.map((e, i) => (
            <li key={`${e.exerciseId}-${i}`} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
              <div className="flex flex-col">
                <button className="icon-btn !h-6" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp size={14} />
                </button>
                <button className="icon-btn !h-6" onClick={() => move(i, 1)} disabled={i === t.exercises.length - 1} aria-label="Move down">
                  <ArrowDown size={14} />
                </button>
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{exMap.get(e.exerciseId)?.name ?? e.exerciseId}</span>
              <div className="flex items-center gap-1" aria-label="Number of sets">
                <button className="icon-btn !h-8 !w-8" onClick={() => setSets(i, e.sets.length - 1)} disabled={e.sets.length <= 1} aria-label="Fewer sets">
                  <Minus size={14} />
                </button>
                <span className="w-12 text-center text-sm font-semibold tabular">{e.sets.length} sets</span>
                <button className="icon-btn !h-8 !w-8" onClick={() => setSets(i, e.sets.length + 1)} disabled={e.sets.length >= 20} aria-label="More sets">
                  <Plus size={14} />
                </button>
              </div>
              <button className="icon-btn !h-8 !w-8" onClick={() => setT({ ...t, exercises: t.exercises.filter((_, j) => j !== i) })} aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-secondary mt-3 w-full" onClick={() => setPicking(true)}>
          <Plus size={16} /> Add exercises
        </button>
        {(allTemplates ?? []).some((o) => o.id !== t.id) && (
          <label className="mt-3 block">
            <span className="label">Add exercises from another template</span>
            <select
              className="input"
              value=""
              onChange={(e) => {
                const src = allTemplates?.find((o) => o.id === e.target.value);
                if (!src) return;
                setT((cur) => ({ ...cur, exercises: [...cur.exercises, ...src.exercises.map((x) => ({ ...x, sets: x.sets.map((y) => ({ ...y })) }))] }));
                toast(`Added ${src.exercises.length} exercises from ${src.name}`);
              }}
            >
              <option value="">Choose a template…</option>
              {(allTemplates ?? [])
                .filter((o) => o.id !== t.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.exercises.length})
                  </option>
                ))}
            </select>
          </label>
        )}
      </Modal>
      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ids) =>
          setT((cur) => ({
            ...cur,
            exercises: [...cur.exercises, ...ids.map((exerciseId) => ({ exerciseId, sets: Array.from({ length: 3 }, () => ({ type: 'normal' as const, reps: null, weight: null })) }))],
          }))
        }
      />
    </>
  );
}
