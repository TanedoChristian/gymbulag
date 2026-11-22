import { useMemo, useState } from 'react';
import { Check, Info, Plus, Search } from 'lucide-react';
import { ExerciseDetail } from './ExerciseDetail';
import { Modal } from './ui';
import { useAllSessions, useExercises } from '../hooks/data';
import { createCustomExercise } from '../lib/repo';
import { MUSCLE_COLORS, capitalize } from '../lib/muscles';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from '../types';
import { useToast } from '../context/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  multiple?: boolean;
  title?: string;
}

export function ExercisePicker({ open, onClose, onPick, multiple = true, title = 'Add exercises' }: Props) {
  return open ? <PickerBody onClose={onClose} onPick={onPick} multiple={multiple} title={title} /> : null;
}

function PickerBody({ onClose, onPick, multiple, title }: Omit<Props, 'open'>) {
  const exercises = useExercises();
  const sessions = useAllSessions();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Exercise | null>(null);
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>('chest');
  const [newEquip, setNewEquip] = useState<Equipment>('barbell');

  // Exercises used recently float to the top.
  const recency = useMemo(() => {
    const m = new Map<string, number>();
    (sessions ?? []).forEach((s, i) => s.exercises.forEach((e) => m.set(e.exerciseId, i + 1)));
    return m;
  }, [sessions]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (exercises ?? [])
      .filter((e) => !e.archived)
      .filter((e) => !muscle || e.muscle === muscle)
      .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.muscle.includes(needle) || e.equipment.includes(needle))
      .sort((a, b) => {
        if (!needle) {
          const r = (recency.get(b.id) ?? 0) - (recency.get(a.id) ?? 0);
          if (r) return r;
        } else {
          const sa = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
          const sb = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
          if (sa !== sb) return sa - sb;
        }
        return a.name.localeCompare(b.name);
      });
  }, [exercises, q, muscle, recency]);

  const toggle = (ex: Exercise) => {
    if (!multiple) {
      onPick([ex.id]);
      onClose();
      return;
    }
    setSelected((s) => (s.includes(ex.id) ? s.filter((x) => x !== ex.id) : [...s, ex.id]));
  };

  const create = async () => {
    const name = q.trim();
    if (!name) return;
    if ((exercises ?? []).some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      toast('An exercise with that name already exists.', { tone: 'error' });
      return;
    }
    const ex = await createCustomExercise({ name, muscle: newMuscle, equipment: newEquip });
    setCreating(false);
    setQ('');
    if (multiple) setSelected((s) => [...s, ex.id]);
    else {
      onPick([ex.id]);
      onClose();
    }
    toast(`Created “${ex.name}”`);
  };

  const recentCount = !q && !muscle ? list.filter((e) => recency.has(e.id)).length : 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        multiple ? (
          <button
            className="btn-primary w-full"
            disabled={!selected.length}
            onClick={() => {
              onPick(selected);
              onClose();
            }}
          >
            {selected.length ? `Add ${selected.length} exercise${selected.length > 1 ? 's' : ''}` : 'Select exercises'}
          </button>
        ) : undefined
      }
    >
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          data-autofocus
          className="input !pl-9"
          placeholder="Search exercises…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCreating(false);
          }}
          aria-label="Search exercises"
        />
      </div>

      <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
        <button className={muscle === null ? 'chip-on' : 'chip-off'} onClick={() => setMuscle(null)}>
          All
        </button>
        {MUSCLE_GROUPS.map((m) => (
          <button key={m} className={muscle === m ? 'chip-on' : 'chip-off'} onClick={() => setMuscle(muscle === m ? null : m)}>
            {m}
          </button>
        ))}
      </div>

      {q.trim() && !creating && (
        <button className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-indigo-400 px-3 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10" onClick={() => setCreating(true)}>
          <Plus size={16} /> Create “{q.trim()}”
        </button>
      )}

      {creating && (
        <div className="mt-3 space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="text-sm font-semibold">New exercise: {q.trim()}</div>
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="label">Muscle</span>
              <select className="input capitalize" value={newMuscle} onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}>
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {capitalize(m)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Equipment</span>
              <select className="input" value={newEquip} onChange={(e) => setNewEquip(e.target.value as Equipment)}>
                {EQUIPMENT.map((m) => (
                  <option key={m} value={m}>
                    {capitalize(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={create}>
              Create
            </button>
          </div>
        </div>
      )}

      <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        {list.map((ex, i) => {
          const on = selected.includes(ex.id);
          return (
            <li key={ex.id}>
              {i === 0 && recentCount > 0 && <div className="label mt-1">Recent</div>}
              {i === recentCount && recentCount > 0 && <div className="label mt-4">All exercises</div>}
              <div className="flex items-center gap-1 rounded-lg px-1 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <button onClick={() => toggle(ex)} className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left" aria-pressed={multiple ? on : undefined}>
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: MUSCLE_COLORS[ex.muscle] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{ex.name}</span>
                    <span className="block text-xs capitalize text-zinc-500">
                      {ex.muscle} · {ex.equipment}
                      {ex.custom && ' · custom'}
                    </span>
                  </span>
                  {multiple && (
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                  )}
                </button>
                <button type="button" className="icon-btn !h-8 !w-8" aria-label={`How to do ${ex.name}`} title="How to do it" onClick={() => setViewing(ex)}>
                  <Info size={15} />
                </button>
              </div>
            </li>
          );
        })}
        {list.length === 0 && <li className="py-8 text-center text-sm text-zinc-500">No exercises match. Create it above.</li>}
      </ul>
      {viewing && <ExerciseDetail exercise={viewing} onClose={() => setViewing(null)} />}
    </Modal>
  );
}
