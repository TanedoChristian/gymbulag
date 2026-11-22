import { useCallback, useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db';
import type { Session } from '../types';

const SAVE_DELAY = 350;

export type SaveState = 'idle' | 'pending' | 'saved' | 'error';

/**
 * Holds an editable copy of a session and persists it to IndexedDB with a
 * short debounce. Pending changes are flushed on unmount and when the page is
 * hidden, so nothing is lost when switching apps on mobile.
 */
export function useSessionDraft(id: string) {
  const [draft, setDraft] = useState<Session | null | undefined>(undefined);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const draftRef = useRef<Session | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(function flush() {
    window.clearTimeout(timer.current);
    if (!dirty.current || !draftRef.current) return;
    dirty.current = false;
    const snapshot = draftRef.current;
    db.sessions
      .put(snapshot)
      .then(() => setSaveState((s) => (dirty.current ? s : 'saved')))
      .catch((err) => {
        console.error('Failed to save session', err);
        dirty.current = true;
        setSaveState('error');
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(flush, 2000);
      });
  }, []);

  useEffect(() => {
    setDraft(undefined);
    draftRef.current = null;
    let loaded = false;
    // Follow the stored session, so changes synced from another device show up.
    // Local unsaved edits always win; an older stored copy never replaces the draft.
    const sub = liveQuery(() => db.sessions.get(id)).subscribe({
      next: (s) => {
        const cur = draftRef.current;
        if (loaded && dirty.current) return;
        if (loaded && s && cur && s.updatedAt <= cur.updatedAt) return;
        loaded = true;
        draftRef.current = s ?? null;
        setDraft(s ?? null);
      },
      error: (err) => console.error('Failed to load session', err),
    });
    return () => sub.unsubscribe();
  }, [id]);

  useEffect(() => {
    const onHide = () => flush();
    const onVis = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
      flush();
    };
  }, [flush, id]);

  const update = useCallback(
    (fn: (s: Session) => Session) => {
      const prev = draftRef.current;
      if (!prev) return;
      const next = { ...fn(prev), updatedAt: Date.now() };
      draftRef.current = next;
      dirty.current = true;
      setDraft(next);
      setSaveState('pending');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY);
    },
    [flush],
  );

  /** Drop unsaved changes (used before deleting the session). */
  const discard = useCallback(() => {
    window.clearTimeout(timer.current);
    dirty.current = false;
  }, []);

  return { draft, update, flush, discard, saveState };
}
