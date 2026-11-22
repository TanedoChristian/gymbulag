import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';
import { Modal } from './ui';
import { useExerciseMap, useTemplates } from '../hooks/data';
import type { Template } from '../types';

export function templateSummary(t: Template, names: Map<string, { name: string }>, max = 3): string {
  const list = t.exercises.slice(0, max).map((e) => names.get(e.exerciseId)?.name ?? '?');
  return list.join(' · ') + (t.exercises.length > max ? ` +${t.exercises.length - max}` : '');
}

/** One tappable template row. */
export function TemplateRow({ t, onPick, disabled }: { t: Template; onPick: (t: Template) => void; disabled?: boolean }) {
  const exMap = useExerciseMap();
  return (
    <button className="card card-hover flex w-full items-center gap-3 p-3.5 text-left" onClick={() => onPick(t)} disabled={disabled}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
        <ClipboardList size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{t.name}</span>
        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
          {t.exercises.length} exercises · {templateSummary(t, exMap)}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-zinc-400" />
    </button>
  );
}

/** Sheet listing all templates; picking one adds its exercises to the current session. */
export function TemplatePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: Template) => void }) {
  const templates = useTemplates();
  return (
    <Modal open={open} onClose={onClose} title="Add from template" size="md">
      <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">All of the template's exercises are added to this session. Exercises already here are skipped.</p>
      {templates?.length ? (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id}>
              <TemplateRow
                t={t}
                onPick={(x) => {
                  onPick(x);
                  onClose();
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          No templates yet.{' '}
          <Link to="/library?tab=templates" className="font-semibold text-indigo-600 dark:text-indigo-400" onClick={onClose}>
            Create one in the Library
          </Link>
        </div>
      )}
    </Modal>
  );
}
