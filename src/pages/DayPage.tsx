import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, Moon, Plus, Repeat, Sparkles } from 'lucide-react';
import { db } from '../db';
import { fromKey, isValidKey, toKey, todayKey } from '../lib/date';
import { createFromTemplate, createSession, latestSessionBefore, repeatSession } from '../lib/repo';
import { useExerciseMap, useTemplates } from '../hooks/data';
import { sessionHasContent, sessionTitle } from '../lib/calc';
import { SessionEditor } from '../components/SessionEditor';
import { TemplateRow } from '../components/TemplatePicker';
import { DayPhotoCard } from '../components/Photos';
import { DayWeightCard } from '../components/BodyWeight';
import { ActivitySection } from '../components/ActivitySection';
import { FoodSection } from '../components/FoodSection';
import { EmptyState, PageHeader, Spinner } from '../components/ui';
import { useToast } from '../context/Toast';
import type { Session, Template } from '../types';

function relativeLabel(key: string): string {
  const diff = differenceInCalendarDays(fromKey(key), new Date());
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return diff < 0 ? `${-diff} days ago` : `In ${diff} days`;
}

export default function DayPage() {
  const { date } = useParams();
  if (!isValidKey(date)) {
    return (
      <>
        <PageHeader title="Invalid date" left={<BackButton to="/" />} />
        <EmptyState icon={<Moon />} title="That date doesn't exist">
          <Link className="font-semibold link-accent" to="/">
            Back to calendar
          </Link>
        </EmptyState>
      </>
    );
  }
  return <Day date={date} />;
}

function BackButton({ to }: { to: string }) {
  return (
    <Link to={to} className="icon-btn -ml-2" aria-label="Back to calendar">
      <ArrowLeft size={20} />
    </Link>
  );
}

function Day({ date }: { date: string }) {
  const navigate = useNavigate();
  const exMap = useExerciseMap();
  const [params, setParams] = useSearchParams();
  const sessions = useLiveQuery(() => db.sessions.where('date').equals(date).sortBy('createdAt'), [date]);
  const requested = params.get('s');
  const activeId = sessions?.find((s) => s.id === requested)?.id ?? sessions?.[0]?.id;

  // Keep the URL in sync so refresh / back returns to the same session.
  useEffect(() => {
    if (activeId && activeId !== requested) setParams({ s: activeId }, { replace: true });
  }, [activeId, requested, setParams]);

  const d = fromKey(date);
  const go = (delta: number) => navigate(`/day/${toKey(addDays(d, delta))}`);

  const addAnother = async () => {
    const s = await createSession(date);
    setParams({ s: s.id });
  };

  return (
    <>
      <PageHeader
        left={<BackButton to={`/?m=${date.slice(0, 7)}`} />}
        title={format(d, 'EEEE, MMM d')}
        subtitle={`${relativeLabel(date)} · ${format(d, 'yyyy')}`}
        right={
          <div className="flex items-center">
            {date !== todayKey() && (
              <Link className="mr-1 rounded-lg px-2 py-1.5 text-xs font-bold text-volt-700 dark:text-volt-400 hover:bg-volt-500/15 dark:text-volt-300" to={`/day/${todayKey()}`}>
                Today
              </Link>
            )}
            <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous day">
              <ChevronLeft size={20} />
            </button>
            <button className="icon-btn" onClick={() => go(1)} aria-label="Next day">
              <ChevronRight size={20} />
            </button>
          </div>
        }
      />
      <div className="mx-auto max-w-app space-y-3 px-4 pt-4 lg:max-w-app-wide lg:px-8">
        <DayPhotoCard date={date} />
        <DayWeightCard date={date} />
        <ActivitySection date={date} />
        <FoodSection date={date} />
        {sessions === undefined ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <StartDay date={date} onCreated={(s) => setParams({ s: s.id }, { replace: true })} />
        ) : (
          <>
            {(
              <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pt-1" role="tablist" aria-label="Sessions on this day">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={s.id === activeId}
                    onClick={() => setParams({ s: s.id }, { replace: true })}
                    className={s.id === activeId ? 'chip-on !normal-case' : 'chip-off !normal-case'}
                  >
                    {sessionTitle(s, exMap)}
                    {!sessionHasContent(s) && <span className="opacity-60">· empty</span>}
                  </button>
                ))}
                <button className="chip-off !normal-case" onClick={addAnother} aria-label="Add another session on this day">
                  <Plus size={13} /> Session
                </button>
              </div>
            )}
            {activeId && <SessionEditor key={activeId} id={activeId} />}
          </>
        )}
      </div>
    </>
  );
}

function StartDay({ date, onCreated }: { date: string; onCreated: (s: Session) => void }) {
  const templates = useTemplates();
  const exMap = useExerciseMap();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const previous = useLiveQuery(() => latestSessionBefore(date), [date]);

  const run = async (fn: () => Promise<Session>) => {
    if (busy) return;
    setBusy(true);
    try {
      onCreated(await fn());
    } catch (e) {
      console.error(e);
      toast('Could not create session', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const describe = (t: Pick<Template, 'exercises'>) =>
    t.exercises
      .slice(0, 3)
      .map((e) => exMap.get(e.exerciseId)?.name ?? '?')
      .join(' · ') + (t.exercises.length > 3 ? ` +${t.exercises.length - 3}` : '');

  const future = date > todayKey();

  return (
    <div className="space-y-4">
      <div className="hero-panel p-6 text-steel-bright">
        <div className="relative pl-2">
          <div className="eyebrow text-volt-500">{future ? 'Plan ahead' : 'Log a workout'}</div>
          <div className="mt-1 font-display text-3xl font-bold tracking-wide">{future ? 'Nothing planned yet' : date === todayKey() ? 'What did you hit today?' : `What did you hit on ${format(fromKey(date), 'EEEE')}?`}</div>
          <p className="mt-2 max-w-sm text-sm text-floor-mute">
            {future ? 'Plan a session and it will show up on your calendar.' : 'Add your exercises with the weight and reps for each set. You can log it any time after training.'}
          </p>
          <button className="btn-primary mt-5" disabled={busy} onClick={() => run(() => createSession(date))}>
            <Plus size={18} strokeWidth={2.5} /> Start logging
          </button>
        </div>
      </div>

      {templates === undefined ? null : templates.length === 0 ? (
        <div className="card flex items-start gap-3 p-4 text-sm text-zinc-500 dark:text-zinc-400">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-volt-600" />
          <span>
            Save any session as a template, or build one in the{' '}
            <Link to="/library?tab=templates" className="font-semibold link-accent">
              Library
            </Link>
            , to load all its exercises with one tap.
          </span>
        </div>
      ) : (
        <section>
          <h2 className="eyebrow mb-2 flex items-center gap-1.5 px-1">
            <ClipboardList size={13} /> Start from a template
          </h2>
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <TemplateRow t={t} disabled={busy} onPick={(x) => run(() => createFromTemplate(date, x))} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {previous && (
        <button className="card card-hover flex w-full items-center gap-3 p-4 text-left" disabled={busy} onClick={() => run(() => repeatSession(date, previous))}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-volt-500/15 text-volt-700 dark:text-volt-400">
            <Repeat size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold">Repeat last workout</div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {sessionTitle(previous, exMap)} · {format(fromKey(previous.date), 'MMM d')} · {describe(previous)}
            </div>
          </div>
          <ChevronRight size={18} className="text-zinc-400" />
        </button>
      )}

    </div>
  );
}
