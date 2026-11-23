import { useMemo, useState } from 'react';
import { subDays } from 'date-fns';
import { Check, Flame, Info } from 'lucide-react';
import { useAllActivities, useAllSessions, useLatestBodyWeight, useSettings } from '../hooks/data';
import { useAuth, ageFromBirthDate } from '../lib/auth';
import { saveSettings } from '../lib/repo';
import { sessionHasContent } from '../lib/calc';
import { activityHasContent } from '../lib/cardio';
import { MACRO_COLOR, fmtKcal } from '../lib/food';
import { kgToUnit, trimNumber, unitToKg } from '../lib/units';
import { toKey } from '../lib/date';
import { ACTIVITY_INFO, ACTIVITY_LEVELS, GOAL_INFO, MIN_KCAL, WEIGHT_GOALS, calculate, suggestActivity, type ActivityLevel, type Sex, type WeightGoal } from '../lib/tdee';
import { Modal, NumberField, Segmented } from './ui';
import { useToast } from '../context/Toast';

/** How much you trained in the last 4 weeks, from what you logged. */
function useLoggedActivity() {
  const sessions = useAllSessions();
  const activities = useAllActivities();
  return useMemo(() => {
    if (!sessions || !activities) return null;
    const from = toKey(subDays(new Date(), 27));
    const days = new Set<string>();
    let km = 0;
    for (const s of sessions) if (s.date >= from && sessionHasContent(s)) days.add(s.date);
    for (const a of activities)
      if (a.date >= from && activityHasContent(a)) {
        days.add(a.date);
        km += a.distance ?? 0;
      }
    const perWeek = days.size / 4;
    const kmPerWeek = km / 4;
    return { perWeek, kmPerWeek, level: suggestActivity(perWeek, kmPerWeek), any: days.size > 0 };
  }, [sessions, activities]);
}

export function TdeeCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Calorie calculator" size="md">
      {open && <Calculator onDone={onClose} />}
    </Modal>
  );
}

