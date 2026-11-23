import { useState } from 'react';
import { useConfirm } from '../context/Confirm';
import { logOut } from '../lib/auth';
import { getSyncStatus } from '../lib/sync';

/**
 * Log out with confirmation. Uploads pending changes first; if that fails, asks again before
 * logging out anyway (which loses changes made on this device since the last sync).
 */
export function useLogout() {
  const confirm = useConfirm();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    const ok = await confirm({ title: 'Log out?', message: 'Your data stays in your account. It will be removed from this device until you log in again.', confirmLabel: 'Log out' });
    if (!ok) return;
    setLeaving(true);
    if (await logOut()) return;
    setLeaving(false);
    const force = await confirm({
      title: "Couldn't sync",
      message: `${getSyncStatus().error ?? 'The server could not be reached'}. Changes made on this device since the last sync will be lost if you log out now.`,
      confirmLabel: 'Log out anyway',
      danger: true,
    });
    if (force) {
      setLeaving(true);
      await logOut({ force: true });
    }
  };

  return { leave, leaving };
}
