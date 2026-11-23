import { useEffect, useState } from 'react';
import { Copy, Download, Printer, RefreshCw } from 'lucide-react';
import { Modal } from '../ui';
import { useToast } from '../../context/Toast';
import { useConfirm } from '../../context/Confirm';
import { joinUrl, qrDataUrl, type Community } from '../../lib/community';

/** A community's join QR code, ready to download or print. Admins can also replace the code (old prints stop working). */
export function QrModal({ community, onClose, onRegenerate }: { community: Community | null; onClose: () => void; onRegenerate?: () => Promise<void> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = community ? joinUrl(community.joinCode) : '';

  useEffect(() => {
    setSrc(null);
    if (url) qrDataUrl(url).then(setSrc).catch(() => setSrc(null));
  }, [url]);

  const fileName = `${(community?.name ?? 'community').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qr.png`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Join link copied', { tone: 'success' });
    } catch {
      toast("Couldn't copy. Select the link and copy it instead.", { tone: 'error' });
    }
  };

  const print = () => {
    if (!src || !community) return;
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return toast('Allow pop-ups to print the QR code', { tone: 'error' });
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    w.document.write(`<!doctype html><title>${esc(community.name)} QR</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px}img{width:420px;max-width:100%}h1{margin:0 0 4px}p{color:#555;margin:4px 0}</style>
<h1>${esc(community.name)}</h1>${community.location ? `<p>${esc(community.location)}</p>` : ''}
<img src="${src}" alt=""><p><b>Scan to join on Gymbulag</b></p><p style="font-size:12px">${esc(url)}</p>
<script>window.onload=()=>{window.print()}</script>`);
    w.document.close();
  };

  const regenerate = async () => {
    if (!onRegenerate) return;
    const ok = await confirm({ title: 'Replace the QR code?', message: 'The current code stops working straight away, so printed copies must be replaced. People already in the community stay in.', confirmLabel: 'Replace', danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await onRegenerate();
      toast('New QR code ready', { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!community} onClose={onClose} title={community ? `${community.name} · Join QR` : ''} size="sm">
      {community && (
        <div className="space-y-4 text-center">
          <div className="mx-auto aspect-square w-full max-w-[18rem] overflow-hidden rounded-xl bg-white p-2 ring-1 ring-steel/10">
            {src ? <img src={src} alt={`QR code to join ${community.name}`} className="h-full w-full" /> : <div className="h-full w-full animate-pulse rounded-lg bg-zinc-100" />}
          </div>
          {!community.active && <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">This community is deactivated, so scanning this code won't add anyone until an admin reactivates it.</p>}
          <p className="break-all text-xs text-zinc-500 dark:text-zinc-400">{url}</p>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-secondary" onClick={copy}>
              <Copy size={16} /> Link
            </button>
            <a className={`btn-secondary ${src ? '' : 'pointer-events-none opacity-50'}`} href={src ?? undefined} download={fileName}>
              <Download size={16} /> PNG
            </a>
            <button className="btn-secondary" onClick={print} disabled={!src}>
              <Printer size={16} /> Print
            </button>
          </div>
          {onRegenerate && (
            <button className="btn-ghost w-full text-xs" onClick={regenerate} disabled={busy}>
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Replace code (old QR stops working)
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
