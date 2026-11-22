import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface TimerState {
  endAt: number;
  duration: number;
}

interface RestTimerApi {
  state: TimerState | null;
  remaining: number;
  start: (seconds: number) => void;
  adjust: (deltaSeconds: number) => void;
  stop: () => void;
}

const STORAGE_KEY = 'gymbulag:rest-timer';
const Ctx = createContext<RestTimerApi | null>(null);

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as TimerState;
    return s.endAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function persist(s: TimerState | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — timer still works in memory */
  }
}

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx ??= new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

function beep() {
  const ctx = getAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [0, 0.22, 0.44].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = i === 2 ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.2);
  });
}

function notifyDone() {
  beep();
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* ignore */
  }
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Rest over', { body: 'Time for your next set 💪', icon: '/pwa-192.png', tag: 'rest-timer' });
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState | null>(load);
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);

  useEffect(() => {
    if (!state) return;
    fired.current = false;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= state.endAt && !fired.current) {
        fired.current = true;
        notifyDone();
        window.setTimeout(() => {
          setState((s) => (s === state ? null : s));
          persist(null);
        }, 2500);
      }
    };
    tick();
    const h = window.setInterval(tick, 250);
    return () => window.clearInterval(h);
  }, [state]);

  const start = useCallback((seconds: number) => {
    // Unlock audio on a user gesture so the end beep can play on iOS.
    getAudio()?.resume().catch(() => {});
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    const s = { endAt: Date.now() + seconds * 1000, duration: seconds };
    persist(s);
    setState(s);
  }, []);

  const adjust = useCallback((delta: number) => {
    setState((s) => {
      if (!s) return s;
      const endAt = Math.max(Date.now() + 1000, s.endAt + delta * 1000);
      const next = { endAt, duration: Math.max(1, s.duration + delta) };
      persist(next);
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    persist(null);
    setState(null);
  }, []);

  const remaining = state ? Math.max(0, Math.ceil((state.endAt - now) / 1000)) : 0;
  const api = useMemo(() => ({ state, remaining, start, adjust, stop }), [state, remaining, start, adjust, stop]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRestTimer(): RestTimerApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRestTimer must be used inside RestTimerProvider');
  return c;
}
