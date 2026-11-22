import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, LineChart, Pencil, Sparkles } from 'lucide-react';
import { Modal, Segmented } from './ui';
import { KineticExerciseDemo } from './anatomy/KineticExerciseDemo';
import { MuscleHitPanel } from './anatomy/MuscleHitPanel';
import { getExerciseGuide } from '../lib/exerciseGuides';
import { MUSCLE_COLORS } from '../lib/muscles';
import type { Exercise } from '../types';

interface Props {
  exercise: Exercise;
  onClose: () => void;
  onEdit?: () => void;
  usage?: number;
}

export function ExerciseDetail({ exercise, onClose, onEdit, usage = 0 }: Props) {
  const guide = useMemo(() => getExerciseGuide(exercise.id, exercise.muscle, exercise.name), [exercise]);
  const [tab, setTab] = useState<'form' | 'muscles'>('form');
  const color = MUSCLE_COLORS[exercise.muscle];

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-white" style={{ background: color }}>
            {exercise.name.slice(0, 1)}
          </span>
          <span className="min-w-0 truncate">{exercise.name}</span>
        </span>
      }
      size="lg"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {usage > 0 && (
            <Link className="btn-ghost !px-3" to={`/progress?tab=exercise&ex=${encodeURIComponent(exercise.id)}`} onClick={onClose}>
              <LineChart size={16} /> Progress
            </Link>
          )}
          {onEdit && (
            <button className="btn-secondary !px-3" onClick={onEdit}>
              <Pencil size={16} /> Edit
            </button>
          )}
          <button className="btn-primary ml-auto" onClick={onClose}>
            Got it
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-lg px-2 py-1 font-bold capitalize" style={{ background: `${color}22`, color }}>
            {exercise.muscle}
          </span>
          <span className="rounded-lg bg-zinc-100 px-2 py-1 font-semibold capitalize text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
            {exercise.equipment}
          </span>
          {exercise.custom && <span className="rounded-lg bg-violet-500/15 px-2 py-1 font-semibold text-violet-600 dark:text-violet-300">Custom</span>}
        </div>

        <Segmented
          ariaLabel="Exercise detail section"
          size="sm"
          value={tab}
          onChange={(v) => setTab(v as 'form' | 'muscles')}
          options={[
            { value: 'form', label: 'How to do it' },
            { value: 'muscles', label: 'Muscles hit' },
          ]}
        />

        {tab === 'form' ? (
          <div className="space-y-4">
            <KineticExerciseDemo
              exerciseId={exercise.id}
              exerciseName={exercise.name}
              equipment={exercise.equipment}
              demo={guide.demo}
              primary={guide.primary}
              className="h-[380px] sm:h-[420px]"
            />

            <section>
              <h3 className="eyebrow mb-2 flex items-center gap-1.5">
                <Sparkles size={12} /> Step by step
              </h3>
              <ol className="space-y-2.5">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                      style={{ background: color }}
                    >
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={14} /> Form cues
              </h3>
              <ul className="space-y-1.5">
                {guide.cues.map((c) => (
                  <li key={c} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {c}
                  </li>
                ))}
              </ul>
            </section>

            {guide.mistakes.length > 0 && (
              <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={14} /> Watch out for
                </h3>
                <ul className="space-y-1.5">
                  {guide.mistakes.map((m) => (
                    <li key={m} className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {m}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <MuscleHitPanel
            exerciseName={exercise.name}
            muscleGroup={exercise.muscle}
            primary={guide.primary}
            secondary={guide.secondary}
          />
        )}
      </div>
    </Modal>
  );
}