function Calculator({ onDone }: { onDone: () => void }) {
  const settings = useSettings();
  const auth = useAuth();
  const logged = useLoggedActivity();
  const toast = useToast();
  const unit = settings.unit;
  const age = auth ? ageFromBirthDate(auth.user.birthDate) : null;
  const lastBw = useLatestBodyWeight();

  const [sex, setSex] = useState<Sex | null>(settings.sex);
  const [height, setHeight] = useState<number | null>(settings.heightCm);
  const [weight, setWeight] = useState<number | null>(() => {
    const kg = lastBw ?? settings.weightKg;
    return kg != null ? Number(trimNumber(kgToUnit(kg, unit), 1)) : null;
  });
  const [activity, setActivity] = useState<ActivityLevel | null>(settings.activityLevel);
  const [goal, setGoal] = useState<WeightGoal>(settings.weightGoal);
  const level = activity ?? logged?.level ?? null;

  const weightKg = weight != null ? unitToKg(weight, unit) : null;
  const ready = sex && age != null && height && height >= 100 && height <= 250 && weightKg && weightKg >= 30 && weightKg <= 300 && level;
  const r = ready ? calculate({ sex, age, heightCm: height, weightKg, activity: level, goal }) : null;

  const apply = async () => {
    if (!r || !sex || !level) return;
    await saveSettings({ kcalGoal: r.target, proteinGoal: r.protein, carbsGoal: r.carbs, fatGoal: r.fat, sex, heightCm: height, weightKg, activityLevel: level, weightGoal: goal });
    toast(`Daily goal set to ${fmtKcal(r.target)} kcal`, { tone: 'success' });
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">Sex</span>
          <Segmented ariaLabel="Sex" size="sm" value={sex ?? ('' as Sex)} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
        </div>
        <div>
          <span className="label">Age</span>
          <div className="flex h-[38px] items-center text-sm">
            <b className="text-base tabular">{age ?? '—'}</b>
            <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-400">from your account</span>
          </div>
        </div>
        <label className="block">
          <span className="label">Height</span>
          <div className="relative">
            <NumberField className="input !pr-10 tabular" decimals={1} value={height} onChange={setHeight} max={250} placeholder="170" aria-label="Height in cm" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">cm</span>
          </div>
        </label>
        <label className="block">
          <span className="label">Weight</span>
          <div className="relative">
            <NumberField className="input !pr-10 tabular" decimals={1} value={weight} onChange={setWeight} max={unit === 'kg' ? 300 : 660} placeholder={unit === 'kg' ? '70' : '155'} aria-label={`Weight in ${unit}`} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{unit}</span>
          </div>
          {lastBw != null && <span className="mt-1 block text-[11px] text-zinc-500 dark:text-zinc-400">Your last logged weight</span>}
        </label>
      </div>

      <div>
        <span className="label">How active are you?</span>
        {logged?.any && (
          <p className="mb-2 flex items-start gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Info size={12} className="mt-px shrink-0" />
            <span>
              Last 4 weeks: {trimNumber(logged.perWeek, 1)} training days a week{logged.kmPerWeek > 0 ? `, ${trimNumber(logged.kmPerWeek, 1)} km walked/run a week` : ''}. That fits <b>{ACTIVITY_INFO[logged.level].label.toLowerCase()}</b>
              {activity == null ? ', so it is selected.' : '.'} Count your job and daily movement too.
            </span>
          </p>
        )}
        <div className="space-y-1.5" role="radiogroup" aria-label="Activity level">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={level === a}
              onClick={() => setActivity(a)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${level === a ? 'border-volt-500 bg-volt-500/10' : 'border-zinc-200 dark:border-white/10'}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{ACTIVITY_INFO[a].label}</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{ACTIVITY_INFO[a].desc}</span>
              </span>
              <span className="text-xs tabular text-zinc-400">×{ACTIVITY_INFO[a].factor}</span>
              {level === a && <Check size={16} className="link-accent" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">Goal</span>
        <div className="flex flex-wrap gap-1.5">
          {WEIGHT_GOALS.map((g) => (
            <button key={g} className={goal === g ? 'chip-on' : 'chip-off'} onClick={() => setGoal(g)}>
              {GOAL_INFO[g].short}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          {GOAL_INFO[goal].label}
          {GOAL_INFO[goal].delta ? ` (${GOAL_INFO[goal].delta > 0 ? '+' : '−'}${Math.abs(GOAL_INFO[goal].delta)} kcal a day)` : ''}
        </p>
      </div>

      {r ? (
        <div className="space-y-3 rounded-2xl bg-zinc-900/[0.03] p-3.5 dark:bg-white/[0.04]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="At rest (BMR)" value={fmtKcal(r.bmr)} />
            <Stat label="Maintenance" value={fmtKcal(r.tdee)} />
            <Stat label="Your target" value={fmtKcal(r.target)} strong />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <Macro label="Protein" g={r.protein} color={MACRO_COLOR.protein} />
            <Macro label="Carbs" g={r.carbs} color={MACRO_COLOR.carbs} />
            <Macro label="Fat" g={r.fat} color={MACRO_COLOR.fat} />
          </div>
          {r.floored && (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Raised to {MIN_KCAL[sex!]} kcal, the usual minimum without medical supervision. Try a slower goal instead.
            </p>
          )}
          {age != null && age < 18 && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">This formula is made for adults. Under 18, check with a doctor or dietitian before cutting calories.</p>}
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            An estimate (Mifflin–St Jeor), usually within about 10%. Log your food and bodyweight for 2–3 weeks: if your weight isn't moving the way you want, adjust by 100–200 kcal.
          </p>
        </div>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-zinc-900/[0.03] p-3.5 text-xs text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
          <Flame size={14} /> Fill in sex, height, weight and activity to see your numbers.
        </p>
      )}

      <button className="btn-primary w-full" disabled={!r} onClick={() => void apply()}>
        Use as my daily goals
      </button>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-1 py-2 ${strong ? 'bg-emerald-500/10' : ''}`}>
      <div className={`text-lg font-extrabold leading-tight tabular ${strong ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

function Macro({ label, g, color }: { label: string; g: number; color: string }) {
  return (
    <div>
      <div className="font-bold" style={{ color }}>
        {label}
      </div>
      <div className="tabular">
        <b className="text-sm">{g}</b> g
      </div>
    </div>
  );
}
