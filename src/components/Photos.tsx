import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, differenceInCalendarDays } from 'date-fns';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { db } from '../db';
import { savePhoto } from '../lib/photos';
import { fromKey } from '../lib/date';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { useToast } from '../context/Toast';
import { useSettings } from '../hooks/data';
import { kgToUnit, trimNumber } from '../lib/units';
import { DeltaChip, useWeightByDate } from './BodyWeight';
import type { Photo, Unit } from '../types';

/** Hidden file input + trigger. Lets the phone offer camera or gallery. */
function usePhotoPicker(date: string) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const el = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        try {
          await savePhoto(date, file);
          toast('Photo saved', { tone: 'success' });
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Could not save photo', { tone: 'error' });
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  return { open: () => input.current?.click(), el, busy };
}

export function PhotoImg({ photo, full, className = '', alt }: { photo: Photo; full?: boolean; className?: string; alt: string }) {
  const url = useObjectUrl(full ? photo.data : photo.thumb, photo.type);
  return url ? <img src={url} alt={alt} className={className} draggable={false} /> : <div className={`${className} animate-pulse bg-zinc-200 dark:bg-zinc-800`} />;
}

/** Progress photo for one day, shown on the day page. */
export function DayPhotoCard({ date }: { date: string }) {
  const photo = useLiveQuery(() => db.photos.get(date), [date]);
  const picker = usePhotoPicker(date);
  const toast = useToast();
  const [viewing, setViewing] = useState(false);

  if (photo === undefined && !picker.busy) {
    return (
      <>
        {picker.el}
        <button
          onClick={picker.open}
          className="group flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-zinc-300/80 p-3 text-left transition hover:border-volt-600 hover:bg-volt-500/10 dark:border-white/10 dark:hover:border-volt-600/50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-steel/[0.06] text-zinc-500 transition group-hover:bg-volt-500/150 group-hover:text-white dark:bg-white/[0.06] dark:text-zinc-400">
            <Camera size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Add a progress photo</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">One per day. Private — stays on this device.</span>
          </span>
          <ImagePlus size={18} className="text-zinc-400" />
        </button>
      </>
    );
  }

  const remove = async () => {
    if (!photo) return;
    await db.photos.delete(date);
    toast('Photo removed', { action: { label: 'Undo', onClick: () => void db.photos.put(photo) } });
  };

  return (
    <>
      {picker.el}
      <div className="card flex items-center gap-3 p-2.5">
        <button className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800" onClick={() => photo && setViewing(true)} aria-label="View photo full screen">
          {photo ? <PhotoImg photo={photo} alt={`Progress photo ${date}`} className="h-full w-full object-cover" /> : <Loader2 className="m-auto mt-7 animate-spin text-zinc-400" size={18} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Progress photo</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">{picker.busy ? 'Saving…' : 'Tap to view full screen'}</div>
          <div className="mt-2 flex gap-1.5">
            <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={picker.open} disabled={picker.busy}>
              <RefreshCw size={13} /> Replace
            </button>
            <button className="btn-ghost !px-2.5 !py-1.5 text-xs !text-red-600 dark:!text-red-400" onClick={remove} disabled={!photo}>
              <Trash2 size={13} /> Remove
            </button>
          </div>
        </div>
      </div>
      {viewing && photo && <PhotoViewer dates={[date]} index={0} onClose={() => setViewing(false)} />}
    </>
  );
}

function useEscape(onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ref.current();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);
}

/** Body weight shown on top of a photo, bottom-left. */
function WeightBadge({ kg, unit, small, children }: { kg: number; unit: Unit; small?: boolean; children?: ReactNode }) {
  return (
    <div className={`pointer-events-none absolute flex flex-col items-start gap-1 ${small ? 'bottom-2 left-2' : 'bottom-3 left-3'}`}>
      <span className={`rounded-xl bg-black/60 font-extrabold text-white backdrop-blur tabular ${small ? 'px-2 py-1 text-sm' : 'px-3 py-1.5 text-2xl'}`}>
        {trimNumber(kgToUnit(kg, unit), 1)} <span className={`font-bold opacity-80 ${small ? 'text-[10px]' : 'text-sm'}`}>{unit}</span>
      </span>
      {children}
    </div>
  );
}

