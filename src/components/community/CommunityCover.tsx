import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { apiBase } from '../../lib/api';
import { useToast } from '../../context/Toast';

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

/** Crop a chosen photo to 3:1 (centre) and shrink it to a wide JPEG data URL. */
export async function prepareCover(file: File, width = 1500): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
  if (file.size > 30 * 1024 * 1024) throw new Error('That image is too large');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image. Try a JPEG or PNG."));
      el.src = url;
    });
    const height = Math.round(width / COVER_RATIO);
    let sw = img.naturalWidth;
    let sh = sw / COVER_RATIO;
    if (sh > img.naturalHeight) {
      sh = img.naturalHeight;
      sw = sh * COVER_RATIO;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Your browser can't resize images");
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload / replace / remove a cover photo (admin panel). */
export function CoverPicker({ name, coverKey, onSave }: { name: string; coverKey: string | null; onSave: (image: string | null) => Promise<unknown> }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'up' | 'rm' | null>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy('up');
    try {
      const data = await prepareCover(file);
      setPreview(data);
      await onSave(data);
      toast('Cover photo updated', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setPreview(null);
      setBusy(null);
      if (input.current) input.current.value = '';
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
      <CommunityCover name={name} coverKey={coverKey} src={preview} className="aspect-[3/1] w-full rounded-lg">
        {busy === 'up' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </CommunityCover>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={() => input.current?.click()} disabled={!!busy}>
          <Camera size={16} /> {coverKey ? 'Change cover' : 'Upload cover'}
        </button>
        {coverKey && (
          <button type="button" className="btn-ghost" onClick={() => void remove()} disabled={!!busy}>
            {busy === 'rm' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Remove
          </button>
        )}
        <span className="text-xs text-steel-mute dark:text-floor-mute">Wide photo, cropped to 3:1. Members see it at the top of the community.</span>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
