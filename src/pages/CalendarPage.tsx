import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, isValid, parse, startOfMonth, startOfWeek } from 'date-fns';
import { ArrowRight, Camera, ChevronLeft, ChevronRight, Dumbbell, Flame, Footprints, MapPin, Plus, Trophy, Utensils } from 'lucide-react';
import { fmtG, fmtKcal, sumNutrients } from '../lib/food';
import { db } from '../db';
import { useAllActivities, useAllSessions, useExerciseMap, useSettings } from '../hooks/data';
import { dayTotals, formatKm, formatSteps } from '../lib/cardio';
import { fromKey, toKey, todayKey } from '../lib/date';
import { computePRs, sessionHasContent, sessionMuscles, sessionTitle, sessionVolume, sessionWorkingSets, weeklyStreak } from '../lib/calc';
import { MUSCLE_COLORS, capitalize } from '../lib/muscles';
import { formatVolume } from '../lib/units';
import type { Session } from '../types';
import { APP_NAME } from '../brand';

function parseMonth(param: string | null): Date {
  if (param) {
    const d = parse(param, 'yyyy-MM', new Date());
    if (isValid(d)) return startOfMonth(d);
  }
  return startOfMonth(new Date());
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Late session?' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function CalendarPage() {
  const firstName = useAuth()?.user.name.split(' ')[0] ?? '';
  const [params, setParams] = useSearchParams();
  const month = parseMonth(params.get('m'));
  const navigate = useNavigate();
  const settings = useSettings();
  const sessions = useAllSessions();
  const exMap = useExerciseMap();
  const activities = useAllActivities();
  const cardioDays = useMemo(() => dayTotals(activities ?? []), [activities]);
  const photoDates = useLiveQuery(async () => new Set((await db.photos.toCollection().primaryKeys()) as string[]), []);
  const today = todayKey();

  const setMonth = (d: Date) => setParams({ m: format(d, 'yyyy-MM') }, { replace: true });

  const byDate = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of sessions ?? []) {
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    }
    return m;
  }, [sessions]);

  const prDates = useMemo(() => {
    const prs = computePRs(sessions ?? []);
    const out = new Set<string>();
    for (const s of sessions ?? []) if (s.exercises.some((e) => e.sets.some((x) => prs.has(x.id)))) out.add(s.date);
    return out;
  }, [sessions]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: settings.weekStartsOn });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: settings.weekStartsOn });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month, settings.weekStartsOn]);

  const weekdayLabels = useMemo(() => days.slice(0, 7).map((d) => format(d, 'EEEEE')), [days]);
  const monthKey = format(month, 'yyyy-MM');
  const monthSessions = useMemo(() => (sessions ?? []).filter((s) => s.date.startsWith(monthKey) && sessionHasContent(s)), [sessions, monthKey]);
  const monthVolume = monthSessions.reduce((a, s) => a + sessionVolume(s), 0);
  const monthDays = new Set(monthSessions.map((s) => s.date)).size;
  const streak = useMemo(() => weeklyStreak(sessions ?? [], settings.weekStartsOn), [sessions, settings.weekStartsOn]);

  const thisWeekCount = useMemo(() => {
    const ws = toKey(startOfWeek(new Date(), { weekStartsOn: settings.weekStartsOn }));
    return new Set((sessions ?? []).filter((s) => s.date >= ws && s.date <= today && sessionHasContent(s)).map((s) => s.date)).size;
  }, [sessions, settings.weekStartsOn, today]);

  const todaySession = (byDate.get(today) ?? []).find(sessionHasContent) ?? byDate.get(today)?.[0];
  const todayCardio = cardioDays.get(today);
  const todayFood = useLiveQuery(async () => {
    const list = await db.foodlog.where('date').equals(today).toArray();
    return list.length ? sumNutrients(list) : null;
  }, [today]);

  // Keyboard: Alt+←/→ change month.
  const monthRef = useRef(month);
  monthRef.current = month;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [role="dialog"]')) return;
      if (e.key === 'ArrowLeft' && e.altKey) setMonth(addMonths(monthRef.current, -1));
      if (e.key === 'ArrowRight' && e.altKey) setMonth(addMonths(monthRef.current, 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const isCurrentMonth = isSameMonth(month, new Date());

  return (
    <div className="mx-auto max-w-app space-y-4 px-4 lg:max-w-app-wide lg:px-8" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      {/* Hero — brand owns the first viewport */}
      <section className="hero-panel p-5 text-steel-bright sm:p-6">
        <div className="relative pl-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-5xl font-bold leading-[0.9] tracking-wide sm:text-6xl">{APP_NAME}</div>
              <div className="mt-2 text-sm font-medium text-floor-mute">
                {greeting()}{firstName ? `, ${firstName}` : ''} · {format(new Date(), 'EEEE, MMM d')}
              </div>
            </div>
            <img src="/icon.svg" alt="" className="mt-1 h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
          <div className="eyebrow text-volt-500">{todaySession && sessionHasContent(todaySession) ? 'Session logged' : 'Open rack'}</div>
          {todaySession && sessionHasContent(todaySession) ? (
            <>
              <div className="mt-1 font-display text-2xl font-bold tracking-wide">{sessionTitle(todaySession, exMap)}</div>
              <div className="mt-1 font-mono text-sm text-floor-mute">
                {sessionWorkingSets(todaySession)} sets · {formatVolume(sessionVolume(todaySession), settings.unit)} {settings.unit}
              </div>
            </>
          ) : (
            <>
              <div className="mt-1 font-display text-2xl font-bold tracking-wide">Ready to train?</div>
              <div className="mt-1 text-sm text-floor-mute">Log today, or tap any day on the grid.</div>
            </>
          )}
          {todayFood && (
            <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-steel-bright/90">
              <Utensils size={14} className="text-volt-500" />
              {fmtKcal(todayFood.kcal)}
              {settings.kcalGoal ? ` / ${fmtKcal(settings.kcalGoal)}` : ''} kcal · {fmtG(todayFood.protein)}
              {settings.proteinGoal ? ` / ${settings.proteinGoal}` : ''} g protein
            </div>
          )}
          {todayCardio && (
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-steel-bright/90">
              <Footprints size={14} className="text-volt-500" />
              {[todayCardio.distance && `${formatKm(todayCardio.distance)} km`, todayCardio.steps && `${formatSteps(todayCardio.steps)} steps`].filter(Boolean).join(' · ') || `${todayCardio.count} logged`} today
            </div>
          )}
          <Link
            to={todaySession ? `/day/${today}?s=${todaySession.id}` : `/day/${today}`}
            className="btn-primary mt-5"
          >
            {todaySession ? (
              <>
                Open today <ArrowRight size={16} />
              </>
            ) : (
              <>
                <Plus size={16} strokeWidth={2.5} /> Log today
              </>
            )}
          </Link>

          <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 border border-white/10 bg-black/25 py-3">
            <HeroStat label="This week" value={thisWeekCount} sub={thisWeekCount === 1 ? 'day' : 'days'} />
            <HeroStat
              label="Streak"
              value={
                <span className="inline-flex items-center gap-1">
                  {streak}
                  {streak > 0 && <Flame size={18} className="text-plate-400" />}
                </span>
              }
              sub={streak === 1 ? 'week' : 'weeks'}
            />
            <HeroStat label={format(month, 'MMMM')} value={formatVolume(monthVolume, settings.unit)} sub={`${settings.unit} · ${monthDays} ${monthDays === 1 ? 'day' : 'days'}`} />
          </div>
          </div>
        </div>
      </section>

      <Link to="/community?tab=nearby" className="card card-hover flex items-center gap-3 p-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-rack text-volt-500">
          <MapPin size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Gyms near me</span>
          <span className="block text-xs text-steel-mute dark:text-floor-mute">Find a fitness centre around you</span>
        </span>
        <ArrowRight size={18} className="shrink-0 text-steel-mute" />
      </Link>

      {/* Calendar */}
      <section className="card p-3 sm:p-4" aria-label="Calendar">
        <div className="mb-2 flex items-center gap-1 px-1">
          <h2 className="flex-1 font-display text-xl font-bold tracking-wide" aria-live="polite">
            {format(month, 'MMMM')} <span className="font-semibold text-steel-mute">{format(month, 'yyyy')}</span>
          </h2>
          {!isCurrentMonth && (
            <button className="rounded-lg px-2 py-1 text-xs font-bold text-volt-700 dark:text-volt-400 hover:bg-volt-500/15 dark:text-volt-300" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </button>
          )}
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <ChevronLeft size={20} />
          </button>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 pb-1.5 text-center text-[11px] font-bold text-zinc-400 dark:text-zinc-500" aria-hidden>
          {weekdayLabels.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>

        <div
          className="grid grid-cols-7 gap-1.5"
          role="grid"
          onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
          onTouchEnd={(e) => {
            if (!touch.current) return;
            const dx = e.changedTouches[0].clientX - touch.current.x;
            const dy = e.changedTouches[0].clientY - touch.current.y;
            touch.current = null;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setMonth(addMonths(month, dx < 0 ? 1 : -1));
          }}
        >
          {days.map((d) => {
            const key = toKey(d);
            const list = (byDate.get(key) ?? []).filter(sessionHasContent);
            const planned = (byDate.get(key) ?? []).length > 0 && list.length === 0;
            const inMonth = isSameMonth(d, month);
            const isToday = key === today;
            const hasPhoto = photoDates?.has(key);
            const hasPR = prDates.has(key);
            const cardio = cardioDays.get(key);
            const muscles = [...new Set(list.flatMap((s) => sessionMuscles(s, exMap)))].slice(0, 3);
            const trained = list.length > 0;
            const label = `${format(d, 'EEEE, MMMM d, yyyy')}${trained ? ` — ${list.length} workout${list.length > 1 ? 's' : ''}` : ''}${cardio ? `, ${cardio.count} walk or run` : ''}${hasPR ? ', PR' : ''}${hasPhoto ? ', photo' : ''}`;
            return (
              <button
                key={key}
                onClick={() => navigate(`/day/${key}`)}
                aria-label={label}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-md text-[15px] font-bold tabular transition active:scale-95 sm:aspect-[1.1] ${
                  trained
                    ? 'bg-rack text-volt-500 shadow-panel hover:bg-steel dark:hover:bg-rack-edge'
                    : cardio && inMonth
                      ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
                    : inMonth
                      ? 'text-steel hover:bg-steel/[0.06] dark:text-steel-bright dark:hover:bg-white/[0.06]'
                      : 'text-floor-mute hover:bg-steel/[0.03] dark:text-rack-edge dark:hover:bg-white/[0.03]'
                } ${isToday && !trained ? 'bg-volt-500/15 text-volt-700 ring-2 ring-inset ring-volt-500 dark:text-volt-400' : ''} ${
                  isToday && trained ? 'ring-2 ring-volt-500 ring-offset-2 ring-offset-floor-soft dark:ring-offset-rack-raised' : ''
                } ${!inMonth && trained ? 'opacity-40' : ''}`}
              >
                {hasPR && (
                  <span className="absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-sm bg-amber-400 text-amber-950 ring-2 ring-white dark:ring-zinc-900" aria-hidden>
                    <Trophy size={8} strokeWidth={3} />
                  </span>
                )}
                {hasPhoto && (
                  <span className={`absolute right-0.5 top-0.5 ${trained ? 'text-white/85' : 'text-zinc-400'}`} aria-hidden>
                    <Camera size={10} strokeWidth={2.5} />
                  </span>
                )}
                {cardio && (
                  <span className={`absolute bottom-0.5 right-0.5 ${trained ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`} aria-hidden>
                    <Footprints size={10} strokeWidth={2.5} />
                  </span>
                )}
                <span>{format(d, 'd')}</span>
                <span className="mt-1 flex h-1.5 gap-0.5">
                  {muscles.map((m) => (
                    <span key={m} className="h-1.5 w-1.5 rounded-full ring-1 ring-white/80" style={{ background: MUSCLE_COLORS[m] }} />
                  ))}
                  {planned && <span className="h-1.5 w-1.5 rounded-full border border-volt-500" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-[11px] font-medium text-zinc-500 dark:border-white/[0.05] dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-rack ring-1 ring-volt-500" /> Trained
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-amber-950">
              <Trophy size={8} strokeWidth={3} />
            </span>
            PR
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Footprints size={12} className="text-emerald-600 dark:text-emerald-400" /> Walk / run
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Camera size={12} /> Photo
          </span>
        </div>
      </section>

      {/* Month list */}
      <section aria-label="Sessions this month">
        <h2 className="eyebrow mb-2 px-1">
          {monthSessions.length ? `${monthSessions.length} session${monthSessions.length > 1 ? 's' : ''} in ${format(month, 'MMMM')}` : `No sessions in ${format(month, 'MMMM')}`}
        </h2>
        {monthSessions.length === 0 ? (
          <div className="card flex items-center gap-3 p-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Dumbbell size={18} />
            Tap any day on the calendar to log a workout.
          </div>
        ) : (
          <ul className="space-y-2">
            {[...monthSessions].reverse().map((s) => {
              const muscles = sessionMuscles(s, exMap).slice(0, 3);
              return (
                <li key={s.id}>
                  <Link to={`/day/${s.date}?s=${s.id}`} className="card card-hover flex items-center gap-3 p-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-rack text-steel-bright">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-volt-500">{format(fromKey(s.date), 'EEE')}</span>
                      <span className="font-mono text-lg font-bold leading-none">{format(fromKey(s.date), 'd')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate font-bold">
                        {sessionTitle(s, exMap)}
                        {prDates.has(s.date) && <Trophy size={13} className="shrink-0 text-amber-500" />}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {muscles.map((m) => (
                          <span key={m} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${MUSCLE_COLORS[m]}1f`, color: MUSCLE_COLORS[m] }}>
                            {capitalize(m)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="font-bold text-zinc-900 tabular dark:text-zinc-100">
                        {formatVolume(sessionVolume(s), settings.unit)} {settings.unit}
                      </div>
                      <div>{sessionWorkingSets(s)} sets</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <div className="px-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-floor-mute">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold leading-none tabular text-volt-500">{value}</div>
      <div className="mt-1 truncate text-[11px] text-floor-mute">{sub}</div>
    </div>
  );
}
