import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, subDays, subMonths } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Camera, Footprints, Utensils, GitCompare, LineChart as LineIcon, Search, Trophy } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { PhotoCompare, PhotoImg, PhotoViewer } from '../components/Photos';
import { DeltaChip, useWeightByDate } from '../components/BodyWeight';
import { useAllActivities, useAllSessions, useBodyWeights, useExerciseMap, useLatestBodyWeight, useSettings } from '../hooks/data';
import { KIND_COLOR, KIND_LABEL, activityHasContent, activityPace, cardioDayStreak, cardioRecords, dailySeries, describeActivity, formatKm, formatPace, formatSteps, weeklyCardio } from '../lib/cardio';
import { KindIcon } from '../components/ActivitySection';
import { TrustBadge } from '../components/AddFood';
import { MACRO_COLOR, TRUST_INFO, averageLogged, fmtG, fmtKcal, macroSplit, nutritionSeries } from '../lib/food';
import { FOOD_TRUST } from '../types';
import {
  computePRs,
  estimate1RM,
  exerciseHistory,
  exerciseRecords,
  sessionHasContent,
  sessionVolume,
  summarizeSets,
  weeklyBuckets,
  weeklyStreak,
  muscleSetCounts,
  repMaxes,
  repRangeBests,
  weightForReps,
  REP_RANGES,
  type HistoryPoint,
  type PRKind,
} from '../lib/calc';
import { fromKey, toKey } from '../lib/date';
import { formatDelta, formatVolume, kgToUnit, trimNumber } from '../lib/units';
import { MUSCLE_COLORS, capitalize } from '../lib/muscles';
import { EmptyState, PageHeader, Segmented, Spinner, StatTile, TabBar } from '../components/ui';
import type { MuscleGroup, Session, Unit } from '../types';
import { todayKey } from '../lib/date';

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function useChartTheme() {
  const dark = useIsDark();
  return {
    accent: dark ? '#c6f000' : '#6b8200',
    grid: dark ? '#242a32' : '#cfd4db',
    axis: dark ? '#8b949e' : '#6b7380',
    surface: dark ? '#12161a' : '#eceff3',
    cursor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };
}

function ChartTooltip({ active, payload, render }: { active?: boolean; payload?: { payload: unknown }[]; render: (p: never) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {render(payload[0].payload as never)}
    </div>
  );
}

type Tab = 'overview' | 'records' | 'exercise' | 'cardio' | 'food' | 'photos';
const TABS: Tab[] = ['overview', 'records', 'exercise', 'cardio', 'food', 'photos'];

export default function ProgressPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'overview';
  const sessions = useAllSessions();
  const hasData = !!sessions && sessions.some(sessionHasContent);

  return (
    <>
      <PageHeader title="Progress" subtitle="Records, trends, cardio, food and photos" />
      <div className="mx-auto max-w-app lg:max-w-app-wide px-4 pt-3">
        <TabBar
          ariaLabel="Progress view"
          value={tab}
          onChange={(v) => {
            const next = new URLSearchParams(params);
            next.set('tab', v);
            setParams(next, { replace: true });
          }}
          tabs={[
            { value: 'overview', label: 'Overview', icon: <BarChart3 size={15} /> },
            { value: 'records', label: 'Records', icon: <Trophy size={15} /> },
            { value: 'exercise', label: 'Exercise', icon: <LineIcon size={15} /> },
            { value: 'cardio', label: 'Cardio', icon: <Footprints size={15} /> },
            { value: 'food', label: 'Food', icon: <Utensils size={15} /> },
            { value: 'photos', label: 'Photos', icon: <Camera size={15} /> },
          ]}
        />
        <div className="pt-3">
          {tab === 'photos' ? (
            <PhotosTab />
          ) : tab === 'cardio' ? (
            <CardioTab />
          ) : tab === 'food' ? (
            <FoodTab />
          ) : sessions === undefined ? (
            <Spinner />
          ) : !hasData ? (
            <EmptyState icon={<LineIcon />} title="No data yet">
              Log a few sessions on the calendar and your records, charts and PRs will show up here.
            </EmptyState>
          ) : tab === 'overview' ? (
            <Overview sessions={sessions} />
          ) : tab === 'records' ? (
            <RecordsTab sessions={sessions} />
          ) : (
            <ExerciseView sessions={sessions} />
          )}
        </div>
      </div>
    </>
  );
}

/* -------------------------------- Overview -------------------------------- */

