import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, Check, Loader2, Move, RotateCcw, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { apiBase } from '../../lib/api';
import { useToast } from '../../context/Toast';
import { clampView, cropRect, initialView, layout, MAX_ZOOM, MIN_ZOOM, panBy, zoomTo, type CropView } from '../../lib/coverCrop';

/** Cover photos are 3:1. */
export const COVER_RATIO = 3;

export const coverSrc = (key: string | null | undefined) => (key ? `${apiBase()}/community-covers/${encodeURIComponent(key)}` : null);

/** A community's cover photo, or a branded pattern when it has none (or it fails to load). */
export function CommunityCover({ name, coverKey, src, className = '', children }: { name: string; coverKey?: string | null; src?: string | null; className?: string; children?: ReactNode }) {
  const url = src ?? coverSrc(coverKey);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <div className={`relative overflow-hidden bg-rack ${className}`}>
      {url && !broken ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setBroken(true)} decoding="async" />
      ) : (
        <div aria-hidden className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(198,240,0,0.28),transparent_55%)]" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(135deg,#fff_0_2px,transparent_2px_14px)]" />
          <span className="absolute bottom-1 right-3 select-none font-display text-[clamp(2rem,12vw,5.5rem)] font-bold uppercase leading-none tracking-tight text-white/[0.06]">{name}</span>
        </div>
      )}
      {children}
    </div>
  );
}

function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Choose an image file'));
  if (file.size > 30 * 1024 * 1024) return Promise.reject(new Error('That image is too large'));
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve({ img: el, url });
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image. Try a JPEG or PNG."));
    };
    el.src = url;
  });
}

/** Draw the chosen part of the photo into a wide 3:1 JPEG data URL. */
function renderCover(img: HTMLImageElement, view: CropView, width = 1500): string {
  const { sx, sy, sw, sh } = cropRect(view, img.naturalWidth, img.naturalHeight, COVER_RATIO);
  const height = Math.round(width / COVER_RATIO);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Your browser can't resize images");
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

/** Drag to reposition, zoom with the slider or mouse wheel, arrow keys to nudge. */
function CoverCropper({ img, src, busy, onCancel, onSave }: { img: HTMLImageElement; src: string; busy: boolean; onCancel: () => void; onSave: (view: CropView) => void }) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<CropView>(() => initialView(iw, ih));
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);

  // Track the frame's on-screen size (it changes with the window).
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = size.w > 0 && size.h > 0;
  const pos = ready ? layout(clampView(view, iw, ih, size.w, size.h), iw, ih, size.w, size.h) : null;

  const zoomAt = (z: number, px?: number, py?: number) => ready && setView((v) => zoomTo(v, z, iw, ih, size.w, size.h, px, py));
  const pan = (dx: number, dy: number) => ready && setView((v) => panBy(v, dx, dy, iw, ih, size.w, size.h));

  // Wheel zoom needs a non-passive listener so the page doesn't scroll instead.
  useEffect(() => {
    const el = frame.current;
    if (!el || !ready) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView((v) => zoomTo(v, v.zoom * Math.exp(-e.deltaY * 0.0015), iw, ih, size.w, size.h, e.clientX - r.left, e.clientY - r.top));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ready, iw, ih, size.w, size.h]);

  return (
    <div className="space-y-3">
      <div
        ref={frame}
        tabIndex={0}
        role="application"
        aria-label="Cover photo position. Drag or use arrow keys to move, plus and minus to zoom."
        className="relative aspect-[3/1] w-full cursor-grab touch-none select-none overflow-hidden rounded-lg bg-rack outline-none ring-volt-500 focus-visible:ring-2 active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          pan(e.clientX - d.x, e.clientY - d.y);
          drag.current = { ...d, x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 10;
          const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
          if (moves[e.key]) {
            e.preventDefault();
            pan(...moves[e.key]);
          } else if (e.key === '+' || e.key === '=') zoomAt(view.zoom * 1.15);
          else if (e.key === '-') zoomAt(view.zoom / 1.15);
        }}
      >
        {pos && <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: pos.left, top: pos.top, width: pos.width, height: pos.height }} />}
        {/* Thirds guide, like a camera grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:33.333%_33.333%]" />
        <div className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[11px] font-semibold text-white">
          <Move size={12} /> Drag to reposition
        </div>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[12rem] flex-1 items-center gap-2">
          <button type="button" className="icon-btn" onClick={() => zoomAt(view.zoom / 1.25)} disabled={view.zoom <= MIN_ZOOM + 1e-6} aria-label="Zoom out">
            <ZoomOut size={18} />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            onChange={(e) => zoomAt(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-[#a8cc00]"
            aria-label="Zoom"
          />
          <button type="button" className="icon-btn" onClick={() => zoomAt(view.zoom * 1.25)} disabled={view.zoom >= MAX_ZOOM - 1e-6} aria-label="Zoom in">
            <ZoomIn size={18} />
          </button>
          <button type="button" className="btn-ghost !px-2.5 text-xs" onClick={() => setView(initialView(iw, ih))} title="Centre and fit">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => ready && onSave(clampView(view, iw, ih, size.w, size.h))} disabled={busy || !ready}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save cover
          </button>
        </div>
      </div>
    </div>
  );
}

/** Upload / replace / remove a cover photo (admin panel). A new photo opens the reposition editor first. */
export function CoverPicker({ name, coverKey, onSave }: { name: string; coverKey: string | null; onSave: (image: string | null) => Promise<unknown> }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ img: HTMLImageElement; url: string } | null>(null);
  const [busy, setBusy] = useState<'up' | 'rm' | null>(null);

  // Free the picked file's memory when the editor closes.
  useEffect(
    () => () => {
      if (editing) URL.revokeObjectURL(editing.url);
    },
    [editing],
  );

  const pick = async (file?: File) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    try {
      setEditing(await loadImage(file));
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  const save = async (view: CropView) => {
    if (!editing) return;
    setBusy('up');
    try {
      await onSave(renderCover(editing.img, view));
      toast('Cover photo updated', { tone: 'success' });
      setEditing(null);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('rm');
    try {
      await onSave(null);
      toast('Cover photo removed', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {editing ? (
        <CoverCropper img={editing.img} src={editing.url} busy={busy === 'up'} onCancel={() => setEditing(null)} onSave={(v) => void save(v)} />
      ) : (
        <>
          <CommunityCover name={name} coverKey={coverKey} className="aspect-[3/1] w-full rounded-lg" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={() => input.current?.click()} disabled={!!busy}>
              <Camera size={16} /> {coverKey ? 'Change cover' : 'Upload cover'}
            </button>
            {coverKey && (
              <button type="button" className="btn-ghost" onClick={() => void remove()} disabled={!!busy}>
                {busy === 'rm' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Remove
              </button>
            )}
            <span className="text-xs text-steel-mute dark:text-floor-mute">After choosing a photo you can drag and zoom it to frame the 3:1 banner.</span>
          </div>
        </>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
