import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowLeft, Barcode, BadgeCheck, Camera, Loader2, PenLine, Plus, Search, ShieldQuestion, Star, User, Zap } from 'lucide-react';
import { db } from '../db';
import { FoodLookupError, MACRO_COLOR, MEAL_LABEL, TRUST_INFO, entryFromFood, fmtG, fmtKcal, loadUsda, nutritionWarning, offByBarcode, offSearch, scale, searchFoods, type UsdaFood } from '../lib/food';
import { addFoodEntry, createCustomFood, saveFoodToLibrary, updateFoodEntry } from '../lib/repo';
import { apiBase, getAuth } from '../lib/api';
import { trimNumber } from '../lib/units';
import { useToast } from '../context/Toast';
import { Modal, NumberField, Segmented } from './ui';
import { MEALS, type Food, type FoodEntry, type FoodTrust, type Meal, type Nutrients } from '../types';

/* --------------------------------- Badges --------------------------------- */

const TRUST_STYLE: Record<FoodTrust, string> = {
  verified: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  checked: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  community: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  yours: 'bg-zinc-500/12 text-zinc-600 dark:text-zinc-300',
};

export function TrustBadge({ trust, source }: { trust: FoodTrust; source?: string }) {
  const Icon = trust === 'verified' || trust === 'checked' ? BadgeCheck : trust === 'community' ? ShieldQuestion : User;
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${TRUST_STYLE[trust]}`} title={TRUST_INFO[trust].desc}>
      <Icon size={11} strokeWidth={2.5} />
      {TRUST_INFO[trust].label}
      {source && <span className="font-semibold opacity-70">· {source}</span>}
    </span>
  );
}

const sourceShort = (f: Pick<Food, 'source'>) => (f.source === 'usda' ? 'USDA' : f.source === 'off' ? 'Open Food Facts' : undefined);

export function MacroLine({ n, className = '' }: { n: Nutrients; className?: string }) {
  return (
    <span className={`tabular ${className}`}>
      <b style={{ color: MACRO_COLOR.protein }}>P</b> {fmtG(n.protein)} · <b style={{ color: MACRO_COLOR.carbs }}>C</b> {fmtG(n.carbs)} · <b style={{ color: MACRO_COLOR.fat }}>F</b> {fmtG(n.fat)}
    </span>
  );
}

/* ---------------------------------- Sheet --------------------------------- */

type View = 'search' | 'amount' | 'quick' | 'create' | 'scan';

export function defaultMeal(): Meal {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

export function AddFoodSheet({ open, onClose, date, meal: initialMeal, editing }: { open: boolean; onClose: () => void; date: string; meal: Meal; editing?: FoodEntry | null }) {
  const [view, setView] = useState<View>('search');
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [food, setFood] = useState<Food | null>(null);
  const [barcode, setBarcode] = useState('');

  useEffect(() => {
    if (!open) return;
    setMeal(editing?.meal ?? initialMeal);
    setBarcode('');
    if (editing) {
      const fromEntry = editing.per100 ? foodFromEntry(editing) : null;
      setFood(fromEntry);
      setView(editing.per100 ? 'amount' : 'quick');
      // Offer the food's other portions too, but keep the per-100 g values the entry was logged with.
      if (fromEntry && editing.foodId)
        void db.foods.get(editing.foodId).then((lib) => {
          if (!lib) return;
          const portions = [...lib.portions];
          if (editing.portion && !portions.some((p) => p.label === editing.portion!.label)) portions.unshift({ label: editing.portion.label, grams: editing.portion.grams });
          setFood({ ...fromEntry, portions });
        });
    } else {
      setFood(null);
      setView('search');
    }
  }, [open, editing, initialMeal]);

  const pick = (f: Food) => {
    setFood(f);
    setView('amount');
  };

  const title = editing ? 'Edit food' : view === 'quick' ? 'Quick add' : view === 'create' ? 'New food' : view === 'scan' ? 'Scan barcode' : view === 'amount' ? 'How much?' : `Add to ${MEAL_LABEL[meal].toLowerCase()}`;
  const back = !editing && view !== 'search' ? () => setView('search') : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-1">
          {back && (
            <button className="icon-btn -ml-2" onClick={back} aria-label="Back to search">
              <ArrowLeft size={18} />
            </button>
          )}
          {title}
        </span>
      }
    >
      {view === 'search' && <SearchView onPick={pick} onQuick={() => setView('quick')} onCreate={() => setView('create')} onScan={() => setView('scan')} />}
      {view === 'amount' && food && <AmountView key={editing ? `${food.id}:${food.portions.length}` : food.id} food={food} date={date} meal={meal} setMeal={setMeal} editing={editing} onDone={onClose} onFoodChange={setFood} />}
      {view === 'quick' && <QuickView date={date} meal={meal} setMeal={setMeal} editing={editing} onDone={onClose} />}
      {view === 'create' && <CreateView barcode={barcode} onCreated={pick} />}
      {view === 'scan' && (
        <ScanView
          onFound={pick}
          onMissing={(code) => {
            setBarcode(code);
            setView('create');
          }}
        />
      )}
    </Modal>
  );
}

function foodFromEntry(e: FoodEntry): Food {
  return {
    id: e.foodId ?? `entry-${e.id}`,
    name: e.name,
    brand: e.brand,
    source: e.source === 'quick' ? 'custom' : e.source,
    sourceId: null,
    sourceNote: '',
    trust: e.trust,
    per100: e.per100!,
    portions: e.portion ? [{ label: e.portion.label, grams: e.portion.grams }] : [],
    barcode: null,
    favorite: false,
    archived: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

/* --------------------------------- Search --------------------------------- */

function useUsda() {
  const [state, setState] = useState<{ foods: UsdaFood[] | null; error: string | null }>({ foods: null, error: null });
  useEffect(() => {
    let live = true;
    loadUsda()
      .then((foods) => live && setState({ foods, error: null }))
      .catch((e) => live && setState({ foods: null, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

function SearchView({ onPick, onQuick, onCreate, onScan }: { onPick: (f: Food) => void; onQuick: () => void; onCreate: () => void; onScan: () => void }) {
  const [q, setQ] = useState('');
  const usda = useUsda();
  const library = useLiveQuery(() => db.foods.toArray(), []);
  const recentIds = useLiveQuery(async () => {
    const latest = await db.foodlog.orderBy('updatedAt').reverse().limit(300).toArray();
    return [...new Set(latest.map((e) => e.foodId).filter(Boolean) as string[])].slice(0, 15);
  }, []);
  const [off, setOff] = useState<{ q: string; loading: boolean; foods: Food[]; error: string | null } | null>(null);

  const query = q.trim();
  const lib = useMemo(() => (library ?? []).filter((f) => !f.archived), [library]);
  const mine = useMemo(() => (query ? searchFoods(lib, query, 15) : []), [lib, query]);
  const usdaHits = useMemo(() => {
    if (!query || !usda.foods) return [];
    const have = new Set(mine.map((f) => f.id));
    return searchFoods(usda.foods, query, 30).filter((f) => !have.has(f.id));
  }, [usda.foods, query, mine]);

  const favorites = lib.filter((f) => f.favorite);
  const byId = new Map(lib.map((f) => [f.id, f]));
  const recent = (recentIds ?? []).map((id) => byId.get(id)).filter((f): f is Food => !!f && !f.favorite);

  const runOff = async () => {
    setOff({ q: query, loading: true, foods: [], error: null });
    try {
      const foods = await offSearch(query, { base: apiBase(), token: getAuth()?.token ?? '' });
      setOff({ q: query, loading: false, foods, error: foods.length ? null : 'No products with nutrition data found.' });
    } catch (e) {
      setOff({ q: query, loading: false, foods: [], error: e instanceof FoodLookupError ? e.message : 'Search failed' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input className="input !pl-9 text-base" placeholder="Search foods, e.g. chicken breast, rice, egg" value={q} onChange={(e) => setQ(e.target.value)} data-autofocus aria-label="Search foods" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <ActionTile icon={<Barcode size={18} />} label="Scan barcode" onClick={onScan} />
        <ActionTile icon={<Zap size={18} />} label="Quick add" onClick={onQuick} />
        <ActionTile icon={<PenLine size={18} />} label="New food" onClick={onCreate} />
      </div>

      {!query ? (
        <>
          {favorites.length > 0 && <FoodList title="Favourites" foods={favorites} onPick={onPick} />}
          {recent.length > 0 && <FoodList title="Recent" foods={recent} onPick={onPick} />}
          {!favorites.length && !recent.length && (
            <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
              Search {usda.foods ? usda.foods.length.toLocaleString() : 'thousands of'} verified USDA foods (works offline), scan a barcode, or add your own food.
            </p>
          )}
        </>
      ) : (
        <>
          {mine.length > 0 && <FoodList title="Your foods" foods={mine} onPick={onPick} />}
          {usda.error ? (
            <p className="text-sm text-red-600">{usda.error}</p>
          ) : !usda.foods ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 size={15} className="animate-spin" /> Loading USDA foods…
            </div>
          ) : (
            <FoodList title="USDA · lab-verified" foods={usdaHits} onPick={onPick} empty={`No USDA food matches "${query}". Try fewer or more general words.`} />
          )}
          <section>
            <h3 className="eyebrow mb-2 px-1">Open Food Facts · packaged products</h3>
            {off?.q === query && !off.loading ? (
              off.error ? (
                <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">{off.error}</p>
              ) : (
                <FoodList foods={off.foods} onPick={onPick} />
              )
            ) : (
              <button className="btn-secondary w-full !py-2.5 text-sm" onClick={runOff} disabled={off?.loading || query.length < 2}>
                {off?.loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Search Open Food Facts for “{query}”
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ActionTile({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card card-hover flex flex-col items-center gap-1.5 p-3 text-xs font-bold">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">{icon}</span>
      {label}
    </button>
  );
}

function FoodList({ title, foods, onPick, empty }: { title?: string; foods: Food[]; onPick: (f: Food) => void; empty?: string }) {
  return (
    <section>
      {title && <h3 className="eyebrow mb-2 px-1">{title}</h3>}
      {foods.length === 0 ? (
        empty && <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/70 dark:divide-white/[0.05] dark:border-white/[0.07]">
          {foods.map((f) => (
            <li key={f.id}>
              <button onClick={() => onPick(f)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-zinc-900/[0.03] dark:hover:bg-white/[0.04]">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">
                    {f.favorite && <Star size={12} className="mr-1 inline fill-amber-400 text-amber-400" />}
                    {f.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <TrustBadge trust={f.trust} source={sourceShort(f)} />
                    {f.trust !== 'verified' && nutritionWarning(f.per100) && (
                      <span className="inline-flex items-center gap-0.5 font-bold text-red-600 dark:text-red-400" title={nutritionWarning(f.per100) ?? ''}>
                        <AlertTriangle size={11} /> Numbers look off
                      </span>
                    )}
                    {f.brand && <span className="truncate">{f.brand}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="block text-sm font-bold text-zinc-900 tabular dark:text-zinc-100">{fmtKcal(f.per100.kcal)}</span>
                  kcal/100 g
                  <span className="block">P {fmtG(f.per100.protein)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------- Amount --------------------------------- */

function MealPicker({ meal, setMeal }: { meal: Meal; setMeal: (m: Meal) => void }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
      {MEALS.map((m) => (
        <button key={m} className={meal === m ? 'chip-on' : 'chip-off'} onClick={() => setMeal(m)}>
          {MEAL_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

function AmountView({ food, date, meal, setMeal, editing, onDone, onFoodChange }: { food: Food; date: string; meal: Meal; setMeal: (m: Meal) => void; editing?: FoodEntry | null; onDone: () => void; onFoodChange: (f: Food) => void }) {
  const toast = useToast();
  const saved = useLiveQuery(() => db.foods.get(food.id), [food.id]);
  // Portion index: -1 = grams.
  const [portionIdx, setPortionIdx] = useState(() => {
    if (editing?.portion) return food.portions.findIndex((p) => p.label === editing.portion!.label);
    return editing ? -1 : food.portions.length ? 0 : -1;
  });
  const [amount, setAmount] = useState<number | null>(() => (editing ? (editing.portion ? editing.portion.count : editing.grams) : food.portions.length ? 1 : 100));
  const [busy, setBusy] = useState(false);

  // Search results from Open Food Facts don't say whether a moderator checked the product; the product page does.
  useEffect(() => {
    if (food.source !== 'off' || !food.barcode || editing) return;
    let live = true;
    offByBarcode(food.barcode)
      .then((full) => live && full && onFoodChange({ ...full, favorite: food.favorite }))
      .catch(() => {});
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.id]);

  const portion = portionIdx >= 0 ? food.portions[portionIdx] : null;
  const grams = amount == null ? 0 : portion ? amount * portion.grams : amount;
  const n = scale(food.per100, grams);

  const choosePortion = (i: number) => {
    setPortionIdx(i);
    setAmount(i < 0 ? Math.round(grams) || 100 : 1);
  };

  const save = async () => {
    if (!grams || busy) return;
    setBusy(true);
    try {
      // Editing keeps the values the entry was logged with; only a new entry refreshes the library copy.
      const stored = editing ? food : await saveFoodToLibrary(saved ? { ...food, favorite: saved.favorite } : food);
      const values = { meal, ...entryFromFood(stored, grams, portion ? { label: portion.label, grams: portion.grams, count: amount ?? 0 } : null) };
      if (editing) values.foodId = editing.foodId;
      if (editing) await updateFoodEntry(editing.id, values);
      else await addFoodEntry(date, values);
      toast(editing ? 'Saved' : `Added to ${MEAL_LABEL[meal].toLowerCase()}`, { tone: 'success' });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async () => {
    const stored = saved ?? (await saveFoodToLibrary(food));
    await db.foods.update(stored.id, { favorite: !stored.favorite, updatedAt: Date.now() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold leading-snug">{food.name}</div>
          {food.brand && <div className="text-xs text-zinc-500 dark:text-zinc-400">{food.brand}</div>}
        </div>
        {!food.id.startsWith('entry-') && (
          <button className="icon-btn -mr-1" onClick={toggleFavorite} aria-label={saved?.favorite ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={!!saved?.favorite}>
            <Star size={18} className={saved?.favorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'} />
          </button>
        )}
      </div>
      <TrustNote food={food} />

      <div>
        <span className="label">Amount</span>
        <div className="flex flex-wrap gap-1.5">
          <button className={portionIdx < 0 ? 'chip-on !normal-case' : 'chip-off !normal-case'} onClick={() => choosePortion(-1)}>
            grams
          </button>
          {food.portions.map((p, i) => (
            <button key={i} className={portionIdx === i ? 'chip-on !normal-case' : 'chip-off !normal-case'} onClick={() => choosePortion(i)}>
              {p.label} <span className="opacity-60">· {trimNumber(p.grams, 1)} g</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <NumberField className="input w-32 text-lg font-bold tabular" value={amount} onChange={setAmount} decimals={portion ? 2 : 1} max={portion ? 100 : 5000} aria-label={portion ? 'Number of portions' : 'Grams'} />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{portion ? `× ${portion.label} = ${Math.round(grams)} g` : 'g'}</span>
        </div>
      </div>

      <div>
        <span className="label">Meal</span>
        <MealPicker meal={meal} setMeal={setMeal} />
      </div>

      <NutrientPreview n={n} />

      <button className="btn-primary w-full !py-3" onClick={save} disabled={!grams || busy}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {editing ? 'Save' : `Add ${fmtKcal(n.kcal)} kcal`}
      </button>
    </div>
  );
}

function TrustNote({ food }: { food: Food }) {
  const info = TRUST_INFO[food.trust];
  // USDA values are lab-measured; alcohol and fibre legitimately break the 4/4/9 rule there.
  const warning = food.trust === 'verified' ? null : nutritionWarning(food.per100);
  return (
    <>
    {warning && (
      <div className="flex items-start gap-2 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-700 dark:text-red-300">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          <b>These numbers look wrong.</b> {warning} Check the package label, or pick a different result.
        </span>
      </div>
    )}
    <div className="flex items-start gap-2 rounded-xl bg-zinc-900/[0.03] p-2.5 text-xs text-zinc-600 dark:bg-white/[0.04] dark:text-zinc-300">
      <TrustBadge trust={food.trust} />
      <span>
        {info.desc}
        {food.source === 'custom' && food.sourceNote && <> Source: {food.sourceNote}.</>}
        {food.source === 'usda' && food.sourceId && <> FDC #{food.sourceId}.</>}
        {food.source === 'off' && food.barcode && <> Barcode {food.barcode}.</>}
      </span>
    </div>
    </>
  );
}

function NutrientPreview({ n }: { n: Nutrients }) {
  const cells: [string, string, string][] = [
    ['Calories', fmtKcal(n.kcal), MACRO_COLOR.kcal],
    ['Protein', `${fmtG(n.protein)} g`, MACRO_COLOR.protein],
    ['Carbs', `${fmtG(n.carbs)} g`, MACRO_COLOR.carbs],
    ['Fat', `${fmtG(n.fat)} g`, MACRO_COLOR.fat],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map(([label, value, color]) => (
        <div key={label} className="rounded-xl bg-zinc-900/[0.03] p-2 text-center dark:bg-white/[0.04]">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color }}>
            {label}
          </div>
          <div className="mt-0.5 text-base font-extrabold tabular">{value}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- Quick --------------------------------- */

function QuickView({ date, meal, setMeal, editing, onDone }: { date: string; meal: Meal; setMeal: (m: Meal) => void; editing?: FoodEntry | null; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(editing?.name ?? '');
  const [v, setV] = useState<Record<'kcal' | 'protein' | 'carbs' | 'fat', number | null>>({
    kcal: editing?.nutrients.kcal ?? null,
    protein: editing?.nutrients.protein ?? null,
    carbs: editing?.nutrients.carbs ?? null,
    fat: editing?.nutrients.fat ?? null,
  });
  const kcal = v.kcal ?? (v.protein ?? 0) * 4 + (v.carbs ?? 0) * 4 + (v.fat ?? 0) * 9;
  const ok = kcal > 0;

  const save = async () => {
    if (!ok) return;
    const values = {
      meal,
      foodId: null,
      name: name.trim() || 'Quick add',
      brand: '',
      source: 'quick' as const,
      trust: 'yours' as const,
      per100: null,
      grams: null,
      portion: null,
      nutrients: { kcal, protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0, fiber: null },
    };
    if (editing) await updateFoodEntry(editing.id, values);
    else await addFoodEntry(date, values);
    toast(editing ? 'Saved' : `Added to ${MEAL_LABEL[meal].toLowerCase()}`, { tone: 'success' });
    onDone();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Type the totals when you already know them, e.g. from a restaurant app. Calories are worked out from the macros if you leave them empty.</p>
      <label className="block">
        <span className="label">Name (optional)</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jollibee Chickenjoy meal" />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <label key={k} className="block">
            <span className="label">{k === 'kcal' ? 'Calories' : `${k} (g)`}</span>
            <NumberField className="input tabular" value={v[k]} onChange={(x) => setV((s) => ({ ...s, [k]: x }))} decimals={1} max={k === 'kcal' ? 10000 : 1000} placeholder={k === 'kcal' && kcal ? String(Math.round(kcal)) : '0'} />
          </label>
        ))}
      </div>
      <div>
        <span className="label">Meal</span>
        <MealPicker meal={meal} setMeal={setMeal} />
      </div>
      <button className="btn-primary w-full !py-3" onClick={save} disabled={!ok}>
        <Plus size={16} /> {editing ? 'Save' : `Add ${fmtKcal(kcal)} kcal`}
      </button>
    </div>
  );
}

/* --------------------------------- Create --------------------------------- */

function CreateView({ barcode, onCreated }: { barcode: string; onCreated: (f: Food) => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [code, setCode] = useState(barcode);
  const [basis, setBasis] = useState<'100g' | 'serving'>(barcode ? 'serving' : '100g');
  const [servingLabel, setServingLabel] = useState('1 serving');
  const [servingGrams, setServingGrams] = useState<number | null>(null);
  const [v, setV] = useState<Record<'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber', number | null>>({ kcal: null, protein: null, carbs: null, fat: null, fiber: null });

  const factor = basis === '100g' ? 1 : servingGrams ? 100 / servingGrams : 0;
  const fromMacros = (v.protein ?? 0) * 4 + (v.carbs ?? 0) * 4 + (v.fat ?? 0) * 9;
  const mismatch = v.kcal != null && fromMacros > 0 && Math.abs(v.kcal - fromMacros) / Math.max(v.kcal, fromMacros) > 0.2;
  const ok = name.trim() && v.kcal != null && factor > 0;

  const save = async () => {
    if (!ok) return;
    const per100: Nutrients = {
      kcal: Math.round((v.kcal ?? 0) * factor),
      protein: Number(((v.protein ?? 0) * factor).toFixed(2)),
      carbs: Number(((v.carbs ?? 0) * factor).toFixed(2)),
      fat: Number(((v.fat ?? 0) * factor).toFixed(2)),
      fiber: v.fiber == null ? null : Number((v.fiber * factor).toFixed(2)),
    };
    const food = await createCustomFood({
      name: name.trim(),
      brand: brand.trim(),
      sourceNote: sourceNote.trim(),
      per100,
      portions: basis === 'serving' && servingGrams ? [{ label: servingLabel.trim() || '1 serving', grams: servingGrams }] : [],
      barcode: code.replace(/\D/g, '') || null,
    });
    onCreated(food);
  };

  return (
    <div className="space-y-4">
      {barcode && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Barcode {barcode} isn't on Open Food Facts. Copy the numbers from the package label and it will be found next time you scan it.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken adobo (homemade)" data-autofocus />
        </label>
        <label className="block">
          <span className="label">Brand (optional)</span>
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Where the numbers are from</span>
          <input className="input" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="Package label, PhilFCT (FNRI), recipe…" />
        </label>
        <label className="block">
          <span className="label">Barcode (optional)</span>
          <input className="input tabular" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label !mb-0">Values are</span>
        <Segmented ariaLabel="Values per" size="sm" value={basis} onChange={setBasis} options={[{ value: '100g', label: 'per 100 g' }, { value: 'serving', label: 'per serving' }]} />
      </div>
      {basis === 'serving' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Serving name</span>
            <input className="input" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Serving weight (g)</span>
            <NumberField className="input tabular" value={servingGrams} onChange={setServingGrams} decimals={1} max={5000} placeholder="e.g. 30" />
          </label>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {(['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const).map((k) => (
          <label key={k} className="block">
            <span className="label truncate">{k === 'kcal' ? 'Calories' : `${k} g`}</span>
            <NumberField className="input tabular" value={v[k]} onChange={(x) => setV((s) => ({ ...s, [k]: x }))} decimals={2} max={k === 'kcal' ? 10000 : 1000} placeholder={k === 'fiber' ? 'opt.' : '0'} />
          </label>
        ))}
      </div>
      {mismatch && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Calories don't match the macros (protein and carbs × 4 + fat × 9 = {Math.round(fromMacros)} kcal). Double-check the label.
        </p>
      )}
      <button className="btn-primary w-full !py-3" onClick={save} disabled={!ok}>
        Save food
      </button>
    </div>
  );
}

/* ---------------------------------- Scan ---------------------------------- */

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => Detector;
  }
}

function ScanView({ onFound, onMissing }: { onFound: (f: Food) => void; onMissing: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const [camera, setCamera] = useState<'off' | 'on' | 'unsupported' | 'denied'>(() => (typeof window !== 'undefined' && window.BarcodeDetector && !!navigator.mediaDevices ? 'off' : 'unsupported'));
  const busyRef = useRef(false);

  const lookup = async (raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (clean.length < 6 || busyRef.current) return;
    busyRef.current = true;
    setCode(clean);
    setStatus({ busy: true, error: null });
    try {
      const mine = await db.foods.where('barcode').equals(clean).first();
      if (mine) return onFound(mine);
      const found = await offByBarcode(clean);
      if (found) return onFound(found);
      onMissing(clean);
    } catch (e) {
      setStatus({ busy: false, error: e instanceof FoodLookupError ? e.message : 'Lookup failed' });
    } finally {
      busyRef.current = false;
    }
  };

  useEffect(() => {
    if (camera !== 'on') return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new window.BarcodeDetector!({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        timer = setInterval(async () => {
          if (!video.current || busyRef.current) return;
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0]?.rawValue) {
            navigator.vibrate?.(60);
            void lookup(codes[0].rawValue);
          }
        }, 350);
      } catch {
        setCamera('denied');
      }
    })();
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  return (
    <div className="space-y-4">
      {camera === 'on' ? (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
        </div>
      ) : camera === 'off' ? (
        <button className="btn-primary w-full !py-3" onClick={() => setCamera('on')}>
          <Camera size={16} /> Start camera
        </button>
      ) : (
        <p className="rounded-xl bg-zinc-900/[0.03] p-3 text-xs text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
          {camera === 'denied' ? 'Camera access was blocked. Allow it in the browser settings, or type the barcode below.' : "This browser can't scan barcodes with the camera (Chrome on Android can). Type the number under the barcode instead."}
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
      >
        <input className="input flex-1 tabular" inputMode="numeric" placeholder="Barcode number, e.g. 4800016644108" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Barcode number" />
        <button className="btn-secondary" type="submit" disabled={status.busy || code.replace(/\D/g, '').length < 6}>
          {status.busy ? <Loader2 size={15} className="animate-spin" /> : 'Look up'}
        </button>
      </form>
      {status.error && <p className="text-sm text-red-600 dark:text-red-400">{status.error}</p>}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Checks your own foods first, then Open Food Facts. If the product isn't there you can add it from the label.</p>
    </div>
  );
}
