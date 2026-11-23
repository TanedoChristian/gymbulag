import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from 'date-fns';
import { Copy, Plus, Target, Trash2, Utensils } from 'lucide-react';
import { db } from '../db';
import { MACRO_COLOR, MEAL_LABEL, fmtG, fmtKcal, portionText, sumNutrients } from '../lib/food';
import { copyMeal } from '../lib/repo';
import { fromKey, toKey } from '../lib/date';
import { useSettings } from '../hooks/data';
import { useToast } from '../context/Toast';
import { AddFoodSheet, MacroLine, TrustBadge, defaultMeal } from './AddFood';
import { MEALS, type FoodEntry, type Meal, type Nutrients } from '../types';

/** What you ate on one day, grouped by meal, with totals against your goals. */
export function FoodSection({ date }: { date: string }) {
  const entries = useLiveQuery(() => db.foodlog.where('date').equals(date).sortBy('createdAt'), [date]);
  const yesterday = toKey(addDays(fromKey(date), -1));
  const prevMeals = useLiveQuery(async () => new Set((await db.foodlog.where('date').equals(yesterday).toArray()).map((e) => e.meal)), [yesterday]);
  const settings = useSettings();
  const toast = useToast();
  const [sheet, setSheet] = useState<{ meal: Meal; editing: FoodEntry | null } | null>(null);

  if (entries === undefined) return null;

  const open = (meal: Meal = defaultMeal(), editing: FoodEntry | null = null) => setSheet({ meal, editing });
  const sheetEl = <AddFoodSheet open={!!sheet} onClose={() => setSheet(null)} date={date} meal={sheet?.meal ?? 'breakfast'} editing={sheet?.editing} />;

  if (entries.length === 0) {
    return (
      <>
        <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-zinc-300/80 p-3 dark:border-white/10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Utensils size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Food</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">Calories, protein, carbs and fat</span>
          </span>
          <button className="btn-secondary !px-3 !py-2 text-xs" onClick={() => open()}>
            <Plus size={13} /> Add food
          </button>
        </div>
        {sheetEl}
      </>
    );
  }

  const total = sumNutrients(entries);
  const remove = async (e: FoodEntry) => {
    await db.foodlog.delete(e.id);
    toast(`Removed ${e.name}`, { action: { label: 'Undo', onClick: () => void db.foodlog.put(e) } });
  };
  const copy = async (meal: Meal) => {
    const n = await copyMeal(yesterday, date, meal);
    toast(`Copied ${n} ${n === 1 ? 'item' : 'items'} from yesterday`, { tone: 'success' });
  };

  return (
    <section className="space-y-2" aria-label="Food">
      <h2 className="eyebrow flex items-center gap-1.5 px-1">
        <Utensils size={13} /> Food
      </h2>
      <Totals total={total} goals={settings} />
      <div className="card divide-y divide-zinc-100 overflow-hidden dark:divide-white/[0.05]">
        {MEALS.map((meal) => {
          const list = entries.filter((e) => e.meal === meal);
          const sub = sumNutrients(list);
          return (
            <div key={meal}>
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-sm font-bold">{MEAL_LABEL[meal]}</span>
                {list.length > 0 && <span className="text-xs font-semibold text-zinc-500 tabular dark:text-zinc-400">{fmtKcal(sub.kcal)} kcal</span>}
                <span className="flex-1" />
                {list.length === 0 && prevMeals?.has(meal) && (
                  <button className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => copy(meal)}>
                    <Copy size={12} /> Yesterday's
                  </button>
                )}
                <button className="icon-btn -mr-2 !h-8 !w-8" onClick={() => open(meal)} aria-label={`Add food to ${MEAL_LABEL[meal].toLowerCase()}`}>
                  <Plus size={16} />
                </button>
              </div>
              {list.length > 0 && (
                <ul className="pb-1">
                  {list.map((e) => (
                    <li key={e.id} className="group flex items-center gap-2 pl-4 pr-2">
                      <button className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2 text-left" onClick={() => open(meal, e)}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{e.name}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {e.source !== 'quick' && <TrustBadge trust={e.trust} />}
                            <span>{portionText(e)}</span>
                            <MacroLine n={e.nutrients} />
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular">{fmtKcal(e.nutrients.kcal)}</span>
                      </button>
                      <button className="icon-btn !h-8 !w-8 !text-zinc-400 hover:!text-red-600" onClick={() => remove(e)} aria-label={`Remove ${e.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {sheetEl}
    </section>
  );
}

type Goals = { kcalGoal: number | null; proteinGoal: number | null; carbsGoal: number | null; fatGoal: number | null };

function Totals({ total, goals }: { total: Nutrients; goals: Goals }) {
  const left = goals.kcalGoal ? goals.kcalGoal - total.kcal : null;
  const pct = goals.kcalGoal ? Math.min(1, total.kcal / goals.kcalGoal) : 0;
  const over = left != null && left < 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="relative h-[84px] w-[84px] shrink-0">
        <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
          <circle cx="42" cy="42" r={R} fill="none" strokeWidth="8" className="stroke-zinc-100 dark:stroke-white/[0.07]" />
          {goals.kcalGoal && <circle cx="42" cy="42" r={R} fill="none" strokeWidth="8" strokeLinecap="round" stroke={over ? '#ef4444' : MACRO_COLOR.kcal} strokeDasharray={`${pct * C} ${C}`} />}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold leading-none tabular">{fmtKcal(total.kcal)}</span>
          <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">kcal</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          {left == null ? (
            <Link to="/settings#nutrition" className="inline-flex items-center gap-1 link-accent">
              <Target size={12} /> Set daily goals
            </Link>
          ) : over ? (
            <span className="text-red-600 dark:text-red-400">{fmtKcal(-left)} kcal over your {fmtKcal(goals.kcalGoal!)} goal</span>
          ) : (
            <>
              <b className="text-zinc-900 dark:text-zinc-100">{fmtKcal(left)}</b> kcal left of {fmtKcal(goals.kcalGoal!)}
            </>
          )}
        </div>
        <MacroBar label="Protein" value={total.protein} goal={goals.proteinGoal} color={MACRO_COLOR.protein} />
        <MacroBar label="Carbs" value={total.carbs} goal={goals.carbsGoal} color={MACRO_COLOR.carbs} />
        <MacroBar label="Fat" value={total.fat} goal={goals.fatGoal} color={MACRO_COLOR.fat} />
      </div>
    </div>
  );
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number | null; color: string }) {
  const pct = goal ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-bold" style={{ color }}>
          {label}
        </span>
        <span className="tabular text-zinc-500 dark:text-zinc-400">
          <b className="text-zinc-900 dark:text-zinc-100">{fmtG(value)}</b>
          {goal ? ` / ${fmtG(goal)}` : ''} g
        </span>
      </div>
      {goal ? (
        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.07]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
      ) : null}
    </div>
  );
}