/** Full-screen photo viewer with swipe / arrow-key navigation. */
export function PhotoViewer({ dates, index: initial, onClose }: { dates: string[]; index: number; onClose: () => void }) {
  const [index, setIndex] = useState(initial);
  const date = dates[index];
  const photo = useLiveQuery(() => db.photos.get(date), [date]);
  const touch = useRef<number | null>(null);
  const settings = useSettings();
  const weightByDate = useWeightByDate();
  useEscape(onClose);
  const kg = weightByDate.get(date);
  // Compare against the oldest photo in this set that has a weight.
  const baseDate = [...dates].sort().find((d) => weightByDate.has(d));
  const baseKg = baseDate && baseDate !== date ? weightByDate.get(baseDate) : undefined;

  const go = (d: number) => setIndex((i) => Math.min(dates.length - 1, Math.max(0, i + d)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates.length]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold">{format(fromKey(date), 'EEEE, MMM d, yyyy')}</div>
          {dates.length > 1 && (
            <div className="text-xs text-white/60">
              {index + 1} of {dates.length}
            </div>
          )}
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" onClick={onClose} aria-label="Close" autoFocus>
          <X size={20} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6">
        <div className="relative flex max-h-full max-w-full">
          {photo ? <PhotoImg photo={photo} full alt={`Progress photo ${date}`} className="max-h-full max-w-full rounded-2xl object-contain" /> : <Loader2 className="animate-spin" />}
          {photo && kg != null && (
            <WeightBadge kg={kg} unit={settings.unit}>
              {baseKg != null && baseDate && <DeltaChip diffKg={kg - baseKg} unit={settings.unit} goal={settings.weightGoal} suffix={`since ${format(fromKey(baseDate), 'MMM d')}`} />}
            </WeightBadge>
          )}
        </div>
        {index > 0 && (
          <button className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60" onClick={() => go(-1)} aria-label="Previous photo">
            <ChevronLeft />
          </button>
        )}
        {index < dates.length - 1 && (
          <button className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur hover:bg-black/60" onClick={() => go(1)} aria-label="Next photo">
            <ChevronRight />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Two photos side by side, oldest on the left. */
export function PhotoCompare({ a, b, onClose }: { a: string; b: string; onClose: () => void }) {
  const [first, second] = a < b ? [a, b] : [b, a];
  const pa = useLiveQuery(() => db.photos.get(first), [first]);
  const pb = useLiveQuery(() => db.photos.get(second), [second]);
  const settings = useSettings();
  const weightByDate = useWeightByDate();
  useEscape(onClose);
  const days = differenceInCalendarDays(fromKey(second), fromKey(first));
  const ka = weightByDate.get(first);
  const kb = weightByDate.get(second);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex animate-fade-in flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Compare photos">
      <div className="flex items-center gap-3 px-4 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold">Before & after</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            {days} {days === 1 ? 'day' : 'days'} apart
            {ka != null && kb != null && <DeltaChip diffKg={kb - ka} unit={settings.unit} goal={settings.weightGoal} />}
          </div>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" onClick={onClose} aria-label="Close" autoFocus>
          <X size={20} />
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 px-2 pb-6">
        {[
          [first, pa],
          [second, pb],
        ].map(([d, p]) => (
          <figure key={d as string} className="flex min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="relative flex max-h-full w-full">
                {p ? <PhotoImg photo={p as Photo} full alt={`Progress photo ${d}`} className="max-h-full w-full rounded-2xl object-contain" /> : <Loader2 className="animate-spin" />}
                {p && weightByDate.has(d as string) && <WeightBadge kg={weightByDate.get(d as string)!} unit={settings.unit} small />}
              </div>
            </div>
            <figcaption className="mt-2 text-center text-sm font-semibold">{format(fromKey(d as string), 'MMM d, yyyy')}</figcaption>
          </figure>
        ))}
      </div>
    </div>,
    document.body,
  );
}
