import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { useToast } from '../context/Toast';
import { prepareAvatar } from '../lib/profile';

/** Profile picture with "change" and "remove". The photo is cropped and shrunk on this device before upload. */
export function AvatarPicker({ name, avatarKey, onUpload, onRemove, size = 'xl' }: { name: string; avatarKey: string | null | undefined; onUpload: (dataUrl: string) => Promise<unknown>; onRemove: () => Promise<unknown>; size?: 'lg' | 'xl' }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'up' | 'rm' | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy('up');
    try {
      const data = await prepareAvatar(file);
      setPreview(data);
      await onUpload(data);
      toast('Profile picture updated', { tone: 'success' });
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
      await onRemove();
      toast('Profile picture removed', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button type="button" className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-500" onClick={() => input.current?.click()} disabled={!!busy} aria-label="Change profile picture">
        <UserAvatar name={name} avatarKey={avatarKey} src={preview} size={size} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
          {busy === 'up' ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
        </span>
        {busy === 'up' && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white">
            <Loader2 size={20} className="animate-spin" />
          </span>
        )}
      </button>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => input.current?.click()} disabled={!!busy}>
            <Camera size={14} /> {avatarKey ? 'Change photo' : 'Add photo'}
          </button>
          {avatarKey && (
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={remove} disabled={!!busy}>
              {busy === 'rm' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remove
            </button>
          )}
        </div>
        <p className="text-[11px] text-steel-mute dark:text-floor-mute">JPEG, PNG or WebP. Cropped to a square.</p>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