function Overview({ sessions }: { sessions: Session[] }) {
  const settings = useSettings();
  const exMap = useExerciseMap();
  const theme = useChartTheme();
  const unit = settings.unit;

  const logged = useMemo(() => sessions.filter(sessionHasContent), [sessions]);
  const weeks = useMemo(() => weeklyBuckets(sessions, 12, settings.weekStartsOn), [sessions, settings.weekStartsOn]);
  const streak = useMemo(() => weeklyStreak(sessions, settings.weekStartsOn), [sessions, settings.weekStartsOn]);
  const muscles = useMemo(() => muscleSetCounts(sessions, exMap, toKey(subDays(new Date(), 30))), [sessions, exMap]);
  const totalVolume = useMemo(() => logged.reduce((a, s) => a + sessionVolume(s), 0), [logged]);
  const avgPerWeek = weeks.slice(-8).reduce((a, w) => a + w.sessions, 0) / 8;

  const weights = useBodyWeights();
  const bodyweight = useMemo(() => (weights ?? []).map((w) => ({ date: w.date, value: Number(trimNumber(kgToUnit(w.kg, unit), 1)) })), [weights, unit]);

  const recentPRs = useMemo(() => {
    const prs = computePRs(sessions);
    const out: { date: string; sessionId: string; exerciseId: string; kinds: PRKind[]; weight: number | null; reps: number | null }[] = [];
    for (const s of sessions) for (const ex of s.exercises) for (const set of ex.sets) {
      const k = prs.get(set.id);
      if (k) out.push({ date: s.date, sessionId: s.id, exerciseId: ex.exerciseId, kinds: k, weight: set.weight, reps: set.reps });
    }
    return out.reverse().slice(0, 8);
  }, [sessions]);

  const chartWeeks = weeks.map((w) => ({ ...w, label: format(fromKey(w.weekStart), 'MMM d'), display: Math.round(kgToUnit(w.volume, unit)) }));
  const maxMuscle = Math.max(1, ...muscles.map((m) => m.sets));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Sessions" value={logged.length} sub="all time" />
        <StatTile label="Total volume" value={formatVolume(totalVolume, unit)} sub={unit} />
        <StatTile label="Per week" value={trimNumber(avgPerWeek, 1)} sub="avg, last 8 weeks" />
        <StatTile label="Streak" value={streak} sub={streak === 1 ? 'week in a row' : 'weeks in a row'} />
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-bold">Weekly volume</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Weight × reps of working sets, {unit}, last 12 weeks</p>
        <div className="mt-3 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartWeeks} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${trimNumber(v / 1000, 0)}k` : String(v))} width={44} />
              <Tooltip
                cursor={{ fill: theme.cursor }}
                content={
                  <ChartTooltip
                    render={(p: (typeof chartWeeks)[number]) => (
                      <>
                        <div className="font-semibold">Week of {p.label}</div>
                        <div className="tabular">
                          {p.display.toLocaleString()} {unit} · {p.sessions} sessions · {p.sets} sets
                        </div>
                      </>
                    )}
                  />
                }
              />
              <Bar dataKey="display" fill={theme.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-bold">Sets per muscle group</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Working sets, last 30 days</p>
        {muscles.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No sets in the last 30 days.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {muscles.map((m) => (
              <li key={m.muscle} className="flex items-center gap-3 text-sm" title={`${capitalize(m.muscle)}: ${m.sets} sets`}>
                <span className="flex w-24 shrink-0 items-center gap-1.5 truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MUSCLE_COLORS[m.muscle] }} />
                  {capitalize(m.muscle)}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <span className="block h-full rounded-full" style={{ width: `${(m.sets / maxMuscle) * 100}%`, background: theme.accent }} />
                </span>
                <span className="w-8 text-right font-semibold tabular">{m.sets}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recentPRs.length > 0 && (
        <section className="card p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold">
            <Trophy size={15} className="text-amber-500" /> Recent PRs
          </h2>
          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentPRs.map((p, i) => (
              <li key={i}>
                <Link to={`/day/${p.date}?s=${p.sessionId}`} className="flex items-center gap-3 py-2.5 text-sm hover:opacity-80">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{exMap.get(p.exerciseId)?.name ?? 'Exercise'}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {format(fromKey(p.date), 'MMM d, yyyy')} · {p.kinds.map((k) => (k === 'e1rm' ? 'Est. 1RM' : k === 'weight' ? 'Heaviest' : 'Most reps')).join(' + ')}
                    </span>
                  </span>
                  <span className="font-bold tabular">
                    {p.weight ? `${trimNumber(kgToUnit(p.weight, unit), 1)} ${unit} × ${p.reps}` : `${p.reps} reps`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bodyweight.length >= 2 && (
        <section className="card p-4">
          <h2 className="text-sm font-bold">Bodyweight</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {unit} · {formatDelta(bodyweight[bodyweight.length - 1].value - bodyweight[0].value, unit)} since {format(fromKey(bodyweight[0].date), 'MMM d, yyyy')}
          </p>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bodyweight} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke={theme.grid} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={(d: string) => format(fromKey(d), 'MMM d')} minTickGap={24} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} width={44} tickFormatter={(v: number) => trimNumber(v, 0)} />
                <Tooltip
                  cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
                  content={<ChartTooltip render={(p: { date: string; value: number }) => (<><div className="font-semibold">{format(fromKey(p.date), 'MMM d, yyyy')}</div><div className="tabular">{p.value} {unit}</div></>)} />}
                />
                <Line type="monotone" dataKey="value" stroke={theme.accent} strokeWidth={2} dot={{ r: 4, fill: theme.accent, stroke: theme.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------ Exercise view ----------------------------- */

type Metric = 'e1rm' | 'weight' | 'volume' | 'reps';
type Range = '3m' | '6m' | '1y' | 'all';

function ExerciseView({ sessions }: { sessions: Session[] }) {
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const exMap = useExerciseMap();
  const theme = useChartTheme();
  const [range, setRange] = useState<Range>('6m');

  // Exercises with history, most frequently trained first.
  const options = useMemo(() => {
    const freq = new Map<string, number>();
    for (const s of sessions) for (const e of new Set(s.exercises.filter((x) => x.sets.some((y) => y.reps)).map((x) => x.exerciseId))) freq.set(e, (freq.get(e) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n, name: exMap.get(id)?.name ?? id }));
  }, [sessions, exMap]);

  const selected = options.find((o) => o.id === params.get('ex'))?.id ?? options[0]?.id;
  // Show numbers in the unit this exercise is usually logged in (e.g. lb dumbbells).
  const unit = (selected && lastUnitFor(sessions, selected)) || settings.unit;
  const history = useMemo(() => (selected ? exerciseHistory(sessions, selected) : []), [sessions, selected]);
  const records = useMemo(() => exerciseRecords(history), [history]);
  const unweighted = history.every((h) => h.topWeight === 0);
  const [metricState, setMetric] = useState<Metric>('e1rm');
  const metric: Metric = unweighted ? 'reps' : metricState;

  if (!selected) return <EmptyState icon={<LineIcon />} title="No exercise history yet" />;

  const since = range === 'all' ? '' : toKey(subMonths(new Date(), range === '3m' ? 3 : range === '6m' ? 6 : 12));
  const points = history
    .filter((h) => h.date >= since)
    .map((h) => {
      const raw = metric === 'e1rm' ? h.bestE1rm : metric === 'weight' ? h.topWeight : metric === 'volume' ? h.volume : h.maxReps;
      const value = metric === 'reps' ? raw : Number(trimNumber(kgToUnit(raw, unit), 1));
      return { date: h.date, value, sets: h.sets };
    });

  const metricLabel: Record<Metric, string> = { e1rm: `Estimated 1RM (${unit})`, weight: `Top set (${unit})`, volume: `Volume (${unit})`, reps: 'Most reps in a set' };
  const fmtW = (kg: number) => trimNumber(kgToUnit(kg, unit), 1);
  const first = points[0]?.value ?? 0;
  const lastV = points[points.length - 1]?.value ?? 0;
  const change = first > 0 && points.length > 1 ? ((lastV - first) / first) * 100 : null;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="label">Exercise</span>
        <select
          className="input text-base font-semibold"
          value={selected}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set('ex', e.target.value);
            setParams(next, { replace: true });
          }}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.n})
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {unweighted ? (
          <StatTile label="Most reps" value={records.mostReps?.value ?? '—'} sub={records.mostReps && format(fromKey(records.mostReps.date), 'MMM d, yyyy')} />
        ) : (
          <>
            <StatTile label="Best est. 1RM" value={records.bestE1rm ? `${fmtW(records.bestE1rm.value)}` : '—'} sub={records.bestE1rm && `${unit} · ${format(fromKey(records.bestE1rm.date), 'MMM d, yyyy')}`} />
            <StatTile
              label="Heaviest"
              value={records.heaviest ? fmtW(records.heaviest.value) : '—'}
              sub={records.heaviest && `${unit} × ${records.heaviest.set.reps} · ${format(fromKey(records.heaviest.date), 'MMM d')}`}
            />
            <StatTile label="Best volume" value={records.bestVolume ? formatVolume(records.bestVolume.value, unit) : '—'} sub={records.bestVolume && `${unit} · ${format(fromKey(records.bestVolume.date), 'MMM d')}`} />
          </>
        )}
        <StatTile label="Sessions" value={records.sessions} sub={history.length ? `since ${format(fromKey(history[0].date), 'MMM yyyy')}` : undefined} />
      </div>

      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {!unweighted && (
            <Segmented
              ariaLabel="Metric"
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'e1rm', label: 'Est. 1RM' },
                { value: 'weight', label: 'Top set' },
                { value: 'volume', label: 'Volume' },
              ]}
            />
          )}
          <div className="ml-auto">
            <Segmented
              ariaLabel="Time range"
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: '3m', label: '3M' },
                { value: '6m', label: '6M' },
                { value: '1y', label: '1Y' },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <h2 className="text-sm font-bold">{metricLabel[metric]}</h2>
          {change != null && (
            <span className={`text-xs font-semibold ${change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500'}`}>
              {change >= 0 ? '▲' : '▼'} {trimNumber(Math.abs(change), 1)}% in range
            </span>
          )}
        </div>
        <div className="mt-2 h-56">
          {points.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">No sessions in this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke={theme.grid} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={(d: string) => format(fromKey(d), 'MMM d')} minTickGap={24} />
                <YAxis domain={['auto', 'auto']} tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} width={44} tickFormatter={(v: number) => (v >= 10000 ? `${trimNumber(v / 1000, 0)}k` : trimNumber(v, 0))} />
                <Tooltip
                  cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
                  content={
                    <ChartTooltip
                      render={(p: (typeof points)[number]) => (
                        <>
                          <div className="font-semibold">{format(fromKey(p.date), 'EEE, MMM d, yyyy')}</div>
                          <div className="tabular">
                            {p.value.toLocaleString()} {metric === 'reps' ? 'reps' : unit}
                          </div>
                          <div className="mt-0.5 max-w-[14rem] text-zinc-500 dark:text-zinc-400">{summarizeSets(p.sets, fmtW)}</div>
                        </>
                      )}
                    />
                  }
                />
                <Line type="monotone" dataKey="value" stroke={theme.accent} strokeWidth={2} dot={{ r: 4, fill: theme.accent, stroke: theme.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <RepRangeSection history={history} unit={unit} unweighted={unweighted} />
      {!unweighted && <RepMaxTable history={history} unit={unit} e1rm={records.bestE1rm?.value ?? 0} />}
      <HistoryTable history={history} unit={unit} />
    </div>
  );
}

function HistoryTable({ history, unit }: { history: ReturnType<typeof exerciseHistory>; unit: Unit }) {
  const [limit, setLimit] = useState(10);
  const rows = [...history].reverse();
  const fmtW = (kg: number) => trimNumber(kgToUnit(kg, unit), 1);
  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold">History</h2>
      <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.slice(0, limit).map((h) => {
          const best = h.sets.reduce<{ e: number; label: string }>((acc, s) => {
            const e = estimate1RM(s.weight, s.reps) ?? 0;
            return e > acc.e ? { e, label: `${fmtW(e)}` } : acc;
          }, { e: 0, label: '' });
          return (
            <li key={h.sessionId}>
              <Link to={`/day/${h.date}?s=${h.sessionId}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                <span className="w-16 shrink-0 text-xs font-semibold text-zinc-500 dark:text-zinc-400">{format(fromKey(h.date), 'MMM d')}<br />{format(fromKey(h.date), 'yyyy')}</span>
                <span className="min-w-0 flex-1 text-sm tabular">{summarizeSets(h.sets, fmtW)}</span>
                {best.e > 0 && (
                  <span className="shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
                    e1RM
                    <br />
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{best.label}</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length > limit && (
        <button className="btn-ghost mt-1 w-full !py-2 text-xs" onClick={() => setLimit((l) => l + 20)}>
          Show more ({rows.length - limit} older)
        </button>
      )}
    </section>
  );
}

/* ------------------------------- Shared bits ------------------------------ */

/** Unit an exercise was most recently logged in, if it was set per exercise. */
function lastUnitFor(sessions: Session[], exerciseId: string): Unit | undefined {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const ex = sessions[i].exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.reps));
    if (ex) return ex.unit;
  }
  return undefined;
}

const RANGE_STYLE: Record<string, string> = {
  strength: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400',
  hypertrophy: 'from-volt-500/15 to-volt-500/5 text-volt-700 dark:text-volt-300',
  endurance: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
};

function fmtSet(weight: number, reps: number, unit: Unit) {
  return weight > 0 ? `${trimNumber(kgToUnit(weight, unit), 1)} ${unit} × ${reps}` : `${reps} reps`;
}

function RepRangeSection({ history, unit, unweighted }: { history: HistoryPoint[]; unit: Unit; unweighted: boolean }) {
  const bests = useMemo(() => repRangeBests(history), [history]);
  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold">PRs by rep range</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{unweighted ? 'Most reps in each range' : `Heaviest set in each range, ${unit}`}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {REP_RANGES.map((r) => {
          const b = bests[r.key];
          return (
            <div key={r.key} className={`rounded-2xl bg-gradient-to-b p-3 ${RANGE_STYLE[r.key]}`}>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em]">{r.label}</div>
              <div className="text-[11px] font-semibold opacity-70">{r.range} reps</div>
              <div className="mt-2 text-xl font-extrabold leading-none tracking-tight text-zinc-900 tabular dark:text-white">
                {!b ? '—' : b.weight > 0 ? (
                  <>
                    {trimNumber(kgToUnit(b.weight, unit), 1)}
                    <span className="ml-0.5 text-xs font-bold text-zinc-400">{unit}</span>
                  </>
                ) : (
                  b.reps
                )}
              </div>
              <div className="mt-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">{b ? (b.weight > 0 ? `× ${b.reps} reps` : 'reps') : 'Not trained yet'}</div>
              {b && <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{format(fromKey(b.date), 'MMM d, yyyy')}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RepMaxTable({ history, unit, e1rm }: { history: HistoryPoint[]; unit: Unit; e1rm: number }) {
  const rows = useMemo(() => repMaxes(history), [history]);
  const fmtW = (kg: number) => trimNumber(kgToUnit(kg, unit), 1);
  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold">Rep maxes</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Heaviest weight you've lifted for at least that many reps. Estimate based on your best est. 1RM.</p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
            <th className="pb-2 font-bold">Reps</th>
            <th className="pb-2 font-bold">Best ({unit})</th>
            <th className="pb-2 font-bold">Date</th>
            <th className="pb-2 text-right font-bold">Est.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.05]">
          {rows.map(({ target, best }) => (
            <tr key={target}>
              <td className="py-2 font-extrabold tabular">{target}RM</td>
              <td className="py-2 font-bold tabular">
                {best ? (
                  <>
                    {fmtW(best.weight)}
                    {best.reps > target && <span className="ml-1 text-xs font-medium text-zinc-400">(×{best.reps})</span>}
                  </>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="py-2 text-xs text-zinc-500 dark:text-zinc-400">{best ? format(fromKey(best.date), 'MMM d, yy') : ''}</td>
              <td className="py-2 text-right text-xs text-zinc-400 tabular">{e1rm > 0 ? fmtW(weightForReps(e1rm, target)) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* --------------------------------- Records -------------------------------- */

type RecordSort = 'recent' | 'az' | 'most';

function RecordsTab({ sessions }: { sessions: Session[] }) {
  const settings = useSettings();
  const exMap = useExerciseMap();
  const [, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [sort, setSort] = useState<RecordSort>('recent');

  const data = useMemo(() => {
    const prs = computePRs(sessions);
    const prInfo = new Map<string, { count: number; last: string }>();
    let total = 0;
    let thisMonth = 0;
    const monthKey = todayKey().slice(0, 7);
    for (const s of sessions)
      for (const e of s.exercises)
        for (const set of e.sets)
          if (prs.has(set.id)) {
            total++;
            if (s.date.startsWith(monthKey)) thisMonth++;
            const cur = prInfo.get(e.exerciseId) ?? { count: 0, last: '' };
            prInfo.set(e.exerciseId, { count: cur.count + 1, last: s.date > cur.last ? s.date : cur.last });
          }
    const ids = new Set<string>();
    for (const s of sessions) for (const e of s.exercises) if (e.sets.some((x) => x.reps)) ids.add(e.exerciseId);
    const rows = [...ids].map((id) => {
      const history = exerciseHistory(sessions, id);
      return {
        id,
        meta: exMap.get(id),
        history,
        records: exerciseRecords(history),
        ranges: repRangeBests(history),
        unit: lastUnitFor(sessions, id) ?? settings.unit,
        unweighted: history.every((h) => h.topWeight === 0),
        pr: prInfo.get(id),
        lastDate: history[history.length - 1]?.date ?? '',
      };
    });
    return { rows, total, thisMonth };
  }, [sessions, exMap, settings.unit]);

  const muscles = [...new Set(data.rows.map((r) => r.meta?.muscle).filter(Boolean) as MuscleGroup[])];
  const needle = q.trim().toLowerCase();
  const rows = data.rows
    .filter((r) => !muscle || r.meta?.muscle === muscle)
    .filter((r) => !needle || (r.meta?.name ?? r.id).toLowerCase().includes(needle))
    .sort((a, b) =>
      sort === 'az'
        ? (a.meta?.name ?? '').localeCompare(b.meta?.name ?? '')
        : sort === 'most'
          ? b.records.sessions - a.records.sessions
          : (b.pr?.last ?? b.lastDate).localeCompare(a.pr?.last ?? a.lastDate),
    );

  const open = (id: string) => setParams({ tab: 'exercise', ex: id });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="PRs all time" value={data.total} icon={<Trophy size={13} className="text-amber-500" />} />
        <StatTile label="This month" value={data.thisMonth} />
        <StatTile label="Exercises" value={data.rows.length} />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className="input !pl-9" placeholder="Search your exercises…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search records" />
        </div>
        <div className="flex items-center gap-2">
          <div className="no-scrollbar -ml-4 flex flex-1 gap-1.5 overflow-x-auto pl-4">
            <button className={muscle === null ? 'chip-on' : 'chip-off'} onClick={() => setMuscle(null)}>
              All
            </button>
            {muscles.map((m) => (
              <button key={m} className={muscle === m ? 'chip-on' : 'chip-off'} onClick={() => setMuscle(muscle === m ? null : m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Segmented ariaLabel="Sort records" size="sm" value={sort} onChange={setSort} options={[{ value: 'recent', label: 'Recent' }, { value: 'most', label: 'Most trained' }, { value: 'az', label: 'A–Z' }]} />
        </div>
      </div>

      <ul className="space-y-3">
        {rows.map((r) => {
          const color = r.meta ? MUSCLE_COLORS[r.meta.muscle] : '#71717a';
          const best = r.records.bestE1rm;
          const heaviest = r.records.heaviest;
          return (
            <li key={r.id}>
              <button onClick={() => open(r.id)} className="card card-hover w-full overflow-hidden text-left">
                <div className="flex items-start gap-3 p-4 pb-3">
                  <span className="mt-0.5 h-10 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold tracking-tight">{r.meta?.name ?? r.id}</div>
                    <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold capitalize" style={{ color }}>
                        {r.meta?.muscle}
                      </span>{' '}
                      · {r.records.sessions} {r.records.sessions === 1 ? 'session' : 'sessions'}
                      {r.pr && <> · last PR {format(fromKey(r.pr.last), 'MMM d')}</>}
                    </div>
                  </div>
                  <div className="text-right">
                    {r.unweighted ? (
                      <>
                        <div className="text-2xl font-extrabold leading-none tracking-tight tabular">{r.records.mostReps?.value ?? '—'}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">most reps</div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-extrabold leading-none tracking-tight tabular">
                          {best ? trimNumber(kgToUnit(best.value, r.unit), 1) : '—'}
                          <span className="ml-0.5 text-xs font-bold text-zinc-400">{r.unit}</span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">est. 1RM</div>
                      </>
                    )}
                  </div>
                </div>
                {!r.unweighted && heaviest && (
                  <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs">
                    <Trophy size={13} className="shrink-0 text-amber-500" />
                    <span className="text-zinc-600 dark:text-zinc-300">
                      Heaviest <b className="text-zinc-900 dark:text-white">{fmtSet(heaviest.value, heaviest.set.reps ?? 0, r.unit)}</b> · {format(fromKey(heaviest.date), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 border-t border-zinc-100 dark:border-white/[0.05]">
                  {REP_RANGES.map((range, i) => {
                    const b = r.ranges[range.key];
                    return (
                      <div key={range.key} className={`px-3 py-2.5 ${i ? 'border-l border-zinc-100 dark:border-white/[0.05]' : ''}`}>
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">{range.range} reps</div>
                        <div className="mt-0.5 truncate text-sm font-bold tabular">
                          {!b ? <span className="text-zinc-300 dark:text-zinc-600">—</span> : b.weight > 0 ? `${trimNumber(kgToUnit(b.weight, r.unit), 1)} × ${b.reps}` : `${b.reps} reps`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-10 text-center text-sm text-zinc-500">No exercises match.</li>}
      </ul>
    </div>
  );
}

/* --------------------------------- Photos --------------------------------- */

function PhotosTab() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').reverse().toArray(), []);
  const [viewer, setViewer] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const settings = useSettings();
  const weightByDate = useWeightByDate();
  const unit = settings.unit;

  if (!photos) return <Spinner />;
  if (photos.length === 0)
    return (
      <EmptyState icon={<Camera />} title="No progress photos yet">
        Open any day on the calendar and add a photo. They stay private on this device.
        <div className="mt-4">
          <Link to={`/day/${todayKey()}`} className="btn-primary">
            Add today's photo
          </Link>
        </div>
      </EmptyState>
    );

  const dates = photos.map((p) => p.date);
  // Change is measured from the oldest photo that has a weight.
  const baseDate = [...dates].reverse().find((d) => weightByDate.has(d));
  const baseKg = baseDate ? weightByDate.get(baseDate)! : null;
  const pick = (d: string) => {
    const next = picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d].slice(-2);
    setPicked(next);
    if (next.length === 2) {
      setCompare([next[0], next[1]]);
      setPicked([]);
      setComparing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-sm text-zinc-500 dark:text-zinc-400">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          {comparing && <span className="font-semibold link-accent"> · pick {2 - picked.length} more</span>}
        </div>
        {photos.length >= 2 && !comparing && (
          <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => setCompare([dates[dates.length - 1], dates[0]])}>
            First vs latest
          </button>
        )}
        {photos.length >= 2 && (
          <button className={comparing ? 'btn-primary !px-3 !py-2 text-xs' : 'btn-secondary !px-3 !py-2 text-xs'} onClick={() => (setComparing((v) => !v), setPicked([]))}>
            <GitCompare size={14} /> {comparing ? 'Cancel' : 'Compare'}
          </button>
        )}
      </div>
      {baseKg != null ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Weight change is shown from your first photo with a weight ({format(fromKey(baseDate!), 'MMM d, yyyy')}).</p>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Log your body weight on the same day as a photo and it shows here, so you can see progress at a glance.</p>
      )}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => {
          const on = picked.includes(p.date);
          return (
            <li key={p.date}>
              <button
                onClick={() => (comparing ? pick(p.date) : setViewer(i))}
                className={`group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-zinc-200 transition dark:bg-zinc-800 ${on ? 'ring-4 ring-volt-500' : ''}`}
                aria-label={`Photo from ${format(fromKey(p.date), 'MMMM d, yyyy')}`}
              >
                <PhotoImg photo={p} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-1.5 pt-10 text-left text-white">
                  {weightByDate.has(p.date) && (
                    <span className="block text-base font-extrabold leading-tight tabular">
                      {trimNumber(kgToUnit(weightByDate.get(p.date)!, unit), 1)} <span className="text-[11px] font-bold opacity-80">{unit}</span>
                    </span>
                  )}
                  <span className="block text-[11px] font-bold opacity-90">{format(fromKey(p.date), 'MMM d, yyyy')}</span>
                </span>
                {baseKg != null && weightByDate.has(p.date) && p.date !== baseDate && (
                  <DeltaChip diffKg={weightByDate.get(p.date)! - baseKg} unit={unit} goal={settings.weightGoal} className="absolute left-1.5 top-1.5 !px-1.5 !text-[10px] shadow" />
                )}
                {on && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-volt-500 text-xs font-bold text-white">{picked.indexOf(p.date) + 1}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {viewer != null && <PhotoViewer dates={dates} index={viewer} onClose={() => setViewer(null)} />}
      {compare && <PhotoCompare a={compare[0]} b={compare[1]} onClose={() => setCompare(null)} />}
    </div>
  );
}

/* --------------------------------- Cardio --------------------------------- */

type CardioMetric = 'km' | 'steps' | 'min';
const CARDIO_METRIC_LABEL: Record<CardioMetric, string> = { km: 'Distance (km)', steps: 'Steps', min: 'Time (min)' };

function CardioTab() {
  const activities = useAllActivities();
  const settings = useSettings();
  const theme = useChartTheme();
  const [metric, setMetric] = useState<CardioMetric>('km');
  const [days, setDays] = useState<30 | 90>(30);
  const [limit, setLimit] = useState(10);

  const logged = useMemo(() => (activities ?? []).filter(activityHasContent), [activities]);
  const weeks = useMemo(() => weeklyCardio(logged, 12, settings.weekStartsOn), [logged, settings.weekStartsOn]);
  const daily = useMemo(() => dailySeries(logged, days), [logged, days]);
  const records = useMemo(() => cardioRecords(logged, settings.weekStartsOn), [logged, settings.weekStartsOn]);
  const streak = useMemo(() => cardioDayStreak(logged), [logged]);
  const runs = useMemo(
    () =>
      logged
        .filter((a) => a.kind === 'run' && activityPace(a) != null)
        .map((a) => ({ date: a.date, pace: Number(activityPace(a)!.toFixed(2)), distance: a.distance ?? 0 })),
    [logged],
  );

  if (activities === undefined) return <Spinner />;
  if (logged.length === 0)
    return (
      <EmptyState icon={<Footprints />} title="No walks or runs yet">
        Open any day on the calendar and tap <b>+ Walk</b> or <b>+ Run</b> to log steps, km and time. You can log them on the same day as a gym session.
        <div className="mt-4">
          <Link to={`/day/${todayKey()}`} className="btn-primary">
            Log today
          </Link>
        </div>
      </EmptyState>
    );

  const thisWeek = weeks[weeks.length - 1];
  const last7 = dailySeries(logged, 7);
  const avgSteps = last7.reduce((a, d) => a + d.steps, 0) / 7;
  const totalKm = logged.reduce((a, x) => a + (x.distance ?? 0), 0);
  const value = (t: { distance: number; steps: number; duration: number }) => (metric === 'km' ? Number(t.distance.toFixed(2)) : metric === 'steps' ? t.steps : Math.round(t.duration));
  const fmt = (v: number) => (metric === 'km' ? `${formatKm(v)} km` : metric === 'steps' ? `${formatSteps(v)} steps` : `${v} min`);
  const chartWeeks = weeks.map((w) => ({ ...w, label: format(fromKey(w.weekStart), 'MMM d'), value: value(w), walk: Number(w.walkKm.toFixed(2)), run: Number(w.runKm.toFixed(2)) }));
  const chartDays = daily.map((d) => ({ ...d, value: value(d), walk: Number(d.walkKm.toFixed(2)), run: Number(d.runKm.toFixed(2)) }));
  const stacked = metric === 'km';
  const yTick = (v: number) => (v >= 10000 ? `${trimNumber(v / 1000, 0)}k` : trimNumber(v, 1));
  const recent = [...logged].reverse();

  const metricPicker = (
    <Segmented
      ariaLabel="Cardio metric"
      size="sm"
      value={metric}
      onChange={setMetric}
      options={[
        { value: 'km', label: 'Km' },
        { value: 'steps', label: 'Steps' },
        { value: 'min', label: 'Time' },
      ]}
    />
  );
  const legend = stacked && (
    <div className="mt-2 flex gap-3 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
      {(['walk', 'run'] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: KIND_COLOR[k] }} /> {KIND_LABEL[k]}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="This week" value={formatKm(thisWeek.distance)} sub={`km · ${formatSteps(thisWeek.steps)} steps`} />
        <StatTile label="Steps / day" value={formatSteps(Math.round(avgSteps))} sub="avg, last 7 days" />
        <StatTile label="Total distance" value={formatKm(totalKm)} sub={`km · ${logged.length} logged`} />
        <StatTile label="Day streak" value={streak} sub={streak === 1 ? 'day in a row' : 'days in a row'} />
      </div>

      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold">Weekly {CARDIO_METRIC_LABEL[metric].toLowerCase()}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Last 12 weeks</p>
          </div>
          {metricPicker}
        </div>
        <div className="mt-3 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartWeeks} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={yTick} width={44} />
              <Tooltip
                cursor={{ fill: theme.cursor }}
                content={
                  <ChartTooltip
                    render={(p: (typeof chartWeeks)[number]) => (
                      <>
                        <div className="font-semibold">Week of {p.label}</div>
                        <div className="tabular">{fmt(p.value)}</div>
                        {stacked && (p.walk > 0 || p.run > 0) && (
                          <div className="text-zinc-500 dark:text-zinc-400">
                            Walk {formatKm(p.walk)} · Run {formatKm(p.run)}
                          </div>
                        )}
                        <div className="text-zinc-500 dark:text-zinc-400">
                          {p.activeDays} active {p.activeDays === 1 ? 'day' : 'days'}
                        </div>
                      </>
                    )}
                  />
                }
              />
              {stacked ? (
                <>
                  <Bar dataKey="walk" stackId="km" fill={KIND_COLOR.walk} maxBarSize={28} />
                  <Bar dataKey="run" stackId="km" fill={KIND_COLOR.run} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </>
              ) : (
                <Bar dataKey="value" fill={KIND_COLOR.walk} radius={[4, 4, 0, 0]} maxBarSize={28} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {legend}
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold">Daily {CARDIO_METRIC_LABEL[metric].toLowerCase()}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">All walks and runs on a day added together</p>
          </div>
          <Segmented ariaLabel="Days" size="sm" value={days} onChange={setDays} options={[{ value: 30, label: '30D' }, { value: 90, label: '90D' }]} />
        </div>
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartDays} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="15%">
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={(d: string) => format(fromKey(d), 'MMM d')} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={yTick} width={44} />
              <Tooltip
                cursor={{ fill: theme.cursor }}
                content={
                  <ChartTooltip
                    render={(p: (typeof chartDays)[number]) => (
                      <>
                        <div className="font-semibold">{format(fromKey(p.date), 'EEE, MMM d')}</div>
                        <div className="tabular">{p.count ? fmt(p.value) : 'Nothing logged'}</div>
                      </>
                    )}
                  />
                }
              />
              {stacked ? (
                <>
                  <Bar dataKey="walk" stackId="km" fill={KIND_COLOR.walk} />
                  <Bar dataKey="run" stackId="km" fill={KIND_COLOR.run} radius={[3, 3, 0, 0]} />
                </>
              ) : (
                <Bar dataKey="value" fill={KIND_COLOR.walk} radius={[3, 3, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {legend}
      </section>

      {runs.length >= 2 && (
        <section className="card p-4">
          <h2 className="text-sm font-bold">Run pace</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Minutes per km. Higher on the chart is faster.</p>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={runs} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke={theme.grid} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={(d: string) => format(fromKey(d), 'MMM d')} minTickGap={24} />
                <YAxis reversed domain={['dataMin - 0.25', 'dataMax + 0.25']} tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} width={44} tickFormatter={(v: number) => formatPace(v).replace(' /km', '')} />
                <Tooltip
                  cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }}
                  content={
                    <ChartTooltip
                      render={(p: (typeof runs)[number]) => (
                        <>
                          <div className="font-semibold">{format(fromKey(p.date), 'EEE, MMM d, yyyy')}</div>
                          <div className="tabular">
                            {formatPace(p.pace)} · {formatKm(p.distance)} km
                          </div>
                        </>
                      )}
                    />
                  }
                />
                <Line type="monotone" dataKey="pace" stroke={KIND_COLOR.run} strokeWidth={2} dot={{ r: 4, fill: KIND_COLOR.run, stroke: theme.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="card p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Trophy size={15} className="text-amber-500" /> Cardio records
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <RecordBox label="Longest run" value={records.longestRun && `${formatKm(records.longestRun.value)} km`} date={records.longestRun?.date} />
          <RecordBox label="Fastest run" value={records.fastestRun && formatPace(records.fastestRun.value)} date={records.fastestRun?.date} hint="runs of 1 km+" />
          <RecordBox label="Longest walk" value={records.longestWalk && `${formatKm(records.longestWalk.value)} km`} date={records.longestWalk?.date} />
          <RecordBox label="Most steps" value={records.mostStepsDay && formatSteps(records.mostStepsDay.value)} date={records.mostStepsDay?.date} hint="in one day" />
          <RecordBox label="Best week" value={records.bestWeekKm && `${formatKm(records.bestWeekKm.value)} km`} date={records.bestWeekKm?.date} prefix="Week of " />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-bold">History</h2>
        <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          {recent.slice(0, limit).map((a) => {
            const pace = activityPace(a);
            return (
              <li key={a.id}>
                <Link to={`/day/${a.date}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: KIND_COLOR[a.kind] }}>
                    <KindIcon kind={a.kind} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {KIND_LABEL[a.kind]} <span className="font-normal text-zinc-500 dark:text-zinc-400">· {format(fromKey(a.date), 'EEE, MMM d, yyyy')}</span>
                    </span>
                    <span className="block truncate text-xs text-zinc-500 tabular dark:text-zinc-400">{describeActivity(a)}</span>
                  </span>
                  {pace != null && <span className="shrink-0 text-xs font-bold tabular">{formatPace(pace)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
        {recent.length > limit && (
          <button className="btn-ghost mt-1 w-full !py-2 text-xs" onClick={() => setLimit((l) => l + 20)}>
            Show more ({recent.length - limit} older)
          </button>
        )}
      </section>
    </div>
  );
}

function RecordBox({ label, value, date, hint, prefix = '' }: { label: string; value: string | null; date?: string; hint?: string; prefix?: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900/[0.03] p-3 dark:bg-white/[0.04]">
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-extrabold leading-tight tracking-tight tabular">{value ?? '—'}</div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{date ? `${prefix}${format(fromKey(date), 'MMM d, yyyy')}` : hint ?? 'Not yet'}</div>
    </div>
  );
}

/* ---------------------------------- Food ---------------------------------- */

function FoodTab() {
  const entries = useLiveQuery(() => db.foodlog.toArray(), []);
  const bw = useLatestBodyWeight();
  const settings = useSettings();
  const theme = useChartTheme();
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const series = useMemo(() => nutritionSeries(entries ?? [], days), [entries, days]);
  const avg = useMemo(() => averageLogged(series), [series]);
  const inRange = useMemo(() => {
    const since = series[0]?.date ?? '';
    return (entries ?? []).filter((e) => e.date >= since);
  }, [entries, series]);

  if (entries === undefined) return <Spinner />;
  if (entries.length === 0)
    return (
      <EmptyState icon={<Utensils />} title="No food logged yet">
        Open any day and tap <b>Add food</b>. Search verified USDA foods, scan a barcode, or add your own.
        <div className="mt-4">
          <Link to={`/day/${todayKey()}`} className="btn-primary">
            Log today's food
          </Link>
        </div>
      </EmptyState>
    );

  const logged = series.filter((d) => d.entries > 0);
  const proteinHit = settings.proteinGoal ? logged.filter((d) => d.protein >= settings.proteinGoal! * 0.95).length : null;
  const kcalHit = settings.kcalGoal ? logged.filter((d) => Math.abs(d.kcal - settings.kcalGoal!) <= settings.kcalGoal! * 0.1).length : null;
  const split = avg ? macroSplit(avg) : null;
  const chart = series.map((d) => ({ ...d, kcalR: Math.round(d.kcal), proteinR: Math.round(d.protein) }));

  // Where the calories came from, by how trustworthy the data is.
  const byTrust = new Map<string, number>();
  let kcalTotal = 0;
  for (const e of inRange) {
    const key = e.source === 'quick' ? 'quick' : e.trust;
    byTrust.set(key, (byTrust.get(key) ?? 0) + e.nutrients.kcal);
    kcalTotal += e.nutrients.kcal;
  }

  const top = (() => {
    const m = new Map<string, { name: string; count: number; kcal: number; protein: number; trust: (typeof inRange)[number]['trust']; quick: boolean }>();
    for (const e of inRange) {
      const k = e.foodId ?? `name:${e.name}`;
      const cur = m.get(k) ?? { name: e.name, count: 0, kcal: 0, protein: 0, trust: e.trust, quick: e.source === 'quick' };
      cur.count++;
      cur.kcal += e.nutrients.kcal;
      cur.protein += e.nutrients.protein;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.count - a.count || b.kcal - a.kcal).slice(0, 8);
  })();

  const dayTick = (d: string) => format(fromKey(d), days === 7 ? 'EEE' : 'MMM d');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Segmented ariaLabel="Range" size="sm" value={days} onChange={setDays} options={[{ value: 7, label: '7D' }, { value: 30, label: '30D' }, { value: 90, label: '90D' }]} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Avg calories" value={avg ? fmtKcal(avg.kcal) : '—'} sub={settings.kcalGoal ? `goal ${fmtKcal(settings.kcalGoal)}` : 'kcal / day'} />
        <StatTile label="Avg protein" value={avg ? `${fmtG(avg.protein)} g` : '—'} sub={settings.proteinGoal ? `goal ${settings.proteinGoal} g` : 'per day'} />
        <StatTile label="Protein / kg" value={avg && bw ? trimNumber(avg.protein / bw, 1) : '—'} sub={bw ? `at ${trimNumber(bw, 1)} kg bodyweight` : 'log your weight on a day'} />
        <StatTile label="Days logged" value={`${logged.length}/${days}`} sub={proteinHit != null ? `protein goal hit ${proteinHit}×` : kcalHit != null ? `within 10% of kcal goal ${kcalHit}×` : 'averages skip empty days'} />
      </div>

      <section className="card p-4">
        <h2 className="text-sm font-bold">Calories</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Per day{settings.kcalGoal ? ', dashed line is your goal' : ''}</p>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="15%">
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={dayTick} minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} width={44} domain={[0, (max: number) => Math.ceil(Math.max(max, (settings.kcalGoal ?? 0) * 1.1))]} />
              <Tooltip
                cursor={{ fill: theme.cursor }}
                content={
                  <ChartTooltip
                    render={(p: (typeof chart)[number]) => (
                      <>
                        <div className="font-semibold">{format(fromKey(p.date), 'EEE, MMM d')}</div>
                        {p.entries ? (
                          <>
                            <div className="tabular">{fmtKcal(p.kcal)} kcal</div>
                            <div className="text-zinc-500 dark:text-zinc-400">
                              P {fmtG(p.protein)} · C {fmtG(p.carbs)} · F {fmtG(p.fat)} g
                            </div>
                          </>
                        ) : (
                          <div className="text-zinc-500">Nothing logged</div>
                        )}
                      </>
                    )}
                  />
                }
              />
              {settings.kcalGoal && <ReferenceLine y={settings.kcalGoal} stroke={theme.axis} strokeDasharray="4 4" />}
              <Bar dataKey="kcalR" fill={MACRO_COLOR.kcal} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-bold">Protein</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Grams per day{settings.proteinGoal ? ', dashed line is your goal' : ''}</p>
        <div className="mt-3 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barCategoryGap="15%">
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} tickFormatter={dayTick} minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: theme.axis, fontSize: 11 }} width={44} domain={[0, (max: number) => Math.ceil(Math.max(max, (settings.proteinGoal ?? 0) * 1.1))]} />
              <Tooltip
                cursor={{ fill: theme.cursor }}
                content={<ChartTooltip render={(p: (typeof chart)[number]) => (<><div className="font-semibold">{format(fromKey(p.date), 'EEE, MMM d')}</div><div className="tabular">{p.entries ? `${fmtG(p.protein)} g protein` : 'Nothing logged'}</div></>)} />}
              />
              {settings.proteinGoal && <ReferenceLine y={settings.proteinGoal} stroke={theme.axis} strokeDasharray="4 4" />}
              <Bar dataKey="proteinR" fill={MACRO_COLOR.protein} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {split && avg && (
        <section className="card p-4">
          <h2 className="text-sm font-bold">Macro split</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Share of calories, average of logged days</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full">
            {(['protein', 'carbs', 'fat'] as const).map((k) => (
              <div key={k} style={{ width: `${split[k] * 100}%`, background: MACRO_COLOR[k] }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {(['protein', 'carbs', 'fat'] as const).map((k) => (
              <div key={k}>
                <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: MACRO_COLOR[k] }}>
                  {k}
                </div>
                <div className="text-lg font-extrabold tabular">{Math.round(split[k] * 100)}%</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{fmtG(avg[k])} g / day</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {kcalTotal > 0 && (
        <section className="card p-4">
          <h2 className="text-sm font-bold">How reliable your numbers are</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Share of logged calories by data source, last {days} days</p>
          <ul className="mt-3 space-y-2">
            {[...FOOD_TRUST, 'quick' as const].map((k) => {
              const v = byTrust.get(k) ?? 0;
              if (!v) return null;
              const pct = (v / kcalTotal) * 100;
              return (
                <li key={k} className="flex items-center gap-3 text-sm" title={k === 'quick' ? 'Totals you typed in yourself' : TRUST_INFO[k].desc}>
                  <span className="w-28 shrink-0">{k === 'quick' ? <span className="text-xs font-semibold text-zinc-500">Quick add</span> : <TrustBadge trust={k} />}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <span className="block h-full rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ width: `${pct}%`, background: k === 'verified' ? '#10b981' : k === 'checked' ? '#0ea5e9' : k === 'community' ? '#f59e0b' : undefined }} />
                  </span>
                  <span className="w-10 text-right font-semibold tabular">{Math.round(pct)}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {top.length > 0 && (
        <section className="card p-4">
          <h2 className="text-sm font-bold">Most eaten</h2>
          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
            {top.map((f, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {!f.quick && <TrustBadge trust={f.trust} />}
                    {f.count}× · {fmtG(f.protein)} g protein total
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular">{fmtKcal(f.kcal)} kcal</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
