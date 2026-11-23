/* Account actions shared by the users table and the user drawer, with their confirmations. */
import { useState, type FormEvent } from 'react';
import { Ban, CircleOff, KeyRound, Loader2, LogOut, ShieldCheck, ShieldMinus, ShieldPlus, UserCheck } from 'lucide-react';
import { Modal } from '../../components/ui';
import type { MenuItem } from '../../components/Menu';
import { useToast } from '../../context/Toast';
import { useConfirm } from '../../context/Confirm';
import { resetPassword, setRole, setStatus, signOutUser, STATUS_LABEL, type AdminUser } from '../../lib/admin';
import { Badge } from './kit';
import type { AccountStatus } from '../../lib/community';

const who = (u: AdminUser) => u.name || u.email;

export function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge dot tone={status === 'active' ? 'green' : status === 'blocked' ? 'red' : 'amber'}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function RoleBadge({ user }: { user: AdminUser }) {
  if (user.role === 'admin') return <Badge tone="volt" title={user.adminSource === 'env' ? 'Admin from ADMIN_EMAILS on the server' : undefined}>Admin{user.adminSource === 'env' ? ' · env' : ''}</Badge>;
  if (user.owned > 0) return <Badge tone="blue">Gym owner</Badge>;
  return <Badge>User</Badge>;
}

export function useUserActions(meId: number | undefined, onChanged: (u: AdminUser | null) => void) {
  const toast = useToast();
  const confirm = useConfirm();
  const [pwFor, setPwFor] = useState<AdminUser | null>(null);

  const run = async (fn: () => Promise<AdminUser | null>, done: string) => {
    try {
      onChanged(await fn());
      toast(done, { tone: 'success' });
    } catch (e) {
      toast((e as Error).message, { tone: 'error', duration: 6000 });
    }
  };

  const status = async (u: AdminUser, next: AccountStatus) => {
    if (next !== 'active') {
      const ok = await confirm({
        title: next === 'blocked' ? `Block ${who(u)}?` : `Deactivate ${who(u)}?`,
        message:
          next === 'blocked'
            ? "They're signed out on every device and can't sign in again. Their data is kept. Use this for abuse; you can unblock later."
            : "They're signed out on every device and can't sign in until you reactivate the account. Their data is kept.",
        confirmLabel: next === 'blocked' ? 'Block account' : 'Deactivate',
        danger: true,
      });
      if (!ok) return;
    }
    await run(() => setStatus(u.id, next), next === 'active' ? 'Account activated' : next === 'blocked' ? 'Account blocked' : 'Account deactivated');
  };

  const role = async (u: AdminUser, next: 'admin' | 'user') => {
    const ok = await confirm(
      next === 'admin'
        ? { title: `Make ${who(u)} an admin?`, message: 'Admins can manage every account and community, including other admins.', confirmLabel: 'Promote to admin' }
        : { title: `Remove admin from ${who(u)}?`, message: "They become a regular user and are signed out of the admin panel. Their app login isn't affected.", confirmLabel: 'Demote', danger: true },
    );
    if (!ok) return;
    await run(() => setRole(u.id, next), next === 'admin' ? 'Promoted to admin' : 'Admin access removed');
  };

  const signOutAll = async (u: AdminUser) => {
    const ok = await confirm({ title: `Sign ${who(u)} out everywhere?`, message: 'Every device has to sign in again. Unsynced changes on their devices are kept on the device until they do.', confirmLabel: 'Sign out everywhere' });
    if (!ok) return;
    try {
      const r = await signOutUser(u.id);
      toast(`Signed out of ${r.signedOut} device${r.signedOut === 1 ? '' : 's'}`, { tone: 'success' });
      onChanged(null);
    } catch (e) {
      toast((e as Error).message, { tone: 'error' });
    }
  };

  /** Menu entries for a user, in the order an admin usually needs them. */
  const menu = (u: AdminUser, extra: MenuItem[] = []): MenuItem[] => {
    const self = u.id === meId;
    const items: MenuItem[] = [...extra];
    if (self) return items;
    if (u.role === 'admin') {
      items.push({ label: u.adminSource === 'env' ? 'Demote (set in ADMIN_EMAILS)' : 'Demote to user', icon: <ShieldMinus size={16} />, disabled: u.adminSource === 'env', onSelect: () => role(u, 'user') });
    } else items.push({ label: 'Promote to admin', icon: <ShieldPlus size={16} />, onSelect: () => role(u, 'admin') });
    if (u.status !== 'active') items.push({ label: u.status === 'blocked' ? 'Unblock' : 'Reactivate', icon: <UserCheck size={16} />, onSelect: () => status(u, 'active') });
    if (u.status !== 'inactive') items.push({ label: 'Deactivate', icon: <CircleOff size={16} />, onSelect: () => status(u, 'inactive') });
    items.push({ label: 'Reset password', icon: <KeyRound size={16} />, onSelect: () => setPwFor(u) });
    items.push({ label: 'Sign out everywhere', icon: <LogOut size={16} />, disabled: u.devices === 0, onSelect: () => signOutAll(u) });
    if (u.status !== 'blocked') items.push({ label: 'Block account', icon: <Ban size={16} />, danger: true, onSelect: () => status(u, 'blocked') });
    return items;
  };

  const modal = <ResetPasswordModal user={pwFor} onClose={() => setPwFor(null)} onDone={() => onChanged(null)} />;
  return { status, role, signOutAll, resetPassword: setPwFor, menu, modal };
}

function ResetPasswordModal({ user, onClose, onDone }: { user: AdminUser | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const generate = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    setPw(Array.from(bytes, (b) => chars[b % chars.length]).join(''));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await resetPassword(user.id, pw);
      toast('Password changed. They were signed out everywhere.', { tone: 'success' });
      setPw('');
      onDone();
      onClose();
    } catch (err) {
      toast((err as Error).message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!user} onClose={onClose} title={user ? `Reset password · ${who(user)}` : ''} size="sm">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-steel-mute dark:text-floor-mute">Sets a new password and signs them out of every device. Share it with them privately.</p>
        <label className="block">
          <span className="label">New password</span>
          <div className="flex gap-2">
            <input className="input flex-1 font-mono" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} maxLength={200} required autoComplete="new-password" />
            <button type="button" className="btn-secondary" onClick={generate}>
              Generate
            </button>
          </div>
        </label>
        <button className="btn-primary w-full" disabled={busy || pw.length < 8}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Set password
        </button>
      </form>
    </Modal>
  );
}
